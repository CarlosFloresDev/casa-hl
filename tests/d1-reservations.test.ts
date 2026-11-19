import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../src/lib/db/schema';
import type { ReservationInput } from '../src/lib/server/reservations';

const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("ok") } }',
    compatibilityDate: '2026-10-01',
    d1Databases: ['DB'],
  }),
);
const binding = await mf.getD1Database('DB');
const db = drizzle(binding, { schema });
vi.doMock('../src/lib/db/client', () => ({ db }));
const service = await import('../src/lib/server/reservations');
const { importLegacy } = await import('../src/lib/server/legacy-import');
const input: ReservationInput = {
  guestName: 'Test',
  guestDocument: '',
  guestPhone: '',
  guestEmail: '',
  guests: 1,
  roomId: 'room',
  checkIn: '2026-01-01',
  checkOut: '2026-01-03',
  discountPct: 0,
  extras: [],
  source: 'directa',
  notes: '',
};
const payment = {
  amountCents: 6000,
  method: 'efectivo' as const,
  kind: 'adelanto' as const,
  paidOn: '2026-01-01',
  note: '',
};

beforeAll(async () => {
  for (const file of ['0000_init.sql', '0001_d1_guards.sql']) {
    const statements = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    await binding.batch(statements.map((s) => binding.prepare(s)));
  }
}, 30000);
beforeEach(async () => {
  await binding.batch(
    [
      'DELETE FROM payments',
      'DELETE FROM reservations',
      'DELETE FROM inquiries',
      'DELETE FROM expenses',
      'DELETE FROM rooms',
      'DELETE FROM users',
    ].map((s) => binding.prepare(s)),
  );
  await db
    .insert(schema.rooms)
    .values({
      id: 'room',
      number: '101',
      slug: '101',
      name: 'Simple',
      type: 'Simple',
      priceCents: 6000,
    });
  await db
    .insert(schema.users)
    .values({ id: 'user', username: 'admin', name: 'Admin', passwordHash: 'unused' });
});
afterAll(() => mf.dispose());

describe('D1 reservation batches and SQL guards', () => {
  it('creates reservation, payment and inquiry conversion atomically', async () => {
    await db
      .insert(schema.inquiries)
      .values({
        id: 'inquiry',
        name: 'Test',
        phone: '123',
        checkIn: input.checkIn,
        checkOut: input.checkOut,
      });
    const created = await service.createReservation(
      { ...input, inquiryId: 'inquiry' },
      payment,
      'user',
    );
    expect(created.code).toBe('RES-00001');
    expect((await service.getReservation(created.id))?.paidCents).toBe(6000);
    expect((await db.select().from(schema.inquiries))[0]?.status).toBe('convertida');
  });
  it('rejects concurrent overlaps and rolls back their payments', async () => {
    const results = await Promise.allSettled([
      service.createReservation(input, payment, null),
      service.createReservation(input, payment, null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.select().from(schema.reservations)).toHaveLength(1);
    expect(await db.select().from(schema.payments)).toHaveLength(1);
  });
  it('allows adjacent stays, blocks reactivation and edits into occupied dates, including finished stays', async () => {
    const first = await service.createReservation(input, null, null);
    await service.setReservationStatus(first.id, 'finalizada');
    const second = await service.createReservation(
      { ...input, checkIn: input.checkOut, checkOut: '2026-01-04' },
      null,
      null,
    );
    await expect(service.updateReservation(second.id, input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await service.setReservationStatus(first.id, 'cancelada');
    await service.createReservation(input, null, null);
    await expect(service.setReservationStatus(first.id, 'confirmada')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
  it('prevents simultaneous overpayment and reducing the total below payments', async () => {
    const created = await service.createReservation(input, null, null);
    const results = await Promise.allSettled([
      service.addPayment(created.id, { ...payment, amountCents: 10000 }, null),
      service.addPayment(created.id, { ...payment, amountCents: 10000 }, null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(
      service.updateReservation(created.id, { ...input, checkOut: '2026-01-02' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await service.setReservationStatus(created.id, 'cancelada');
    await expect(service.addPayment(created.id, payment, null)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
  it('rolls back the reservation if its payment fails', async () => {
    await expect(
      db.batch([
        db
          .insert(schema.reservations)
          .values({
            id: 'rollback',
            seq: 1,
            guestName: 'Test',
            roomId: 'room',
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            nights: 2,
            nightlyRateCents: 6000,
            subtotalCents: 12000,
            totalCents: 12000,
          }),
        db
          .insert(schema.payments)
          .values({ ...payment, amountCents: 13000, reservationId: 'rollback' }),
      ]),
    ).rejects.toThrow();
    expect(await db.select().from(schema.reservations)).toHaveLength(0);
  });
  it('imports a new room and skips overlaps within the same batch', async () => {
    const stay = {
      roomId: 'legacy',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestName: 'Legacy',
      totalAmount: 120,
      paidAmount: 60,
    };
    const result = await importLegacy(
      {
        rooms: [{ id: 'legacy', number: '202', price: 60 }],
        reservations: [stay, stay],
        expenses: [{ concept: 'Test', amount: 10, date: '2026-01-01' }],
      },
      'user',
    );
    expect(result).toMatchObject({ rooms: 1, reservations: 1, expenses: 1 });
    expect(result.skipped).toHaveLength(1);
    expect(await db.select().from(schema.payments)).toHaveLength(1);
  });
});
