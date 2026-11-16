// The app's D1 data (through the Worker): posts, A-F votes, coin events and the read-only earn
// ledger. Shapes match the Worker's api.js. Callers decide when to use it (dataBackend.ts).
import { workerFetch } from './workerApi';

export interface D1Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userAge: number | null;
  caption: string;
  photos: string[];
  clear: string[];
  likeCount: number;
  commentCount: number;
  createdAt: number;
}

export interface D1Earning {
  id: string;
  type: string;
  partner: string;
  status: string;
  coins: number;
  rupees: number;
  createdAt: number;
  holdUntil: number | null;
}

export const d1Feed = (opts: { before?: number | null; limit?: number; uids?: string[] } = {}) => {
  const q = [`limit=${opts.limit || 10}`];
  if (opts.before) q.push(`before=${opts.before}`);
  if (opts.uids && opts.uids.length) q.push(`uids=${encodeURIComponent(opts.uids.join(','))}`);
  return workerFetch<{ posts: D1Post[]; hasMore: boolean; cursor: number | null }>(`/v1/feed?${q.join('&')}`);
};

export const d1CreatePost = (body: {
  photos: string[];
  clear?: string[];
  caption: string;
  userName?: string | null;
  userAvatar?: string | null;
  userAge?: number | null;
}) => workerFetch<{ id: string; createdAt: number }>('/v1/posts', { method: 'POST', body, timeoutMs: 30000 });

export const d1GetPost = async (id: string): Promise<D1Post | null> => {
  try {
    return (await workerFetch<{ post: D1Post }>(`/v1/posts/${encodeURIComponent(id)}`)).post;
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
};

export const d1DeletePost = (id: string) => workerFetch(`/v1/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const d1Votes = (postId: string, n: number) =>
  workerFetch<{ counts: number[]; total: number; myVote: number | null }>(`/v1/votes?post=${encodeURIComponent(postId)}&n=${n}`);

export const d1Vote = (postId: string, option: string) => workerFetch('/v1/votes', { method: 'PUT', body: { postId, option } });

export const d1CoinTotal = async (): Promise<number> => (await workerFetch<{ total: number }>('/v1/coins')).total || 0;

export const d1AwardCoin = (type: string, targetId: string) =>
  workerFetch<{ id: string; added: number; total: number }>('/v1/coins', { method: 'POST', body: { type, targetId } });

export const d1Earnings = async (): Promise<D1Earning[]> => (await workerFetch<{ entries: D1Earning[] }>('/v1/earnings')).entries || [];
