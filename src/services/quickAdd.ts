// Quick add: several wardrobe photos in one go. Each photo gets a category (one tap, or the
// same category for all) and is saved with addWardrobeItem one after another (so the daily task,
// coins and cache work exactly as for a single add). Pure helpers exported for tests.
import { addWardrobeItem, WardrobeItemResponse } from './wardrobeApi';
import { fitsInFirestore, StoredPhoto } from '../utils/photoStorage';

export const QUICK_ADD_MAX = 10;

export interface QuickItem extends StoredPhoto {
  key: string;
  category: string;
}

// "Kurtas 2" style default names (numbered per category within the batch)
export const quickNames = (items: { category: string }[]): string[] => {
  const seen: Record<string, number> = {};
  const totals: Record<string, number> = {};
  items.forEach(i => (totals[i.category] = (totals[i.category] || 0) + 1));
  return items.map(i => {
    seen[i.category] = (seen[i.category] || 0) + 1;
    return totals[i.category] > 1 ? `${i.category} ${seen[i.category]}` : i.category;
  });
};

export interface QuickAddResult {
  saved: WardrobeItemResponse[];
  failed: { key: string; error: string }[];
}

export const saveQuickItems = async (
  uid: string,
  gender: string | null | undefined,
  items: QuickItem[],
  isPublic: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<QuickAddResult> => {
  const names = quickNames(items);
  const result: QuickAddResult = { saved: [], failed: [] };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      if (!fitsInFirestore(it)) throw new Error('Photo too large');
      const saved = await addWardrobeItem({
        userId: uid,
        name: names[i],
        category: it.category,
        gender: gender || undefined,
        isPublic,
        imageUri: it.dataUri,
        imageThumb: it.thumbUri || null,
        imageClear: it.clearUri || null,
      });
      result.saved.push(saved);
    } catch (e: any) {
      result.failed.push({ key: it.key, error: e?.message || 'Could not save' });
    }
    onProgress?.(i + 1, items.length);
  }
  return result;
};
