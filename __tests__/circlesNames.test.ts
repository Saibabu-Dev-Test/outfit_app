// Circles: unique names, district (Discover) + optional location (Nearby), join rules, join-by-code.
// firebase/firestore is replaced by a tiny in-memory fake (no network, no rules: the rules are
// checked in firestore.rules, this covers the client logic).

type Docs = Map<string, any>;
const mockStore: Docs = new Map();
let mockAutoId = 0;

jest.mock('../src/config/firebaseConfig', () => ({ db: {} }));
jest.mock('../src/utils/imagePicker', () => ({ MAX_BASE64_CHARS: 400000 }));
jest.mock('../src/services/userApi', () => ({ inlineAvatar: (a: any) => a || null }));
const mockLocation = jest.fn();
jest.mock('../src/native/location', () => ({ getApproxLocation: () => mockLocation() }));

jest.mock('firebase/firestore', () => {
  const DELETE = { __delete: true };
  const ref = (path: string) => ({
    path,
    id: path.split('/').pop(),
    withConverter: undefined,
  });
  const snap = (path: string) => {
    const data = mockStore.get(path);
    return { id: path.split('/').pop(), ref: ref(path), exists: () => data !== undefined, data: () => data };
  };
  const apply = (path: string, data: any, merge: boolean) => {
    const cur = merge ? { ...(mockStore.get(path) || {}) } : {};
    Object.entries(data).forEach(([k, v]: [string, any]) => {
      if (v === DELETE) delete cur[k];
      else if (v && v.__union) cur[k] = Array.from(new Set([...(cur[k] || []), ...v.__union]));
      else if (v && v.__remove) cur[k] = (cur[k] || []).filter((x: any) => !v.__remove.includes(x));
      else cur[k] = v;
    });
    mockStore.set(path, cur);
  };
  const matches = (d: any, w: any) => {
    const v = d[w.field];
    switch (w.op) {
      case '==':
        return v === w.value;
      case 'in':
        return w.value.includes(v);
      case 'array-contains':
        return Array.isArray(v) && v.includes(w.value);
      case '>=':
        return typeof v === 'string' && v >= w.value;
      case '<=':
        return typeof v === 'string' && v <= w.value;
      default:
        return false;
    }
  };
  return {
    collection: (_db: any, ...parts: string[]) => ({ path: parts.join('/'), __col: true }),
    doc: (a: any, ...parts: string[]) => {
      if (a && a.__col && parts.length === 0) return ref(`${a.path}/auto${++mockAutoId}`);
      return ref(parts.join('/'));
    },
    getDoc: async (r: any) => snap(r.path),
    getDocs: async (q: any) => {
      const col = q.__col ? q.path : q.col.path;
      const wheres = q.__col ? [] : q.wheres;
      const docs = [...mockStore.keys()]
        .filter(p => p.startsWith(col + '/') && p.split('/').length === col.split('/').length + 1)
        .filter(p => wheres.every((w: any) => matches(mockStore.get(p), w)))
        .map(snap);
      return { docs };
    },
    addDoc: async (c: any, data: any) => apply(`${c.path}/auto${++mockAutoId}`, data, false),
    setDoc: async (r: any, data: any) => apply(r.path, data, false),
    updateDoc: async (r: any, data: any) => {
      if (!mockStore.has(r.path)) throw Object.assign(new Error('missing'), { code: 'not-found' });
      apply(r.path, data, true);
    },
    deleteDoc: async (r: any) => mockStore.delete(r.path),
    deleteField: () => DELETE,
    writeBatch: () => {
      const ops: (() => void)[] = [];
      return {
        set: (r: any, d: any) => ops.push(() => apply(r.path, d, false)),
        delete: (r: any) => ops.push(() => mockStore.delete(r.path)),
        commit: async () => ops.forEach(o => o()),
      };
    },
    runTransaction: async (_db: any, fn: any) => {
      const ops: (() => void)[] = [];
      const tx = {
        get: async (r: any) => snap(r.path),
        set: (r: any, d: any) => ops.push(() => apply(r.path, d, false)),
        update: (r: any, d: any) => ops.push(() => apply(r.path, d, true)),
        delete: (r: any) => ops.push(() => mockStore.delete(r.path)),
      };
      const out = await fn(tx);
      ops.forEach(o => o());
      return out;
    },
    query: (col: any, ...cs: any[]) => ({ col, wheres: cs.filter(c => c && c.field) }),
    where: (field: string, op: string, value: any) => ({ field, op, value }),
    orderBy: () => null,
    limit: () => null,
    onSnapshot: () => () => {},
    serverTimestamp: () => 'TS',
    arrayUnion: (...v: any[]) => ({ __union: v }),
    arrayRemove: (...v: any[]) => ({ __remove: v }),
  };
});

