// Pure logic for the shared task pool (no Firebase). Server rules of the pool: server/earn/taskPool.js.
import {
  POOL_TASK_TYPES,
  PoolTaskType,
  TASK_POOL_DEFAULT_CLAIM_MINUTES,
  TASK_POOL_DEFAULT_USER_CAP,
  TASK_POOL_LIMITS,
} from '../config/earn';

export type SlotStatus = 'open' | 'claimed' | 'done';

export interface PoolSlot {
  id: string;
  taskType: PoolTaskType;
  rewardCoins: number;
  status: SlotStatus; // as stored
  claimedBy: string | null;
  claimExpiresAt: number; // ms, 0 = none
}

export interface PoolDay {
  budgetCoins: number;
  claimMinutes: number;
  perUserCap: number;
  paidCoins: number;
}

export interface PoolUserDay {
  claims: number;
  done: number;
}

const num = (v: any): number => (typeof v === 'number' && isFinite(v) ? v : 0);
const ms = (v: any): number =>
  v?.toMillis ? v.toMillis() : v?.toDate ? v.toDate().getTime() : v instanceof Date ? v.getTime() : num(v);
const clampInt = (v: any, lo: number, hi: number, dflt: number): number => {
  const n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.floor(n)));
};

export const toPoolSlot = (id: string, d: any): PoolSlot | null => {
  if (!d || !POOL_TASK_TYPES.includes(d.taskType)) return null;
  return {
    id,
    taskType: d.taskType,
    rewardCoins: Math.max(0, Math.floor(num(d.rewardCoins))),
    status: d.status === 'claimed' || d.status === 'done' ? d.status : 'open',
    claimedBy: typeof d.claimedBy === 'string' ? d.claimedBy : null,
    claimExpiresAt: ms(d.claimExpiresAt),
  };
};

export const toPoolDay = (d: any): PoolDay | null =>
  d
    ? {
        budgetCoins: clampInt(d.budgetCoins, TASK_POOL_LIMITS.budgetCoins[0], TASK_POOL_LIMITS.budgetCoins[1], 0),
        claimMinutes: clampInt(
          d.claimMinutes,
          TASK_POOL_LIMITS.claimMinutes[0],
          TASK_POOL_LIMITS.claimMinutes[1],
          TASK_POOL_DEFAULT_CLAIM_MINUTES,
        ),
        perUserCap: clampInt(d.perUserCap, TASK_POOL_LIMITS.perUserCap[0], TASK_POOL_LIMITS.perUserCap[1], TASK_POOL_DEFAULT_USER_CAP),
        paidCoins: Math.max(0, Math.floor(num(d.paidCoins))),
      }
    : null;

export const toPoolUserDay = (d: any): PoolUserDay => ({
  claims: Math.max(0, Math.floor(num(d?.claims))),
  done: Math.max(0, Math.floor(num(d?.done))),
});

// A claim past its expiry is open again (the server treats it the same way)
export const effectiveStatus = (s: PoolSlot, now: number): SlotStatus =>
  s.status === 'done' ? 'done' : s.status === 'claimed' && s.claimExpiresAt > now ? 'claimed' : 'open';

export interface PoolView {
  mine: PoolSlot | null; // my live claim
  open: { taskType: PoolTaskType; rewardCoins: number; count: number; slotId: string }[]; // one row per type + reward
  openCount: number;
  claimsLeft: number;
}

export const poolView = (slots: PoolSlot[], day: PoolDay | null, me: PoolUserDay, uid: string, now: number): PoolView => {
  let mine: PoolSlot | null = null;
  const groups = new Map<string, { taskType: PoolTaskType; rewardCoins: number; count: number; slotId: string }>();
  let openCount = 0;
  for (const s of slots) {
    const st = effectiveStatus(s, now);
    if (st === 'claimed' && s.claimedBy === uid) mine = s;
    if (st !== 'open') continue;
    openCount++;
    const k = `${s.taskType}|${s.rewardCoins}`;
    const g = groups.get(k);
    if (g) g.count++;
    else groups.set(k, { taskType: s.taskType, rewardCoins: s.rewardCoins, count: 1, slotId: s.id });
  }
  const open = [...groups.values()].sort(
    (a, b) => POOL_TASK_TYPES.indexOf(a.taskType) - POOL_TASK_TYPES.indexOf(b.taskType) || b.rewardCoins - a.rewardCoins,
  );
  const cap = day ? day.perUserCap : 0;
  return { mine, open, openCount, claimsLeft: Math.max(0, cap - me.claims) };
};

// "12:34" left on a claim
export const timeLeftText = (expiresAt: number, now: number): string => {
  const s = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// ── Admin form checks (firestore.rules checks the same ranges) ──
export type CheckResult = { ok: true } | { ok: false; message: string };

export const checkPoolSettings = (budgetCoins: number, claimMinutes: number, perUserCap: number, paidCoins = 0): CheckResult => {
  const L = TASK_POOL_LIMITS;
  if (!Number.isInteger(budgetCoins) || budgetCoins < L.budgetCoins[0] || budgetCoins > L.budgetCoins[1]) {
    return { ok: false, message: `Budget must be a whole number of coins, ${L.budgetCoins[0]}–${L.budgetCoins[1]}.` };
  }
  if (budgetCoins < paidCoins) return { ok: false, message: `Budget can't be below the ${paidCoins} coins already paid today.` };
  if (!Number.isInteger(claimMinutes) || claimMinutes < L.claimMinutes[0] || claimMinutes > L.claimMinutes[1]) {
    return { ok: false, message: `Claim time must be ${L.claimMinutes[0]}–${L.claimMinutes[1]} minutes.` };
  }
  if (!Number.isInteger(perUserCap) || perUserCap < L.perUserCap[0] || perUserCap > L.perUserCap[1]) {
    return { ok: false, message: `Tasks per user must be ${L.perUserCap[0]}–${L.perUserCap[1]}.` };
  }
  return { ok: true };
};

export const checkNewSlots = (rewardCoins: number, count: number): CheckResult => {
  const L = TASK_POOL_LIMITS;
  if (!Number.isInteger(rewardCoins) || rewardCoins < L.rewardCoins[0] || rewardCoins > L.rewardCoins[1]) {
    return { ok: false, message: `Reward must be ${L.rewardCoins[0]}–${L.rewardCoins[1]} coins.` };
  }
  if (!Number.isInteger(count) || count < 1 || count > L.slotsPerAdd) {
    return { ok: false, message: `Add 1–${L.slotsPerAdd} slots at a time.` };
  }
  return { ok: true };
};

// Coins of all slots not yet paid vs what is left of the budget (admin warning)
export const slotsOverBudget = (slots: PoolSlot[], day: PoolDay | null): number => {
  if (!day) return 0;
  const unpaid = slots.filter(s => s.status !== 'done').reduce((t, s) => t + s.rewardCoins, 0);
  return Math.max(0, unpaid - Math.max(0, day.budgetCoins - day.paidCoins));
};
