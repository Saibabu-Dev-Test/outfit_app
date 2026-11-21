// Cool-down memory for the AI fallback chain (gemini.js, llm.js). When a Gemini key / model, Groq or
// Workers AI answers "quota used up", the time it frees up is saved in D1 (table ai_cooldown,
// migration 0007) so every Worker isolate and every later call skips it until then, instead of
// spending a request (and seconds) on a sure 429. D1 is shared by all isolates and survives restarts;
// one tiny read per AI call (free D1: 5M reads / day), one write only when something runs out.
// Never stores a key: ids hold a short md5 prefix (see coolId in gemini.js).
// Any D1 problem is swallowed: the chain then just tries every key again (never breaks AI).
//
// When things reset:
//   Gemini daily quota  midnight Pacific time -> we wait until the next 08:00 UTC (= midnight PST,
//                       1 am PDT), so a key is never retried while still exhausted
//   Gemini per-minute   the RetryInfo delay Google sends (default 60 s)
//   Groq / Workers AI   daily limits reset 00:00 UTC -> next UTC day; per-minute 60 s / retry-after
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// Next 00:00 UTC strictly after `now` (pure: tested)
export const nextUtcDay = now => {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

// Next 08:00 UTC strictly after `now`: Gemini's daily free quota resets at midnight Pacific (pure: tested)
export const nextGeminiReset = now => {
  const d = new Date(now);
  const today8 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8);
  return now < today8 ? today8 : today8 + DAY_MS;
};

// D1-backed store (raw D1 binding: env.DB). null when there is no DB (unit tests, local scripts).
export function d1Cooldown(DB) {
  if (!DB || typeof DB.prepare !== 'function') {
    return null;
  }
  return {
    // Map id -> until (ms) of everything still cooling at `now`
    async active(now) {
      try {
        const r = await DB.prepare('SELECT id, until FROM ai_cooldown WHERE until > ?').bind(now).all();
        return new Map(((r && r.results) || []).map(x => [x.id, Number(x.until) || 0]));
      } catch (e) {
        return new Map();
      }
    },
    async set(id, until, reason, now) {
      try {
        await DB.prepare(
          `INSERT INTO ai_cooldown (id, until, reason, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET until = excluded.until, reason = excluded.reason, updated_at = excluded.updated_at`,
        )
          .bind(String(id).slice(0, 120), Math.round(until), String(reason || '').slice(0, 20), now)
          .run();
      } catch (e) {
        // ignore: worst case the key is tried once more next call
      }
    },
  };
}

// In-memory store with the same shape (tests; a Worker without D1)
export function memoryCooldown() {
  const m = new Map();
  return {
    rows: m,
    async active(now) {
      return new Map([...m].filter(([, v]) => v.until > now).map(([k, v]) => [k, v.until]));
    },
    async set(id, until, reason) {
      m.set(id, { until, reason });
    },
  };
}

// The store a call uses: an explicit one from deps (tests), else D1 from env.DB, else none
export const cooldownFor = (env, deps = {}) => (deps && deps.cooldown !== undefined ? deps.cooldown : d1Cooldown(env && env.DB));

// Small per-call view: reads the store once, writes through
export async function coolView(store, now) {
  const active = store ? await store.active(now) : new Map();
  return {
    isCool: id => (active.get(id) || 0) > now,
    until: id => active.get(id) || 0,
    async cool(id, until, reason) {
      active.set(id, until);
      if (store) {
        await store.set(id, until, reason, now);
      }
    },
  };
}
