// ML Kit labels + main colour -> wardrobe category / colour suggestion (pure, unit tested)
import { COLOR_SWATCHES, resolveCategory } from '../constants/wardrobe';

export interface VisionTags {
  category: string;
  subCategory: string;
  wearType: string;
  color: string;
  colorName: string;
  fabric: string;
  name: string;
  confidence: number;
}

// ML Kit base-model label -> our category name (resolveCategory understands these aliases)
const LABEL_MAP: Record<string, string> = {
  jeans: 'jean', denim: 'jean', shirt: 'shirt', 'dress shirt': 'shirt', 't-shirt': 't-shirt', jersey: 't-shirt',
  dress: 'dress', skirt: 'skirt', shorts: 'short', trousers: 'trouser', pants: 'pant', jacket: 'jacket',
  coat: 'coat', blazer: 'blazer', suit: 'blazer', sweater: 'sweater', hoodie: 'hoodie', shoe: 'shoe',
  sneakers: 'sneaker', boot: 'shoe', sandal: 'sandal', 'high heels': 'heel', sunglasses: 'sunglass',
  handbag: 'handbag', bag: 'bag', watch: 'watch', necklace: 'necklace', earrings: 'earring', ring: 'ring',
  bracelet: 'bracelet', hat: 'hat', cap: 'cap', scarf: 'scarf', tie: 'tie', belt: 'belt', sari: 'saree',
  saree: 'saree', jewellery: 'jewelry', jewelry: 'jewelry', leggings: 'legging',
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const nearestSwatch = (hex: string | null | undefined) => {
  const c = hex ? hexToRgb(hex) : null;
  if (!c) return null;
  let best = COLOR_SWATCHES[0];
  let bestD = Infinity;
  for (const sw of COLOR_SWATCHES) {
    const s = hexToRgb(sw.hex)!;
    // weighted RGB distance (closer to how eyes see it)
    const d = 2 * (c[0] - s[0]) ** 2 + 4 * (c[1] - s[1]) ** 2 + 3 * (c[2] - s[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = sw;
    }
  }
  return best;
};

export const tagsFromVision = (
  labels: { text: string; confidence: number }[],
  hex: string | null,
): VisionTags | null => {
  let cat: { category: string; subType?: string } | null = null;
  let conf = 0;
  for (const l of [...labels].sort((a, b) => b.confidence - a.confidence)) {
    const key = l.text.toLowerCase().trim();
    const hit = resolveCategory(LABEL_MAP[key] || key);
    if (hit && hit.category !== 'Others') {
      cat = hit;
      conf = l.confidence;
      break;
    }
  }
  const sw = nearestSwatch(hex);
  if (!cat && !sw) return null;
  const category = cat?.category || '';
  return {
    category,
    subCategory: cat?.subType || '',
    wearType: '',
    color: sw?.hex || '',
    colorName: sw?.label || '',
    fabric: labels.some(l => /denim/i.test(l.text)) ? 'Denim' : '',
    name: [sw?.label, cat?.subType || category].filter(Boolean).join(' '),
    confidence: conf,
  };
};
