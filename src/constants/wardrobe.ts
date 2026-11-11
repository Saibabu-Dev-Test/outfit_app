// Gender-wise wardrobe categories and colour swatches

// ── Grouped categories ─────────────────────────────────────────────────────
// Wardrobe tiles and the upload/edit category picker both use these groups.
// An item stores `category` (one of the category values below) and an optional
// `subType` (only for Shoes and Accessories). Old values map in via normalizeCategory.

export interface CategoryGroup {
  key: string;
  label: string;
  icon: string;
  categories: string[]; // category values in this group
  subTypes?: string[]; // set for Shoes / Accessories: the group is one category with types
}

export const SHOE_TYPES = [
  'Sneakers', 'Formal Shoes', 'Loafers', 'Sandals', 'Slippers / Flip-flops', 'Boots',
  'Sports Shoes', 'Heels', 'Flats', 'Ethnic (Mojari / Jutti)',
];

// Stored values never change (items keep their subType); new types are only appended.
export const ACCESSORY_TYPES = [
  'Earrings', 'Bangles', 'Bracelets', 'Necklace / Chain', 'Rings', 'Anklets (Payal)', 'Nose Pin',
  'Maang Tikka', 'Watches', 'Bags', 'Handbags', 'Clutch', 'Belts', 'Sunglasses', 'Hair Accessories',
  'Caps / Hats', 'Wallets', 'Jewellery', 'Ties', 'Scarves / Stoles', 'Socks',
];

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: 'tops', label: 'Tops', icon: '👕', categories: ['Shirts', 'T-Shirts', 'Tops', 'Kurtas', 'Kurtis', 'Jackets', 'Blazers', 'Hoodies & Sweatshirts'] },
  { key: 'bottoms', label: 'Bottoms', icon: '👖', categories: ['Pants', 'Jeans', 'Trousers', 'Shorts', 'Skirts', 'Leggings', 'Track Pants'] },
  { key: 'ethnic', label: 'Ethnic & Dresses', icon: '🥻', categories: ['Sarees', 'Dresses', 'Lehengas', 'Dupattas', 'Sherwanis', 'Ethnic'] },
  { key: 'shoes', label: 'Shoes', icon: '👟', categories: ['Shoes'], subTypes: SHOE_TYPES },
  { key: 'accessories', label: 'Accessories', icon: '⌚', categories: ['Accessories'], subTypes: ACCESSORY_TYPES },
  { key: 'others', label: 'Others', icon: '🧺', categories: ['Others'] },
];

// Every category value
export const ALL_CATEGORIES: string[] = CATEGORY_GROUPS.flatMap(g => g.categories);

