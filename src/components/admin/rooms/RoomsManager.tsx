import { useState, type SubmitEvent } from 'react';
import { actions } from 'astro:actions';
import { EyeOff, Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Field';
import {
  AMENITIES,
  AMENITY_KEYS,
  ROOM_IMAGES,
  ROOM_IMAGE_KEYS,
  ROOM_TYPES,
  type AmenityKey,
  type RoomImageKey,
} from '@/lib/domain/catalog';
import { centsToInput, formatMoney, toCents } from '@/lib/domain/money';
import { refreshPage, runAction, type FieldErrors } from '@/lib/client/actions';
import { cn } from '@/lib/cn';
import type { Room } from '@/lib/db/schema';

interface Props {
  rooms: Room[];
  thumbnails: Record<RoomImageKey, string>;
  isAdmin: boolean;
  occupiedToday: string[];
}

type Draft = {
  number: string;
  name: string;
  floor: number;
  type: (typeof ROOM_TYPES)[number];
  capacity: number;
  price: string;
  amenities: AmenityKey[];
  description: string;
  notes: string;
  image: RoomImageKey;
  published: boolean;
  sortOrder: number;
};

function toDraft(room?: Room): Draft {
  return {
    number: room?.number ?? '',
    name: room?.name ?? '',
    floor: room?.floor ?? 1,
    type: (ROOM_TYPES as readonly string[]).includes(room?.type ?? '') ? (room!.type as Draft['type']) : 'Matrimonial',
    capacity: room?.capacity ?? 2,
    price: room ? centsToInput(room.priceCents) : '',
    amenities: room?.amenities ?? ['bano_privado', 'wifi', 'toallas'],
    description: room?.description ?? '',
    notes: room?.notes ?? '',
    image: (ROOM_IMAGE_KEYS as string[]).includes(room?.image ?? '') ? (room!.image as RoomImageKey) : 'room-simple',
    published: room?.published ?? true,
    sortOrder: room?.sortOrder ?? 0,
  };
}

export default function RoomsManager({ rooms, thumbnails, isAdmin, occupiedToday }: Props) {
  const [editing, setEditing] = useState<{ room?: Room } | null>(null);
  const [confirm, setConfirm] = useState<{ room: Room; kind: 'delete' | 'toggle' } | null>(null);
  const [busy, setBusy] = useState(false);
  const occupied = new Set(occupiedToday);

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    const ok =
      confirm.kind === 'delete'
        ? await runAction(actions.rooms.delete({ id: confirm.room.id }), { success: 'Habitación eliminada' })
        : await runAction(actions.rooms.setActive({ id: confirm.room.id, active: !confirm.room.active }), {
            success: confirm.room.active ? 'Habitación desactivada' : 'Habitación activada',
          });
    setBusy(false);
    setConfirm(null);
    if (ok) await refreshPage();
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        {isAdmin && (
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing({})}>
            Agregar habitación
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-mist bg-surface px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold">Aún no hay habitaciones</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
            Agrega cada habitación con su precio por noche y servicios. Aparecerán en el sitio web, el calendario y el cotizador.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id} className={cn('flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-mist bg-surface', !room.active && 'opacity-70')}>
              <div className="relative aspect-[16/10] bg-stone">
                <img src={thumbnails[room.image as RoomImageKey] ?? thumbnails['room-simple']} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {!room.active ? (
                    <Badge tone="danger">Inactiva</Badge>
                  ) : occupied.has(room.id) ? (
                    <Badge tone="ink">Ocupada hoy</Badge>
                  ) : (
                    <Badge tone="pine">Libre hoy</Badge>
                  )}
                  {!room.published && room.active && (
                    <Badge>
                      <EyeOff className="size-3" /> Oculta en web
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">
                      {room.number}
                      {room.name && <span className="font-normal text-ink-muted"> · {room.name}</span>}
                    </h2>
                    <p className="text-sm text-ink-muted">
                      {room.type} · Piso {room.floor} ·{' '}
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden /> {room.capacity}
                      </span>
                    </p>
                  </div>
                  <p className="text-right">
                    <span className="block font-display text-xl font-semibold tabular">{formatMoney(room.priceCents)}</span>
                    <span className="text-xs text-ink-muted">por noche</span>
                  </p>
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {room.amenities.map((a) => (
                    <li key={a} className="rounded-full bg-stone px-2.5 py-0.5 text-xs text-ink-soft">
                      {AMENITIES[a] ?? a}
                    </li>
                  ))}
                </ul>
                {room.notes && <p className="mt-3 text-[13px] text-ink-muted">Nota interna: {room.notes}</p>}
                <div className="min-h-4 flex-1" />
                {isAdmin && (
                  <div className="mt-auto flex gap-1 border-t border-mist pt-3">
                    <Button variant="ghost" size="sm" icon={<Pencil className="size-4" />} onClick={() => setEditing({ room })}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Power className="size-4" />} onClick={() => setConfirm({ room, kind: 'toggle' })}>
                      {room.active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <span className="flex-1" />
                    <Button variant="danger-ghost" size="icon" aria-label={`Eliminar habitación ${room.number}`} onClick={() => setConfirm({ room, kind: 'delete' })}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <RoomForm room={editing.room} thumbnails={thumbnails} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={confirm !== null}
        busy={busy}
        title={confirm?.kind === 'delete' ? 'Eliminar habitación' : confirm?.room.active ? 'Desactivar habitación' : 'Activar habitación'}
        confirmLabel={confirm?.kind === 'delete' ? 'Eliminar' : confirm?.room.active ? 'Desactivar' : 'Activar'}
        tone={confirm?.kind === 'delete' || confirm?.room.active ? 'danger' : 'primary'}
        message={
          confirm?.kind === 'delete'
            ? 'Solo se pueden eliminar habitaciones sin reservas. Si tiene historial, desactívala.'
            : confirm?.room.active
              ? 'Dejará de aparecer en el sitio, el calendario y el cotizador. Sus reservas se conservan.'
              : 'Volverá a estar disponible para nuevas reservas.'
        }
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function RoomForm({ room, thumbnails, onClose }: { room?: Room | undefined; thumbnails: Record<RoomImageKey, string>; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(room));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { price, ...rest } = d;
    const priceCents = toCents(price);
    const input = { ...rest, priceCents: Number.isNaN(priceCents) ? 0 : priceCents };
    const ok = room
      ? await runAction(actions.rooms.update({ ...input, id: room.id }), { success: 'Habitación actualizada', onFieldErrors: setErrors })
      : await runAction(actions.rooms.create(input), { success: 'Habitación agregada', onFieldErrors: setErrors });
    setBusy(false);
    if (ok) {
      onClose();
      await refreshPage();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={room ? `Editar habitación ${room.number}` : 'Agregar habitación'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="room-form" loading={busy}>
            {room ? 'Guardar cambios' : 'Agregar habitación'}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Número" error={errors.number}>
            {(p) => <Input {...p} value={d.number} onChange={(e) => set('number', e.target.value)} placeholder="101" required />}
          </Field>
          <Field label="Nombre comercial" error={errors.name} className="sm:col-span-2">
            {(p) => <Input {...p} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Matrimonial con balcón" />}
          </Field>
          <Field label="Piso" error={errors.floor}>
            {(p) => <Input {...p} type="number" min={0} value={d.floor} onChange={(e) => set('floor', Number(e.target.value))} />}
          </Field>
          <Field label="Tipo" error={errors.type} className="sm:col-span-2">
            {(p) => (
              <Select {...p} value={d.type} onChange={(e) => set('type', e.target.value as Draft['type'])}>
                {ROOM_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Capacidad" error={errors.capacity}>
            {(p) => <Input {...p} type="number" min={1} max={20} value={d.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />}
          </Field>
          <Field label="Precio por noche" error={errors.priceCents}>
            {(p) => <MoneyInput {...p} value={d.price} onChange={(e) => set('price', e.target.value)} placeholder="80.00" required />}
          </Field>
        </div>

        <div>
          <span className="field-label">Servicios incluidos</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {AMENITY_KEYS.map((k) => (
              <Checkbox
                key={k}
                label={AMENITIES[k]}
                checked={d.amenities.includes(k)}
                onChange={(e) => set('amenities', e.target.checked ? [...d.amenities, k] : d.amenities.filter((a) => a !== k))}
              />
            ))}
          </div>
        </div>

        <Field label="Descripción para el sitio web" error={errors.description} hint="Una o dos frases: camas, vista, para quién es ideal.">
          {(p) => <Textarea {...p} value={d.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>

        <fieldset>
          <legend className="field-label">Foto</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROOM_IMAGE_KEYS.map((k) => (
              <label key={k} className="group relative cursor-pointer overflow-hidden rounded-xl ring-2 ring-transparent has-[:checked]:ring-pine-600">
                <input type="radio" name="image" value={k} checked={d.image === k} onChange={() => set('image', k)} className="peer sr-only" />
                <img src={thumbnails[k]} alt="" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5 text-xs text-white">{ROOM_IMAGES[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field label="Nota interna (no se publica)" error={errors.notes}>
            {(p) => <Input {...p} value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ducha con presión baja, revisar" />}
          </Field>
          <Field label="Orden" hint="Menor primero">
            {(p) => <Input {...p} type="number" min={0} value={d.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />}
          </Field>
        </div>
        <Checkbox label="Mostrar en el sitio web" description="Si la desmarcas, solo se usa internamente." checked={d.published} onChange={(e) => set('published', e.target.checked)} />
      </form>
    </Dialog>
  );
}
