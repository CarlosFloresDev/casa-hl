import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { expenses, inquiries, payments, reservations, rooms } from '@/lib/db/schema';
import { todayIso } from '@/lib/domain/dates';

/** Respaldo completo en JSON (solo administradores). */
export const GET: APIRoute = async ({ locals }) => {
  if (locals.user?.role !== 'admin') return new Response('No autorizado', { status: 403 });

  const [r, res, pay, exp, inq] = await Promise.all([
    db.select().from(rooms),
    db.select().from(reservations),
    db.select().from(payments),
    db.select().from(expenses),
    db.select().from(inquiries),
  ]);
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), version: 1, rooms: r, reservations: res, payments: pay, expenses: exp, inquiries: inq },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="casa-hl-respaldo-${todayIso()}.json"`,
      'Cache-Control': 'no-store',
    },
  });
};
