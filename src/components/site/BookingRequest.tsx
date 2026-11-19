import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { actions } from 'astro:actions';
import { Check, LoaderCircle, MessageCircle, Users } from 'lucide-react';
import { SITE, whatsappLink } from '@/config/site';
import { EXTRAS, EXTRA_KEYS, type ExtraKey } from '@/lib/domain/catalog';
import { addDays, formatDate } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { computeQuote } from '@/lib/domain/pricing';
import { quoteMessage } from '@/lib/domain/quote-message';
import { fieldErrors, type FieldErrors } from '@/lib/client/errors';
import { cn } from '@/lib/cn';

export interface PublicRoom {
  id: string;
  name: string;
  number: string;
  type: string;
  capacity: number;
  priceCents: number;
  image: string;
}

interface Props {
  rooms: PublicRoom[];
  today: string;
  initial: { checkIn: string; checkOut: string; guests: number; roomId: string | null };
}

type Availability = Record<string, boolean>;

export default function BookingRequest({ rooms, today, initial }: Props) {
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState(initial.guests);
  const [selected, setSelected] = useState<string[]>(initial.roomId ? [initial.roomId] : []);
  const [extras, setExtras] = useState<ExtraKey[]>([]);
  const [contact, setContact] = useState({ name: '', phone: '', email: '', message: '', website: '' });
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ totalCents: number } | null>(null);

  const validRange = checkOut > checkIn && checkIn >= today;

  useEffect(() => {
    if (!validRange) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      const { data } = await actions.site.availability({ checkIn, checkOut });
      if (cancelled) return;
      setChecking(false);
      if (data) {
        const map = Object.fromEntries(data.map((d) => [d.id, d.available]));
        setAvailability(map);
        setSelected((s) => s.filter((id) => map[id] !== false));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [checkIn, checkOut, validRange]);

  const chosen = rooms.filter((r) => selected.includes(r.id));
  const capacity = chosen.reduce((s, r) => s + r.capacity, 0);
  const quote = useMemo(
    () =>
      computeQuote({
        rooms: chosen.map((r) => ({ id: r.id, label: r.name || `Habitación ${r.number}`, priceCents: r.priceCents })),
        checkIn,
        checkOut,
        extras,
      }),
    [selected.join(), checkIn, checkOut, extras.join()],
  );

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSending(true);
    const { data, error } = await actions.site.requestBooking({
      checkIn,
      checkOut,
      guests,
      roomIds: selected,
      extras,
      ...contact,
    });
    setSending(false);
    if (error) {
      const fe = fieldErrors(error);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? 'Revisa los datos marcados.' : error.message);
      return;
    }
    setErrors({});
    setSent({ totalCents: data.quotedTotalCents });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (sent && quote) {
    const text = quoteMessage({ clientName: contact.name, quote, checkIn, checkOut, guests, from: 'guest' });
    return (
      <div className="mx-auto max-w-xl rounded-[1.75rem] bg-surface p-8 text-center shadow-[var(--shadow-soft)] sm:p-12" role="status">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-pine-50 text-pine-700">
          <Check className="size-7" aria-hidden />
        </span>
        <h2 className="mt-6 font-serif text-4xl">Recibimos tu solicitud</h2>
        <p className="mt-3 text-[17px] text-ink-soft">
          Te escribiremos al {contact.phone} para confirmar la disponibilidad del {formatDate(checkIn)} al {formatDate(checkOut)} y coordinar el adelanto de{' '}
          <strong className="text-ink">{formatMoney(quote.depositCents)}</strong>.
        </p>
        <p className="mt-3 text-ink-muted">Si prefieres no esperar, envíanos el resumen por WhatsApp.</p>
        <a
          href={whatsappLink(text)}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#25D366] px-6 font-semibold text-ink transition hover:brightness-95"
        >
          <MessageCircle className="size-5" aria-hidden /> Enviar resumen por WhatsApp
        </a>
      </div>
    );
  }

  const err = (k: string) => errors[k];

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
      <div className="space-y-10">
        {/* Fechas */}
        <fieldset>
          <legend className="font-serif text-[2rem] leading-tight">Fechas</legend>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="b-in" className="field-label">Llegada</label>
              <input
                id="b-in"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1));
                }}
                className="field-input"
                aria-invalid={err('checkIn') ? true : undefined}
              />
              {err('checkIn') && <p className="mt-1.5 text-[13px] text-danger-500">{err('checkIn')}</p>}
            </div>
            <div>
              <label htmlFor="b-out" className="field-label">Salida</label>
              <input id="b-out" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="field-input" aria-invalid={err('checkOut') ? true : undefined} />
              {err('checkOut') && <p className="mt-1.5 text-[13px] text-danger-500">{err('checkOut')}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="b-guests" className="field-label">Personas</label>
              <input id="b-guests" type="number" min={1} max={20} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))} className="field-input" />
            </div>
          </div>
        </fieldset>

        {/* Habitaciones */}
        <fieldset>
          <legend className="flex w-full items-center justify-between gap-3 font-serif text-[2rem] leading-tight">
            Habitación
            {checking && (
              <span className="flex items-center gap-1.5 font-sans text-sm font-normal text-ink-muted">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Revisando disponibilidad
              </span>
            )}
          </legend>
          <p className="mt-1 text-[15px] text-ink-muted">Puedes elegir más de una si viajan en grupo.</p>
          {err('roomIds') && <p className="mt-2 text-[13px] text-danger-500">{err('roomIds')}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rooms.map((r) => {
              const unavailable = availability?.[r.id] === false;
              const isOn = selected.includes(r.id);
              return (
                <label
                  key={r.id}
                  className={cn(
                    'relative flex cursor-pointer gap-3 overflow-hidden rounded-2xl border bg-surface p-3 transition-colors',
                    unavailable ? 'cursor-not-allowed border-mist opacity-55' : isOn ? 'border-pine-500 ring-1 ring-pine-500' : 'border-mist hover:border-pine-200',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isOn}
                    disabled={unavailable}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                  />
                  <img src={r.image} alt="" className="size-20 shrink-0 rounded-xl object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{r.name || `Habitación ${r.number}`}</span>
                    <span className="flex items-center gap-1 text-[13px] text-ink-muted">
                      <Users className="size-3.5" aria-hidden /> hasta {r.capacity}
                    </span>
                    <span className="mt-1 block text-[15px] font-medium tabular">
                      {formatMoney(r.priceCents)} <span className="font-normal text-ink-muted">/ noche</span>
                    </span>
                    {unavailable && <span className="text-[13px] text-danger-500">No disponible en esas fechas</span>}
                  </span>
                  <span
                    className={cn('grid size-6 shrink-0 place-items-center rounded-full border transition-colors', isOn ? 'border-pine-600 bg-pine-600 text-white' : 'border-mist')}
                    aria-hidden
                  >
                    {isOn && <Check className="size-3.5" />}
                  </span>
                </label>
              );
            })}
          </div>
          {chosen.length > 0 && capacity < guests && (
            <p className="mt-3 rounded-xl bg-marigold-50 px-4 py-2.5 text-sm text-marigold-700">
              Las habitaciones elegidas son para {capacity} {capacity === 1 ? 'persona' : 'personas'}. Agrega otra o cuéntanos en el mensaje.
            </p>
          )}
        </fieldset>

        {/* Extras */}
        <fieldset>
          <legend className="font-serif text-[2rem] leading-tight">Servicios adicionales</legend>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {EXTRA_KEYS.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-3 rounded-xl border border-mist px-4 py-3 has-[:checked]:border-pine-400 has-[:checked]:bg-pine-50">
                <input
                  type="checkbox"
                  className="size-4 accent-pine-700"
                  checked={extras.includes(k)}
                  onChange={(e) => setExtras((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))}
                />
                <span className="flex-1">{EXTRAS[k].label}</span>
                <span className="text-sm text-ink-muted tabular">
                  {formatMoney(EXTRAS[k].amountCents)}
                  {EXTRAS[k].per === 'night' ? ' / noche' : ''}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Contacto */}
        <fieldset>
          <legend className="font-serif text-[2rem] leading-tight">Tus datos</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="b-name" className="field-label">Nombre y apellido</label>
              <input id="b-name" autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="field-input" aria-invalid={err('name') ? true : undefined} required />
              {err('name') && <p className="mt-1.5 text-[13px] text-danger-500">{err('name')}</p>}
            </div>
            <div>
              <label htmlFor="b-phone" className="field-label">Celular (WhatsApp)</label>
              <input id="b-phone" type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="field-input" aria-invalid={err('phone') ? true : undefined} placeholder="951 234 567" required />
              {err('phone') && <p className="mt-1.5 text-[13px] text-danger-500">{err('phone')}</p>}
            </div>
            <div>
              <label htmlFor="b-email" className="field-label">Correo (opcional)</label>
              <input id="b-email" type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="field-input" aria-invalid={err('email') ? true : undefined} />
              {err('email') && <p className="mt-1.5 text-[13px] text-danger-500">{err('email')}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="b-msg" className="field-label">Mensaje (opcional)</label>
              <textarea id="b-msg" rows={3} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} className="field-input" placeholder="Hora aproximada de llegada, si viajas con niños, etc." />
            </div>
            {/* Campo trampa para bots */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
              <label htmlFor="b-web">No llenar</label>
              <input id="b-web" tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
            </div>
          </div>
        </fieldset>
      </div>

      {/* Resumen */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-pine-900 p-6 text-pine-50 sm:p-7">
          <h2 className="text-sm text-pine-200">Tu estadía</h2>
          {quote ? (
            <>
              <p className="mt-1 font-serif text-5xl text-white tabular">{formatMoney(quote.totalCents)}</p>
              <p className="mt-1 text-sm text-pine-200">
                {formatDate(checkIn)} – {formatDate(checkOut)} · {quote.nights} {quote.nights === 1 ? 'noche' : 'noches'}
              </p>
              <dl className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
                {quote.roomLines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <dt className="text-pine-100">{l.label}</dt>
                    <dd className="tabular">{formatMoney(l.amountCents)}</dd>
                  </div>
                ))}
                {quote.extraLines.map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <dt className="text-pine-100">{l.label}</dt>
                    <dd className="tabular">{formatMoney(l.amountCents)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex justify-between gap-3 rounded-xl bg-white/8 px-4 py-3 text-sm">
                <span>Adelanto para separar (50%)</span>
                <strong className="text-marigold-100 tabular">{formatMoney(quote.depositCents)}</strong>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-pine-200">Elige fechas válidas y al menos una habitación para ver el precio.</p>
          )}
          {formError && (
            <p className="mt-4 rounded-xl bg-danger-500/20 px-4 py-2.5 text-sm text-white" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={sending || !quote}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-marigold-500 font-semibold text-ink transition hover:brightness-95 disabled:opacity-50"
          >
            {sending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Enviar solicitud
          </button>
          <p className="mt-3 text-center text-[13px] text-pine-300">Aún no pagas nada. Te confirmamos por WhatsApp.</p>
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          ¿Dudas?{' '}
          <a className="text-pine-700 underline-offset-2 hover:underline" href={whatsappLink(`Hola, tengo una consulta sobre ${SITE.name}.`)} target="_blank" rel="noopener">
            Escríbenos por WhatsApp
          </a>
        </p>
      </aside>
    </form>
  );
}
