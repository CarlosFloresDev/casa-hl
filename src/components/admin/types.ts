import type { ExtraKey, ReservationSource } from '@/lib/domain/catalog';

/** Habitación reducida a lo que necesitan los formularios del panel. */
export interface RoomOption {
  id: string;
  number: string;
  name: string;
  type: string;
  capacity: number;
  priceCents: number;
  active: boolean;
}

export interface ReservationDraft {
  guestName: string;
  guestDocument: string;
  guestPhone: string;
  guestEmail: string;
  guests: number;
  roomId: string;
  checkIn: string;
  checkOut: string;
  discountPct: number;
  extras: ExtraKey[];
  source: ReservationSource;
  notes: string;
  inquiryId?: string;
}

export function roomOptionLabel(r: Pick<RoomOption, 'number' | 'name'>): string {
  return r.name ? `${r.number} · ${r.name}` : `Hab. ${r.number}`;
}
