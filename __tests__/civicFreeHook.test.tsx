// useCivicData with free sources (Worker data reply freeSources: true; Govt / Hospitals from
// Wikidata / Wikipedia / OpenStreetMap): a research reply with status 'ready' (origin 'free') is
// success and the saved rows show at once; 'paused' is never shown for free-source places; an AI
// translation hiccup only says the translation is on the way while English shows.
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('../src/services/workerApi', () => {
  class WorkerError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { workerFetch: jest.fn(), WorkerError };
});
jest.mock('../src/services/civicApi', () => ({ researchCivic: jest.fn() }));
jest.mock('../src/services/civicCache', () => ({
  civicCacheKey: (...a: any[]) => a.join('|'),
  readCivicCache: jest.fn(async () => null),
  writeCivicCache: jest.fn(async () => undefined),
}));

const { researchCivic } = require('../src/services/civicApi');
import { useCivicData, MAX_POLLS, POLL_MS } from '../src/screens/Civic/useCivicData';

type Hook = ReturnType<typeof useCivicData<any>>;
let hook: Hook;

// Free-source place: researchConfigured / aiConfigured may even be false (no AI key at all)
const base = { kind: 'hosp', state: 'AP', district: 'kurnool', variant: 'govt', sources: [], aiStars: null, updatedAt: 1, aiConfigured: false, researchConfigured: true, freeSources: true };
const empty = (extra: any = {}) => ({ ...base, data: null, i18n: {}, status: 'none', running: false, ...extra });
const ROWS = { origin: 'free', asOf: '2026-11-22', hospitals: [{ name: 'Government General Hospital', slug: 'ggh', ownership: 'govt', address: 'Kurnool', phone: '' }] };
const full = (extra: any = {}) => ({ ...base, data: ROWS, i18n: { te: null, hi: null }, status: 'ok', ...extra });

function Probe({ fetcher, lang = 'English' }: { fetcher: any; lang?: any }) {
  hook = useCivicData<any>('hosp', 'AP', 'kurnool', 'govt', lang, fetcher);
  return null;
}

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const mount = async (fetcher: any, lang = 'English') => {
  let r: any;
  await act(async () => {
    r = ReactTestRenderer.create(<Probe fetcher={fetcher} lang={lang} />);
    await flush();
  });
  return r;
};
const tick = async (n = 1) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      jest.advanceTimersByTime(POLL_MS);
      await flush();
    });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  researchCivic.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useCivicData: free sources', () => {
  it("research 'ready' (origin free) is success: rows show at once, no note, no endless poll", async () => {
    let saved = false;
    const fetcher = jest.fn(async () => (saved ? full() : empty()));
    researchCivic.mockImplementationOnce(async () => {
      saved = true;
      return { ok: true, status: 'ready', did: 'research', origin: 'free', translated: [] };
    });
    const r = await mount(fetcher);
    expect(researchCivic).toHaveBeenCalledTimes(1);
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.hospitals[0].name).toBe('Government General Hospital');
    expect(hook.aiNote).toBeNull();
    const calls = fetcher.mock.calls.length;
    await tick(MAX_POLLS);
    expect(fetcher.mock.calls.length).toBe(calls); // nothing left to poll for
    act(() => r.unmount());
  });

  it("'ready' without did still counts as done (older / other reply shapes)", async () => {
    let saved = false;
    researchCivic.mockImplementationOnce(async () => {
      saved = true;
      return { ok: true, status: 'ready', origin: 'free' };
    });
    const r = await mount(jest.fn(async () => (saved ? full() : empty())));
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.origin).toBe('free');
    act(() => r.unmount());
  });

  it("never shows 'Research paused' for a free-source place, even if a reply says paused", async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'paused', paused: true, code: 'quota' });
    const r = await mount(jest.fn(async () => empty()));
    expect(hook.aiNote).not.toBe('researchPaused');
    expect(hook.phase).not.toBe('collecting'); // the spinner still ends
    act(() => r.unmount());
  });

  it('free data on the Worker shows immediately (no research call)', async () => {
    const r = await mount(jest.fn(async () => full()));
    expect(researchCivic).not.toHaveBeenCalled();
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.hospitals).toHaveLength(1);
    act(() => r.unmount());
  });

  it('Telugu: AI translation paused on a free-source place = English shows + "translation on the way"', async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'paused', did: 'translate', code: 'quota' });
    const r = await mount(jest.fn(async () => full({ aiConfigured: true })), 'Telugu');
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.hospitals[0].name).toBe('Government General Hospital');
    expect(hook.aiNote).toBe('trLater');
    act(() => r.unmount());
  });

  it("without freeSources (AI-researched kinds) a paused reply never shows 'Research paused' either", async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'paused', paused: true, code: 'quota' });
    const r = await mount(jest.fn(async () => empty({ freeSources: false, aiConfigured: true })));
    expect(hook.aiNote).not.toBe('researchPaused');
    expect(hook.phase).toBe('ready');
    act(() => r.unmount());
  });
});
