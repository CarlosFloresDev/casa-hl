import { ActionError, defineAction } from 'astro:actions';
import { importLegacy, legacySchema } from '../lib/server/legacy-import';
import { z } from 'astro/zod';
import {
  AMENITY_KEYS,
  EXPENSE_CATEGORIES,
  EXTRA_KEYS,
  INQUIRY_STATUS_KEYS,
  PAYMENT_KIND_KEYS,
  PAYMENT_METHOD_KEYS,
  RESERVATION_SOURCE_KEYS,
  RESERVATION_STATUS_KEYS,
  ROOM_IMAGE_KEYS,
  ROOM_TYPES,
} from '../lib/domain/catalog';
import { createExpense, deleteExpense, updateExpense } from '../lib/server/expenses';
import { deleteInquiry, setInquiryStatus } from '../lib/server/inquiries';
import {
  addPayment,
  createReservation,
  deletePayment,
  deleteReservation,
  getReservation,
  occupiedRoomIds,
  setReservationStatus,
  updateReservation,
} from '../lib/server/reservations';
import { createRoom, deleteRoom, setRoomActive, updateRoom } from '../lib/server/rooms';
import { cents, id, isoDate, requireUser, run, shortText } from './_shared';

const roomInput = z.object({
  number: z.string().trim().min(1, 'Indica el número').max(20),
  name: shortText(60),
  floor: z.number().int().min(0).max(50),
  type: z.enum(ROOM_TYPES),
  capacity: z.number().int().min(1).max(20),
  priceCents: cents.min(100, 'Indica el precio por noche'),
  amenities: z.array(z.enum(AMENITY_KEYS)).max(AMENITY_KEYS.length),
  description: shortText(600),
  notes: shortText(300),
  image: z.enum(ROOM_IMAGE_KEYS),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

const reservationInput = z
  .object({
    guestName: z.string().trim().min(2, 'Indica el nombre del huésped').max(120),
    guestDocument: shortText(20),
    guestPhone: shortText(20),
    guestEmail: z.union([z.literal(''), z.email('Correo no válido')]),
    guests: z.number().int().min(1).max(20),
    roomId: id,
    checkIn: isoDate,
    checkOut: isoDate,
    discountPct: z.number().int().min(0).max(100),
    extras: z.array(z.enum(EXTRA_KEYS)),
    source: z.enum(RESERVATION_SOURCE_KEYS),
    notes: shortText(500),
    inquiryId: id.optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'La salida debe ser posterior al ingreso',
    path: ['checkOut'],
  });

const paymentInput = z.object({
  amountCents: cents.min(1, 'Indica el monto'),
  method: z.enum(PAYMENT_METHOD_KEYS),
  kind: z.enum(PAYMENT_KIND_KEYS),
  paidOn: isoDate,
  note: shortText(200),
});

const expenseInput = z.object({
  concept: z.string().trim().min(2, 'Describe el egreso').max(160),
  category: z.enum(EXPENSE_CATEGORIES),
  amountCents: cents.min(1, 'Indica el monto'),
  method: z.enum(PAYMENT_METHOD_KEYS),
  spentOn: isoDate,
});

export const rooms = {
  create: defineAction({
    accept: 'json',
    input: roomInput,
    handler: async (input, context) => {
      requireUser(context, 'admin');
      return run(() => createRoom(input));
    },
  }),
  update: defineAction({
    accept: 'json',
    input: roomInput.extend({ id }),
    handler: async ({ id: roomId, ...input }, context) => {
      requireUser(context, 'admin');
      return run(() => updateRoom(roomId, input));
    },
  }),
  setActive: defineAction({
    accept: 'json',
    input: z.object({ id, active: z.boolean() }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await setRoomActive(input.id, input.active);
      return { ok: true };
    },
  }),
  delete: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await run(() => deleteRoom(input.id));
      return { ok: true };
    },
  }),
};

export const reservations = {
  /** Ids de habitaciones ocupadas en el rango (incluye habitaciones no publicadas). */
  occupied: defineAction({
    accept: 'json',
    input: z.object({ checkIn: isoDate, checkOut: isoDate }),
    handler: async (input, context) => {
      requireUser(context);
      if (input.checkOut <= input.checkIn) return [];
      return [...(await occupiedRoomIds(input.checkIn, input.checkOut))];
    },
  }),
  get: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context);
      return (await getReservation(input.id)) ?? null;
    },
  }),
  create: defineAction({
    accept: 'json',
    input: z.object({ reservation: reservationInput, payment: paymentInput.nullable() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      return run(() => createReservation(input.reservation, input.payment, user.id));
    },
  }),
  update: defineAction({
    accept: 'json',
    input: z.object({ id, reservation: reservationInput }),
    handler: async (input, context) => {
      requireUser(context);
      await run(() => updateReservation(input.id, input.reservation));
      return { ok: true };
    },
  }),
  setStatus: defineAction({
    accept: 'json',
    input: z.object({ id, status: z.enum(RESERVATION_STATUS_KEYS) }),
    handler: async (input, context) => {
      requireUser(context);
      await run(() => setReservationStatus(input.id, input.status));
      return { ok: true };
    },
  }),
  delete: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await deleteReservation(input.id);
      return { ok: true };
    },
  }),
  addPayment: defineAction({
    accept: 'json',
    input: paymentInput.extend({ reservationId: id }),
    handler: async ({ reservationId, ...input }, context) => {
      const user = requireUser(context);
      await run(() => addPayment(reservationId, input, user.id));
      return { ok: true };
    },
  }),
  deletePayment: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await deletePayment(input.id);
      return { ok: true };
    },
  }),
};

export const expenses = {
  create: defineAction({
    accept: 'json',
    input: expenseInput,
    handler: async (input, context) => {
      const user = requireUser(context);
      await createExpense(input, user.id);
      return { ok: true };
    },
  }),
  update: defineAction({
    accept: 'json',
    input: expenseInput.extend({ id }),
    handler: async ({ id: expenseId, ...input }, context) => {
      requireUser(context);
      await run(() => updateExpense(expenseId, input));
      return { ok: true };
    },
  }),
  delete: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await deleteExpense(input.id);
      return { ok: true };
    },
  }),
};

export const data = {
  importLegacy: defineAction({
    accept: 'json',
    input: z.object({ json: z.string().min(2).max(5_000_000) }),
    handler: async ({ json }, context) => {
      const user = requireUser(context, 'admin');
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'El texto pegado no es un JSON válido.' });
      }
      const result = legacySchema.safeParse(parsed);
      if (!result.success) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: 'El formato no coincide con el del sistema anterior (se esperan rooms, reservations y expenses).',
        });
      }
      return importLegacy(result.data, user.id);
    },
  }),
};

export const inquiries = {
  setStatus: defineAction({
    accept: 'json',
    input: z.object({ id, status: z.enum(INQUIRY_STATUS_KEYS) }),
    handler: async (input, context) => {
      requireUser(context);
      await setInquiryStatus(input.id, input.status);
      return { ok: true };
    },
  }),
  delete: defineAction({
    accept: 'json',
    input: z.object({ id }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await deleteInquiry(input.id);
      return { ok: true };
    },
  }),
};
