import { HTMLAttributes } from 'react';
import { useTheme } from '../../utils/useTheme';

export default function Card({
  className = '',
  children,
  padding = 'md',
  ...rest
}: HTMLAttributes<HTMLDivElement> & { padding?: 'sm' | 'md' | 'lg' | 'none' }) {
  const mc = useTheme() === 'minecraft';
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-3' : padding === 'lg' ? 'p-6' : 'p-4';
  return (
    <div
      className={
        mc
          ? `mc-block mc-panel bg-white shadow-md ${pad} ${className}`
          : `rounded-xl border border-slate-300 bg-white shadow-sm ${pad} ${className}`
      }
      {...rest}
    >
      {children}
    </div>
  );
}
