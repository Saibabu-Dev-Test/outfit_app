jest.mock('../src/config/firebaseConfig', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),
  increment: jest.fn((n: number) => n),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));

import { CHAIN, SWITCH_AT, isConfigured } from '../src/config/storage';
import { dataUriBytes, isQuotaError, pickProvider, providerStatus } from '../src/services/photoStorage';

const stats = (bytesUsed: number, full = false) => ({ bytesUsed, fileCount: 1, lastUpload: null, full, days: {} });
const firebase = CHAIN.find(p => p.id === 'firebase')!;

describe('photo storage chain', () => {
  it('starts with Firebase, then Cloudinary (outfitvote / outfit_unsigned)', () => {
    expect(CHAIN[0].id).toBe('firebase');
    const c = CHAIN.find(p => p.id === 'cloudinary')!;
    expect(c.config.cloudName).toBe('outfitvote');
    expect(c.config.uploadPreset).toBe('outfit_unsigned');
    expect(isConfigured(c)).toBe(true);
  });

  it('never configures a provider that needs a secret or server', () => {
    CHAIN.filter(p => !p.clientUpload).forEach(p => expect(isConfigured(p)).toBe(false));
  });

  it('picks Firebase while it has room', async () => {
    expect((await pickProvider('image', { firebase: stats(1000) }))?.id).toBe('firebase');
  });

  it('switches to the next provider at 95% or when marked full', async () => {
    expect((await pickProvider('image', { firebase: stats(firebase.freeBytes * SWITCH_AT) }))?.id).toBe('cloudinary');
    expect((await pickProvider('image', { firebase: stats(0, true) }))?.id).toBe('cloudinary');
  });

  it('status labels', () => {
    expect(providerStatus(firebase, stats(0), 'firebase')).toBe('active');
    expect(providerStatus(firebase, stats(0, true), 'cloudinary')).toBe('full');
    expect(providerStatus(CHAIN.find(p => p.id === 'tigris')!, undefined, 'firebase')).toBe('needs setup');
  });

  it('quota errors and sizes', () => {
    expect(isQuotaError({ code: 'resource-exhausted' })).toBe(true);
    expect(isQuotaError({ message: 'network failed' })).toBe(false);
    expect(dataUriBytes('data:image/jpeg;base64,AAAA')).toBe(3);
  });
});
