import { useMemo, useState, type SubmitEvent } from 'react';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Field';
import { Dialog } from '@/components/ui/Dialog';
import {
  EXTRAS,
  EXTRA_KEYS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  RESERVATION_SOURCES,
  RESERVATION_SOURCE_KEYS,
  type ExtraKey,
  type PaymentMethod,
} from '@/lib/domain/catalog';
import { addDays, todayIso } from '@/lib/domain/dates';
import { centsToInput, formatMoney, toCents } from '@/lib/domain/money';
import { computeQuote } from '@/lib/domain/pricing';
import { refreshPage, runAction, type FieldErrors } from '@/lib/client/actions';
import { roomOptionLabel, type ReservationDraft, type RoomOption } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  rooms: RoomOption[];
  initial: Partial<ReservationDraft>;
  /** Si viene, se edita esa reserva (sin pago inicial). */
  editId?: string | undefined;
  /** Tarifa pactada de la reserva en edición (se respeta si no cambia la habitación). */
  lockedRate?: { roomId: string; nightlyRateCents: number } | undefined;
}

function emptyDraft(rooms: RoomOption[], initial: Partial<ReservationDraft>): ReservationDraft {
  const checkIn = initial.checkIn ?? todayIso();
  return {
    guestName: '',
    guestDocument: '',
    guestPhone: '',
    guestEmail: '',
    guests: 1,
    roomId: rooms.find((r) => r.active)?.id ?? '',
    discountPct: 0,
    extras: [],
    source: 'directa',
    notes: '',
    ...initial,
    checkIn,
    checkOut: initial.checkOut ?? addDays(checkIn, 1),
  };
}

