// Thin D1 wrapper that counts rows read / written per request (from each result's meta), so the
// Worker can keep its own "today's D1 usage" counter (usage table, UTC day) for the 95% switch and
// the Admin > System screen. flushUsage adds the counts in one statement at the end of a request.
import { utcDay } from './days.js';

export class Db {
  constructor(d1) {
    this.d1 = d1;
    this.reads = 0;
    this.writes = 0;
    this.sizeBytes = null;
  }

  track(res) {
    const m = res && res.meta;
    if (m) {
      this.reads += Number(m.rows_read || 0);
      this.writes += Number(m.rows_written || 0);
      if (typeof m.size_after === 'number') {
        this.sizeBytes = m.size_after;
      }
    }
    return res;
  }

  stmt(sql, ...binds) {
    return this.d1.prepare(sql).bind(...binds);
  }

  async all(sql, ...binds) {
    const r = this.track(await this.stmt(sql, ...binds).all());
    return (r && r.results) || [];
  }

  async first(sql, ...binds) {
    const rows = await this.all(sql, ...binds);
    return rows[0] || null;
  }

  async run(sql, ...binds) {
    return this.track(await this.stmt(sql, ...binds).run());
  }

  async batch(stmts) {
    const rs = await this.d1.batch(stmts);
    (rs || []).forEach(r => this.track(r));
    return rs;
  }

  async flushUsage(now = Date.now()) {
    if (!this.reads && !this.writes) {
      return;
    }
    const day = utcDay(now);
    // +2 rows written (+ index) for this upsert itself
    const reads = this.reads;
    const writes = this.writes + 2;
    this.reads = 0;
    this.writes = 0;
    await this.d1.batch([
      this.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, 'd1_reads', reads),
      this.stmt('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, 'd1_writes', writes),
    ]);
  }
}

export const addUsage = (db, day, key, n) =>
  db.run('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = n + excluded.n', day, key, n);

export const setUsage = (db, day, key, n) =>
  db.run('INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = excluded.n', day, key, n);

export async function usageFor(db, day, keys) {
  const marks = keys.map(() => '?').join(',');
  const rows = await db.all(`SELECT key, n FROM usage WHERE day = ? AND key IN (${marks})`, day, ...keys);
  const out = {};
  keys.forEach(k => (out[k] = 0));
  rows.forEach(r => (out[r.key] = Number(r.n) || 0));
  return out;
}
