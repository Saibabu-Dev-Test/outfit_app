// TEMPORARY ops check (branch ops/civic-research-check, never merged): reads civic_data from D1 over
// the Cloudflare REST API and, only if AP govt / AP hosp(govt) have no stored data, runs the Worker's
// own researchNow() once for each (same caps + lock as the app's POST /v1/civic/research).
import { researchNow, CIVIC_DAILY_MAX } from '../../server/worker/src/civic/research.js';
import { Db, usageFor } from '../../server/worker/src/db.js';
import { utcDay } from '../../server/worker/src/days.js';

const ACCT = process.env.CLOUDFLARE_ACCOUNT_ID;
const DBID = '3b5f3c2f-26a2-429e-8f5b-8d90c8123b3c';
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DBID}/query`;

async function q(sql, params = []) {
  const r = await fetch(API, { method: 'POST', headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ sql, params }) });
  const j = await r.json();
  if (!j.success) throw new Error('D1 ' + r.status + ' ' + JSON.stringify(j.errors).slice(0, 300));
  return j.result[0];
}
const shim = {
  prepare(sql) {
    let binds = [];
    const st = {
      bind(...b) { binds = b; return st; },
      async all() { const r = await q(sql, binds); return { results: r.results, meta: r.meta }; },
      async run() { const r = await q(sql, binds); return { results: r.results, meta: r.meta }; },
    };
    return st;
  },
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; },
};

const show = async label => {
  const rows = (await q("SELECT kind, state, district, variant, status, substr(error,1,200) AS error, model, updated_at, schema_v, length(data) AS data_len, length(i18n) AS i18n_len FROM civic_data WHERE state = 'AP' OR updated_at > ? ORDER BY updated_at DESC LIMIT 30", [Date.now() - 6 * 3600 * 1000])).results;
  console.log(`== ${label}`);
  rows.forEach(r => console.log(JSON.stringify({ ...r, updated: new Date(Number(r.updated_at)).toISOString() })));
  const counts = (await q('SELECT kind, status, COUNT(*) AS n FROM civic_data GROUP BY kind, status')).results;
  console.log('counts', JSON.stringify(counts));
  const usage = (await q("SELECT day, key, n FROM usage WHERE key IN ('civic_ai','civic_tr') ORDER BY day DESC LIMIT 6")).results;
  console.log('usage', JSON.stringify(usage));
};

const db = new Db(shim);
const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY || '' };
await show('before');
const used = await usageFor(db, utcDay(), ['civic_ai']);
console.log('civic_ai used today', used.civic_ai, 'cap', CIVIC_DAILY_MAX);
for (const t of [{ kind: 'govt', state: 'AP', district: '', variant: '' }, { kind: 'hosp', state: 'AP', district: '', variant: 'govt' }]) {
  const t0 = Date.now();
  const r = await researchNow(db, env, t, '');
  console.log('researchNow', JSON.stringify(t), JSON.stringify(r), `${Date.now() - t0} ms`);
}
await show('after');
const g = (await q("SELECT data FROM civic_data WHERE kind='govt' AND state='AP' AND district='' AND variant=''")).results[0];
if (g && g.data) { const d = JSON.parse(g.data); console.log('AP govt sample', JSON.stringify({ asOf: d.asOf, cm: d.leaders && d.leaders.chiefMinister, governor: d.leaders && d.leaders.governor, schemes: (d.schemes || []).length })); }
const h = (await q("SELECT data FROM civic_data WHERE kind='hosp' AND state='AP' AND district='' AND variant='govt'")).results[0];
if (h && h.data) { const d = JSON.parse(h.data); console.log('AP hosp sample', JSON.stringify({ n: (d.hospitals || []).length, first: (d.hospitals || []).slice(0, 2).map(x => x.name) })); }
