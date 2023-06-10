const SAYFA_TOKEN_MAX_LEN = 200;
export const HASH_PREFIX = 'H';

/**
 * RLE: consecutive runs a-b, + between segments. Matches Python encode_basket_token_for_filename
 * (sorted unique page set, not user order).
 */
export function rleFromSortedUnique(sorted: number[]): string {
  if (sorted.length === 0) return '';
  const s = [...new Set(sorted.map((x) => int(x)).filter((n) => n > 0))].sort((a, b) => a - b);
  const segs: string[] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    let j = i;
    while (j + 1 < n && s[j + 1] === s[j] + 1) {
      j += 1;
    }
    if (j > i) {
      segs.push(`${s[i]}-${s[j]}`);
    } else {
      segs.push(String(s[i]));
    }
    i = j + 1;
  }
  return segs.join('+');
}

function int(x: number) {
  return Math.floor(x);
}

/** SHA-256 first 8 hex chars, browser Web Crypto, matches Python. */
export async function sha256First8OfCsv(sortedPages: number[]): Promise<string> {
  const s = sortedPages
    .map((x) => int(x))
    .filter((n) => n > 0);
  s.sort((a, b) => a - b);
  const str = s.join(',');
  const data = new TextEncoder().encode(str);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
}

/**
 * If RLE &lt; max len, return sync token; else { kind:'hash' } to fill async.
 */
export function tokenPreviewForSortedUnique(sorted: number[]): { token: string; needHash: boolean } {
  const t = rleFromSortedUnique(sorted);
  if (t.length > SAYFA_TOKEN_MAX_LEN) {
    return { token: '', needHash: true };
  }
  return { token: t, needHash: false };
}

export function makeHashToken(hex8: string) {
  return `${HASH_PREFIX}${hex8.slice(0, 8).toLowerCase()}`;
}
