import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'w-[min(26rem,calc(100vw-2rem))]', md: 'w-[min(34rem,calc(100vw-2rem))]', lg: 'w-[min(46rem,calc(100vw-2rem))]' };

/** Diálogo modal sobre <dialog> nativo: foco atrapado, Escape y fondo inerte gratis. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="app-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      {open ? (
        <div
          className={cn(
            'dialog-panel flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-2xl',
            widths[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-mist px-6 pt-5 pb-4">
            <div>
              <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
                {title}
              </h2>
              {description ? <p id={descriptionId} className="mt-1 text-sm text-ink-muted">{description}</p> : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
              <X className="size-4" />
            </Button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-mist bg-stone/60 px-6 py-3.5">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Volver
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[15px] text-ink-soft">{message}</div>
    </Dialog>
  );
}