// Old / AI / loosely typed names -> category value (and a sub-type when the name is one)
const ALIASES: Record<string, { category: string; subType?: string }> = {
  'shirt': { category: 'Shirts' },
  't-shirt': { category: 'T-Shirts' }, 'tshirt': { category: 'T-Shirts' }, 'tshirts': { category: 'T-Shirts' }, 't shirts': { category: 'T-Shirts' }, 't shirt': { category: 'T-Shirts' },
  'top': { category: 'Tops' }, 'blouse': { category: 'Tops' },
  'kurta': { category: 'Kurtas' }, 'kurti': { category: 'Kurtis' },
  'jacket': { category: 'Jackets' }, 'blazer': { category: 'Blazers' }, 'coat': { category: 'Jackets' },
  'hoodie': { category: 'Hoodies & Sweatshirts' }, 'hoodies': { category: 'Hoodies & Sweatshirts' },
  'sweatshirt': { category: 'Hoodies & Sweatshirts' }, 'sweatshirts': { category: 'Hoodies & Sweatshirts' },
  'sweater': { category: 'Hoodies & Sweatshirts' }, 'sweaters': { category: 'Hoodies & Sweatshirts' },
  'pant': { category: 'Pants' }, 'jean': { category: 'Jeans' }, 'denim': { category: 'Jeans' },
  'trouser': { category: 'Trousers' }, 'short': { category: 'Shorts' }, 'skirt': { category: 'Skirts' },
  'legging': { category: 'Leggings' },
  'track pant': { category: 'Track Pants' }, 'trackpants': { category: 'Track Pants' }, 'joggers': { category: 'Track Pants' },
  'saree': { category: 'Sarees' }, 'sari': { category: 'Sarees' }, 'dress': { category: 'Dresses' },
  'lehenga': { category: 'Lehengas' }, 'dupatta': { category: 'Dupattas' }, 'sherwani': { category: 'Sherwanis' }, 'ethnic wear': { category: 'Ethnic' },
  'shoe': { category: 'Shoes' }, 'footwear': { category: 'Shoes' },
  'accessory': { category: 'Accessories' },
  'other': { category: 'Others' },
};
SHOE_TYPES.forEach(t => { ALIASES[t.toLowerCase()] = { category: 'Shoes', subType: t }; });
ACCESSORY_TYPES.forEach(t => { ALIASES[t.toLowerCase()] = { category: 'Accessories', subType: t }; });
Object.assign(ALIASES, {
  'jewelry': { category: 'Accessories', subType: 'Jewellery' },
  'watch': { category: 'Accessories', subType: 'Watches' },
  'belt': { category: 'Accessories', subType: 'Belts' },
  'bag': { category: 'Accessories', subType: 'Bags' }, 'handbag': { category: 'Accessories', subType: 'Handbags' }, 'purse': { category: 'Accessories', subType: 'Handbags' },
  'wallet': { category: 'Accessories', subType: 'Wallets' },
  'cap': { category: 'Accessories', subType: 'Caps / Hats' }, 'hat': { category: 'Accessories', subType: 'Caps / Hats' },
  'tie': { category: 'Accessories', subType: 'Ties' },
  'earring': { category: 'Accessories', subType: 'Earrings' }, 'jhumka': { category: 'Accessories', subType: 'Earrings' }, 'jhumkas': { category: 'Accessories', subType: 'Earrings' },
  'studs': { category: 'Accessories', subType: 'Earrings' },
  'bangle': { category: 'Accessories', subType: 'Bangles' }, 'gajulu': { category: 'Accessories', subType: 'Bangles' }, 'kada': { category: 'Accessories', subType: 'Bracelets' },
  'bracelet': { category: 'Accessories', subType: 'Bracelets' },
  'necklace': { category: 'Accessories', subType: 'Necklace / Chain' }, 'chain': { category: 'Accessories', subType: 'Necklace / Chain' },
  'necklaces': { category: 'Accessories', subType: 'Necklace / Chain' }, 'chains': { category: 'Accessories', subType: 'Necklace / Chain' },
  'mangalsutra': { category: 'Accessories', subType: 'Necklace / Chain' }, 'haram': { category: 'Accessories', subType: 'Necklace / Chain' },
  'ring': { category: 'Accessories', subType: 'Rings' },
  'anklet': { category: 'Accessories', subType: 'Anklets (Payal)' }, 'anklets': { category: 'Accessories', subType: 'Anklets (Payal)' },
  'payal': { category: 'Accessories', subType: 'Anklets (Payal)' }, 'pattilu': { category: 'Accessories', subType: 'Anklets (Payal)' },
  'nose pin': { category: 'Accessories', subType: 'Nose Pin' }, 'nose ring': { category: 'Accessories', subType: 'Nose Pin' }, 'nath': { category: 'Accessories', subType: 'Nose Pin' },
  'maang tikka': { category: 'Accessories', subType: 'Maang Tikka' }, 'tikka': { category: 'Accessories', subType: 'Maang Tikka' }, 'papidi billa': { category: 'Accessories', subType: 'Maang Tikka' },
  'hair accessory': { category: 'Accessories', subType: 'Hair Accessories' }, 'hair clip': { category: 'Accessories', subType: 'Hair Accessories' },
  'hairband': { category: 'Accessories', subType: 'Hair Accessories' }, 'hair band': { category: 'Accessories', subType: 'Hair Accessories' },
  'scrunchie': { category: 'Accessories', subType: 'Hair Accessories' },
  'clutch': { category: 'Accessories', subType: 'Clutch' }, 'clutches': { category: 'Accessories', subType: 'Clutch' },
  'sunglass': { category: 'Accessories', subType: 'Sunglasses' }, 'goggles': { category: 'Accessories', subType: 'Sunglasses' }, 'scarf': { category: 'Accessories', subType: 'Scarves / Stoles' },
  'sneaker': { category: 'Shoes', subType: 'Sneakers' }, 'sandal': { category: 'Shoes', subType: 'Sandals' },
  'slippers': { category: 'Shoes', subType: 'Slippers / Flip-flops' }, 'flip-flops': { category: 'Shoes', subType: 'Slippers / Flip-flops' },
  'heel': { category: 'Shoes', subType: 'Heels' }, 'mojari': { category: 'Shoes', subType: 'Ethnic (Mojari / Jutti)' },
  'jutti': { category: 'Shoes', subType: 'Ethnic (Mojari / Jutti)' },
});

