import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { EXTRA_KEYS } from '../lib/domain/catalog';
import { addDays, todayIso } from '../lib/domain/dates';
import { createInquiry } from '../lib/server/inquiries';
import { checkRateLimit } from '../lib/server/rate-limit';
import { occupiedRoomIds } from '../lib/server/reservations';
import { listPublicRooms } from '../lib/server/rooms';
import { id, isoDate, run, shortText } from './_shared';

const stay = z
  .object({ checkIn: isoDate, checkOut: isoDate })
  .refine((v) => v.checkOut > v.checkIn, {
    message: 'La salida debe ser posterior a la llegada',
    path: ['checkOut'],
  })
  .refine((v) => v.checkIn >= addDays(todayIso(), -1), {
    message: 'La fecha de llegada ya pasó',
    path: ['checkIn'],
  })
  .refine((v) => v.checkOut <= addDays(todayIso(), 540), {
    message: 'Aceptamos solicitudes hasta 18 meses por adelantado',
    path: ['checkOut'],
  });

export const site = {
  /** Disponibilidad pública: qué habitaciones están libres en el rango. */
  availability: defineAction({
    accept: 'json',
    input: stay,
    handler: async ({ checkIn, checkOut }) => {
      const [roomList, occupied] = await Promise.all([
        listPublicRooms(),
        occupiedRoomIds(checkIn, checkOut),
      ]);
      return roomList.map((r) => ({ id: r.id, available: !occupied.has(r.id) }));
    },
  }),

  /** Solicitud de reserva desde el sitio. No confirma nada: queda pendiente para recepción. */
  requestBooking: defineAction({
    accept: 'json',
    input: z.intersection(
      stay,
      z.object({
        name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[\d\s-]{7,20}$/, 'Escribe un número de celular válido'),
        email: z.union([z.literal(''), z.email('Correo no válido')]),
        guests: z.number().int().min(1).max(20),
        roomIds: z.array(id).min(1, 'Elige al menos una habitación').max(10),
        extras: z.array(z.enum(EXTRA_KEYS)),
        message: shortText(600),
        // Campo trampa: los humanos no lo ven; si viene con datos, es un bot.
        website: z.string().max(0).optional(),
      }),
    ),
    handler: async ({ website: _hp, ...input }, context) => {
      const ip = context.clientAddress ?? 'unknown';
      if (!checkRateLimit(`inquiry:${ip}`, 5, 60 * 60_000)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Recibimos varias solicitudes desde tu conexión. Escríbenos por WhatsApp.',
        });
      }
      const inquiry = await run(() => createInquiry(input));
      return { id: inquiry.id, quotedTotalCents: inquiry.quotedTotalCents };
    },
  }),
};
