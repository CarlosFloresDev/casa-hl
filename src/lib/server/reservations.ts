import { and, asc, desc, eq, gt, like, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import {
  inquiries,
  payments,
  reservations,
  rooms,
  type Payment,
  type Reservation,
  type ReservationExtra,
} from '../db/schema';
import type {
  ExtraKey,
  PaymentKind,
  PaymentMethod,
  ReservationSource,
  ReservationStatus,
} from '../domain/catalog';
import { formatDate, isIsoDate, todayIso } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { balanceCents, computeQuote, paymentState, type PaymentState } from '../domain/pricing';
import { DomainError } from './errors';
import { writeBatch } from './write-batch';
import { roomLabel } from './rooms';

export interface ReservationRow extends Reservation {
  code: string;
  roomNumber: string;
  roomName: string;
  paidCents: number;
  balanceCents: number;
  paymentState: PaymentState;
}

export interface ReservationDetail extends ReservationRow {
  payments: Payment[];
}

export interface ReservationInput {
  guestName: string;
  guestDocument: string;
  guestPhone: string;
  guestEmail: string;
  guests: number;
  roomId: string;
  checkIn: string;
  checkOut: string;
  discountPct: number;
  extras: ExtraKey[];
  source: ReservationSource;
  notes: string;
  inquiryId?: string | undefined;
}

export interface PaymentInput {
  amountCents: number;
  method: PaymentMethod;
  kind: PaymentKind;
  paidOn: string;
  note: string;
}

export const ACTIVE_STATUSES: ReservationStatus[] = ['confirmada', 'en_casa'];

export function reservationCode(seq: number): string {
  return `RES-${String(seq).padStart(5, '0')}`;
}

const paidSq = db
  .select({
    reservationId: payments.reservationId,
    paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.as('paid'),
  })
  .from(payments)
  .groupBy(payments.reservationId)
  .as('paid_sq');

function baseQuery() {
  return db
    .select({
      reservation: reservations,
      roomNumber: rooms.number,
      roomName: rooms.name,
      paidCents: sql<number>`coalesce(${paidSq.paid}, 0)`,
    })
    .from(reservations)
    .innerJoin(rooms, eq(rooms.id, reservations.roomId))
    .leftJoin(paidSq, eq(paidSq.reservationId, reservations.id));
}

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>['execute']>>[number];

function toRow({ reservation, roomNumber, roomName, paidCents }: BaseRow): ReservationRow {
  const paid = Number(paidCents) || 0;
  return {
    ...reservation,
    code: reservationCode(reservation.seq),
    roomNumber,
    roomName,
    paidCents: paid,
    balanceCents:
      reservation.status === 'cancelada' ? 0 : balanceCents(reservation.totalCents, paid),
    paymentState: paymentState(reservation.totalCents, paid),
  };
}

export interface ReservationFilters {
  status?: ReservationStatus | 'activas' | 'todas' | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
  roomId?: string | undefined;
}

export async function listReservations(
  filters: ReservationFilters = {},
): Promise<ReservationRow[]> {
  const where: SQL[] = [];
  if (filters.status === 'activas') {
    where.push(or(eq(reservations.status, 'confirmada'), eq(reservations.status, 'en_casa'))!);
  } else if (filters.status && filters.status !== 'todas') {
    where.push(eq(reservations.status, filters.status));
  }
  // Estadías que se cruzan con el rango [from, to)
  if (filters.from) where.push(gt(reservations.checkOut, filters.from));
  if (filters.to) where.push(lt(reservations.checkIn, filters.to));
  if (filters.roomId) where.push(eq(reservations.roomId, filters.roomId));
  if (filters.q) {
    const q = `%${filters.q.trim()}%`;
    const codeSeq = Number(filters.q.replace(/\D/g, ''));
    where.push(
      or(
        like(reservations.guestName, q),
        like(reservations.guestDocument, q),
        like(reservations.guestPhone, q),
        ...(codeSeq ? [eq(reservations.seq, codeSeq)] : []),
      )!,
    );
  }
  const rows = await baseQuery()
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(reservations.checkIn), desc(reservations.seq));
  return rows.map(toRow);
}

export async function countByStatus(): Promise<Record<ReservationStatus, number>> {
  const rows = await db
    .select({ status: reservations.status, total: sql<number>`count(*)` })
    .from(reservations)
    .groupBy(reservations.status);
  const out: Record<ReservationStatus, number> = {
    confirmada: 0,
    en_casa: 0,
    finalizada: 0,
    cancelada: 0,
  };
  for (const r of rows) out[r.status] = Number(r.total);
  return out;
}

export async function getReservation(id: string): Promise<ReservationDetail | undefined> {
  const [row] = await baseQuery().where(eq(reservations.id, id));
  if (!row) return undefined;
  const list = await db
    .select()
    .from(payments)
    .where(eq(payments.reservationId, id))
    .orderBy(asc(payments.paidOn), asc(payments.createdAt));
  return { ...toRow(row), payments: list };
}

