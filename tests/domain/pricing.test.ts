import { describe, expect, it } from 'vitest';
import { balanceCents, computeQuote, paymentState, type QuoteInput } from '@/lib/domain/pricing';

const input: QuoteInput = {
  rooms: [
    { id: '101', label: 'Simple', priceCents: 10000 },
    { id: '102', label: 'Doble', priceCents: 15000 },
  ],
  checkIn: '2026-12-30',
  checkOut: '2027-01-02',
};
describe('computeQuote', () => {
  it('cobra cada habitación por las noches de la estadía', () => {
    const quote = computeQuote(input)!;
    expect(quote.nights).toBe(3);
    expect(quote.roomLines.map((line) => line.amountCents)).toEqual([30000, 45000]);
    expect(quote.totalCents).toBe(75000);
    expect(quote.depositCents).toBe(37500);
  });
  it('descuenta solo habitaciones y distingue extras por noche y por estadía', () => {
    const quote = computeQuote({
      ...input,
      discountPct: 20,
      extras: ['desayuno', 'cochera', 'recojo', 'toallas'],
    })!;
    expect(quote.discountCents).toBe(15000);
    expect(quote.extraLines.map((line) => line.amountCents)).toEqual([4500, 3000, 2000, 1000]);
    expect(quote.extrasCents).toBe(10500);
    expect(quote.totalCents).toBe(70500);
    expect(quote.depositCents).toBe(35250);
  });
  it('no cobra extras duplicados', () => {
    const quote = computeQuote({ ...input, extras: ['desayuno', 'desayuno', 'recojo', 'recojo'] })!;
    expect(quote.extraLines).toHaveLength(2);
    expect(quote.extrasCents).toBe(6500);
  });
  it('redondea el adelanto de 50% a céntimos enteros', () => {
    expect(
      computeQuote({ ...input, rooms: [{ id: '1', label: 'Simple', priceCents: 10001 }] })
        ?.depositCents,
    ).toBe(15002);
  });
  it.each([
    ['2026-10-02', '2026-10-02'],
    ['2026-10-03', '2026-10-02'],
    ['inválida', '2026-10-02'],
  ])('rechaza el rango %s a %s', (checkIn, checkOut) => {
    expect(computeQuote({ ...input, checkIn, checkOut })).toBeNull();
  });
  it('rechaza cotizaciones sin habitaciones', () =>
    expect(computeQuote({ ...input, rooms: [] })).toBeNull());
});
describe('pagos y saldos', () => {
  it.each([
    [10000, 0, 'pendiente', 10000],
    [10000, 4000, 'parcial', 6000],
    [10000, 10000, 'pagado', 0],
    [10000, 12000, 'pagado', 0],
    [0, 0, 'pagado', 0],
  ] as const)('total %i, pagado %i', (total, paid, state, balance) => {
    expect(paymentState(total, paid)).toBe(state);
    expect(balanceCents(total, paid)).toBe(balance);
  });
});
