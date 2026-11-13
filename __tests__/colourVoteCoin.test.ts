// Home "today's colour" vote: flip + sound on every vote, +1 coin only on the first vote of the day.
const mockCreated = new Set<string>();
const mockCommit = jest.fn();

jest.mock('../src/config/firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: (_db: any, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: async () => ({ exists: () => true, data: () => ({ coins: 10 }) }),
  increment: (n: number) => ({ inc: n }),
  serverTimestamp: () => 'ts',
  writeBatch: () => {
    const ops: any[] = [];
    return {
      set: (ref: any, data: any) => ops.push({ ref, data }),
      update: (ref: any, data: any) => ops.push({ ref, data }),
      commit: async () => {
        mockCommit(ops);
        // coinEvents docs are create-only (firestore.rules): a second create is refused
        const ev = ops.find(o => o.ref.path.includes('/coinEvents/'));
        if (ev && mockCreated.has(ev.ref.path)) {
          const e: any = new Error('denied');
          e.code = 'permission-denied';
          throw e;
        }
        if (ev) mockCreated.add(ev.ref.path);
      },
    };
  },
}));

import { awardColourVoteCoin, coinEventId, colourVoteCoinTarget, COLOUR_VOTE_CAPTION } from '../src/services/coinsApi';
import { onCoinFlip, CoinFlipEvent } from '../src/services/coinBus';

const flush = () => new Promise<void>(r => setTimeout(r, 0));
const settle = async () => {
  for (let i = 0; i < 10; i++) await flush();
};

describe('Home colour vote coin', () => {
  it('uses one coin event per local day', () => {
    expect(coinEventId('vote', colourVoteCoinTarget('2026-11-13'))).toBe('vote_colour_2026-11-13');
    expect(coinEventId('vote', colourVoteCoinTarget('2026-11-13'))).toMatch(/^vote_[A-Za-z0-9_-]{1,200}$/);
  });

  it('first vote of the day: +1 coin and a flip; later votes: flip only, no coin', async () => {
    const flips: CoinFlipEvent[] = [];
    const off = onCoinFlip(e => flips.push(e));
    awardColourVoteCoin('2026-11-13');
    await settle();
    expect(flips).toHaveLength(1);
    expect(flips[0]).toMatchObject({ earned: 1, total: 11, caption: COLOUR_VOTE_CAPTION });
    expect(mockCommit).toHaveBeenCalledTimes(1);

    // Changing the vote later the same day
    awardColourVoteCoin('2026-11-13');
    await settle();
    expect(flips).toHaveLength(2);
    expect(flips[1]).toMatchObject({ earned: 0, caption: COLOUR_VOTE_CAPTION });
    expect(mockCommit).toHaveBeenCalledTimes(1); // no second write this session

    // Next day: a new coin
    awardColourVoteCoin('2026-11-14');
    await settle();
    expect(flips[2]).toMatchObject({ earned: 1, total: 12 });
    expect(mockCommit).toHaveBeenCalledTimes(2);
    off();
  });

  it('already awarded on another device: flip only, no coin', async () => {
    mockCreated.add('users/u1/coinEvents/vote_colour_2026-11-15');
    const flips: CoinFlipEvent[] = [];
    const off = onCoinFlip(e => flips.push(e));
    awardColourVoteCoin('2026-11-15');
    await settle();
    expect(flips).toHaveLength(1);
    expect(flips[0].earned).toBe(0);
    expect(flips[0].caption).toBe(COLOUR_VOTE_CAPTION);
    off();
  });
});
