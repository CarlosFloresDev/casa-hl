import { describe, expect, it } from 'vitest';
import {
  isIsoDate,
  nightsBetween,
  occupiesNight,
  rangesOverlap,
  todayIso,
} from '@/lib/domain/dates';

describe('fechas de estadía', () => {
  it('deja libre la fecha de salida para otra reserva', () => {
    expect(rangesOverlap('2026-10-01', '2026-10-03', '2026-10-03', '2026-10-05')).toBe(false);
    expect(rangesOverlap('2026-10-03', '2026-10-05', '2026-10-01', '2026-10-03')).toBe(false);
    expect(rangesOverlap('2026-10-01', '2026-10-04', '2026-10-03', '2026-10-05')).toBe(true);
    expect(rangesOverlap('2026-10-01', '2026-10-10', '2026-10-03', '2026-10-05')).toBe(true);
  });
  it.each([
    ['2026-09-30', false],
    ['2026-10-01', true],
    ['2026-10-02', true],
    ['2026-10-03', false],
  ])('ocupación de %s', (date, expected) => {
    expect(occupiesNight(date, '2026-10-01', '2026-10-03')).toBe(expected);
  });
  it.each([
    ['2026-01-31', '2026-02-02', 2],
    ['2026-12-31', '2027-01-02', 2],
    ['2024-02-28', '2024-03-01', 2],
    ['2026-10-01', '2026-10-01', 0],
    ['2026-10-02', '2026-10-01', -1],
  ])('cuenta noches del %s al %s', (start, end, expected) =>
    expect(nightsBetween(start, end)).toBe(expected),
  );
  it.each([
    ['2026-02-30', false],
    ['2026-02-29', false],
    ['2024-02-29', true],
    ['2026-10-06', true],
    ['2026-13-01', false],
    ['2026-1-01', false],
    ['texto', false],
  ])('valida %s', (date, expected) => expect(isIsoDate(date)).toBe(expected));
  it('usa la fecha de Lima aunque UTC ya esté en el día siguiente', () => {
    expect(todayIso(new Date('2026-01-01T04:59:59Z'))).toBe('2025-12-31');
    expect(todayIso(new Date('2026-01-01T05:00:00Z'))).toBe('2026-01-01');
  });
});
