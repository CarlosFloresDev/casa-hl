import { useState } from 'react';
import { actions } from 'astro:actions';
import { Download, Plus, Printer, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';
import { PAYMENT_METHOD_KEYS, PAYMENT_METHODS } from '@/lib/domain/catalog';
import { formatDate } from '@/lib/domain/dates';
import { formatMoney } from '@/lib/domain/money';
import { runAction, refreshPage } from '@/lib/client/actions';
import type { Expense } from '@/lib/db/schema';
import type { PeriodStats } from '@/lib/server/stats';
import type { CalendarMonth } from '../calendar/month';
import MonthNavigation from '../calendar/MonthNavigation';
import ExpenseForm from './ExpenseForm';
import DailyIncomeChart from './DailyIncomeChart';

export default function CashBook({
  month,
  stats,
  expenses,
  isAdmin,
}: {
  month: CalendarMonth;
  stats: PeriodStats;
  expenses: Expense[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const categories = new Map<string, number>();
  for (const expense of expenses)
    categories.set(expense.category, (categories.get(expense.category) ?? 0) + expense.amountCents);
  function exportCsv() {
    const cell = (value: string) =>
      `"${(/^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const rows = [
      ['Fecha', 'Concepto', 'Categoría', 'Medio', 'Monto (S/)'],
      ...expenses.map((e) => [
        e.spentOn,
        e.concept,
        e.category,
        PAYMENT_METHODS[e.method],
        (e.amountCents / 100).toFixed(2).replace('.', ','),
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `egresos-${month.key}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await runAction(actions.expenses.delete({ id: deleting.id }), {
        success: 'Egreso eliminado.',
      });
      if (result) {
        setDeleting(null);
        await refreshPage();
      }
    } catch {
      setError('No se pudo eliminar el egreso. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <MonthNavigation month={month} />
      <div className="rounded-[var(--radius-card)] border border-mist bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-5">
          <div>
            <p className="text-sm text-ink-soft">Ingresos del mes</p>
            <p className="font-display text-3xl font-semibold text-pine-700 tabular">
              {formatMoney(stats.incomeCents)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-sm text-ink-soft">Egresos</dt>
              <dd className="text-xl tabular">{formatMoney(stats.expensesCents)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-soft">Resultado neto</dt>
              <dd
                className={`text-xl font-semibold tabular ${stats.netCents < 0 ? 'text-danger-700' : 'text-pine-700'}`}
              >
                {formatMoney(stats.netCents)}
              </dd>
            </div>
          </dl>
        </div>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 border-t border-mist pt-4 text-sm">
          {PAYMENT_METHOD_KEYS.map((key) => (
            <div key={key}>
              <dt className="text-ink-muted">{PAYMENT_METHODS[key]}</dt>
              <dd className="tabular">{formatMoney(stats.incomeByMethod[key])}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t border-mist pt-4">
          <h3 className="text-sm font-medium">Egresos por categoría</h3>
          {categories.size ? (
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {Array.from(categories, ([category, cents]) => (
                <div key={category} className="flex gap-2">
                  <dt className="text-ink-soft">{category}:</dt>
                  <dd className="tabular">{formatMoney(cents)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">No hay egresos este mes.</p>
          )}
        </div>
      </div>
      <DailyIncomeChart days={stats.dailyIncome} />
      <div className="rounded-[var(--radius-card)] border border-mist bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="font-display text-xl font-semibold">Egresos del mes</h2>
          <div className="no-print flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Download size={15} aria-hidden />}
              onClick={exportCsv}
            >
              Exportar CSV
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Printer size={15} aria-hidden />}
              onClick={() => window.print()}
            >
              Imprimir
            </Button>
            <Button
              size="sm"
              icon={<Plus size={15} aria-hidden />}
              onClick={() => setEditing('new')}
            >
              Nuevo egreso
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="px-5 pb-3 text-danger-700">
            {error}
          </p>
        )}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Egresos de {month.label}</caption>
            <thead className="border-y border-mist bg-stone text-ink-soft">
              <tr>
                {['Fecha', 'Concepto', 'Categoría', 'Medio', 'Monto'].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-4 py-2.5 font-medium ${label === 'Monto' ? 'text-right' : ''}`}
                  >
                    {label}
                  </th>
                ))}
                <th scope="col" className="no-print px-4">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-mist last:border-0 print:break-inside-avoid"
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular">{formatDate(e.spentOn)}</td>
                  <td className="min-w-40 break-words px-4 py-3">{e.concept}</td>
                  <td className="px-4 py-3">{e.category}</td>
                  <td className="px-4 py-3">{PAYMENT_METHODS[e.method]}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular">
                    {formatMoney(e.amountCents)}
                  </td>
                  <td className="no-print px-4 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${e.concept}`}
                        onClick={() => setEditing(e)}
                      >
                        <Pencil size={16} aria-hidden />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="danger-ghost"
                          aria-label={`Eliminar ${e.concept}`}
                          onClick={() => setDeleting(e)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!expenses.length && (
            <p className="p-6 text-sm text-ink-muted">
              No hay egresos registrados en este mes. Usa «Nuevo egreso» para registrar uno.
            </p>
          )}
        </div>
      </div>
      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo egreso' : 'Editar egreso'}
      >
        {editing && (
          <ExpenseForm
            key={editing === 'new' ? 'new' : editing.id}
            expense={editing === 'new' ? undefined : editing}
            today={month.today}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Eliminar egreso"
        message={
          <>
            {error && (
              <p role="alert" className="mb-2 text-danger-700">
                {error}
              </p>
            )}
            Se eliminará «{deleting?.concept}» por {formatMoney(deleting?.amountCents ?? 0)}. Esta
            acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar egreso"
        busy={busy}
        onCancel={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={remove}
      />
    </section>
  );
}
