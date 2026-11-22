// HTTP helpers for the free civic sources (Wikidata, Wikipedia, Nominatim, Overpass). Every call
// has a hard timeout and identifies the app with a User-Agent + contact, as the Wikimedia and
// OpenStreetMap usage policies ask. Never throws: { ok, status, data|text, error }.

export const FREE_UA = 'OutfitApp-Civic/1.0 (https://github.com/Saibabu-Dev-Test/outfit_app; civic tab, cached in D1)';

export async function getJson(url, { fetchImpl = fetch, timeoutMs = 8000, headers = {}, method = 'GET', body } = {}) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, {
      method,
      body,
      headers: { 'User-Agent': FREE_UA, Accept: 'application/json', ...headers },
      signal: ctl ? ctl.signal : undefined,
    });
    if (!res || !res.ok) {
      return { ok: false, status: res ? res.status : 0, error: `http ${res ? res.status : 0}` };
    }
    const text = await res.text();
    try {
      return { ok: true, status: res.status, data: JSON.parse(text) };
    } catch (e) {
      return { ok: false, status: res.status, error: 'bad json' };
    }
  } catch (e) {
    return { ok: false, status: 0, error: e && e.name === 'AbortError' ? 'timeout' : String((e && e.message) || e).slice(0, 120) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// First mirror that answers ok, one after another (each with its own timeout)
export async function firstOk(urls, opts = {}) {
  let last = { ok: false, error: 'no source' };
  for (const u of urls) {
    const r = await getJson(u, opts);
    if (r.ok) return { ...r, url: u };
    last = r;
  }
  return last;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

// YYYY-MM-DD of an epoch ms (UTC)
export const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
