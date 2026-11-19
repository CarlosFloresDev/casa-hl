import type { BatchItem } from 'drizzle-orm/batch';
import { writeBatch } from './write-batch';
import { sql } from 'drizzle-orm';
import { z } from 'astro/zod';
import { db } from '../db/client';
import { expenses, payments, reservations, rooms } from '../db/schema';
import {
  EXPENSE_CATEGORIES,
  ROOM_TYPES,
  type AmenityKey,
  type PaymentMethod,
} from '../domain/catalog';
import { isIsoDate, nightsBetween, todayIso } from '../domain/dates';
import { toCents } from '../domain/money';
import { findConflicts } from './reservations';
import { slugify } from './rooms';

/**
 * Importa los datos del sistema anterior (archivo HTML que guardaba todo en localStorage
 * con las claves hl_rooms, hl_reservations y hl_expenses).
 */
const num = z.union([z.number(), z.string()]).optional();

export const legacySchema = z.object({
  rooms: z
    .array(
      z.looseObject({
        id: z.union([z.string(), z.number()]).transform(String),
        number: z.union([z.string(), z.number()]).transform(String),
        floor: num,
        type: z.string().optional(),
        price: num,
        amenities: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
  reservations: z
    .array(
      z.looseObject({
        guestName: z.string().optional(),
        dni: z.string().optional(),
        phone: z.string().optional(),
        roomId: z.union([z.string(), z.number()]).transform(String),
        checkIn: z.string(),
        checkOut: z.string(),
        paymentMethod: z.string().optional(),
        totalAmount: num,
        paidAmount: num,
      }),
    )
    .default([]),
  expenses: z
    .array(
      z.looseObject({
        concept: z.string().optional(),
        category: z.string().optional(),
        amount: num,
        date: z.string().optional(),
      }),
    )
    .default([]),
});
export type LegacyData = z.infer<typeof legacySchema>;

const AMENITY_MAP: Record<string, AmenityKey> = {
  'Baño Privado': 'bano_privado',
  'Baño Compartido': 'bano_compartido',
  'TV Cable': 'tv',
  Cocina: 'cocina',
  Desayuno: 'desayuno',
  Toallas: 'toallas',
  'Wi-Fi': 'wifi',
};

const METHOD_MAP: Record<string, PaymentMethod> = {
  'YAPE/PLIN': 'yape_plin',
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
};

function roomType(legacy?: string): string {
  if (!legacy) return 'Matrimonial';
  const l = legacy.toLowerCase();
  if (l.includes('simple')) return 'Simple';
  if (l.includes('matrimonial')) return 'Matrimonial';
  if (l.includes('doble')) return 'Doble';
  if (l.includes('triple') || l.includes('familiar')) return 'Triple / Familiar';
  if (l.includes('minidep')) return 'Minidepartamento';
  if (l.includes('departamento')) return 'Departamento completo';
  return ROOM_TYPES.includes(legacy as never) ? legacy : 'Matrimonial';
}

function imageFor(type: string): string {
  return (
    (
      {
        Simple: 'room-simple',
        Matrimonial: 'room-matrimonial',
        Doble: 'room-doble',
        'Triple / Familiar': 'room-familiar',
        Minidepartamento: 'room-minidepartamento',
        'Departamento completo': 'room-departamento',
      } as Record<string, string>
    )[type] ?? 'room-simple'
  );
}

const cents = (v: unknown) => {
  const c = toCents(v as string | number);
  return Number.isFinite(c) && c > 0 ? c : 0;
};

export interface ImportSummary {
  rooms: number;
  reservations: number;
  expenses: number;
  skipped: string[];
}

export async function importLegacy(data: LegacyData, userId: string): Promise<ImportSummary> {
  const summary: ImportSummary = { rooms: 0, reservations: 0, expenses: 0, skipped: [] };
  const today = todayIso();

  const writes: BatchItem<'sqlite'>[] = [];
  const pending: { roomId: string; checkIn: string; checkOut: string }[] = [];
  const existing = await db.select({ id: rooms.id, number: rooms.number }).from(rooms);
  const byNumber = new Map(existing.map((r) => [r.number, r.id]));
  const roomIdMap = new Map<string, { id: string; priceCents: number }>();

  for (const r of data.rooms) {
    const number = r.number.trim();
    if (!number) continue;
    const priceCents = cents(r.price);
    const already = byNumber.get(number);
    if (already) {
      roomIdMap.set(r.id, { id: already, priceCents });
      summary.skipped.push(`Habitación ${number}: ya existía, se reutilizó.`);
      continue;
    }
    const type = roomType(r.type);
    const id = crypto.randomUUID();
    writes.push(
      db
        .insert(rooms)
        .values({
          id,
          number,
          slug: slugify(`${number}-${type}`),
          name: type,
          floor: Number(r.floor) || 1,
          type,
          capacity: type === 'Simple' ? 1 : type === 'Triple / Familiar' ? 4 : 2,
          priceCents,
          amenities: [
            ...new Set(
              (r.amenities ?? []).map((a) => AMENITY_MAP[a]).filter((a): a is AmenityKey => !!a),
            ),
          ],
          notes: r.notes ?? '',
          image: imageFor(type),
        })
        .returning({ id: rooms.id }),
    );
    byNumber.set(number, id);
    roomIdMap.set(r.id, { id, priceCents });
    summary.rooms++;
  }

  for (const r of data.reservations) {
    const room = roomIdMap.get(r.roomId);
    const nights = nightsBetween(r.checkIn, r.checkOut);
    if (!room || !isIsoDate(r.checkIn) || !isIsoDate(r.checkOut) || nights <= 0) {
      summary.skipped.push(
        `Reserva de ${r.guestName ?? 'sin nombre'} (${r.checkIn}): habitación o fechas no válidas.`,
      );
      continue;
    }
    const conflicts = await findConflicts(room.id, r.checkIn, r.checkOut, undefined);
    if (
      conflicts.length > 0 ||
      pending.some((p) => p.roomId === room.id && p.checkIn < r.checkOut && p.checkOut > r.checkIn)
    ) {
      summary.skipped.push(
        `Reserva de ${r.guestName ?? 'sin nombre'} (${r.checkIn} a ${r.checkOut}): se cruza con otra reserva de la misma habitación.`,
      );
      continue;
    }
    const totalCents = cents(r.totalAmount) || room.priceCents * nights;
    const paidCents = Math.min(cents(r.paidAmount), totalCents);
    const id = crypto.randomUUID();
    pending.push({ roomId: room.id, checkIn: r.checkIn, checkOut: r.checkOut });
    writes.push(
      db
        .insert(reservations)
        .values({
          id,
          seq: sql`(select coalesce(max(seq), 0) + 1 from reservations)`,
          guestName: (r.guestName ?? '').trim() || 'Huésped sin nombre',
          guestDocument: r.dni ?? '',
          guestPhone: r.phone ?? '',
          roomId: room.id,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          nights,
          nightlyRateCents: Math.round(totalCents / nights),
          subtotalCents: totalCents,
          totalCents,
          status: r.checkOut < today ? 'finalizada' : 'confirmada',
          source: 'directa',
          notes: 'Importada del sistema anterior',
          createdBy: userId,
        })
        .returning({ id: reservations.id }),
    );
    if (paidCents > 0) {
      writes.push(
        db.insert(payments).values({
          reservationId: id,
          amountCents: paidCents,
          method: METHOD_MAP[r.paymentMethod ?? ''] ?? 'efectivo',
          kind: paidCents >= totalCents ? 'saldo' : 'adelanto',
          paidOn: r.checkIn <= today ? r.checkIn : today,
          note: 'Importado',
          createdBy: userId,
        }),
      );
    }
    summary.reservations++;
  }

  for (const e of data.expenses) {
    const amountCents = cents(e.amount);
    if (!amountCents || !e.date || !isIsoDate(e.date)) {
      summary.skipped.push(`Egreso "${e.concept ?? ''}": monto o fecha no válidos.`);
      continue;
    }
    const category =
      EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === (e.category ?? '').toLowerCase()) ??
      'Otros';
    writes.push(
      db.insert(expenses).values({
        concept: (e.concept ?? '').trim() || 'Egreso importado',
        category,
        amountCents,
        spentOn: e.date,
        createdBy: userId,
      }),
    );
    summary.expenses++;
  }
  if (writes.length) await writeBatch([writes[0]!, ...writes.slice(1)]);

  return summary;
}
