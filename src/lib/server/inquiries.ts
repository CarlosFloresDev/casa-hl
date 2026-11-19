import { count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { inquiries, rooms, type Inquiry } from '../db/schema';
import type { ExtraKey, InquiryStatus } from '../domain/catalog';
import { computeQuote } from '../domain/pricing';
import { DomainError } from './errors';
import { roomLabel } from './rooms';

export interface InquiryInput {
  name: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomIds: string[];
  extras: ExtraKey[];
  message: string;
}

/** Registra una solicitud del sitio público. El monto se recalcula en el servidor. */
export async function createInquiry(input: InquiryInput): Promise<Inquiry> {
  const selected = input.roomIds.length
    ? await db.select().from(rooms).where(inArray(rooms.id, input.roomIds))
    : [];
  const valid = selected.filter((r) => r.active && r.published);
  if (input.roomIds.length && valid.length !== input.roomIds.length) {
    throw new DomainError('BAD_REQUEST', 'Alguna de las habitaciones elegidas ya no está disponible.');
  }
  const quote = computeQuote({
    rooms: valid.map((r) => ({ id: r.id, label: roomLabel(r), priceCents: r.priceCents })),
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    extras: input.extras,
  });
  const [row] = await db
    .insert(inquiries)
    .values({
      ...input,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      message: input.message.trim(),
      quotedTotalCents: quote?.totalCents ?? 0,
    })
    .returning();
  return row!;
}

export async function listInquiries(status?: InquiryStatus): Promise<Inquiry[]> {
  return db
    .select()
    .from(inquiries)
    .where(status ? eq(inquiries.status, status) : undefined)
    .orderBy(desc(inquiries.createdAt));
}

export async function getInquiry(id: string): Promise<Inquiry | undefined> {
  return db.query.inquiries.findFirst({ where: eq(inquiries.id, id) });
}

export async function countNewInquiries(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(inquiries).where(eq(inquiries.status, 'nueva'));
  return row?.total ?? 0;
}

export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
}

export async function deleteInquiry(id: string): Promise<void> {
  await db.delete(inquiries).where(eq(inquiries.id, id));
}
