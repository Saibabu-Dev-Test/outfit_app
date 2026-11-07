// Gender-wise wardrobe categories and colour swatches

export const MALE_CATEGORIES = [
  'Shirts', 'T-Shirts', 'Kurtas', 'Jeans', 'Trousers', 'Shorts',
  'Jackets', 'Ethnic', 'Footwear', 'Accessories',
];

export const FEMALE_CATEGORIES = [
  'Tops', 'Kurtis', 'Sarees', 'Dresses', 'Jeans', 'Leggings', 'Skirts',
  'Lehengas', 'Jackets', 'Footwear', 'Accessories', 'Jewellery',
];

export const ALL_CATEGORIES = Array.from(new Set([...MALE_CATEGORIES, ...FEMALE_CATEGORIES]));

export const getCategoriesForGender = (gender?: string | null): string[] => {
  const g = (gender || '').toLowerCase();
  if (g === 'male') return MALE_CATEGORIES;
  if (g === 'female') return FEMALE_CATEGORIES;
  return ALL_CATEGORIES; // Other / not set
};

export const CATEGORY_ICONS: Record<string, string> = {
  'Shirts': '👔',
  'T-Shirts': '👕',
  'Kurtas': '🥻',
  'Jeans': '👖',
  'Trousers': '👖',
  'Shorts': '🩳',
  'Jackets': '🧥',
  'Ethnic': '🧣',
  'Footwear': '👟',
  'Accessories': '⌚',
  'Tops': '👚',
  'Kurtis': '👘',
  'Sarees': '🥻',
  'Dresses': '👗',
  'Leggings': '👖',
  'Skirts': '👗',
  'Lehengas': '👗',
  'Jewellery': '💍',
};

export const categoryIcon = (c?: string | null): string => (c && CATEGORY_ICONS[c]) || '👕';

export const COLOR_SWATCHES = [
  { label: 'White', hex: '#FFFFFF', border: '#D0CBDF' },
  { label: 'Black', hex: '#1A1A1A', border: '#1A1A1A' },
  { label: 'Grey', hex: '#9E9EA8', border: '#9E9EA8' },
  { label: 'Beige', hex: '#D4B896', border: '#D4B896' },
  { label: 'Brown', hex: '#8B5E3C', border: '#8B5E3C' },
  { label: 'Navy', hex: '#1B2A6B', border: '#1B2A6B' },
  { label: 'Blue', hex: '#4A90D9', border: '#4A90D9' },
  { label: 'Green', hex: '#4CAF50', border: '#4CAF50' },
  { label: 'Red', hex: '#E53935', border: '#E53935' },
  { label: 'Maroon', hex: '#800020', border: '#800020' },
  { label: 'Pink', hex: '#EC407A', border: '#EC407A' },
  { label: 'Yellow', hex: '#FDD835', border: '#FDD835' },
  { label: 'Orange', hex: '#FF7043', border: '#FF7043' },
  { label: 'Purple', hex: '#7B1FA2', border: '#7B1FA2' },
];

// Accepts a colour name or hex; returns a hex for display
export const colorToHex = (c?: string | null): string => {
  if (!c) return '#F3F0FF';
  if (c.startsWith('#')) return c;
  const hit = COLOR_SWATCHES.find(s => s.label.toLowerCase() === c.toLowerCase());
  return hit ? hit.hex : '#F3F0FF';
};

export const colorNameFromHex = (hex?: string | null): string | null => {
  if (!hex) return null;
  const hit = COLOR_SWATCHES.find(s => s.hex.toLowerCase() === hex.toLowerCase());
  return hit ? hit.label : null;
};

export const WEAR_TYPES = ['Daily Wear', 'Formal', 'Casual'];
