import { useState, type SubmitEvent } from 'react';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Field';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_KEYS,
  type PaymentMethod,
} from '@/lib/domain/catalog';
import { centsToInput, toCents } from '@/lib/domain/money';
import { runAction, refreshPage, type FieldErrors } from '@/lib/client/actions';
import type { Expense } from '@/lib/db/schema';

export default function ExpenseForm({
  expense,
  today,
  onClose,
}: {
  expense?: Expense;
  today: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const input = {
      concept: String(data.get('concept')).trim(),
      category: String(data.get('category')) as (typeof EXPENSE_CATEGORIES)[number],
      amountCents: toCents(String(data.get('amount'))),
      method: String(data.get('method')) as PaymentMethod,
      spentOn: String(data.get('spentOn')),
    };
    setBusy(true);
    setErrors({});
    setFailure('');
    try {
      const result = await runAction(
        expense
          ? actions.expenses.update({ ...input, id: expense.id })
          : actions.expenses.create(input),
        { success: 'Egreso guardado.', onFieldErrors: setErrors },
      );
      if (result) {
        onClose();
        await refreshPage();
      }
    } catch {
      setFailure('No se pudo guardar el egreso. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {failure && (
        <p role="alert" className="text-sm text-danger-700">
          {failure}
        </p>
      )}
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Concepto" error={errors.concept}>
          {(props) => (
            <Input
              {...props}
              name="concept"
              required
              minLength={2}
              maxLength={160}
              defaultValue={expense?.concept}
              autoFocus
            />
          )}
        </Field>
        <Field label="Categoría" error={errors.category}>
          {(props) => (
            <Select
              {...props}
              name="category"
              defaultValue={expense?.category ?? EXPENSE_CATEGORIES[0]}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Monto" error={errors.amountCents}>
          {(props) => (
            <MoneyInput
              {...props}
              name="amount"
              required
              min="0.01"
              max="1000000"
              defaultValue={expense ? centsToInput(expense.amountCents) : ''}
            />
          )}
        </Field>
        <Field label="Medio de pago" error={errors.method}>
          {(props) => (
            <Select {...props} name="method" defaultValue={expense?.method ?? 'efectivo'}>
              {PAYMENT_METHOD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PAYMENT_METHODS[key]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha" error={errors.spentOn}>
          {(props) => (
            <Input
              {...props}
              type="date"
              name="spentOn"
              required
              defaultValue={expense?.spentOn ?? today}
            />
          )}
        </Field>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          Guardar egreso
        </Button>
      </div>
    </form>
  );
}
