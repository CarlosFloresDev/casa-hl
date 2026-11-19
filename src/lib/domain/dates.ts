/**
 * Las fechas de estadía se guardan como cadenas ISO "YYYY-MM-DD" (fechas de calendario sin hora).
 * Toda la aritmética se hace en UTC para no depender de la zona horaria del servidor.
 */

export const BUSINESS_TIME_ZONE = 'America/Lima';
const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Fecha de hoy en la zona horaria del negocio (Perú). */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Noches entre check-in y check-out. 0 o negativo si el rango no es válido. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((toUtc(checkOut) - toUtc(checkIn)) / DAY_MS);
}

/**
 * Dos estadías se cruzan si una empieza antes de que la otra termine.
 * El día de salida queda libre para un nuevo ingreso.
 */
export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/** ¿La noche de `date` está ocupada por una estadía [checkIn, checkOut)? */
export function occupiesNight(date: string, checkIn: string, checkOut: string): boolean {
  return date >= checkIn && date < checkOut;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function monthDates(year: number, month0: number): string[] {
  const total = daysInMonth(year, month0);
  return Array.from({ length: total }, (_, i) =>
    new Date(Date.UTC(year, month0, i + 1)).toISOString().slice(0, 10),
  );
}

const longFmt = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortFmt = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-10-06" → "6 oct. 2026" */
export function formatDate(date: string): string {
  return longFmt.format(new Date(toUtc(date)));
}

/** "2026-10-06" → "6 oct." */
export function formatDateShort(date: string): string {
  return shortFmt.format(new Date(toUtc(date)));
}

export function formatWeekday(date: string): string {
  return weekdayFmt.format(new Date(toUtc(date)));
}

/** (2026, 9) → "octubre de 2026" */
export function formatMonth(year: number, month0: number): string {
  return monthFmt.format(new Date(Date.UTC(year, month0, 1)));
}

export function formatRange(checkIn: string, checkOut: string): string {
  return `${formatDateShort(checkIn)} – ${formatDate(checkOut)}`;
}
