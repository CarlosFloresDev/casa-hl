import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}

/** Envuelve un control con etiqueta, ayuda y mensaje de error accesibles. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div data-ui-field className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div data-ui-field-control className="contents">
        {children({
          id,
          ...(error ? { 'aria-invalid': true as const } : {}),
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-danger-500">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn('field-input', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn('field-input appearance-auto pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn('field-input resize-y', className)} {...rest} />;
  },
);

/** Input de soles: muestra el prefijo "S/" y trabaja con texto decimal. */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function MoneyInput({ className, ...rest }, ref) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted">
          S/
        </span>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className={cn('field-input tabular pl-9', className)}
          {...rest}
        />
      </div>
    );
  },
);

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-xl border border-mist bg-surface px-3 py-2.5 text-sm transition-colors [@media(pointer:fine)]:hover:border-pine-200 has-[:checked]:border-pine-400 has-[:checked]:bg-pine-50',
        className,
      )}
    >
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-pine-700" {...rest} />
      <span>
        <span className="block text-ink">{label}</span>
        {description ? <span className="block text-[13px] text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}
