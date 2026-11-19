/** Todos los montos se manejan como enteros en céntimos para evitar errores de coma flotante. */

const formatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

/** 12345 → "S/ 123.45" */
export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

/** "123.45" | 123.45 → 12345. Devuelve NaN si la entrada no es numérica. */
export function toCents(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').trim());
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * 100);
}

/** 12345 → "123.45" (para inputs numéricos). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
