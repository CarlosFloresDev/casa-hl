import { DEPOSIT_RATE, EXTRAS, type ExtraKey } from './catalog';
import { nightsBetween } from './dates';

export interface QuoteRoomInput {
  id: string;
  label: string;
  priceCents: number;
}

export interface QuoteInput {
  rooms: QuoteRoomInput[];
  checkIn: string;
  checkOut: string;
  discountPct?: number;
  extras?: ExtraKey[];
}

export interface QuoteLine {
  key: string;
  label: string;
  amountCents: number;
}

export interface Quote {
  nights: number;
  roomLines: QuoteLine[];
  extraLines: QuoteLine[];
  subtotalCents: number;
  discountPct: number;
  discountCents: number;
  extrasCents: number;
  totalCents: number;
  depositCents: number;
}

export function clampDiscount(pct: number | undefined): number {
  if (!pct || !Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function extraAmount(key: ExtraKey, nights: number): number {
  const extra = EXTRAS[key];
  return extra.per === 'night' ? extra.amountCents * nights : extra.amountCents;
}

/**
 * Calcula una cotización. El descuento aplica solo al alojamiento, no a los servicios extra.
 * Devuelve `null` si el rango de fechas no es válido o no hay habitaciones.
 */
export function computeQuote(input: QuoteInput): Quote | null {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (!Number.isFinite(nights) || nights <= 0 || input.rooms.length === 0) return null;

  const roomLines = input.rooms.map((room) => ({
    key: room.id,
    label: room.label,
    amountCents: room.priceCents * nights,
  }));
  const subtotalCents = roomLines.reduce((sum, l) => sum + l.amountCents, 0);
  const discountPct = clampDiscount(input.discountPct);
  const discountCents = Math.round((subtotalCents * discountPct) / 100);

  const extraLines = [...new Set(input.extras ?? [])].map((key) => ({
    key,
    label: EXTRAS[key].label,
    amountCents: extraAmount(key, nights),
  }));
  const extrasCents = extraLines.reduce((sum, l) => sum + l.amountCents, 0);

  const totalCents = subtotalCents - discountCents + extrasCents;
  return {
    nights,
    roomLines,
    extraLines,
    subtotalCents,
    discountPct,
    discountCents,
    extrasCents,
    totalCents,
    depositCents: Math.round(totalCents * DEPOSIT_RATE),
  };
}

export type PaymentState = 'pendiente' | 'parcial' | 'pagado';

export function paymentState(totalCents: number, paidCents: number): PaymentState {
  if (paidCents <= 0 && totalCents > 0) return 'pendiente';
  if (paidCents < totalCents) return 'parcial';
  return 'pagado';
}

export function balanceCents(totalCents: number, paidCents: number): number {
  return Math.max(0, totalCents - paidCents);
}
