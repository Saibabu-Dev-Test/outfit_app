// Admin > System (owner only): one read-only snapshot of the free-tier backends.
//   Worker: GET /health (ping) and GET /v1/admin/system (owner check on the Worker from the verified
//           Firebase token: D1 usage, Firestore usage counted by the app, earn per partner, active users)
//   Firestore: users total / new today (count aggregations), pending UPI withdrawals
//   Photo storage chain: stats/storage/providers (photoStorage.ts)
// Every part fails on its own, so one broken source never blanks the screen.
import { collection, getCountFromServer, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { isOwnerEmail } from '../config/owner';
import { CHAIN, ProviderId } from '../config/storage';
import { isBitlabsConfigured, isCpxConfigured, offerwallUrl } from '../config/earn';
import { BACKEND_SWITCH_AT, DataBackend } from '../config/backend';
import { ProviderStats, getStorageStats, pickProvider, providerStatus, ProviderStatus } from './photoStorage';
import { pingWorker, workerFetch } from './workerApi';
import { activeBackend } from './dataBackend';

export type Partner = 'bitlabs' | 'cpx' | 'offerwall';
export const PARTNER_LABEL: Record<Partner, string> = { bitlabs: 'BitLabs', cpx: 'CPX Research', offerwall: 'Offerwall.GG' };

export interface PartnerEarn {
  configured: boolean; // Worker secret set
  postbacksToday: { ok: number; rejected: number; error: number; not_configured: number };
  pendingCoins: number;
  approvedCoins: number;
  reversedCount: number;
  ownerRupees: number;
}

export interface ServerSystem {
  worker: { version: string; firebaseServiceAccount: boolean };
  backend: DataBackend;
  reason: string;
  switchAt: number;
  firestore: { day: string; reads: number; writes: number; exhausted: boolean; limits: { reads: number; writes: number } };
  d1: {
    day: string;
    reads: number;
    writes: number;
    storageBytes: number | null;
    limits: { reads: number; writes: number; storageBytes: number };
    rows: Record<string, number>;
  };
  earn: Record<Partner, PartnerEarn>;
  users: { day: string; activeToday: number };
  at: number;
}

export interface ChainRow {
  id: ProviderId;
  name: string;
  status: ProviderStatus;
  bytesUsed: number;
  freeBytes: number;
  fileCount: number;
}

export interface SystemSnapshot {
  health: Awaited<ReturnType<typeof pingWorker>>;
  server: ServerSystem | null;
  serverError: string | null;
  backendHere: DataBackend;
  chain: ChainRow[] | null;
  users: { total: number | null; newToday: number | null; error: string | null };
  withdrawals: { pending: number; rupees: number; error: string | null };
  appPartners: Record<Partner, boolean>; // public app-side config filled (wall link / app id)
  at: Date;
}

// Owner = verified Google email in OWNER_EMAILS (Worker and firestore.rules check the same)
export const isOwnerUser = (): boolean => {
  const u: any = auth?.currentUser;
  return !!u && isOwnerEmail(u.email) && (u.emailVerified === true || googleLinked(u));
};

// A Google-linked account proves the email even when emailVerified is false
// (happens when the account started with a phone number and Google was linked later)
export const googleLinked = (u: any): boolean =>
  Array.isArray(u?.providerData) &&
  u.providerData.some((p: any) => p?.providerId === 'google.com' && isOwnerEmail(p?.email ?? u?.email));

// Start of today in India time (owner's "today")
export const istDayStart = (now: Date = new Date()): Date => {
  const off = 330 * 60000;
  const t = now.getTime() + off;
  return new Date(t - (t % 86400000) - off);
};

export const pct = (used: number | null | undefined, limitN: number): number =>
  !limitN || !used ? 0 : Math.round((used / limitN) * 1000) / 10;

export const nearLimit = (used: number | null | undefined, limitN: number): boolean => !!used && used >= limitN * BACKEND_SWITCH_AT;

const chainRows = async (): Promise<ChainRow[]> => {
  const stats: Record<string, ProviderStats> = await getStorageStats(0);
  const active = (await pickProvider('image', stats).catch(() => null))?.id || null;
  return CHAIN.map(p => ({
    id: p.id,
    name: p.name,
    status: providerStatus(p, stats[p.id], active),
    bytesUsed: stats[p.id]?.bytesUsed || 0,
    freeBytes: p.freeBytes,
    fileCount: stats[p.id]?.fileCount || 0,
  }));
};

const userCounts = async () => {
  try {
    const col = collection(db, 'users');
    const [all, fresh] = await Promise.all([
      getCountFromServer(col),
      getCountFromServer(query(col, where('createdAt', '>=', Timestamp.fromDate(istDayStart())))),
    ]);
    return { total: all.data().count, newToday: fresh.data().count, error: null };
  } catch (e: any) {
    return { total: null, newToday: null, error: e?.message || 'Could not count users.' };
  }
};

const pendingWithdrawals = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'withdrawals'), where('status', '==', 'pending'), limit(500)));
    const rupees = snap.docs.reduce((n, d) => n + (Number((d.data() as any)?.rupees) || 0), 0);
    return { pending: snap.size, rupees, error: null };
  } catch (e: any) {
    return { pending: 0, rupees: 0, error: e?.message || 'Could not load withdrawals.' };
  }
};

export const getSystemSnapshot = async (): Promise<SystemSnapshot> => {
  const [health, server, backendHere, chain, users, withdrawals] = await Promise.all([
    pingWorker(),
    workerFetch<ServerSystem>('/v1/admin/system')
      .then(s => ({ s, err: null as string | null }))
      .catch((e: any) => ({ s: null, err: e?.status === 403 ? 'Owner only.' : e?.message || 'Worker not reachable.' })),
    activeBackend(),
    chainRows().catch(() => null),
    userCounts(),
    pendingWithdrawals(),
  ]);
  return {
    health,
    server: server.s,
    serverError: server.err,
    backendHere,
    chain,
    users,
    withdrawals,
    appPartners: {
      bitlabs: isBitlabsConfigured(),
      cpx: isCpxConfigured(),
      offerwall: !!offerwallUrl('x'),
    },
    at: new Date(),
  };
};
