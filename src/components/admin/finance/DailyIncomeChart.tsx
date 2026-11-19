import { useId } from 'react';
import { formatDate } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';

export default function DailyIncomeChart({ days }: { days: { date: string; cents: number }[] }) {
  const id = useId();
  const max = Math.max(1, ...days.map((d) => d.cents));
  const width = 720,
    height = 130,
    step = width / Math.max(1, days.length);
  return (
    <figure className="rounded-[var(--radius-card)] border border-mist bg-surface p-5">
      <figcaption id={id} className="mb-2 font-medium">
        Ingresos diarios
      </figcaption>
      <p className="mb-2 text-xs text-ink-muted">
        Escala máxima: {formatMoney(max === 1 && days.every((d) => !d.cents) ? 0 : max)}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height + 25}`}
        className="w-full"
        role="img"
        aria-labelledby={id}
        aria-describedby={`${id}-description`}
      >
        <desc id={`${id}-description`}>
          Pagos recibidos por día. Los importes están disponibles en el detalle debajo del gráfico.
        </desc>
        <line x1="0" y1={height} x2={width} y2={height} stroke="var(--color-mist)" />
        {days.map((day, i) => (
          <g key={day.date}>
            <title>{`${formatDate(day.date)}: ${formatMoney(day.cents)}`}</title>
            <rect
              x={i * step + 3}
              y={height - (day.cents / max) * 120}
              width={step - 6}
              height={(day.cents / max) * 120}
              rx="2"
              fill="var(--color-pine-600)"
            />
            {(i === 0 || (i + 1) % 5 === 0 || i === days.length - 1) && (
              <text
                x={i * step + step / 2}
                y={height + 18}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-ink-soft)"
              >
                {Number(day.date.slice(-2))}
              </text>
            )}
          </g>
        ))}
      </svg>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-pine-700">Ver importes por día</summary>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => (
            <div key={day.date} className="flex justify-between gap-3">
              <dt>{formatDate(day.date)}</dt>
              <dd className="tabular">{formatMoney(day.cents)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </figure>
  );
}
