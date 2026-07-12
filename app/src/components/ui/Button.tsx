import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'secondary' | 'ghost' | 'brass' | 'plaque';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  secondary:
    'border-[var(--color-border-strong)] bg-[var(--color-warm-ivory)] text-[var(--color-text-primary)] hover:bg-white',
  ghost:
    'border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-warm-ivory)]',
  brass:
    'border-[var(--color-brass-dark)] bg-[var(--color-brass-gold)] text-[var(--color-deep-graphite)] shadow-[var(--shadow-control)] hover:bg-[var(--color-brass-light)]',
  plaque:
    'border-[rgb(246_240_230_/_0.18)] bg-[rgb(23_21_20_/_0.54)] text-[var(--color-warm-ivory)] shadow-[var(--shadow-control)] hover:border-[rgb(184_138_61_/_0.55)] hover:bg-[rgb(23_21_20_/_0.68)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, className = '', variant = 'secondary', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex min-h-10 items-center justify-center rounded-[var(--radius-md)] border px-4 text-sm font-semibold transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brass-gold)] ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
