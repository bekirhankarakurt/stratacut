import { InputHTMLAttributes, forwardRef } from 'react';
import { useTheme } from '../../utils/useTheme';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  className?: string;
  inputClassName?: string;
};

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, className = '', inputClassName = '', id, ...rest },
  ref,
) {
  const mc = useTheme() === 'minecraft';
  const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-slate-600 ${className}`}>
      {label ? <span>{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={[
          mc
            ? 'mc-block-inset bg-[#12140e] px-2.5 py-1.5 text-sm font-normal text-slate-900 caret-accent-500 focus:ring-2 focus:ring-accent-500/40 disabled:bg-[#181b13] disabled:text-slate-400'
            : 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-normal text-slate-900 focus:border-slate-300 focus:ring-2 focus:ring-accent-600/20 disabled:bg-slate-50 disabled:text-slate-400',
          'outline-none transition-shadow duration-150',
          'placeholder:text-slate-400',
          inputClassName,
        ].join(' ')}
        {...rest}
      />
      {hint ? <span className="text-[11px] font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
});

export default Input;