import {
  cleanCircleName,
  normalizeCircleName,
  circleNameDocId,
  createCircle,
  updateCircleDetails,
  updateCircleVisibility,
  getNearbyCircles,
  joinCircle,
  joinWithCode,
  deleteCircle,
  isCircleNameAvailable,
  joinRadiusKm,
  getDistrictCircles,
  nameVariants,
} from '../src/services/circlesApi';

const HYD = { lat: 17.385, lng: 78.4867 };
// ~1.1 km north and ~11 km north of HYD
const NEAR = { lat: 17.395, lng: 78.4867 };
const FAR = { lat: 17.485, lng: 78.4867 };

const base = { description: '', emoji: '👗' };

beforeEach(() => {
  mockStore.clear();
  mockAutoId = 0;
  mockLocation.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const HYDD = { district: 'Hyderabad', districtKey: 'hyderabad', state: 'Telangana' };

describe('circle name normalization', () => {
  it('trims, collapses spaces and lower-cases', () => {
    expect(cleanCircleName('  Office   Looks \n')).toBe('Office Looks');
    expect(normalizeCircleName('  Office   LOOKS ')).toBe('office looks');
  });
  it('makes Firestore-safe, one-to-one doc ids', () => {
    expect(circleNameDocId('office looks')).toBe('office looks');
    expect(circleNameDocId('a/b')).toBe('a%2Fb');
    expect(circleNameDocId('a%2fb')).toBe('a%252fb');
    expect(circleNameDocId('a/b')).not.toBe(circleNameDocId('a%2fb'));
    expect(circleNameDocId('.')).toBe('%2E');
    expect(circleNameDocId('..')).toBe('%2E%2E');
    expect(circleNameDocId('__x__')).toBe('%5F%5Fx%5F%5F');
  });
});

describe('createCircle', () => {
  it('public circle stores location + geohash + name doc', async () => {
    const c = await createCircle({ ...base, name: ' Office  Looks ', isPrivate: false, district: HYDD, location: HYD }, 'u1');
    const d = mockStore.get(`circles/${c.id}`);
    expect(d.name).toBe('Office Looks');
    expect(d.nameLower).toBe('office looks');
    expect(d.nameKey).toBe('office looks');
    expect(d.location).toEqual({ lat: 17.385, lng: 78.487 });
    expect(typeof d.geohash).toBe('string');
    expect(mockStore.get('circleNames/office looks')).toEqual({ circleId: c.id, ownerId: 'u1', createdAt: 'TS' });
    expect(mockStore.get(`inviteCodes/${d.inviteCode}`).circleId).toBe(c.id);
  });

  it('rejects a public circle without a district; location is optional', async () => {
    await expect(createCircle({ ...base, name: 'X', isPrivate: false, location: HYD }, 'u1')).rejects.toThrow(
      /district/i,
    );
    const c = await createCircle({ ...base, name: 'Y', isPrivate: false, district: HYDD, location: null }, 'u1');
    expect(mockStore.get(`circles/${c.id}`)).toMatchObject({ district: 'Hyderabad', districtKey: 'hyderabad', isPublic: true });
    expect(mockStore.get(`circles/${c.id}`).location).toBeUndefined();
  });

  it('private circle has no location', async () => {
    const c = await createCircle({ ...base, name: 'Secret', isPrivate: true, location: HYD }, 'u1');
    expect(mockStore.get(`circles/${c.id}`).location).toBeUndefined();
  });

  it('rejects duplicate names (case / spacing insensitive)', async () => {
    await createCircle({ ...base, name: 'Office Looks', isPrivate: false, district: HYDD, location: HYD }, 'u1');
    await expect(
      createCircle({ ...base, name: '  office   LOOKS', isPrivate: true }, 'u2'),
    ).rejects.toThrow(/already exists/);
  });

  it('rejects names of legacy public circles without a name doc', async () => {
    mockStore.set('circles/legacy', { name: 'Saree Lovers', isPrivate: false, ownerId: 'old', memberIds: ['old'] });
    await expect(createCircle({ ...base, name: 'saree lovers', isPrivate: true }, 'u2')).rejects.toThrow(
      /already exists/,
    );
    expect(await isCircleNameAvailable('Saree Lovers', 'u2')).toBe(false);
    expect(await isCircleNameAvailable('Kurta Club', 'u2')).toBe(true);
  });
});

describe('nameVariants', () => {
  it('covers common spellings', () => {
    expect(nameVariants('saree LOVERS')).toEqual(
      expect.arrayContaining(['saree LOVERS', 'saree lovers', 'SAREE LOVERS', 'Saree Lovers', 'Saree lovers']),
    );
  });
});

describe('updateCircleDetails (rename)', () => {
  it('moves the name doc and rejects taken names', async () => {
    const a = await createCircle({ ...base, name: 'Alpha', isPrivate: true }, 'u1');
    await createCircle({ ...base, name: 'Beta', isPrivate: true }, 'u2');
    await expect(updateCircleDetails(a.id, { ...base, name: 'BETA ' }, 'u1')).rejects.toThrow(/already exists/);
    await updateCircleDetails(a.id, { name: 'Gamma', description: 'new', emoji: '🔥' }, 'u1');
    expect(mockStore.get('circleNames/alpha')).toBeUndefined();
    expect(mockStore.get('circleNames/gamma').circleId).toBe(a.id);
    expect(mockStore.get(`circles/${a.id}`)).toMatchObject({ name: 'Gamma', nameLower: 'gamma', description: 'new', emoji: '🔥' });
  });

  it('allows a case-only change of its own name', async () => {
    const a = await createCircle({ ...base, name: 'Alpha', isPrivate: true }, 'u1');
    await updateCircleDetails(a.id, { ...base, name: 'ALPHA' }, 'u1');
    expect(mockStore.get(`circles/${a.id}`).name).toBe('ALPHA');
    expect(mockStore.get('circleNames/alpha').circleId).toBe(a.id);
  });

  it('only the owner can edit', async () => {
    const a = await createCircle({ ...base, name: 'Alpha', isPrivate: true }, 'u1');
    await expect(updateCircleDetails(a.id, { ...base, name: 'Other' }, 'u2')).rejects.toThrow(/owner/);
  });

  it('backfills a legacy circle on first save', async () => {
    mockStore.set('circles/legacy', { name: 'Old One', isPrivate: true, ownerId: 'u1', memberIds: ['u1'] });
    await updateCircleDetails('legacy', { ...base, name: 'Old One', description: 'd' }, 'u1');
    expect(mockStore.get('circleNames/old one').circleId).toBe('legacy');
    expect(mockStore.get('circles/legacy').nameLower).toBe('old one');
  });

  it('deleteCircle frees the name', async () => {
    const a = await createCircle({ ...base, name: 'Alpha', isPrivate: true }, 'u1');
    await deleteCircle({ ...a });
    expect(mockStore.get('circleNames/alpha')).toBeUndefined();
    await expect(createCircle({ ...base, name: 'alpha', isPrivate: true }, 'u2')).resolves.toBeTruthy();
  });
});

describe('visibility', () => {
  it('public saves district (+ optional location); private removes the location', async () => {
    const a = await createCircle({ ...base, name: 'Alpha', isPrivate: true }, 'u1');
    await updateCircleVisibility(a.id, false, HYD, null, HYDD);
    expect(mockStore.get(`circles/${a.id}`).districtKey).toBe('hyderabad');
    expect(mockStore.get(`circles/${a.id}`)).toMatchObject({ isPrivate: false, isPublic: true });
    expect(mockStore.get(`circles/${a.id}`).geohash).toBeTruthy();
    await updateCircleVisibility(a.id, true);
    expect(mockStore.get(`circles/${a.id}`).location).toBeUndefined();
    expect(mockStore.get(`circles/${a.id}`).geohash).toBeUndefined();
  });
});

describe('nearby discovery + joining', () => {
  it('lists only public circles within 3 km, nearest first', async () => {
    await createCircle({ ...base, name: 'Here', isPrivate: false, district: HYDD, location: HYD }, 'o');
    await createCircle({ ...base, name: 'Near', isPrivate: false, district: HYDD, location: NEAR }, 'o');
    await createCircle({ ...base, name: 'Far', isPrivate: false, district: HYDD, location: FAR }, 'o');
    await createCircle({ ...base, name: 'Hidden', isPrivate: true }, 'o');
    const list = await getNearbyCircles(HYD.lat, HYD.lng);
    expect(list.map(c => c.name)).toEqual(['Here', 'Near']);
    expect(list[1].distanceKm).toBeGreaterThan(0.5);
    expect(list[1].distanceKm).toBeLessThan(3);
  });

  it('join without code only from within 3 km', async () => {
    const far = await createCircle({ ...base, name: 'Far', isPrivate: false, district: HYDD, location: FAR }, 'o');
    mockLocation.mockResolvedValue({ ok: true, coords: HYD });
    await expect(joinCircle(far, 'u9')).rejects.toThrow(/invite/);
    const near = await createCircle({ ...base, name: 'Near', isPrivate: false, district: HYDD, location: NEAR }, 'o');
    await joinCircle(near, 'u9');
    expect(mockStore.get(`circles/${near.id}`).memberIds).toContain('u9');
    expect(joinRadiusKm({ radiusKm: null })).toBe(3);
    expect(joinRadiusKm({ radiusKm: 1 })).toBe(1);
  });

  it('Discover lists public circles of my district only; district members join without location', async () => {
    const mine = await createCircle({ ...base, name: 'Mine D', isPrivate: false, district: HYDD, location: null }, 'o');
    await createCircle({ ...base, name: 'Other D', isPrivate: false, district: { district: 'Warangal', districtKey: 'warangal', state: 'Telangana' } }, 'o');
    await createCircle({ ...base, name: 'Priv D', isPrivate: true, district: HYDD }, 'o');
    mockStore.set('circles/legacy-pub', { name: 'Legacy', isPrivate: false, isPublic: true, ownerId: 'x', memberIds: ['x'] });
    const list = await getDistrictCircles('hyderabad');
    expect(list.map(c => c.name)).toEqual(['Mine D']);
    mockLocation.mockResolvedValue({ ok: false, reason: 'off', message: 'off' });
    await joinCircle(mine, 'u7', { districtKey: 'hyderabad' });
    expect(mockStore.get(`circles/${mine.id}`).memberIds).toContain('u7');
      });

  it('join by code works for private and far-away public circles', async () => {
    const priv = await createCircle({ ...base, name: 'Priv', isPrivate: true }, 'o');
    const far = await createCircle({ ...base, name: 'Far', isPrivate: false, district: HYDD, location: FAR }, 'o');
    expect(await joinWithCode(priv.inviteCode.toLowerCase(), 'u9')).toBe(priv.id);
    expect(await joinWithCode(`Join: outfit://join/${far.inviteCode}`, 'u9')).toBe(far.id);
    expect(mockStore.get(`circles/${priv.id}`).memberIds).toContain('u9');
    expect(mockStore.get(`circles/${far.id}`).lastJoin).toEqual({ uid: 'u9', code: far.inviteCode });
    await expect(joinWithCode('ZZZZZZ', 'u9')).rejects.toThrow(/No circle/);
  });
});
