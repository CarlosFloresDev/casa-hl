import type { BatchItem } from 'drizzle-orm/batch';
import { db } from '../db/client';
import { DomainError } from './errors';

/** D1 rolls back the entire batch if a SQL guard rejects any statement. */
export async function writeBatch<T extends [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]>(
  writes: T,
) {
  try {
    return await db.batch(writes);
  } catch (error) {
    let cause: unknown = error;
    while (cause instanceof Error) {
      if (cause.message.includes('reservation_overlap')) {
        throw new DomainError(
          'CONFLICT',
          'La habitación ya está reservada en esas fechas. Actualiza la disponibilidad.',
        );
      }
      if (
        cause.message.includes('payment_invalid') ||
        cause.message.includes('reservation_total_below_paid')
      ) {
        throw new DomainError(
          'BAD_REQUEST',
          'El saldo o el estado de la reserva cambió. Actualiza los datos antes de guardar.',
        );
      }
      if (cause.message.includes('reservation_early_checkin')) {
        throw new DomainError(
          'BAD_REQUEST',
          'El ingreso está programado para una fecha futura. Edita primero la fecha de ingreso.',
        );
      }
      cause = cause.cause;
    }
    throw error;
  }
}