/** Reservas activas de una habitación que se cruzan con el rango indicado. */
export async function findConflicts(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string,
): Promise<Reservation[]> {
  return db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.roomId, roomId),
        ne(reservations.status, 'cancelada'),
        lt(reservations.checkIn, checkOut),
        gt(reservations.checkOut, checkIn),
        excludeId ? ne(reservations.id, excludeId) : undefined,
      ),
    );
}

/** Ids de habitaciones ocupadas al menos una noche dentro del rango. */
export async function occupiedRoomIds(checkIn: string, checkOut: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ roomId: reservations.roomId })
    .from(reservations)
    .where(
      and(
        ne(reservations.status, 'cancelada'),
        lt(reservations.checkIn, checkOut),
        gt(reservations.checkOut, checkIn),
      ),
    );
  return new Set(rows.map((r) => r.roomId));
}

async function priceReservation(input: ReservationInput) {
  if (!isIsoDate(input.checkIn) || !isIsoDate(input.checkOut)) {
    throw new DomainError('BAD_REQUEST', 'Las fechas no son válidas.');
  }
  const room = await db.query.rooms.findFirst({ where: eq(rooms.id, input.roomId) });
  if (!room) throw new DomainError('NOT_FOUND', 'La habitación seleccionada no existe.');

  const quote = computeQuote({
    rooms: [{ id: room.id, label: roomLabel(room), priceCents: room.priceCents }],
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    discountPct: input.discountPct,
    extras: input.extras,
  });
  if (!quote)
    throw new DomainError('BAD_REQUEST', 'La fecha de salida debe ser posterior al ingreso.');
  return { room, quote };
}

async function assertAvailable(
  stay: Pick<ReservationInput, 'roomId' | 'checkIn' | 'checkOut'>,
  excludeId?: string,
) {
  const conflicts = await findConflicts(stay.roomId, stay.checkIn, stay.checkOut, excludeId);
  if (conflicts.length > 0) {
    const c = conflicts[0]!;
    throw new DomainError(
      'CONFLICT',
      `La habitación ya está reservada del ${c.checkIn} al ${c.checkOut} (${reservationCode(c.seq)} · ${c.guestName}).`,
    );
  }
}

function pricedFields(
  input: ReservationInput,
  quote: NonNullable<ReturnType<typeof computeQuote>>,
  nightlyRateCents: number,
) {
  const extras: ReservationExtra[] = quote.extraLines.map((l) => ({
    key: l.key as ExtraKey,
    label: l.label,
    amountCents: l.amountCents,
  }));
  return {
    guestName: input.guestName.trim(),
    guestDocument: input.guestDocument.trim(),
    guestPhone: input.guestPhone.trim(),
    guestEmail: input.guestEmail.trim(),
    guests: input.guests,
    roomId: input.roomId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: quote.nights,
    nightlyRateCents,
    discountPct: quote.discountPct,
    extras,
    subtotalCents: quote.subtotalCents,
    discountCents: quote.discountCents,
    extrasCents: quote.extrasCents,
    totalCents: quote.totalCents,
    source: input.source,
    notes: input.notes.trim(),
  };
}

export async function createReservation(
  input: ReservationInput,
  initialPayment: PaymentInput | null,
  userId: string | null,
): Promise<{ id: string; code: string }> {
  const { room, quote } = await priceReservation(input);
  await assertAvailable(input);

  if (initialPayment && initialPayment.amountCents > quote.totalCents) {
    throw new DomainError(
      'BAD_REQUEST',
      'El adelanto no puede ser mayor que el total de la estadía.',
    );
  }

  const id = crypto.randomUUID();
  const create = db
    .insert(reservations)
    .values({
      ...pricedFields(input, quote, room.priceCents),
      id,
      seq: sql`(select coalesce(max(seq), 0) + 1 from reservations)`,
      inquiryId: input.inquiryId ?? null,
      createdBy: userId,
    })
    .returning({ id: reservations.id, seq: reservations.seq });

  const payment =
    initialPayment && initialPayment.amountCents > 0
      ? db.insert(payments).values({
          ...initialPayment,
          reservationId: id,
          createdBy: userId,
        })
      : null;
  const inquiry = input.inquiryId
    ? db.update(inquiries).set({ status: 'convertida' }).where(eq(inquiries.id, input.inquiryId))
    : null;
  const [created] = await writeBatch([
    create,
    ...(payment ? [payment] : []),
    ...(inquiry ? [inquiry] : []),
  ]);
  return { id, code: reservationCode(created[0]!.seq) };
}

