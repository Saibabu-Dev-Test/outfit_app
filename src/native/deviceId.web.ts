// Web build: no device id; a per-browser install id (weak) so the Earn code path still works.
import { sha256Hex } from '../utils/sha256';

const KEY = 'earn.installId.v1';
const store = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } | null =>
  (globalThis as any).localStorage || null;
export const getDeviceHash = async (): Promise<{ hash: string; strong: boolean }> => {
  let id = '';
  try {
    id = store()?.getItem(KEY) || '';
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      store()?.setItem(KEY, id);
    }
  } catch {
    id = `${Date.now()}`;
  }
  return { hash: `i_${sha256Hex(`install:${id}`).slice(0, 62)}`, strong: false };
};
