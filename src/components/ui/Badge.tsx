import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const tones = {
  neutral: 'bg-stone text-ink-soft ring-mist',
  pine: 'bg-pine-50 text-pine-700 ring-pine-200',
  marigold: 'bg-marigold-50 text-marigold-700 ring-marigold-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-500/20',
  ink: 'bg-ink text-white ring-ink',
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      data-ui-badge={tone}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
