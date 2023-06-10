import { useEffect, useState } from 'react';

export type Toast = { id: string; type: 'success' | 'error' | 'info'; message: string };

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveAt = setTimeout(() => setLeaving(true), 3800);
    const removeAt = setTimeout(() => onDismiss(toast.id), 4000);
    return () => {
      clearTimeout(leaveAt);
      clearTimeout(removeAt);
    };
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={[
        leaving ? 'animate-toast-out' : 'animate-toast-in',
        'rounded-lg border p-3 shadow-sm',
        toast.type === 'success'
          ? 'border-accent-200 bg-accent-50 text-accent-900'
          : toast.type === 'info'
            ? 'border-sky-200 bg-sky-50 text-sky-900'
            : 'border-rose-200 bg-rose-50 text-rose-900',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">{toast.message}</div>
        <button
          type="button"
          className="rounded text-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
          onClick={() => {
            setLeaving(true);
            setTimeout(() => onDismiss(toast.id), 160);
          }}
        >
          Kapat
        </button>
      </div>
    </div>
  );
}

export default function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed right-4 top-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
