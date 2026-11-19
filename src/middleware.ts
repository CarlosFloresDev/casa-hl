import { defineMiddleware } from 'astro:middleware';
import { getActiveUser } from './lib/server/users';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/login/']);

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const needsUser = pathname.startsWith('/admin') || pathname.startsWith('/_actions');

  context.locals.user = null;
  if (needsUser) {
    const userId = await context.session?.get('userId');
    if (userId) context.locals.user = await getActiveUser(userId);
  }

  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.has(pathname) && !context.locals.user) {
    return context.redirect(`/admin/login?next=${encodeURIComponent(pathname + context.url.search)}`);
  }

  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(name)) {
      try {
        response.headers.set(name, value);
      } catch {
        // Algunas respuestas (p. ej. redirecciones) tienen cabeceras inmutables.
      }
    }
  }
  if (pathname.startsWith('/admin')) {
    try {
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    } catch {
      /* cabeceras inmutables */
    }
  }
  return response;
});