// Resolve any stored / suggested name. Unknown names -> null.
export const resolveCategory = (name?: string | null): { category: string; subType?: string } | null => {
  const c = (name || '').trim().toLowerCase();
  if (!c) return null;
  const exact = ALL_CATEGORIES.find(x => x.toLowerCase() === c);
  if (exact) return { category: exact };
  return ALIASES[c] || null;
};

// The category value an item belongs under (old "Footwear" -> "Shoes", "Jewellery" -> "Accessories", unknown -> "Others")
export const normalizeCategory = (name?: string | null): string => resolveCategory(name)?.category || 'Others';

export const groupOfCategory = (category?: string | null): CategoryGroup => {
  const c = normalizeCategory(category);
  return CATEGORY_GROUPS.find(g => g.categories.includes(c)) || CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1];
};

export const subTypesFor = (category?: string | null): string[] =>
  groupOfCategory(category).subTypes || [];

// An item's sub-type: its stored subType, else one implied by an old category ("Jewellery")
// or subCategory. undefined = "All / Other".
export const itemSubType = (item: { category?: string | null; subType?: string | null; subCategory?: string | null }): string | undefined => {
  const types = subTypesFor(item.category);
  if (!types.length) return undefined;
  for (const raw of [item.subType, resolveCategory(item.category)?.subType, item.subCategory]) {
    if (!raw) continue;
    const hit = types.find(t => t.toLowerCase() === raw.toLowerCase()) || resolveCategory(raw)?.subType;
    if (hit && types.includes(hit)) return hit;
  }
  return undefined;
};

// ── Gender-wise categories ──────────────────────────────────────────────────
// Only gender-specific values are listed; everything else is unisex and shows for everyone.
// Users see only their registered gender's (users/{uid}.gender 'Male' / 'Female') plus unisex;
// a missing or other gender sees all.
const GENDER_OF: Record<string, 'male' | 'female'> = {
  // categories
  'Shirts': 'male', 'Kurtas': 'male', 'Trousers': 'male', 'Blazers': 'male', 'Sherwanis': 'male',
  'Tops': 'female', 'Kurtis': 'female', 'Sarees': 'female', 'Dresses': 'female', 'Lehengas': 'female',
  'Leggings': 'female', 'Skirts': 'female', 'Dupattas': 'female',
  // shoe / accessory types
  'Heels': 'female', 'Flats': 'female', 'Handbags': 'female', 'Jewellery': 'female', 'Ties': 'male',
  'Bangles': 'female', 'Anklets (Payal)': 'female', 'Nose Pin': 'female', 'Maang Tikka': 'female', 'Clutch': 'female',
};

export const genderKey = (gender?: string | null): 'male' | 'female' | null => {
  const g = (gender || '').trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'man' || g === 'boy') return 'male';
  if (g === 'female' || g === 'f' || g === 'woman' || g === 'girl') return 'female';
  return null;
};

// Is this category / type shown for this gender? (unisex, or same gender, or gender unknown)
export const isForGender = (value: string, gender?: string | null): boolean => {
  const g = genderKey(gender);
  const v = GENDER_OF[value];
  return !g || !v || v === g;
};

export const MALE_CATEGORIES = ALL_CATEGORIES.filter(c => isForGender(c, 'male'));
export const FEMALE_CATEGORIES = ALL_CATEGORIES.filter(c => isForGender(c, 'female'));

export const getCategoriesForGender = (gender?: string | null): string[] =>
  ALL_CATEGORIES.filter(c => isForGender(c, gender));

// A group's categories for this gender only (name kept for older callers)
export const groupCategoriesSorted = (group: CategoryGroup, gender?: string | null): string[] =>
  group.categories.filter(c => isForGender(c, gender));

// A group's sub-types (shoe / accessory types) for this gender
export const groupSubTypesFor = (group: CategoryGroup, gender?: string | null): string[] | undefined =>
  group.subTypes ? group.subTypes.filter(t => isForGender(t, gender)) : undefined;

// Groups with their categories and sub-types narrowed to this gender (empty groups dropped)
export const categoryGroupsForGender = (gender?: string | null): CategoryGroup[] =>
  CATEGORY_GROUPS.map(g => ({ ...g, categories: groupCategoriesSorted(g, gender), subTypes: groupSubTypesFor(g, gender) })).filter(
    g => g.categories.length > 0,
  );

// All categories for this gender
export const getAllCategoriesSorted = (gender?: string | null): string[] =>
  CATEGORY_GROUPS.flatMap(g => groupCategoriesSorted(g, gender));

// Item belongs to a tile (old names map in; "Others" takes unknown categories)
export const inCategory = (itemCategory: string | null | undefined, tile: string): boolean =>
  normalizeCategory(itemCategory) === normalizeCategory(tile);

