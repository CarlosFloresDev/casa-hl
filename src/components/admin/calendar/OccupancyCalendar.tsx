import { Badge } from '@/components/ui/Badge';
import { formatDate, formatWeekday, nightsBetween, occupiesNight } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { RESERVATION_STATUSES } from '@/lib/domain/catalog';
import type { ReservationRow } from '@/lib/server/reservations';
import MonthNavigation from './MonthNavigation';
import type { CalendarMonth } from './month';

const colors = {
  confirmada: 'bg-pine-600 text-white',
  en_casa: 'bg-pine-900 text-white',
  finalizada: 'bg-mist text-ink',
  cancelada: 'bg-stone text-ink',
};
export default function OccupancyCalendar({
  month,
  rooms,
  reservations,
}: {
  month: CalendarMonth;
  rooms: { id: string; label: string }[];
  reservations: ReservationRow[];
}) {
  const active = reservations.filter((r) => r.status !== 'cancelada');
  const sold = rooms.reduce(
    (sum, room) =>
      sum +
      month.dates.filter((date) =>
        active.some((r) => r.roomId === room.id && occupiesNight(date, r.checkIn, r.checkOut)),
      ).length,
    0,
  );
  const capacity = rooms.length * month.dates.length;
  const columns = `160px repeat(${month.dates.length}, minmax(42px, 1fr))`;
  const tint = (date: string) =>
    date === month.today
      ? 'bg-marigold-50'
      : [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())
        ? 'bg-stone'
        : 'bg-surface';
  return (
    <section>
      <MonthNavigation month={month} />
      {!rooms.length ? (
        <div className="rounded-[var(--radius-card)] border border-mist bg-surface p-8">
          <p>No hay habitaciones activas para mostrar.</p>
          <a className="mt-3 inline-block text-pine-700 underline" href="/admin/habitaciones">
            Administrar habitaciones
          </a>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-soft tabular">
            {Math.round((sold / capacity) * 100)}% de ocupación · {sold} de {capacity} noches de
            habitación ocupadas
          </p>
          <div
            className="overflow-x-auto rounded-[var(--radius-card)] border border-mist bg-surface"
            role="region"
            aria-label={`Ocupación de ${month.label}`}
            tabIndex={0}
          >
            <div style={{ minWidth: 160 + month.dates.length * 42 }}>
              <div
                className="grid border-b border-mist text-center text-xs"
                style={{ gridTemplateColumns: columns }}
              >
                <div className="sticky left-0 z-20 bg-surface p-3 text-left font-medium">
                  Habitación
                </div>
                {month.dates.map((date) => (
                  <div
                    key={date}
                    className={`border-l border-mist py-2 ${tint(date)}`}
                    aria-current={date === month.today ? 'date' : undefined}
                  >
                    <span className="block text-ink-muted">{formatWeekday(date)}</span>
                    <span className="tabular font-semibold">{Number(date.slice(-2))}</span>
                    {date === month.today && <span className="block">Hoy</span>}
                  </div>
                ))}
              </div>
              {rooms.map((room) => {
                const stays = active.filter((r) => r.roomId === room.id);
                return (
                  <div
                    key={room.id}
                    className="grid border-b border-mist last:border-0"
                    style={{ gridTemplateColumns: columns }}
                  >
                    <div
                      className="sticky left-0 z-20 flex items-center border-r border-mist bg-surface px-3 py-4 text-sm font-medium"
                      style={{ gridRow: 1 }}
                    >
                      {room.label}
                    </div>
                    {month.dates.map((date, i) => (
                      <div
                        key={date}
                        className={`min-h-16 border-r border-mist ${tint(date)}`}
                        style={{ gridRow: 1, gridColumn: i + 2 }}
                      >
                        {!stays.some((r) => occupiesNight(date, r.checkIn, r.checkOut)) && (
                          <a
                            className="block h-full min-h-16 hover:bg-pine-100 focus-visible:bg-pine-100"
                            aria-label={`Crear reserva: ${room.label}, ${formatDate(date)}`}
                            href={`/admin/reservas?${new URLSearchParams({ nueva: '1', room: room.id, checkIn: date })}`}
                          />
                        )}
                      </div>
                    ))}
                    {stays.map((r) => {
                      const start = r.checkIn < month.from ? month.from : r.checkIn;
                      const end = r.checkOut > month.to ? month.to : r.checkOut;
                      const description = `${r.code} · ${r.guestName} · ${RESERVATION_STATUSES[r.status]} · ${formatDate(r.checkIn)} al ${formatDate(r.checkOut)} · Saldo: ${formatMoney(r.balanceCents)}`;
                      return (
                        <a
                          key={r.id}
                          href={`/admin/reservas?ver=${encodeURIComponent(r.id)}`}
                          title={description}
                          aria-label={description}
                          className={`z-10 mx-0.5 my-3 self-center truncate rounded-md px-2 py-2 text-xs ${colors[r.status]} ${r.balanceCents > 0 ? 'border-l-4 border-marigold-500' : ''}`}
                          style={{
                            gridRow: 1,
                            gridColumn: `${nightsBetween(month.from, start) + 2} / span ${nightsBetween(start, end)}`,
                          }}
                        >
                          {r.guestName}
                        </a>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div
            className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-soft"
            aria-label="Leyenda"
          >
            <Badge tone="pine">Confirmada</Badge>
            <Badge tone="ink">En casa</Badge>
            <Badge>Finalizada</Badge>
            <span className="border-l-4 border-marigold-500 pl-2">Saldo pendiente</span>
            <span>Las fechas de salida quedan libres.</span>
          </div>
        </>
      )}
    </section>
  );
}
