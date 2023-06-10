import { ButtonHTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../utils/useTheme';
import Spinner from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const classicVariants: Record<Variant, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900/30 disabled:bg-slate-900',
  secondary:
    'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-900/20',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-900/20',
  danger:
    'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500/20',
  accent:
    'bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-600/30 disabled:bg-accent-600',
};

const minecraftVariants: Record<Variant, string> = {
  primary:
    'mc-block mc-press bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-500/40 disabled:bg-accent-600',
  secondary:
    'mc-block mc-press bg-[#c6c6c6] text-[#111111] hover:bg-[#d8d8d8] focus-visible:ring-white/30',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500/30 active:translate-y-[1px]',
  danger:
    'mc-block mc-press bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-500/40',
  accent:
    'mc-block mc-press bg-accent-500 text-white hover:bg-accent-400 focus-visible:ring-accent-400/40 disabled:bg-accent-500',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md';
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', loading, size = 'md', className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const mc = useTheme() === 'minecraft';
  const sizeCls = mc
    ? size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : 'px-3.5 py-2 text-sm'
    : size === 'sm'
      ? 'px-2 py-1 text-xs'
      : 'px-3 py-2 text-sm';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold',
        mc
          ? 'tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent'
          : 'rounded-lg transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeCls,
        (mc ? minecraftVariants : classicVariants)[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

export default Button;
