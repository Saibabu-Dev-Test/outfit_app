// Puts an ad placeholder row after every `every` items (repeating). Lists render NativeAdCard for it.
export type AdRow = { __ad: true; id: string };
export const isAdRow = (x: unknown): x is AdRow => !!x && (x as AdRow).__ad === true;
export function interleaveAds<T>(items: T[], every: number): (T | AdRow)[] {
  if (!every || every < 1) return items;
  const out: (T | AdRow)[] = [];
  items.forEach((it, i) => {
    out.push(it);
    if ((i + 1) % every === 0) out.push({ __ad: true, id: `ad_${(i + 1) / every}` });
  });
  return out;
}
