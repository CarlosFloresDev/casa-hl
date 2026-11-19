import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RESERVATION_STATUSES } from '@/lib/domain/catalog';
import { formatDateShort } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import type { ReservationDetail as Detail, ReservationRow } from '@/lib/server/reservations';
import { cn } from '@/lib/cn';
import type { ReservationDraft, RoomOption } from '../types';
import { ReservationDetail } from './ReservationDetail';
import { ReservationForm } from './ReservationForm';
import { PAYMENT_LABEL, PAYMENT_TONE, STATUS_TONE } from './status';

interface Props {
  rows: ReservationRow[];
  rooms: RoomOption[];
  isAdmin: boolean;
  filters: { estado: string; q: string };
  counts: Record<string, number>;
  /** Abre el formulario de nueva reserva con estos datos (desde calendario, cotizador o solicitudes). */
  prefill: Partial<ReservationDraft> | null;
  /** Abre el detalle de esta reserva al cargar. */
  openId: string | null;
}

const TABS = [
  { key: 'activas', label: 'Activas' },
  { key: 'confirmada', label: 'Por llegar' },
  { key: 'en_casa', label: 'En casa' },
  { key: 'finalizada', label: 'Finalizadas' },
  { key: 'cancelada', label: 'Canceladas' },
  { key: 'todas', label: 'Todas' },
] as const;

type FormState = { initial: Partial<ReservationDraft>; editId?: string; lockedRate?: { roomId: string; nightlyRateCents: number } };

export default function ReservationsManager({ rows, rooms, isAdmin, filters, counts, prefill, openId }: Props) {
  const [form, setForm] = useState<FormState | null>(prefill ? { initial: prefill } : null);
  const [detailId, setDetailId] = useState<string | null>(openId);

  // Limpia los parámetros de apertura para que recargar la página no vuelva a abrir el diálogo.
  useEffect(() => {
    const url = new URL(location.href);
    let changed = false;
    for (const key of ['nueva', 'ver', 'room', 'checkIn', 'checkOut', 'inquiry', 'discount', 'extras', 'name', 'phone', 'guests']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) history.replaceState(history.state, '', url);
  }, []);

  function edit(d: Detail) {
    setDetailId(null);
    setForm({
      editId: d.id,
      lockedRate: { roomId: d.roomId, nightlyRateCents: d.nightlyRateCents },
      initial: {
        guestName: d.guestName,
        guestDocument: d.guestDocument,
        guestPhone: d.guestPhone,
        guestEmail: d.guestEmail,
        guests: d.guests,
        roomId: d.roomId,
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        discountPct: d.discountPct,
        extras: d.extras.map((x) => x.key),
        source: d.source,
        notes: d.notes,
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrar por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => {
            const active = filters.estado === t.key;
            const params = new URLSearchParams({ estado: t.key, ...(filters.q ? { q: filters.q } : {}) });
            return (
              <a
                key={t.key}
                href={`?${params}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                  active ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface',
                )}
              >
                {t.label}
                {counts[t.key] !== undefined && <span className={cn('text-xs tabular', active ? 'text-white/70' : 'text-ink-muted')}>{counts[t.key]}</span>}
              </a>
            );
          })}
        </nav>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <form role="search" className="relative w-full sm:w-72">
            <input type="hidden" name="estado" value={filters.estado} />
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <label htmlFor="res-search" className="sr-only">
              Buscar reservas
            </label>
            <input id="res-search" name="q" defaultValue={filters.q} placeholder="Nombre, DNI, celular o código" className="field-input pl-9" />
          </form>
          <Button icon={<Plus className="size-4" />} onClick={() => setForm({ initial: {} })} disabled={rooms.length === 0}>
            Nueva reserva
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-mist bg-surface px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold">{filters.q ? 'No hay reservas que coincidan' : 'Sin reservas en esta vista'}</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
            {rooms.length === 0
              ? 'Primero registra tus habitaciones en la sección Habitaciones.'
              : filters.q
                ? 'Prueba con otro nombre, número de documento o código de reserva.'
                : 'Registra una nueva reserva o cambia el filtro de estado.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-mist bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-mist bg-stone/60 text-[13px] text-ink-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Huésped</th>
                  <th scope="col" className="px-3 py-3 font-medium">Habitación</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estadía</th>
                  <th scope="col" className="px-3 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-3 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {rows.map((r) => (
                  <tr key={r.id} className="group cursor-pointer transition-colors hover:bg-pine-50/60" onClick={() => setDetailId(r.id)}>
                    <td className="px-5 py-3">
                      <button type="button" className="text-left font-medium text-ink group-hover:text-pine-700" onClick={() => setDetailId(r.id)}>
                        {r.guestName}
                      </button>
                      <div className="text-[13px] text-ink-muted tabular">
                        {r.code}
                        {r.guestPhone && ` · ${r.guestPhone}`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium tabular">{r.roomNumber}</span>
                      {r.roomName && <span className="text-ink-muted"> · {r.roomName}</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular">
                      {formatDateShort(r.checkIn)} – {formatDateShort(r.checkOut)}
                      <div className="text-[13px] text-ink-muted">
                        {r.nights} {r.nights === 1 ? 'noche' : 'noches'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={STATUS_TONE[r.status]}>{RESERVATION_STATUSES[r.status]}</Badge>
                        {r.status !== 'cancelada' && r.paymentState !== 'pagado' && <Badge tone={PAYMENT_TONE[r.paymentState]}>{PAYMENT_LABEL[r.paymentState]}</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular">{formatMoney(r.totalCents)}</td>
                    <td className={cn('px-5 py-3 text-right font-medium tabular', r.balanceCents > 0 ? 'text-marigold-700' : 'text-ink-muted')}>
                      {r.balanceCents > 0 ? formatMoney(r.balanceCents) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <ReservationForm
          key={form.editId ?? 'new'}
          open
          onClose={() => setForm(null)}
          rooms={rooms}
          initial={form.initial}
          editId={form.editId}
          lockedRate={form.lockedRate}
        />
      )}
      <ReservationDetail reservationId={detailId} isAdmin={isAdmin} onClose={() => setDetailId(null)} onEdit={edit} />
    </div>
  );
}
