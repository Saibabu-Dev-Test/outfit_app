// Web build: no coin sound
export const COIN_SOUND_KEY = 'outfitpref:coinSound';
export const isCoinSoundSupported = (): boolean => false;
export const isCoinSoundOn = async (): Promise<boolean> => false;
export const setCoinSound = async (_on: boolean): Promise<void> => {};
export const playCoinSound = (): void => {};
