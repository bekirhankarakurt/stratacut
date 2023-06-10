/** Parse "4,7-9" style specs for EXCLUDED pages; each must lie in [rangeStart, rangeEnd] and [1, pageCount]. */
export function parseExcludedPagesSpec(
  text: string,
  rangeStart: number,
  rangeEnd: number,
  pageCount: number,
): { ok: true; pages: number[] } | { ok: false; message: string } {
  const t = text.trim();
  if (!t) return { ok: true, pages: [] };

  const parts = t
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new Set<number>();

  for (const part of parts) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let x = lo; x <= hi; x++) out.add(x);
    } else if (/^\d+$/.test(part)) {
      out.add(Number(part));
    } else {
      return { ok: false, message: `Geçersiz parça: "${part}"` };
    }
  }

  const sorted = [...out].sort((a, b) => a - b);
  for (const p of sorted) {
    if (p < 1 || p > pageCount) {
      return { ok: false, message: `Sayfa ${p} PDF dışında (1–${pageCount}).` };
    }
    if (p < rangeStart || p > rangeEnd) {
      return {
        ok: false,
        message: `Hariç tutulacak sayfa ${p}, başlangıç–bitiş aralığında olmalı (${rangeStart}–${rangeEnd}). Aralık dışı sayfa için aşağıdan “Aralığa ekle” kullanın.`,
      };
    }
  }
  return { ok: true, pages: sorted };
}

export function fullRangePages(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export function exportedPagesAfterExclude(start: number, end: number, excludedSorted: number[]): number[] {
  const ex = new Set(excludedSorted);
  return fullRangePages(start, end).filter((p) => !ex.has(p));
}
