import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { authenticate, changePassword, createUser, listUsers, setUserActive } from '../lib/server/users';
import { USER_ROLE_KEYS } from '../lib/domain/catalog';
import { checkRateLimit } from '../lib/server/rate-limit';
import { id, requireUser, run } from './_shared';

export const auth = {
  login: defineAction({
    accept: 'form',
    input: z.object({
      username: z.string().trim().min(1, 'Ingresa tu usuario').max(60),
      password: z.string().min(1, 'Ingresa tu contraseña').max(200),
    }),
    handler: async ({ username, password }, context) => {
      const ip = context.clientAddress ?? 'unknown';
      if (!checkRateLimit(`login:${ip}`, 8, 10 * 60_000)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.',
        });
      }
      const user = await authenticate(username, password);
      if (!user) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Usuario o contraseña incorrectos.' });
      }
      await context.session?.regenerate();
      context.session?.set('userId', user.id);
      return { name: user.name };
    },
  }),

  logout: defineAction({
    accept: 'form',
    handler: async (_input, context) => {
      context.session?.destroy();
      return { ok: true };
    },
  }),

  changePassword: defineAction({
    accept: 'json',
    input: z
      .object({
        current: z.string().min(1).max(200),
        next: z.string().min(8, 'Usa al menos 8 caracteres').max(200),
        confirm: z.string(),
      })
      .refine((v) => v.next === v.confirm, { message: 'Las contraseñas no coinciden', path: ['confirm'] }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await run(() => changePassword(user.id, input.current, input.next));
      return { ok: true };
    },
  }),

  listUsers: defineAction({
    accept: 'json',
    handler: async (_input, context) => {
      requireUser(context, 'admin');
      return listUsers();
    },
  }),

  createUser: defineAction({
    accept: 'json',
    input: z.object({
      username: z
        .string()
        .trim()
        .min(3, 'Mínimo 3 caracteres')
        .max(40)
        .regex(/^[a-zA-Z0-9._-]+$/, 'Solo letras, números, punto, guion o guion bajo'),
      name: z.string().trim().min(2).max(80),
      password: z.string().min(8, 'Usa al menos 8 caracteres').max(200),
      role: z.enum(USER_ROLE_KEYS),
    }),
    handler: async (input, context) => {
      requireUser(context, 'admin');
      await run(() => createUser(input));
      return { ok: true };
    },
  }),

  setUserActive: defineAction({
    accept: 'json',
    input: z.object({ id, active: z.boolean() }),
    handler: async (input, context) => {
      const actor = requireUser(context, 'admin');
      await run(() => setUserActive(actor.id, input.id, input.active));
      return { ok: true };
    },
  }),
};
