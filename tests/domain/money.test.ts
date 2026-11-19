import { describe, expect, it } from 'vitest';
import { formatMoney, toCents } from '@/lib/domain/money';

describe('dinero en céntimos', () => {
  it.each([
    ['123.45', 12345],
    ['123,45', 12345],
    [' 12.30 ', 1230],
    [123.45, 12345],
    [0, 0],
    [12.345, 1235],
    [-1.25, -125],
  ])('convierte %s', (value, expected) => expect(toCents(value)).toBe(expected));
  it.each(['abc', '12.3.4', Infinity, NaN])('rechaza %s', (value) =>
    expect(toCents(value)).toBeNaN(),
  );
  it.each([
    [12345, 'S/ 123.45'],
    [0, 'S/ 0.00'],
    [123456, 'S/ 1,234.56'],
    [-150, '-S/ 1.50'],
  ])('formatea %i en soles', (value, expected) => {
    expect(formatMoney(value).replace(/\s/g, ' ')).toBe(expected);
  });
});
