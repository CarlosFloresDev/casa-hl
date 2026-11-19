import { useEffect, useState, type SubmitEvent } from 'react';
import { actions } from 'astro:actions';
import { DoorClosed, DoorOpen, MessageCircle, Pencil, Printer, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import { SITE, whatsappLink } from '@/config/site';
import {
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  type PaymentMethod,
  type ReservationStatus,
} from '@/lib/domain/catalog';
import { formatDate, todayIso } from '@/lib/domain/dates';
import { centsToInput, formatMoney, toCents } from '@/lib/domain/money';
import { refreshPage, runAction, type FieldErrors } from '@/lib/client/actions';
import type { ReservationDetail as Detail } from '@/lib/server/reservations';
import { PAYMENT_LABEL, PAYMENT_TONE, STATUS_TONE } from './status';

interface Props {
  reservationId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (detail: Detail) => void;
}

type Pending = { kind: 'status'; status: ReservationStatus; label: string } | { kind: 'delete' } | { kind: 'payment-delete'; id: string };

export function ReservationDetail({ reservationId, isAdmin, onClose, onEdit }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(id: string) {
    setLoading(true);
    const data = await runAction(actions.reservations.get({ id }));
    setLoading(false);
    if (data === null) {
      const { toast } = await import('sonner');
      toast.error('La reserva no existe o fue eliminada.');
      onClose();
      return;
    }
    if (data) setDetail(data);
  }

  useEffect(() => {
    setDetail(null);
    if (reservationId) void load(reservationId);
  }, [reservationId]);

  async function confirmPending() {
    if (!pending || !detail) return;
    setBusy(true);
    let ok: unknown;
    if (pending.kind === 'status') {
      ok = await runAction(actions.reservations.setStatus({ id: detail.id, status: pending.status }), {
        success: `Reserva ${RESERVATION_STATUSES[pending.status].toLowerCase()}`,
      });
    } else if (pending.kind === 'delete') {
      ok = await runAction(actions.reservations.delete({ id: detail.id }), { success: 'Reserva eliminada' });
    } else {
      ok = await runAction(actions.reservations.deletePayment({ id: pending.id }), { success: 'Pago eliminado' });
    }
    setBusy(false);
    setPending(null);
    if (!ok) return;
    if (pending.kind === 'delete') {
      onClose();
    } else {
      await load(detail.id);
    }
    await refreshPage();
  }

  const open = reservationId !== null;
  const r = detail;
  const active = r && (r.status === 'confirmada' || r.status === 'en_casa');

  const guestMessage = r
    ? `Hola ${r.guestName.split(' ')[0]}, te escribimos de ${SITE.name}. Tu reserva ${r.code} está registrada del ${formatDate(r.checkIn)} al ${formatDate(r.checkOut)} en la habitación ${r.roomNumber}. Total: ${formatMoney(r.totalCents)}. Pagado: ${formatMoney(r.paidCents)}.${r.balanceCents > 0 ? ` Saldo a pagar al ingresar: ${formatMoney(r.balanceCents)}.` : ''} Ingreso desde las ${SITE.checkInTime}. ¡Te esperamos!`
    : '';

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        title={r ? `${r.code} · ${r.guestName}` : 'Reserva'}
        description={
          r ? `Hab. ${r.roomNumber}${r.roomName ? ` · ${r.roomName}` : ''} · ${formatDate(r.checkIn)} – ${formatDate(r.checkOut)}` : loading ? 'Cargando…' : undefined
        }
        footer={
          r ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              {isAdmin && (
                <Button variant="danger-ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setPending({ kind: 'delete' })}>
                  Eliminar
                </Button>
              )}
              <span className="flex-1" />
              {r.guestPhone && (
                <a
                  href={whatsappLink(guestMessage, r.guestPhone)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mist bg-surface px-3 text-[13px] font-medium hover:bg-pine-50"
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
              <a
                href={`/admin/reservas/${r.id}/comprobante`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-mist bg-surface px-3 text-[13px] font-medium hover:bg-pine-50"
              >
                <Printer className="size-4" /> Comprobante
              </a>
              <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => onEdit(r)}>
                Editar
              </Button>
            </div>
          ) : undefined
        }
      >
        {!r ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-stone" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[r.status]}>{RESERVATION_STATUSES[r.status]}</Badge>
              {r.status !== 'cancelada' && <Badge tone={PAYMENT_TONE[r.paymentState]}>{PAYMENT_LABEL[r.paymentState]}</Badge>}
              <Badge>{RESERVATION_SOURCES[r.source]}</Badge>
              <span className="flex-1" />
              {r.status === 'confirmada' && r.checkIn <= todayIso() && (
                <Button size="sm" icon={<DoorOpen className="size-4" />} onClick={() => setPending({ kind: 'status', status: 'en_casa', label: 'Registrar ingreso' })}>
                  Registrar ingreso
                </Button>
              )}
              {r.status === 'en_casa' && (
                <Button size="sm" icon={<DoorClosed className="size-4" />} onClick={() => setPending({ kind: 'status', status: 'finalizada', label: 'Registrar salida' })}>
                  Registrar salida
                </Button>
              )}
              {active && (
                <Button variant="ghost" size="sm" icon={<XCircle className="size-4" />} onClick={() => setPending({ kind: 'status', status: 'cancelada', label: 'Cancelar reserva' })}>
                  Cancelar
                </Button>
              )}
              {(r.status === 'cancelada' || r.status === 'finalizada') && (
                <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setPending({ kind: 'status', status: 'confirmada', label: 'Reactivar reserva' })}>
                  Reactivar
                </Button>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <dl className="space-y-2 text-sm">
                <Row label="Documento" value={r.guestDocument || '—'} />
                <Row label="Celular" value={r.guestPhone || '—'} />
                <Row label="Correo" value={r.guestEmail || '—'} />
                <Row label="Personas" value={String(r.guests)} />
                <Row label="Noches" value={String(r.nights)} />
                {r.notes && <Row label="Notas" value={r.notes} />}
              </dl>
              <dl className="space-y-2 rounded-2xl bg-stone p-4 text-sm">
                <Row label={`${r.nights} × ${formatMoney(r.nightlyRateCents)}`} value={formatMoney(r.subtotalCents)} />
                {r.discountCents > 0 && <Row label={`Descuento ${r.discountPct}%`} value={`−${formatMoney(r.discountCents)}`} />}
                {r.extras.map((x) => (
                  <Row key={x.key} label={x.label} value={formatMoney(x.amountCents)} />
                ))}
                <div className="my-2 border-t border-mist" />
                <Row label="Total" value={formatMoney(r.totalCents)} strong />
                <Row label="Pagado" value={formatMoney(r.paidCents)} />
                <div className="flex justify-between gap-3 text-[15px]">
                  <dt className="font-medium">Saldo</dt>
                  <dd className={r.balanceCents > 0 ? 'font-semibold text-marigold-700 tabular' : 'font-semibold text-pine-700 tabular'}>
                    {formatMoney(r.balanceCents)}
                  </dd>
                </div>
              </dl>
            </div>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Pagos</h3>
              {r.payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-mist px-4 py-3 text-sm text-ink-muted">Aún no se registran pagos.</p>
              ) : (
                <ul className="divide-y divide-mist rounded-xl border border-mist">
                  {r.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-24 text-ink-muted tabular">{formatDate(p.paidOn)}</span>
                      <span className="flex-1">
                        {PAYMENT_KINDS[p.kind]} · {PAYMENT_METHODS[p.method]}
                        {p.note && <span className="text-ink-muted"> · {p.note}</span>}
                      </span>
                      <span className="font-medium tabular">{formatMoney(p.amountCents)}</span>
                      {isAdmin && (
                        <Button variant="danger-ghost" size="icon" aria-label="Eliminar pago" onClick={() => setPending({ kind: 'payment-delete', id: p.id })}>
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {active && r.balanceCents > 0 && <PaymentForm reservationId={r.id} balanceCents={r.balanceCents} onSaved={() => load(r.id)} />}
            </section>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        title={pending?.kind === 'status' ? pending.label : pending?.kind === 'delete' ? 'Eliminar reserva' : 'Eliminar pago'}
        confirmLabel={pending?.kind === 'status' ? pending.label : 'Eliminar'}
        tone={pending?.kind === 'status' && pending.status !== 'cancelada' ? 'primary' : 'danger'}
        message={
          pending?.kind === 'delete'
            ? 'Se borrará la reserva y todos sus pagos. Esta acción no se puede deshacer. Si el huésped no vendrá, es mejor cancelarla.'
            : pending?.kind === 'payment-delete'
              ? 'El pago dejará de contar en la caja y el saldo de la reserva aumentará.'
              : pending?.kind === 'status' && pending.status === 'en_casa' && r && r.balanceCents > 0
                ? `El huésped tiene un saldo de ${formatMoney(r.balanceCents)}. Puedes registrar el ingreso y cobrarlo después.`
                : '¿Confirmas el cambio de estado?'
        }
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={strong ? 'text-right font-semibold tabular' : 'text-right tabular'}>{value}</dd>
    </div>
  );
}

function PaymentForm({ reservationId, balanceCents, onSaved }: { reservationId: string; balanceCents: number; onSaved: () => void }) {
  const [amount, setAmount] = useState(centsToInput(balanceCents));
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => setAmount(centsToInput(balanceCents)), [balanceCents]);

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const amountCents = toCents(amount);
    const ok = await runAction(
      actions.reservations.addPayment({
        reservationId,
        amountCents: Number.isNaN(amountCents) ? 0 : amountCents,
        method,
        kind: amountCents >= balanceCents ? 'saldo' : 'otro',
        paidOn,
        note: '',
      }),
      { success: 'Pago registrado', onFieldErrors: setErrors },
    );
    setBusy(false);
    if (ok) {
      onSaved();
      await refreshPage();
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid items-end gap-3 rounded-xl border border-marigold-100 bg-marigold-50/60 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Field label="Cobrar" error={errors.amountCents}>
        {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
      </Field>
      <Field label="Medio">
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
      <Field label="Fecha" error={errors.paidOn}>
        {(p) => <Input {...p} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}
      </Field>
      <Button type="submit" loading={busy} className="h-[42px]">
        Registrar pago
      </Button>
    </form>
  );
}
