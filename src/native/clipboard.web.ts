// Web build: no native clipboard module. Reading is never needed (the web uses ?ref= links);
// copying goes through navigator.clipboard in referralLink.ts.
export const readClipboardText = async (): Promise<string> => '';
export const setClipboardText = async (_text: string): Promise<boolean> => false;
export const clearClipboardText = async (): Promise<void> => {};
