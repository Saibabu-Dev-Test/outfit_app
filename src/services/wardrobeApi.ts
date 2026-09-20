import { BACKEND_IP, BACKEND_PORT } from '../config/apiConfig';

const BASE_URL = `http://${BACKEND_IP}:${BACKEND_PORT}/api/wardrobe`;

export interface WardrobeItemPayload {
  userId: number | string;
  name: string;
  category: string;
  subCategory?: string;
  wearType?: string;
  color?: string;
  fabric?: string;
  imageUri?: string | null; // local file URI from image picker
}

export interface WardrobeItemResponse {
  id: number;
  userId: number;
  name: string;
  category: string;
  subCategory?: string | null;
  wearType?: string | null;
  color: string | null;
  fabric: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Add wardrobe item (multipart/form-data so image is streamed to S3) ─────────
export const addWardrobeItem = async (
  payload: WardrobeItemPayload,
): Promise<WardrobeItemResponse> => {
  const formData = new FormData();
  formData.append('userId', String(payload.userId));
  formData.append('name', payload.name);
  formData.append('category', payload.category);
  if (payload.subCategory) formData.append('subCategory', payload.subCategory);
  if (payload.wearType) formData.append('wearType', payload.wearType);
  if (payload.color) formData.append('color', payload.color);
  if (payload.fabric) formData.append('fabric', payload.fabric);

  // Attach image as a binary blob if provided
  if (payload.imageUri) {
    const uriParts = payload.imageUri.split('.');
    const ext = uriParts[uriParts.length - 1] || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('image', {
      uri: payload.imageUri,
      name: `clothing_${Date.now()}.${ext}`,
      type: mimeType,
    } as any);
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type header — fetch sets it automatically with boundary
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to add wardrobe item');
  }

  return data.item as WardrobeItemResponse;
};

// ── Fetch all items for a user ─────────────────────────────────────────────────
export const getWardrobeItems = async (
  userId: number | string,
): Promise<WardrobeItemResponse[]> => {
  const response = await fetch(`${BASE_URL}/${userId}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch wardrobe items');
  }
  return data.items as WardrobeItemResponse[];
};

// ── Delete an item ─────────────────────────────────────────────────────────────
export const deleteWardrobeItem = async (itemId: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/${itemId}`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to delete wardrobe item');
  }
};
