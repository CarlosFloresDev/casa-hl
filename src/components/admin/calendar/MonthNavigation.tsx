import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarMonth } from './month';

export default function MonthNavigation({ month }: { month: CalendarMonth }) {
  const link =
    'inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-mist bg-surface px-3 text-sm hover:bg-pine-50';
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{month.label}</h2>
      <nav aria-label="Cambiar mes" className="no-print flex gap-2">
        <a className={link} href={`?mes=${month.previous}`} aria-label="Mes anterior">
          <ChevronLeft size={16} aria-hidden />
        </a>
        <a className={link} href={`?mes=${month.current}`}>
          Hoy
        </a>
        <a className={link} href={`?mes=${month.next}`} aria-label="Mes siguiente">
          <ChevronRight size={16} aria-hidden />
        </a>
      </nav>
    </div>
  );
}
