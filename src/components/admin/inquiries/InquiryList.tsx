import { useId, useState, type KeyboardEvent } from 'react';
import { actions } from 'astro:actions';
import { MessageCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Dialog';
import {
  EXTRAS,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_KEYS,
  type InquiryStatus,
} from '@/lib/domain/catalog';
import { formatDate, nightsBetween, todayIso } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { runAction, refreshPage } from '@/lib/client/actions';
import { SITE, whatsappLink } from '@/config/site';
import type { Inquiry } from '@/lib/db/schema';

const tones: Record<InquiryStatus, BadgeTone> = {
  nueva: 'marigold',
  contactada: 'pine',
  convertida: 'ink',
  descartada: 'neutral',
};
const filters = ['todas', ...INQUIRY_STATUS_KEYS] as const;
type Filter = (typeof filters)[number];
export default function InquiryList({
  inquiries,
  rooms,
  isAdmin,
}: {
  inquiries: Inquiry[];
  rooms: { id: string; label: string }[];
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Inquiry | null>(null);
  const [error, setError] = useState('');
  const id = useId();
  const visible = inquiries.filter((inquiry) => filter === 'todas' || inquiry.status === filter);
  async function status(inquiry: Inquiry, next: InquiryStatus) {
    if (busy) return;
    setBusy(inquiry.id);
    setError('');
    try {
      const result = await runAction(
        actions.inquiries.setStatus({ id: inquiry.id, status: next }),
        { success: 'Estado actualizado.' },
      );
      if (result) await refreshPage();
    } catch {
      setError('No se pudo actualizar el estado. Intenta nuevamente.');
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(deleting.id);
    setError('');
    try {
      const result = await runAction(actions.inquiries.delete({ id: deleting.id }), {
        success: 'Solicitud eliminada.',
      });
      if (result) {
        setDeleting(null);
        await refreshPage();
      }
    } catch {
      setError('No se pudo eliminar la solicitud. Intenta nuevamente.');
    } finally {
      setBusy(null);
    }
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    if (event.key === 'ArrowRight') target = (index + 1) % filters.length;
    else if (event.key === 'ArrowLeft') target = (index + filters.length - 1) % filters.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = filters.length - 1;
    else return;
    event.preventDefault();
    setFilter(filters[target]!);
    document.getElementById(`${id}-${filters[target]}`)?.focus();
  }
  return (
    <section>
      <div
        role="tablist"
        aria-label="Estado de las solicitudes"
        className="mb-5 flex gap-2 overflow-x-auto pb-2"
      >
        {filters.map((key, index) => (
          <button
            key={key}
            id={`${id}-${key}`}
            type="button"
            role="tab"
            aria-selected={filter === key}
            aria-controls={`${id}-panel`}
            tabIndex={filter === key ? 0 : -1}
            onKeyDown={(event) => tabKey(event, index)}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm ${filter === key ? 'border-pine-700 bg-pine-700 text-white' : 'border-mist bg-surface text-ink-soft hover:bg-pine-50'}`}
          >
            {key === 'todas' ? 'Todas' : INQUIRY_STATUSES[key]}{' '}
            <span className="ml-1 tabular">
              {key === 'todas'
                ? inquiries.length
                : inquiries.filter((i) => i.status === key).length}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger-700">
          {error}
        </p>
      )}
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${filter}`}
        tabIndex={0}
        className="space-y-4"
      >
        {!visible.length && (
          <div className="rounded-[var(--radius-card)] border border-mist bg-surface p-8">
            <h2 className="font-display text-xl font-semibold">
              {inquiries.length ? 'No hay solicitudes con este estado' : 'Aún no hay solicitudes'}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Las solicitudes que envíen los huéspedes desde el sitio web aparecerán aquí para que
              puedas responderlas y crear sus reservas.
            </p>
          </div>
        )}
        {visible.map((inquiry) => {
          const message = `Hola, ${inquiry.name}. Te saludamos de ${SITE.name}. Gracias por tu consulta para el ${formatDate(inquiry.checkIn)} al ${formatDate(inquiry.checkOut)}. El total cotizado es ${formatMoney(inquiry.quotedTotalCents)}. Con gusto te ayudamos a coordinar tu reserva.`;
          return (
            <article
              key={inquiry.id}
              className="rounded-[var(--radius-card)] border border-mist bg-surface p-5 sm:p-6"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-display text-xl font-semibold">{inquiry.name}</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    Recibida el {formatDate(todayIso(new Date(inquiry.createdAt)))}
                  </p>
                </div>
                <Badge tone={tones[inquiry.status]}>{INQUIRY_STATUSES[inquiry.status]}</Badge>
              </header>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <a
                  className="break-all text-pine-700 underline"
                  href={`tel:${inquiry.phone.replace(/[^+\d]/g, '')}`}
                >
                  {inquiry.phone}
                </a>
                {inquiry.email && (
                  <a className="break-all text-pine-700 underline" href={`mailto:${inquiry.email}`}>
                    {inquiry.email}
                  </a>
                )}
              </div>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-ink-muted">Estadía</dt>
                  <dd>
                    {formatDate(inquiry.checkIn)} al {formatDate(inquiry.checkOut)}
                    <span className="block tabular">
                      {nightsBetween(inquiry.checkIn, inquiry.checkOut)} noches · {inquiry.guests}{' '}
                      {inquiry.guests === 1 ? 'huésped' : 'huéspedes'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Habitaciones solicitadas</dt>
                  <dd>
                    {inquiry.roomIds.length
                      ? inquiry.roomIds
                          .map(
                            (roomId) =>
                              rooms.find((room) => room.id === roomId)?.label ??
                              'Habitación no disponible',
                          )
                          .join(', ')
                      : 'Sin preferencia'}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Total cotizado</dt>
                  <dd className="text-lg font-semibold tabular">
                    {formatMoney(inquiry.quotedTotalCents)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Servicios adicionales</dt>
                  <dd>
                    {inquiry.extras.length
                      ? inquiry.extras.map((extra) => EXTRAS[extra].label).join(', ')
                      : 'Sin servicios adicionales'}
                  </dd>
                </div>
              </dl>
              {inquiry.message && (
                <div className="mt-4 rounded-xl bg-stone p-4 text-sm">
                  <h3 className="mb-1 font-medium">Mensaje</h3>
                  <p className="whitespace-pre-wrap break-words text-ink-soft">{inquiry.message}</p>
                </div>
              )}
              <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-mist pt-4">
                <a
                  href={whatsappLink(message, inquiry.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!!busy}
                  onClick={(event) => {
                    if (busy) {
                      event.preventDefault();
                      return;
                    }
                    if (inquiry.status === 'nueva') void status(inquiry, 'contactada');
                  }}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl bg-pine-700 px-4 py-2 text-sm font-medium text-white hover:bg-pine-800 ${busy ? 'opacity-55' : ''}`}
                >
                  <MessageCircle size={16} aria-hidden />
                  Responder por WhatsApp<span className="sr-only"> (abre otra pestaña)</span>
                </a>
                {inquiry.status !== 'convertida' && (
                  <a
                    className="inline-flex min-h-10 items-center rounded-xl border border-mist px-4 py-2 text-sm hover:bg-pine-50"
                    href={`/admin/reservas?nueva=1&inquiry=${encodeURIComponent(inquiry.id)}`}
                  >
                    Crear reserva
                  </a>
                )}
                {(inquiry.status === 'nueva' || inquiry.status === 'contactada') && (
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() => void status(inquiry, 'descartada')}
                  >
                    Descartar
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="danger-ghost"
                    disabled={!!busy}
                    icon={<Trash2 size={16} aria-hidden />}
                    onClick={() => setDeleting(inquiry)}
                  >
                    Eliminar
                  </Button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar solicitud"
        message={
          <>
            {error && (
              <p role="alert" className="mb-2 text-danger-700">
                {error}
              </p>
            )}
            Se eliminará la solicitud de {deleting?.name}. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar solicitud"
        busy={!!busy}
        onCancel={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={remove}
      />
    </section>
  );
}