export async function updateReservation(id: string, input: ReservationInput): Promise<void> {
  const current = await db.query.reservations.findFirst({ where: eq(reservations.id, id) });
  if (!current) throw new DomainError('NOT_FOUND', 'La reserva no existe.');

  const { room } = await priceReservation(input);
  if (current.status !== 'cancelada') await assertAvailable(input, id);

  // Se conserva la tarifa pactada si no cambió la habitación.
  const nightlyRateCents =
    current.roomId === input.roomId ? current.nightlyRateCents : room.priceCents;
  const repriced = computeQuote({
    rooms: [{ id: input.roomId, label: '', priceCents: nightlyRateCents }],
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    discountPct: input.discountPct,
    extras: input.extras,
  })!;

  const [paidRow] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(eq(payments.reservationId, id));
  const paid = Number(paidRow?.paid) || 0;
  if (repriced.totalCents < paid) {
    throw new DomainError(
      'BAD_REQUEST',
      `El nuevo total (${formatMoney(repriced.totalCents)}) es menor que lo ya pagado (${formatMoney(paid)}). Elimina o ajusta un pago antes de reducir la estadía.`,
    );
  }

  await writeBatch([
    db
      .update(reservations)
      .set(pricedFields(input, repriced, nightlyRateCents))
      .where(eq(reservations.id, id)),
  ]);
}

export async function setReservationStatus(id: string, status: ReservationStatus): Promise<void> {
  const current = await db.query.reservations.findFirst({ where: eq(reservations.id, id) });
  if (!current) throw new DomainError('NOT_FOUND', 'La reserva no existe.');
  if (status === 'en_casa' && current.checkIn > todayIso()) {
    throw new DomainError(
      'BAD_REQUEST',
      `El ingreso está programado para el ${formatDate(current.checkIn)}. Si el huésped llega antes, edita primero la fecha de ingreso.`,
    );
  }
  if (current.status === 'cancelada' && status !== 'cancelada') {
    await assertAvailable(current, id);
  }
  await writeBatch([db.update(reservations).set({ status }).where(eq(reservations.id, id))]);
}

export async function deleteReservation(id: string): Promise<void> {
  await db.delete(reservations).where(eq(reservations.id, id));
}

export async function addPayment(
  reservationId: string,
  input: PaymentInput,
  userId: string | null,
): Promise<void> {
  if (input.amountCents <= 0)
    throw new DomainError('BAD_REQUEST', 'El monto debe ser mayor que cero.');
  // Las guardas SQL vuelven a comprobar el saldo al escribir, incluso con cobros simultáneos.
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
  });
  if (!reservation) throw new DomainError('NOT_FOUND', 'La reserva no existe.');
  if (reservation.status === 'cancelada') {
    throw new DomainError('BAD_REQUEST', 'No se pueden registrar pagos en una reserva cancelada.');
  }
  const [row] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(eq(payments.reservationId, reservationId));
  const balance = balanceCents(reservation.totalCents, Number(row?.paid) || 0);
  if (input.amountCents > balance) {
    throw new DomainError(
      'BAD_REQUEST',
      `El pago supera el saldo pendiente de ${formatMoney(balance)}.`,
    );
  }
  await writeBatch([db.insert(payments).values({ ...input, reservationId, createdBy: userId })]);
}

export async function deletePayment(paymentId: string): Promise<void> {
  await db.delete(payments).where(eq(payments.id, paymentId));
}

/** Reservas que ocupan al menos una noche en [from, to). Para el calendario. */
export async function listOccupancy(from: string, to: string): Promise<ReservationRow[]> {
  const rows = await baseQuery()
    .where(
      and(
        ne(reservations.status, 'cancelada'),
        lt(reservations.checkIn, to),
        gt(reservations.checkOut, from),
      ),
    )
    .orderBy(asc(reservations.checkIn));
  return rows.map(toRow);
}

export interface TodayBoard {
  today: string;
  arrivals: ReservationRow[];
  departures: ReservationRow[];
  inHouse: ReservationRow[];
}

export async function todayBoard(today = todayIso()): Promise<TodayBoard> {
  const rows = await baseQuery()
    .where(
      and(
        ne(reservations.status, 'cancelada'),
        sql`${reservations.checkIn} <= ${today}`,
        sql`${reservations.checkOut} >= ${today}`,
      ),
    )
    .orderBy(asc(rooms.sortOrder), asc(rooms.number));
  const all = rows.map(toRow);
  return {
    today,
    arrivals: all.filter((r) => r.checkIn === today && r.status === 'confirmada'),
    departures: all.filter((r) => r.checkOut === today && r.status !== 'finalizada'),
    inHouse: all.filter((r) => r.checkIn <= today && r.checkOut > today),
  };
}

export async function upcomingArrivals(limit = 6, today = todayIso()): Promise<ReservationRow[]> {
  const rows = await baseQuery()
    .where(and(eq(reservations.status, 'confirmada'), gt(reservations.checkIn, today)))
    .orderBy(asc(reservations.checkIn))
    .limit(limit);
  return rows.map(toRow);
}
