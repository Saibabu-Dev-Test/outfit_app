// Today's "Wear today" votes for one owner's wardrobe, with my vote and a vote / un-vote action.
// The day rolls over at local midnight (useDayKey), so the tally starts again from 0.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useDayKey } from './useDayKey';
import { castWearVote, emptyWearTally, getWearTally, removeWearVote, WearTally } from '../services/wearVotesApi';

export interface WearVotes {
  day: string;
  tally: WearTally;
  loading: boolean;
  error: string | null;
  busyItem: string | null;
  canVote: boolean; // signed in and not the owner
  vote: (itemId: string) => Promise<void>; // tap my current pick again to take the vote back
  refresh: () => Promise<void>;
}

export default function useWearVotes(ownerId?: string, myUid?: string): WearVotes {
  const day = useDayKey();
  const [tally, setTally] = useState<WearTally>(emptyWearTally(day));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const tallyRef = useRef(tally);
  tallyRef.current = tally;
  const canVote = !!myUid && !!ownerId && myUid !== ownerId;

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    try {
      setTally(await getWearTally(ownerId, day, myUid));
      setError(null);
    } catch (e: any) {
      setTally(emptyWearTally(day));
      setError(e?.message || 'Could not load wear votes');
    } finally {
      setLoading(false);
    }
  }, [ownerId, day, myUid]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const vote = useCallback(
    async (itemId: string) => {
      if (!canVote || !ownerId || !myUid || busyItem) return;
      const before = tallyRef.current;
      const undo = before.myItemId === itemId;
      // Optimistic: move my vote
      const counts = { ...before.counts };
      if (before.myItemId) counts[before.myItemId] = Math.max(0, (counts[before.myItemId] || 0) - 1);
      if (!undo) counts[itemId] = (counts[itemId] || 0) + 1;
      setTally({
        ...before,
        counts,
        total: before.total + (undo ? -1 : before.myItemId ? 0 : 1),
        myItemId: undo ? null : itemId,
      });
      setBusyItem(itemId);
      try {
        if (undo) await removeWearVote(ownerId, myUid, day);
        else await castWearVote(ownerId, myUid, itemId, day);
        await refresh();
      } catch (e: any) {
        setTally(before);
        Alert.alert('Vote failed', e?.message || 'Please try again.');
      } finally {
        setBusyItem(null);
      }
    },
    [canVote, ownerId, myUid, busyItem, day, refresh],
  );

  return { day, tally, loading, error, busyItem, canVote, vote, refresh };
}
