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

// ── Update an item ─────────────────────────────────────────────────────────────
export const updateWardrobeItem = async (
  itemId: number,
  payload: Partial<WardrobeItemPayload>,
): Promise<WardrobeItemResponse> => {
  const formData = new FormData();
  if (payload.userId !== undefined) formData.append('userId', String(payload.userId));
  if (payload.name) formData.append('name', payload.name);
  if (payload.category) formData.append('category', payload.category);
  if (payload.subCategory !== undefined) formData.append('subCategory', payload.subCategory || '');
  if (payload.wearType !== undefined) formData.append('wearType', payload.wearType || '');
  if (payload.color !== undefined) formData.append('color', payload.color || '');
  if (payload.fabric !== undefined) formData.append('fabric', payload.fabric || '');

  // Attach new image if chosen (local file URI)
  if (payload.imageUri && !payload.imageUri.startsWith('http')) {
    const uriParts = payload.imageUri.split('.');
    const ext = uriParts[uriParts.length - 1] || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    formData.append('image', {
      uri: payload.imageUri,
      name: `clothing_${Date.now()}.${ext}`,
      type: mimeType,
    } as any);
  }

  const response = await fetch(`${BASE_URL}/${itemId}`, {
    method: 'PUT',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update wardrobe item');
  }

  return data.item as WardrobeItemResponse;
};

// ── Delete an item ─────────────────────────────────────────────────────────────
export const deleteWardrobeItem = async (itemId: number): Promise<void> => {
  const response = await fetch(`${BASE_URL}/${itemId}`, { method: 'DELETE' });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to delete wardrobe item');
  }
};

export interface ClothingAnalysisResult {
  category: string;
  subCategory: string;
  wearType: string;
  color: string;
  colorName: string;
  fabric: string;
  name: string;
  confidence: number;
}

// ── Analyze Clothing Photo with AI Vision ──────────────────────────────────────
export const analyzeClothingPhoto = async (
  imageUri: string,
): Promise<ClothingAnalysisResult> => {
  const uriParts = imageUri.split('.');
  const ext = uriParts[uriParts.length - 1] || 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const fastApiCandidateUrls = [
    `http://${BACKEND_IP}:8000/api/vision/analyze-clothing`,
    `http://${BACKEND_IP}:${BACKEND_PORT}/api/wardrobe/analyze`,
    'http://10.0.2.2:8000/api/vision/analyze-clothing',
    'http://10.0.2.2:3000/api/wardrobe/analyze',
    'http://localhost:8000/api/vision/analyze-clothing',
    'http://localhost:3000/api/wardrobe/analyze',
  ];

  for (const url of fastApiCandidateUrls) {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: `photo_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);

      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        const analysis = json.analysis || json;
        if (analysis && analysis.category) {
          return analysis as ClothingAnalysisResult;
        }
      }
    } catch (e) {
      // try next candidate
    }
  }

  // Fallback defaults if offline / network failed
  return {
    category: 'TOPS',
    subCategory: 'T-Shirts',
    wearType: 'Casual',
    color: '#1A1A1A',
    colorName: 'Black',
    fabric: 'Casual',
    name: 'Clothing Item',
    confidence: 0.8,
  };
};
