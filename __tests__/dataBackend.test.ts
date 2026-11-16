// Firestore -> D1 fallback decision (services/dataBackend.ts), same pattern as photoStorage.
jest.mock('../src/config/firebaseConfig', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),
  increment: jest.fn((n: number) => n),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
const mockWorker = jest.fn();
jest.mock('../src/services/workerApi', () => ({ workerFetch: (...a: any[]) => mockWorker(...a) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIRESTORE_FREE, BACKEND_SWITCH_AT } from '../src/config/backend';
import { __resetBackend, activeBackend, chooseBackend, pacificDay, withFallback } from '../src/services/dataBackend';

const status = (fs: any) => ({ backend: 'firestore', reason: 'ok', firestore: { day: pacificDay(), reads: 0, writes: 0, exhausted: false, limits: {}, ...fs }, at: 0 });

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetBackend();
  mockWorker.mockReset();
});

describe('data backend', () => {
  test('chooseBackend: Firestore until 95% / exhausted / local flag', () => {
    expect(chooseBackend(null, false)).toBe('firestore');
    expect(chooseBackend({ reads: FIRESTORE_FREE.reads * BACKEND_SWITCH_AT - 1, writes: 0, exhausted: false }, false)).toBe('firestore');
    expect(chooseBackend({ reads: FIRESTORE_FREE.reads * BACKEND_SWITCH_AT, writes: 0, exhausted: false }, false)).toBe('d1');
    expect(chooseBackend({ reads: 0, writes: FIRESTORE_FREE.writes * BACKEND_SWITCH_AT, exhausted: false }, false)).toBe('d1');
    expect(chooseBackend({ reads: 0, writes: 0, exhausted: true }, false)).toBe('d1');
    expect(chooseBackend(null, true)).toBe('d1');
  });

  test('Worker unreachable -> stays on Firestore', async () => {
    mockWorker.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await activeBackend()).toBe('firestore');
  });

  test('withFallback: resource-exhausted switches to D1 and stays there', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockWorker.mockImplementation(async (path: string) => (path === '/v1/backend/exhausted' ? status({ exhausted: true }) : status({})));
    const fs = jest.fn(async () => {
      const e: any = new Error('Quota exceeded.');
      e.code = 'resource-exhausted';
      throw e;
    });
    const d1 = jest.fn(async () => 'from-d1');
    expect(await withFallback(fs, d1)).toBe('from-d1');
    expect(mockWorker).toHaveBeenCalledWith('/v1/backend/exhausted', expect.anything());
    expect(await activeBackend()).toBe('d1');
    expect(await withFallback(fs, d1)).toBe('from-d1');
    expect(fs).toHaveBeenCalledTimes(1);
  });

  test('withFallback: other Firestore errors are not swallowed', async () => {
    mockWorker.mockResolvedValue(status({}));
    const fs = jest.fn(async () => {
      const e: any = new Error('nope');
      e.code = 'permission-denied';
      throw e;
    });
    await expect(withFallback(fs, async () => 'd1')).rejects.toThrow('nope');
  });
});
