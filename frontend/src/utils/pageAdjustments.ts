export type PageAdjustment = {
  rotate: number;
  mirrorH: boolean;
  mirrorV: boolean;
  contrast: number;
};

export type PageAdjustmentEntry = PageAdjustment & { page: number };

export const DEFAULT_PAGE_ADJUSTMENT: PageAdjustment = {
  rotate: 0,
  mirrorH: false,
  mirrorV: false,
  contrast: 1,
};

export const CONTRAST_MIN = 0.5;
export const CONTRAST_MAX = 2;
export const CONTRAST_STEP = 0.1;

export function hasPageAdjustments(adj: PageAdjustment | undefined): boolean {
  if (!adj) return false;
  return (
    adj.rotate !== 0 ||
    adj.mirrorH ||
    adj.mirrorV ||
    Math.abs(adj.contrast - 1) > 0.01
  );
}

export function getPageAdjustment(
  map: Record<number, PageAdjustment>,
  page: number,
): PageAdjustment {
  return map[page] ?? DEFAULT_PAGE_ADJUSTMENT;
}

export function buildAdjustmentsPayload(
  pages: number[],
  map: Record<number, PageAdjustment>,
): PageAdjustmentEntry[] {
  const out: PageAdjustmentEntry[] = [];
  for (const page of pages) {
    const adj = getPageAdjustment(map, page);
    if (hasPageAdjustments(adj)) {
      out.push({ page, ...adj });
    }
  }
  return out;
}

export function adjustmentQueryParams(adj: PageAdjustment): string {
  const parts = [`rotate=${adj.rotate}`];
  if (adj.mirrorH) parts.push('mirrorH=1');
  if (adj.mirrorV) parts.push('mirrorV=1');
  if (Math.abs(adj.contrast - 1) > 0.01) {
    parts.push(`contrast=${adj.contrast.toFixed(2)}`);
  }
  return parts.join('&');
}
