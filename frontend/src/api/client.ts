export type ApiError = {
  detail?: string | Array<{ msg?: string; message?: string } | string>;
};

function formatDetail(detail: ApiError['detail']): string | null {
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.msg || item.message || '';
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  }
  return null;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as ApiError;
  throw new Error(formatDetail(body.detail) || `HTTP ${res.status}`);
}

import { getTheme } from '../utils/theme';

function imageSlotLimit() {
  return getTheme() === 'minecraft' ? 3 : 2;
}

let imageActive = 0;
const imageWait: Array<() => void> = [];

function acquireImageSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      const i = imageWait.indexOf(tryEnter);
      if (i >= 0) imageWait.splice(i, 1);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const tryEnter = () => {
      if (signal?.aborted) {
        onAbort();
        return true;
      }
      if (imageActive >= imageSlotLimit()) return false;
      imageActive += 1;
      signal?.removeEventListener('abort', onAbort);
      resolve();
      return true;
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (!tryEnter()) imageWait.push(tryEnter);
  });
}

function releaseImageSlot() {
  imageActive = Math.max(0, imageActive - 1);
  while (imageWait.length && imageActive < imageSlotLimit()) {
    const next = imageWait.shift();
    if (next) next();
    else break;
  }
}

export async function apiPostJson<T>(path: string, data: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal,
  });
  await throwIfNotOk(res);
  return (await res.json()) as T;
}

export async function apiPostFile<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(path, { method: 'POST', body: fd });
  await throwIfNotOk(res);
  return (await res.json()) as T;
}

export async function apiPostEmpty<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'POST' });
  await throwIfNotOk(res);
  return (await res.json()) as T;
}

export async function fetchImageBlobUrl(src: string, signal?: AbortSignal, tries = 2): Promise<string> {
  await acquireImageSlot(signal);
  try {
    let last: Error | null = null;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(src, {
          signal,
          cache: i === 0 ? 'default' : 'reload',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (blob.size < 32) throw new Error('empty image');
        return URL.createObjectURL(blob);
      } catch (err) {
        last = err instanceof Error ? err : new Error('load failed');
        if (signal?.aborted) throw last;
        await new Promise((r) => setTimeout(r, 220 * (i + 1)));
      }
    }
    throw last ?? new Error('load failed');
  } finally {
    releaseImageSlot();
  }
}
