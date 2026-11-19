import { useEffect, useMemo, useState } from 'react';
import { actions } from 'astro:actions';
import { CalendarCheck, Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '@/components/ui/Field';
import { whatsappLink } from '@/config/site';
import {
  EXTRAS,
  EXTRA_KEYS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  type ExtraKey,
  type PaymentMethod,
} from '@/lib/domain/catalog';
import { addDays, formatDate, todayIso } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { computeQuote } from '@/lib/domain/pricing';
import { quoteMessage } from '@/lib/domain/quote-message';
import { refreshPage, runAction } from '@/lib/client/actions';
import { cn } from '@/lib/cn';
import { roomOptionLabel, type RoomOption } from '../types';

export default function QuoteBuilder({ rooms }: { rooms: RoomOption[] }) {
  const [client, setClient] = useState('');
  const [phone, setPhone] = useState('');
  const [guests, setGuests] = useState(2);
  const [checkIn, setCheckIn] = useState(todayIso());
  const [checkOut, setCheckOut] = useState(addDays(todayIso(), 1));
  const [selected, setSelected] = useState<string[]>([]);
  const [discount, setDiscount] = useState(0);
  const [extras, setExtras] = useState<ExtraKey[]>([]);
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (checkOut <= checkIn) return;
    let cancelled = false;
    actions.reservations.occupied({ checkIn, checkOut }).then(({ data }) => {
      if (!cancelled && data) setOccupied(new Set(data));
    });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut]);

  const chosen = rooms.filter((r) => selected.includes(r.id));
  const quote = useMemo(
    () =>
      computeQuote({
        rooms: chosen.map((r) => ({ id: r.id, label: roomOptionLabel(r), priceCents: r.priceCents })),
        checkIn,
        checkOut,
        discountPct: discount,
        extras,
      }),
    [chosen.map((r) => r.id).join(), checkIn, checkOut, discount, extras],
  );
  const message = quote ? quoteMessage({ clientName: client, quote, checkIn, checkOut, guests, from: 'staff' }) : '';
  const capacity = chosen.reduce((s, r) => s + r.capacity, 0);
  const conflicts = chosen.filter((r) => occupied.has(r.id));

  function toggleRoom(id: string, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  }

  function convert() {
    if (!quote) return;
    if (chosen.length === 1) {
      const params = new URLSearchParams({
        nueva: '1',
        room: chosen[0]!.id,
        checkIn,
        checkOut,
        guests: String(guests),
        ...(discount ? { discount: String(discount) } : {}),
        ...(extras.length ? { extras: extras.join(',') } : {}),
        ...(client ? { name: client } : {}),
        ...(phone ? { phone } : {}),
      });
      window.location.assign(`/admin/reservas?${params}`);
    } else {
      setConverting(true);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="space-y-6 rounded-[var(--radius-card)] border border-mist bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cliente" className="lg:col-span-2">
            {(p) => <Input {...p} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nombre de quien consulta" />}
          </Field>
          <Field label="Celular (WhatsApp)">
            {(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="951 234 567" />}
          </Field>
          <Field label="Personas">
            {(p) => <Input {...p} type="number" min={1} max={20} value={guests} onChange={(e) => setGuests(Number(e.target.value))} />}
          </Field>
          <Field label="Llegada">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1));
                }}
              />
            )}
          </Field>
          <Field label="Salida">
            {(p) => <Input {...p} type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />}
          </Field>
          <Field label="Descuento (%)" hint="Solo sobre alojamiento">
            {(p) => <Input {...p} type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />}
          </Field>
        </div>

        <fieldset>
          <legend className="field-label">Habitaciones</legend>
          {rooms.length === 0 ? (
            <p className="text-sm text-ink-muted">No hay habitaciones activas.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rooms.map((r) => {
                const busy = occupied.has(r.id);
                return (
                  <label
                    key={r.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors has-[:checked]:border-pine-400 has-[:checked]:bg-pine-50',
                      busy ? 'border-danger-500/30 bg-danger-50/40' : 'border-mist hover:border-pine-200',
                    )}
                  >
                    <input type="checkbox" className="size-4 accent-pine-700" checked={selected.includes(r.id)} onChange={(e) => toggleRoom(r.id, e.target.checked)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{roomOptionLabel(r)}</span>
                      <span className="block text-[13px] text-ink-muted">
                        {r.type} · hasta {r.capacity} {r.capacity === 1 ? 'persona' : 'personas'}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-medium tabular">{formatMoney(r.priceCents)}</span>
                      {busy ? <span className="text-xs text-danger-500">Ocupada</span> : <span className="text-xs text-pine-600">Libre</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="field-label">Servicios adicionales</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EXTRA_KEYS.map((k) => (
              <Checkbox
                key={k}
                label={EXTRAS[k].label}
                description={`${formatMoney(EXTRAS[k].amountCents)} ${EXTRAS[k].per === 'night' ? 'por noche' : 'por estadía'}`}
                checked={extras.includes(k)}
                onChange={(e) => setExtras((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <div className="overflow-hidden rounded-[var(--radius-card)] bg-pine-900 text-pine-50 shadow-[var(--shadow-soft)]">
          <div className="p-6">
            <p className="text-sm text-pine-200">Cotización{client ? ` para ${client}` : ''}</p>
            <p className="mt-1 font-display text-4xl font-semibold text-white tabular">{quote ? formatMoney(quote.totalCents) : 'S/ —'}</p>
            {quote ? (
              <p className="mt-1 text-sm text-pine-200">
                {formatDate(checkIn)} – {formatDate(checkOut)} · {quote.nights} {quote.nights === 1 ? 'noche' : 'noches'}
              </p>
            ) : (
              <p className="mt-1 text-sm text-pine-200">Elige habitaciones y fechas válidas.</p>
            )}
            {quote && (
              <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                {quote.roomLines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <dt className="text-pine-100">{l.label}</dt>
                    <dd className="tabular">{formatMoney(l.amountCents)}</dd>
                  </div>
                ))}
                {quote.discountCents > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-pine-100">Descuento {quote.discountPct}%</dt>
                    <dd className="tabular">−{formatMoney(quote.discountCents)}</dd>
                  </div>
                )}
                {quote.extraLines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <dt className="text-pine-100">{l.label}</dt>
                    <dd className="tabular">{formatMoney(l.amountCents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t border-white/10 pt-3 text-marigold-100">
                  <dt>Adelanto 50% para confirmar</dt>
                  <dd className="font-semibold tabular">{formatMoney(quote.depositCents)}</dd>
                </div>
              </dl>
            )}
            {quote && (capacity < guests || conflicts.length > 0) && (
              <div className="mt-4 space-y-1.5">
                {capacity < guests && <Badge tone="marigold">Capacidad para {capacity}, piden {guests}</Badge>}
                {conflicts.map((r) => (
                  <Badge key={r.id} tone="danger">
                    {r.number} está ocupada en esas fechas
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="grid gap-2 bg-black/15 p-4 sm:grid-cols-2">
            <a
              href={quote ? whatsappLink(message, phone || '') : undefined}
              target="_blank"
              rel="noopener"
              aria-disabled={!quote}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-medium text-ink transition hover:brightness-95',
                !quote && 'pointer-events-none opacity-50',
              )}
            >
              <MessageCircle className="size-4" /> Enviar por WhatsApp
            </a>
            <Button
              variant="secondary"
              size="lg"
              className="h-11 justify-center border-white/15 bg-white/10 text-white hover:bg-white/20"
              disabled={!quote}
              icon={<Copy className="size-4" />}
              onClick={async () => {
                await navigator.clipboard.writeText(message);
                toast.success('Cotización copiada');
              }}
            >
              Copiar texto
            </Button>
            <Button
              variant="accent"
              size="lg"
              className="h-11 justify-center sm:col-span-2"
              disabled={!quote || conflicts.length > 0}
              icon={<CalendarCheck className="size-4" />}
              onClick={convert}
            >
              Convertir en reserva
            </Button>
          </div>
        </div>
      </aside>

      {converting && quote && (
        <MultiConvert
          rooms={chosen}
          client={client}
          phone={phone}
          guests={guests}
          checkIn={checkIn}
          checkOut={checkOut}
          discount={discount}
          extras={extras}
          onClose={() => setConverting(false)}
        />
      )}
    </div>
  );
}

/** Crea una reserva por habitación. Los servicios extra se cargan solo a la primera. */
function MultiConvert(props: {
  rooms: RoomOption[];
  client: string;
  phone: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  discount: number;
  extras: ExtraKey[];
  onClose: () => void;
}) {
  const [name, setName] = useState(props.client);
  const [withDeposit, setWithDeposit] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('yape_plin');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      toast.error('Escribe el nombre del huésped.');
      return;
    }
    setBusy(true);
    const codes: string[] = [];
    for (const [i, room] of props.rooms.entries()) {
      const roomExtras = i === 0 ? props.extras : [];
      const q = computeQuote({
        rooms: [{ id: room.id, label: '', priceCents: room.priceCents }],
        checkIn: props.checkIn,
        checkOut: props.checkOut,
        discountPct: props.discount,
        extras: roomExtras,
      })!;
      const res = await runAction(
        actions.reservations.create({
          reservation: {
            guestName: name,
            guestDocument: '',
            guestPhone: props.phone,
            guestEmail: '',
            guests: Math.max(1, Math.min(room.capacity, props.guests)),
            roomId: room.id,
            checkIn: props.checkIn,
            checkOut: props.checkOut,
            discountPct: props.discount,
            extras: roomExtras,
            source: 'cotizacion',
            notes: props.rooms.length > 1 ? `Grupo de ${props.rooms.length} habitaciones` : '',
          },
          payment: withDeposit ? { amountCents: q.depositCents, method, kind: 'adelanto', paidOn: todayIso(), note: '' } : null,
        }),
      );
      if (!res) break;
      codes.push(res.code);
    }
    setBusy(false);
    if (codes.length) toast.success(`Reservas registradas: ${codes.join(', ')}`);
    if (codes.length === props.rooms.length) {
      props.onClose();
      window.location.assign('/admin/reservas');
    } else {
      await refreshPage();
    }
  }

  return (
    <Dialog
      open
      onClose={props.onClose}
      title={`Registrar ${props.rooms.length} reservas`}
      description="Se crea una reserva por habitación, con las mismas fechas y el mismo huésped responsable."
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            Registrar reservas
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Huésped responsable">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Checkbox label="Registrar el adelanto del 50% de cada habitación" checked={withDeposit} onChange={(e) => setWithDeposit(e.target.checked)} />
        {withDeposit && (
          <Field label="Medio de pago del adelanto">
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
        )}
      </div>
    </Dialog>
  );
}
