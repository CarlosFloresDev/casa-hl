import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
// Extensión explícita: este archivo también lo importan scripts que corren con Node directamente.
import {
  INQUIRY_STATUS_KEYS,
  PAYMENT_KIND_KEYS,
  PAYMENT_METHOD_KEYS,
  RESERVATION_SOURCE_KEYS,
  RESERVATION_STATUS_KEYS,
  USER_ROLE_KEYS,
  type AmenityKey,
  type ExtraKey,
} from '../domain/catalog.ts';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdateFn(() => new Date().toISOString()),
};

export interface ReservationExtra {
  key: ExtraKey;
  label: string;
  amountCents: number;
}

export const users = sqliteTable('users', {
  id: id(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: USER_ROLE_KEYS }).notNull().default('staff'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

export const rooms = sqliteTable(
  'rooms',
  {
    id: id(),
    number: text('number').notNull().unique(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    floor: integer('floor').notNull().default(1),
    type: text('type').notNull(),
    capacity: integer('capacity').notNull().default(2),
    priceCents: integer('price_cents').notNull(),
    amenities: text('amenities', { mode: 'json' }).$type<AmenityKey[]>().notNull().default([]),
    description: text('description').notNull().default(''),
    notes: text('notes').notNull().default(''),
    image: text('image').notNull().default('room-simple'),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('rooms_active_idx').on(t.active, t.sortOrder)],
);

export const reservations = sqliteTable(
  'reservations',
  {
    id: id(),
    seq: integer('seq').notNull().unique(),
    guestName: text('guest_name').notNull(),
    guestDocument: text('guest_document').notNull().default(''),
    guestPhone: text('guest_phone').notNull().default(''),
    guestEmail: text('guest_email').notNull().default(''),
    guests: integer('guests').notNull().default(1),
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'restrict' }),
    checkIn: text('check_in').notNull(),
    checkOut: text('check_out').notNull(),
    nights: integer('nights').notNull(),
    nightlyRateCents: integer('nightly_rate_cents').notNull(),
    discountPct: integer('discount_pct').notNull().default(0),
    extras: text('extras', { mode: 'json' }).$type<ReservationExtra[]>().notNull().default([]),
    subtotalCents: integer('subtotal_cents').notNull(),
    discountCents: integer('discount_cents').notNull().default(0),
    extrasCents: integer('extras_cents').notNull().default(0),
    totalCents: integer('total_cents').notNull(),
    status: text('status', { enum: RESERVATION_STATUS_KEYS }).notNull().default('confirmada'),
    source: text('source', { enum: RESERVATION_SOURCE_KEYS }).notNull().default('directa'),
    inquiryId: text('inquiry_id'),
    notes: text('notes').notNull().default(''),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('reservations_room_dates_idx').on(t.roomId, t.checkIn, t.checkOut),
    index('reservations_check_in_idx').on(t.checkIn),
    index('reservations_status_idx').on(t.status),
  ],
);

export const payments = sqliteTable(
  'payments',
  {
    id: id(),
    reservationId: text('reservation_id')
      .notNull()
      .references(() => reservations.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: PAYMENT_METHOD_KEYS }).notNull(),
    kind: text('kind', { enum: PAYMENT_KIND_KEYS }).notNull().default('adelanto'),
    paidOn: text('paid_on').notNull(),
    note: text('note').notNull().default(''),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('payments_reservation_idx').on(t.reservationId),
    index('payments_paid_on_idx').on(t.paidOn),
  ],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: id(),
    concept: text('concept').notNull(),
    category: text('category').notNull(),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: PAYMENT_METHOD_KEYS }).notNull().default('efectivo'),
    spentOn: text('spent_on').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('expenses_spent_on_idx').on(t.spentOn)],
);

export const inquiries = sqliteTable(
  'inquiries',
  {
    id: id(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull().default(''),
    checkIn: text('check_in').notNull(),
    checkOut: text('check_out').notNull(),
    guests: integer('guests').notNull().default(1),
    roomIds: text('room_ids', { mode: 'json' }).$type<string[]>().notNull().default([]),
    extras: text('extras', { mode: 'json' }).$type<ExtraKey[]>().notNull().default([]),
    message: text('message').notNull().default(''),
    quotedTotalCents: integer('quoted_total_cents').notNull().default(0),
    status: text('status', { enum: INQUIRY_STATUS_KEYS }).notNull().default('nueva'),
    ...timestamps,
  },
  (t) => [index('inquiries_status_idx').on(t.status, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
