// useCivicData (Govt / Hospitals / comparison loader): the spinner always ends. Research that fails
// (error, timeout, daily cap, busy 429) or polls that run out show saved / English info ('ready') or
// an 'error' state with the pull-to-retry message; 'paused' shows saved info with no poll; Govt
// 'partial' parts show while the rest is polled for; background translation ('translating') polls.
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

const { WorkerError } = require('../src/services/workerApi');
const { researchCivic } = require('../src/services/civicApi');
const { readCivicCache, writeCivicCache } = require('../src/services/civicCache');
import { useCivicData, MAX_POLLS, POLL_MS } from '../src/screens/Civic/useCivicData';
import { CIVIC_LABELS } from '../src/i18n/civicLabels';

type Hook = ReturnType<typeof useCivicData<any>>;
let hook: Hook;

const base = { kind: 'govt', state: 'AP', district: 'kurnool', variant: '', sources: [], aiStars: null, updatedAt: 1, aiConfigured: true, researchConfigured: true };
const empty = (extra: any = {}) => ({ ...base, data: null, i18n: {}, status: 'pending', running: false, ...extra });
const full = (extra: any = {}) => ({ ...base, data: { overview: 'Kurnool district.' }, i18n: { te: null, hi: null }, status: 'ok', ...extra });

function Probe({ fetcher, lang = 'English' }: { fetcher: any; lang?: any }) {
  hook = useCivicData<any>('govt', 'AP', 'kurnool', '', lang, fetcher);
  return null;
}

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
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
  readCivicCache.mockReset();
  readCivicCache.mockImplementation(async () => null);
  writeCivicCache.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useCivicData: collecting always ends', () => {
  it('polls exhausted (another runner never finishes): error state with the retry message, polling stops', async () => {
    const fetcher = jest.fn(async () => empty({ running: true }));
    const r = await mount(fetcher);
    expect(hook.phase).toBe('collecting');
    expect(researchCivic).not.toHaveBeenCalled(); // someone else's run is going
    await tick(MAX_POLLS + 1);
    expect(hook.phase).toBe('error');
    const calls = fetcher.mock.calls.length;
    expect(calls).toBe(MAX_POLLS + 1);
    await tick(5);
    expect(fetcher.mock.calls.length).toBe(calls); // no more polls
    expect(CIVIC_LABELS.Telugu.error).toBeTruthy(); // the error card text exists in the app languages
    act(() => r.unmount());
  });

  it('polls exhausted with saved info on the phone: the saved copy shows (ready), no spinner', async () => {
    readCivicCache.mockImplementation(async () => ({ res: full(), at: 1 }));
    const fetcher = jest.fn(async () => empty({ running: true }));
    const r = await mount(fetcher);
    expect(hook.phase).toBe('collecting');
    await tick(MAX_POLLS + 1);
    expect(hook.phase).toBe('ready');
    expect(hook.fromCache).toBe(true);
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    act(() => r.unmount());
  });

  it('research error: stops at once with the error state; timeout gives the busy note', async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'error', error: 'research failed recently, retrying later' });
    const fetcher = jest.fn(async () => empty());
    const r = await mount(fetcher);
    expect(researchCivic).toHaveBeenCalledTimes(1);
    expect(hook.phase).toBe('error');
    const calls = fetcher.mock.calls.length;
    await tick(MAX_POLLS);
    expect(fetcher.mock.calls.length).toBe(calls); // the poll started before the call was cancelled
    expect(hook.phase).toBe('error');
    act(() => r.unmount());

    researchCivic.mockResolvedValueOnce({ ok: false, status: 'error', code: 'timeout', error: 'timed out' });
    const r2 = await mount(jest.fn(async () => empty()));
    expect(hook.phase).toBe('error');
    expect(hook.aiNote).toBe('aiBusy');
    act(() => r2.unmount());
  });

  it('research paused (free quota used up): saved info + paused note, no retry, no poll', async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'paused', paused: true, code: 'quota' });
    const fetcher = jest.fn(async () => empty());
    const r = await mount(fetcher);
    expect(hook.phase).toBe('ready');
    expect(hook.aiNote).toBe('researchPaused');
    const calls = fetcher.mock.calls.length;
    await tick(MAX_POLLS);
    expect(fetcher.mock.calls.length).toBe(calls);
    expect(researchCivic).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('busy: a 429 from the Worker or the daily cap ends the spinner with the busy note', async () => {
    researchCivic.mockRejectedValueOnce(new WorkerError(429, 'try again later today'));
    const r = await mount(jest.fn(async () => empty()));
    expect(hook.phase).toBe('error');
    expect(hook.aiNote).toBe('aiBusy');
    act(() => r.unmount());

    researchCivic.mockResolvedValueOnce({ ok: false, status: 'pending', error: 'daily cap reached', code: 'cap' });
    readCivicCache.mockImplementation(async () => ({ res: full(), at: 1 }));
    const r2 = await mount(jest.fn(async () => empty()));
    expect(hook.phase).toBe('ready'); // saved copy on the phone stays on screen
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    expect(hook.aiNote).toBe('aiBusy');
    act(() => r2.unmount());
  });

  it('already running elsewhere: keeps polling and shows the result when it lands', async () => {
    researchCivic.mockResolvedValueOnce({ ok: true, status: 'running', did: 'already running' });
    let n = 0;
    const fetcher = jest.fn(async () => (++n < 3 ? empty() : full()));
    const r = await mount(fetcher);
    expect(hook.phase).toBe('collecting');
    await tick(2);
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    act(() => r.unmount());
  });

  it('pull to refresh after an error asks the Worker again', async () => {
    researchCivic.mockResolvedValueOnce({ ok: false, status: 'error', error: 'x' });
    researchCivic.mockResolvedValueOnce({ ok: true, status: 'ok', did: 'research' });
    let n = 0;
    const fetcher = jest.fn(async () => (++n < 3 ? empty() : full()));
    const r = await mount(fetcher);
    expect(hook.phase).toBe('error');
    await act(async () => {
      hook.refresh();
      await flush();
    });
    expect(researchCivic).toHaveBeenCalledTimes(2);
    expect(hook.phase).toBe('ready');
    act(() => r.unmount());
  });
});

