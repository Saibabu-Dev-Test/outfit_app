// Web: no native crash reporter / safe mode
export const crashNative = () => undefined;
export const isSafeMode = (): boolean => false;
export const nativeShowsCrash = (): boolean => false;
export const markBootOk = (): void => {};
export const saveJsCrash = (_text: string): void => {};
