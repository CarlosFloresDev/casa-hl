import { ActionError, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro/zod';
import { isIsoDate } from '../lib/domain/dates';
import { DomainError } from '../lib/server/errors';
import type { SessionUser } from '../lib/server/users';
import type { UserRole } from '../lib/domain/catalog';

/** Exige sesión iniciada (y opcionalmente un rol). Devuelve el usuario actual. */
export function requireUser(context: ActionAPIContext, role?: UserRole): SessionUser {
  const user = context.locals.user;
  if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Tu sesión expiró. Vuelve a ingresar.' });
  if (role && user.role !== role) {
    throw new ActionError({ code: 'FORBIDDEN', message: 'Solo un administrador puede realizar esta acción.' });
  }
  return user;
}

/** Ejecuta lógica de negocio traduciendo DomainError a ActionError. */
export async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DomainError) throw new ActionError({ code: err.code, message: err.message });
    throw err;
  }
}

export const isoDate = z.string().refine(isIsoDate, 'Fecha no válida');
export const cents = z.number().int().nonnegative().max(100_000_000);
export const shortText = (max = 120) => z.string().trim().max(max);
export const id = z.string().min(1).max(64);
