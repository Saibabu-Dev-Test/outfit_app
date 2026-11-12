// Web build: no ads. Rewarded content unlocks after the same short wait as "no ad available".
import { REWARDED_FALLBACK_WAIT_MS } from '../config/ads';

export type RewardedSlot = 'astroRewarded' | 'poruthamRewarded';
export type RewardedResult = 'earned' | 'closed' | 'no_ad';
export const adsModule = (): any => null;
export const adsAvailable = (): boolean => false;
export const initAds = (): Promise<boolean> => Promise.resolve(false);
export const showRewardedAd = (_slot: RewardedSlot): Promise<RewardedResult> => Promise.resolve('no_ad');
export const watchAdToUnlock = async (_slot: RewardedSlot): Promise<boolean> => {
  await new Promise<void>(r => setTimeout(r, REWARDED_FALLBACK_WAIT_MS));
  return true;
};
export const adsAllowed = (): boolean => false;
export const allowAds = (): void => {};
export const onAdsAllowed = (_fn: () => void): (() => void) => () => {};
export const whenAdsAllowed = (): Promise<void> => new Promise<void>(() => {});

// Admin "Ads status" (no ads on the web)
export interface AdStatus { slot: string; ok: boolean; message: string; at: number }
export const noteAd = (_slot: string, _ok: boolean, _message: string): void => {};
export const adStatuses = (): AdStatus[] => [];
