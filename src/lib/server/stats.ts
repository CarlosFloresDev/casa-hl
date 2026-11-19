import { and, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { expenses, payments } from '../db/schema';
import { PAYMENT_METHOD_KEYS, type PaymentMethod } from '../domain/catalog';
import { addDays, monthDates, nightsBetween } from '../domain/dates';
import { listReservations, listOccupancy } from './reservations';
import { listRooms } from './rooms';

export interface PeriodStats {
  from: string;
  to: string;
  incomeCents: number;
  incomeByMethod: Record<PaymentMethod, number>;
  expensesCents: number;
  netCents: number;
  pendingCents: number;
  pendingCount: number;
  occupancyPct: number;
  roomNightsSold: number;
  dailyIncome: { date: string; cents: number }[];
}

/** Indicadores del mes (year, month0). */
export async function monthStats(year: number, month0: number): Promise<PeriodStats> {
  const dates = monthDates(year, month0);
  const from = dates[0]!;
  const to = addDays(dates.at(-1)!, 1);

  const [byMethod, byDay, [exp], active, occupancy, rooms] = await Promise.all([
    db
      .select({ method: payments.method, total: sql<number>`sum(${payments.amountCents})` })
      .from(payments)
      .where(and(gte(payments.paidOn, from), lt(payments.paidOn, to)))
      .groupBy(payments.method),
    db
      .select({ date: payments.paidOn, total: sql<number>`sum(${payments.amountCents})` })
      .from(payments)
      .where(and(gte(payments.paidOn, from), lt(payments.paidOn, to)))
      .groupBy(payments.paidOn),
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)` })
      .from(expenses)
      .where(and(gte(expenses.spentOn, from), lt(expenses.spentOn, to))),
    listReservations({ status: 'activas' }),
    listOccupancy(from, to),
    listRooms(),
  ]);

  const incomeByMethod = Object.fromEntries(PAYMENT_METHOD_KEYS.map((k) => [k, 0])) as Record<
    PaymentMethod,
    number
  >;
  for (const row of byMethod) incomeByMethod[row.method] = Number(row.total) || 0;
  const incomeCents = Object.values(incomeByMethod).reduce((a, b) => a + b, 0);
  const expensesCents = Number(exp?.total) || 0;

  const withBalance = active.filter((r) => r.balanceCents > 0);

  // Noches vendidas dentro del mes (recortando estadías que cruzan el borde del mes).
  const roomNightsSold = occupancy.reduce((sum, r) => {
    const start = r.checkIn > from ? r.checkIn : from;
    const end = r.checkOut < to ? r.checkOut : to;
    return sum + Math.max(0, nightsBetween(start, end));
  }, 0);
  const capacity = rooms.length * dates.length;

  const dayMap = new Map(byDay.map((d) => [d.date, Number(d.total) || 0]));

  return {
    from,
    to,
    incomeCents,
    incomeByMethod,
    expensesCents,
    netCents: incomeCents - expensesCents,
    pendingCents: withBalance.reduce((s, r) => s + r.balanceCents, 0),
    pendingCount: withBalance.length,
    occupancyPct: capacity ? Math.round((roomNightsSold / capacity) * 100) : 0,
    roomNightsSold,
    dailyIncome: dates.map((date) => ({ date, cents: dayMap.get(date) ?? 0 })),
  };
}
