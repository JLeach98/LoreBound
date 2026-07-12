import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'secondary' | 'ghost' | 'brass' | 'plaque';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  secondary:
    'border-[var(--color-border-strong)] bg-[rgb(246_240_230_/_0.88)] text-[var(--color-text-primary)] hover:bg-[var(--color-warm-ivory)] hover:shadow-[var(--shadow-panel-soft)]',
  ghost:
    'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[rgb(246_240_230_/_0.72)]',
  brass:
    'border-[var(--color-brass-dark)] bg-[var(--color-brass-gold)] text-[var(--color-deep-graphite)] shadow-[var(--shadow-control)] hover:bg-[var(--color-brass-light)] hover:shadow-[0_14px_30px_rgb(31_26_23_/_0.24)]',
  plaque:
    'border-[rgb(246_240_230_/_0.16)] bg-[var(--color-panel-dark)] text-[var(--color-warm-ivory)] shadow-[var(--shadow-control)] hover:border-[rgb(184_138_61_/_0.5)] hover:bg-[var(--color-panel-dark-strong)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className = '', variant = 'secondary', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border px-4 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brass-gold)] disabled:hover:translate-y-0 ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
