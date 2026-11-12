// true once App.tsx has allowed ads (a few seconds after the first screen); re-renders then.
import { useEffect, useState } from 'react';
import { adsAllowed, onAdsAllowed } from '../../native/ads';

export default function useAdsAllowed(): boolean {
  const [ok, setOk] = useState<boolean>(() => adsAllowed());
  useEffect(() => {
    if (ok) return;
    return onAdsAllowed(() => setOk(true));
  }, [ok]);
  return ok;
}
