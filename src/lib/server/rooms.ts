import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { reservations, rooms, type Room } from '../db/schema';
import type { AmenityKey, RoomImageKey } from '../domain/catalog';
import { DomainError } from './errors';

export interface RoomInput {
  number: string;
  name: string;
  floor: number;
  type: string;
  capacity: number;
  priceCents: number;
  amenities: AmenityKey[];
  description: string;
  notes: string;
  image: RoomImageKey;
  published: boolean;
  sortOrder: number;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function roomLabel(room: Pick<Room, 'number' | 'name'>): string {
  return room.name ? `${room.number} · ${room.name}` : `Hab. ${room.number}`;
}

export async function listRooms(opts: { includeInactive?: boolean } = {}): Promise<Room[]> {
  return db
    .select()
    .from(rooms)
    .where(opts.includeInactive ? undefined : eq(rooms.active, true))
    .orderBy(asc(rooms.sortOrder), asc(rooms.number));
}

export async function listPublicRooms(): Promise<Room[]> {
  return db
    .select()
    .from(rooms)
    .where(and(eq(rooms.active, true), eq(rooms.published, true)))
    .orderBy(asc(rooms.sortOrder), asc(rooms.number));
}

export async function getRoom(id: string): Promise<Room | undefined> {
  return db.query.rooms.findFirst({ where: eq(rooms.id, id) });
}

export async function getRoomBySlug(slug: string): Promise<Room | undefined> {
  return db.query.rooms.findFirst({ where: and(eq(rooms.slug, slug), eq(rooms.active, true)) });
}

async function assertNumberFree(number: string, exceptId?: string) {
  const existing = await db.query.rooms.findFirst({ where: eq(rooms.number, number) });
  if (existing && existing.id !== exceptId) {
    throw new DomainError('CONFLICT', `Ya existe una habitación con el número ${number}.`);
  }
}

export async function createRoom(input: RoomInput): Promise<Room> {
  await assertNumberFree(input.number);
  const [room] = await db
    .insert(rooms)
    .values({ ...input, slug: slugify(`${input.number}-${input.name || input.type}`) })
    .returning();
  return room!;
}

export async function updateRoom(id: string, input: RoomInput): Promise<Room> {
  await assertNumberFree(input.number, id);
  const [room] = await db
    .update(rooms)
    .set({ ...input, slug: slugify(`${input.number}-${input.name || input.type}`) })
    .where(eq(rooms.id, id))
    .returning();
  if (!room) throw new DomainError('NOT_FOUND', 'La habitación no existe.');
  return room;
}

export async function setRoomActive(id: string, active: boolean): Promise<void> {
  await db.update(rooms).set({ active }).where(eq(rooms.id, id));
}

/** Solo se pueden eliminar habitaciones sin historial; las demás se desactivan. */
export async function deleteRoom(id: string): Promise<void> {
  const [row] = await db
    .select({ total: count() })
    .from(reservations)
    .where(eq(reservations.roomId, id));
  if ((row?.total ?? 0) > 0) {
    throw new DomainError(
      'CONFLICT',
      'Esta habitación tiene reservas registradas. Desactívala en lugar de eliminarla para conservar el historial.',
    );
  }
  await db.delete(rooms).where(eq(rooms.id, id));
}
