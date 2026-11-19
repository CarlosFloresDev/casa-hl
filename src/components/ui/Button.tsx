import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-pine-700 text-white [@media(pointer:fine)]:hover:bg-pine-800 active:bg-pine-900 shadow-sm',
  secondary: 'bg-surface text-ink border border-mist [@media(pointer:fine)]:hover:border-pine-200 [@media(pointer:fine)]:hover:bg-pine-50',
  ghost: 'text-ink-soft [@media(pointer:fine)]:hover:bg-pine-50 [@media(pointer:fine)]:hover:text-ink',
  danger: 'bg-danger-500 text-white [@media(pointer:fine)]:hover:bg-danger-700 shadow-sm',
  'danger-ghost': 'text-danger-500 [@media(pointer:fine)]:hover:bg-danger-50',
  accent: 'bg-marigold-500 text-ink [@media(pointer:fine)]:hover:brightness-95 shadow-sm',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-ui-button={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
