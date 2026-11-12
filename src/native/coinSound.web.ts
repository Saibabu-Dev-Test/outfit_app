// Web build: no coin sound
export const COIN_SOUND_KEY = 'outfitpref:coinSound';
export const isCoinSoundSupported = (): boolean => false;
export const isCoinSoundOn = async (): Promise<boolean> => false;
export const setCoinSound = async (_on: boolean): Promise<void> => {};
export const playCoinSound = (): void => {};
export const COIN_VOLUME_KEY = 'outfitpref:coinVolume';
export const clampVolume = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
};
export const getCoinVolume = async (): Promise<number> => 1;
export const setCoinVolume = async (_v: number): Promise<void> => {};