export function ReservationForm({ open, onClose, rooms, initial, editId, lockedRate }: Props) {
  const [draft, setDraft] = useState<ReservationDraft>(() => emptyDraft(rooms, initial));
  const [depositInput, setDepositInput] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('yape_plin');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ReservationDraft>(key: K, value: ReservationDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const room = rooms.find((r) => r.id === draft.roomId);
  const nightly =
    lockedRate && lockedRate.roomId === draft.roomId ? lockedRate.nightlyRateCents : (room?.priceCents ?? 0);

  const quote = useMemo(
    () =>
      room
        ? computeQuote({
            rooms: [{ id: room.id, label: roomOptionLabel(room), priceCents: nightly }],
            checkIn: draft.checkIn,
            checkOut: draft.checkOut,
            discountPct: draft.discountPct,
            extras: draft.extras,
          })
        : null,
    [room, nightly, draft.checkIn, draft.checkOut, draft.discountPct, draft.extras],
  );

  const depositCents = depositInput === null ? (quote?.depositCents ?? 0) : toCents(depositInput || '0');
  const err = (key: string) => errors[`reservation.${key}`] ?? errors[key];

  function toggleExtra(key: ExtraKey, on: boolean) {
    set('extras', on ? [...draft.extras, key] : draft.extras.filter((k) => k !== key));
  }

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const reservation = { ...draft, guests: Number(draft.guests), discountPct: Number(draft.discountPct) || 0 };
    const ok = editId
      ? await runAction(actions.reservations.update({ id: editId, reservation }), {
          success: 'Reserva actualizada',
          onFieldErrors: setErrors,
        })
      : await runAction(
          actions.reservations.create({
            reservation,
            payment:
              depositCents > 0
                ? { amountCents: depositCents, method, kind: depositCents >= (quote?.totalCents ?? 0) ? 'saldo' : 'adelanto', paidOn, note: '' }
                : null,
          }),
          { onFieldErrors: setErrors },
        );
    setBusy(false);
    if (!ok) return;
    if (!editId && typeof ok === 'object' && 'code' in ok) {
      const { toast } = await import('sonner');
      toast.success(`Reserva ${ok.code} registrada`);
    }
    onClose();
    await refreshPage();
  }

  const nightsLabel = quote ? `${quote.nights} ${quote.nights === 1 ? 'noche' : 'noches'}` : '—';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editId ? 'Editar reserva' : 'Nueva reserva'}
      description={editId ? 'Los cambios de fechas o habitación recalculan el total.' : 'Se valida que la habitación esté libre en esas fechas.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="reservation-form" loading={busy} disabled={!quote}>
            {editId ? 'Guardar cambios' : 'Registrar reserva'}
          </Button>
        </>
      }
    >
      <form id="reservation-form" onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_15rem]" noValidate>
        <div className="space-y-5">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-ink">Huésped</legend>
            <Field label="Nombre completo" error={err('guestName')} className="sm:col-span-2">
              {(p) => (
                <Input {...p} value={draft.guestName} onChange={(e) => set('guestName', e.target.value)} required autoComplete="off" />
              )}
            </Field>
            <Field label="DNI / pasaporte" error={err('guestDocument')}>
              {(p) => <Input {...p} value={draft.guestDocument} onChange={(e) => set('guestDocument', e.target.value)} />}
            </Field>
            <Field label="Celular" error={err('guestPhone')}>
              {(p) => <Input {...p} type="tel" value={draft.guestPhone} onChange={(e) => set('guestPhone', e.target.value)} />}
            </Field>
            <Field label="Correo (opcional)" error={err('guestEmail')}>
              {(p) => <Input {...p} type="email" value={draft.guestEmail} onChange={(e) => set('guestEmail', e.target.value)} />}
            </Field>
            <Field label="Personas" error={err('guests')}>
              {(p) => (
                <Input {...p} type="number" min={1} max={20} value={draft.guests} onChange={(e) => set('guests', Number(e.target.value))} />
              )}
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold text-ink">Estadía</legend>
            <Field label="Habitación" error={err('roomId')} className="sm:col-span-2" hint={room && draft.guests > room.capacity ? `Capacidad recomendada: ${room.capacity} personas.` : undefined}>
              {(p) => (
                <Select {...p} value={draft.roomId} onChange={(e) => set('roomId', e.target.value)} required>
                  {rooms.length === 0 && <option value="">Registra una habitación primero</option>}
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.active && r.id !== draft.roomId}>
                      {roomOptionLabel(r)} — {formatMoney(r.priceCents)}/noche{r.active ? '' : ' (inactiva)'}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ingreso" error={err('checkIn')}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={draft.checkIn}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => ({ ...d, checkIn: v, checkOut: d.checkOut > v ? d.checkOut : addDays(v, 1) }));
                  }}
                  required
                />
              )}
            </Field>
            <Field label="Salida" error={err('checkOut')}>
              {(p) => (
                <Input {...p} type="date" min={addDays(draft.checkIn, 1)} value={draft.checkOut} onChange={(e) => set('checkOut', e.target.value)} required />
              )}
            </Field>
            <Field label="Descuento sobre alojamiento" error={err('discountPct')} hint="En porcentaje (0 a 100).">
              {(p) => (
                <Input {...p} type="number" min={0} max={100} value={draft.discountPct} onChange={(e) => set('discountPct', Number(e.target.value))} />
              )}
            </Field>
            <Field label="Origen" error={err('source')}>
              {(p) => (
                <Select {...p} value={draft.source} onChange={(e) => set('source', e.target.value as ReservationDraft['source'])}>
                  {RESERVATION_SOURCE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {RESERVATION_SOURCES[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="sm:col-span-2">
              <span className="field-label">Servicios adicionales</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXTRA_KEYS.map((k) => (
                  <Checkbox
                    key={k}
                    label={EXTRAS[k].label}
                    description={`${formatMoney(EXTRAS[k].amountCents)} ${EXTRAS[k].per === 'night' ? 'por noche' : 'por estadía'}`}
                    checked={draft.extras.includes(k)}
                    onChange={(e) => toggleExtra(k, e.target.checked)}
                  />
                ))}
              </div>
            </div>
            <Field label="Notas internas" className="sm:col-span-2" error={err('notes')}>
              {(p) => <Textarea {...p} rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Hora estimada de llegada, pedidos especiales…" />}
            </Field>
          </fieldset>
        </div>

        <aside className="space-y-4 md:sticky md:top-0 md:self-start">
          <div className="rounded-2xl bg-pine-900 p-4 text-pine-50">
            <p className="text-[13px] text-pine-200">Total de la estadía</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white tabular">{quote ? formatMoney(quote.totalCents) : '—'}</p>
            <dl className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-pine-200">{nightsLabel} × {formatMoney(nightly)}</dt>
                <dd className="tabular">{quote ? formatMoney(quote.subtotalCents) : '—'}</dd>
              </div>
              {quote && quote.discountCents > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-pine-200">Descuento {quote.discountPct}%</dt>
                  <dd className="tabular">−{formatMoney(quote.discountCents)}</dd>
                </div>
              )}
              {quote && quote.extrasCents > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-pine-200">Servicios</dt>
                  <dd className="tabular">{formatMoney(quote.extrasCents)}</dd>
                </div>
              )}
            </dl>
          </div>

          {!editId && (
            <div className="space-y-3 rounded-2xl border border-mist p-4">
              <p className="text-sm font-semibold">Pago recibido ahora</p>
              <Field label="Monto" hint={quote ? `50% sugerido: ${formatMoney(quote.depositCents)}` : undefined} error={err('payment.amountCents')}>
                {(p) => (
                  <MoneyInput
                    {...p}
                    value={depositInput ?? (quote ? centsToInput(quote.depositCents) : '')}
                    onChange={(e) => setDepositInput(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Medio de pago">
                {(p) => (
                  <Select {...p} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHOD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {PAYMENT_METHODS[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Fecha del pago">
                {(p) => <Input {...p} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
              </Field>
              {quote && (
                <p className="text-[13px] text-ink-muted">
                  Saldo para el ingreso:{' '}
                  <strong className="text-marigold-700 tabular">{formatMoney(Math.max(0, quote.totalCents - depositCents))}</strong>
                </p>
              )}
            </div>
          )}
        </aside>
      </form>
    </Dialog>
  );
}