describe('useCivicData: progressive Govt + background translation', () => {
  it('partial parts show at once (not cached), the rest is polled for', async () => {
    researchCivic.mockResolvedValueOnce({ ok: true, status: 'running', did: 'already running' });
    let n = 0;
    const fetcher = jest.fn(async () => (++n < 3 ? full({ status: 'partial', running: true }) : full({ data: { overview: 'Kurnool district.', departments: [{ name: 'Health' }] } })));
    const r = await mount(fetcher);
    expect(hook.phase).toBe('collecting');
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    expect(writeCivicCache).not.toHaveBeenCalled();
    await tick(2);
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.departments[0].name).toBe('Health');
    expect(writeCivicCache).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('partial parts stay on screen when polls run out', async () => {
    const fetcher = jest.fn(async () => full({ status: 'partial', running: true }));
    const r = await mount(fetcher);
    await tick(MAX_POLLS + 1);
    expect(hook.phase).toBe('ready');
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    act(() => r.unmount());
  });

  it("translation started in the background ('translating'): English shows, then the copy arrives", async () => {
    researchCivic.mockResolvedValueOnce({ ok: true, status: 'translating', did: 'translate', lang: 'te' });
    let n = 0;
    const fetcher = jest.fn(async () => (++n < 3 ? full({ status: 'translating' }) : full({ i18n: { te: { overview: 'కర్నూలు జిల్లా.' }, hi: null } })));
    const r = await mount(fetcher, 'Telugu');
    expect(hook.phase).toBe('translating');
    expect(hook.res?.data?.overview).toBe('Kurnool district.');
    await tick(2);
    expect(hook.phase).toBe('ready');
    expect(hook.res?.i18n?.te?.overview).toBe('కర్నూలు జిల్లా.');
    act(() => r.unmount());
  });
});
