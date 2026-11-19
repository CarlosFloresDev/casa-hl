import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { ROOM_IMAGE_KEYS, type RoomImageKey } from './domain/catalog';

const files = import.meta.glob<ImageMetadata>('/src/assets/images/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
});

const byKey = new Map<string, ImageMetadata>(
  Object.entries(files).map(([path, meta]) => [path.split('/').pop()!.replace(/\.\w+$/, ''), meta]),
);

/** Imagen del catálogo por clave (p. ej. "room-doble"). Cae en una genérica si no existe. */
export function roomImage(key: string): ImageMetadata {
  return byKey.get(key) ?? byKey.get('room-simple')!;
}

export function siteImage(key: string): ImageMetadata {
  const img = byKey.get(key);
  if (!img) throw new Error(`Imagen no encontrada: ${key}`);
  return img;
}

/** Miniaturas optimizadas de todas las fotos asignables, para los selectores del panel. */
export async function roomThumbnails(width = 480): Promise<Record<RoomImageKey, string>> {
  const entries = await Promise.all(
    ROOM_IMAGE_KEYS.map(async (key) => {
      const img = await getImage({ src: roomImage(key), width, format: 'webp' });
      return [key, img.src] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<RoomImageKey, string>;
}