export const CATEGORY_ICONS: Record<string, string> = {
  'Shirts': '👔',
  'T-Shirts': '👕',
  'Tops': '👚',
  'Kurtas': '🥻',
  'Kurtis': '👘',
  'Jackets': '🧥',
  'Hoodies & Sweatshirts': '🧥',
  'Pants': '👖',
  'Jeans': '👖',
  'Trousers': '👖',
  'Shorts': '🩳',
  'Skirts': '👗',
  'Leggings': '👖',
  'Track Pants': '🏃',
  'Sarees': '🥻',
  'Dresses': '👗',
  'Lehengas': '👗',
  'Dupattas': '🧣',
  'Sherwanis': '🤵',
  'Blazers': '🧥',
  'Ethnic': '🧣',
  'Shoes': '👟',
  'Footwear': '👟',
  'Accessories': '⌚',
  'Jewellery': '💍',
  'Others': '🧺',
  // Shoe types
  'Sneakers': '👟',
  'Formal Shoes': '👞',
  'Loafers': '👞',
  'Sandals': '🩴',
  'Slippers / Flip-flops': '🩴',
  'Boots': '🥾',
  'Sports Shoes': '🏃',
  'Heels': '👠',
  'Flats': '🥿',
  'Ethnic (Mojari / Jutti)': '🪷',
  // Accessory types
  'Watches': '⌚',
  'Belts': '🪢',
  'Sunglasses': '🕶️',
  'Caps / Hats': '🧢',
  'Bags': '🎒',
  'Handbags': '👜',
  'Wallets': '👛',
  'Ties': '👔',
  'Scarves / Stoles': '🧣',
  'Socks': '🧦',
  'Earrings': '💎',
  'Bangles': '⭕',
  'Bracelets': '📿',
  'Necklace / Chain': '📿',
  'Rings': '💍',
  'Anklets (Payal)': '🔔',
  'Nose Pin': '✨',
  'Maang Tikka': '🪔',
  'Clutch': '👛',
  'Hair Accessories': '🎀',
};

// Labels for the accessory types in Telugu / Hindi (stored values stay English; anything
// missing falls back to the English value)
const ACCESSORY_LABELS: Record<string, { te: string; hi: string }> = {
  'Earrings': { te: 'చెవి కమ్మలు', hi: 'झुमके / बालियाँ' },
  'Bangles': { te: 'గాజులు', hi: 'चूड़ियाँ' },
  'Bracelets': { te: 'బ్రేస్‌లెట్', hi: 'ब्रेसलेट' },
  'Necklace / Chain': { te: 'హారం / గొలుసు', hi: 'हार / चेन' },
  'Rings': { te: 'ఉంగరాలు', hi: 'अंगूठियाँ' },
  'Anklets (Payal)': { te: 'పట్టీలు', hi: 'पायल' },
  'Nose Pin': { te: 'ముక్కుపుడక', hi: 'नथ / नोज़ पिन' },
  'Maang Tikka': { te: 'పాపిడి బిళ్ళ', hi: 'मांग टीका' },
  'Watches': { te: 'గడియారం', hi: 'घड़ी' },
  'Bags': { te: 'బ్యాగ్', hi: 'बैग' },
  'Handbags': { te: 'హ్యాండ్‌బ్యాగ్', hi: 'हैंडबैग' },
  'Clutch': { te: 'క్లచ్', hi: 'क्लच' },
  'Belts': { te: 'బెల్ట్', hi: 'बेल्ट' },
  'Sunglasses': { te: 'కళ్లజోడు (సన్‌గ్లాసెస్)', hi: 'धूप का चश्मा' },
  'Hair Accessories': { te: 'జుట్టు అలంకరణలు', hi: 'बालों की एक्सेसरीज़' },
  'Caps / Hats': { te: 'క్యాప్ / టోపీ', hi: 'कैप / टोपी' },
  'Accessories': { te: 'యాక్సెసరీలు', hi: 'एक्सेसरीज़' },
};

/** Display label for a category / type in the user's language ('Telugu' / 'Hindi'); English fallback */
export const typeLabel = (value: string, language?: string | null): string => {
  const l = (language || '').trim().toLowerCase();
  const row = ACCESSORY_LABELS[value];
  if (!row) return value;
  if (l === 'telugu' || l === 'te') return row.te || value;
  if (l === 'hindi' || l === 'hi') return row.hi || value;
  return value;
};

export const categoryIcon = (c?: string | null): string =>
  (c && (CATEGORY_ICONS[c] || CATEGORY_ICONS[normalizeCategory(c)])) || '👕';

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
