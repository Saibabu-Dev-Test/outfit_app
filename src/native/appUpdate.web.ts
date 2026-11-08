// Web build: no in-app update (the web app updates itself through Firebase Hosting)
export const GET_PAGE_URL = 'https://outfit-vote-9edca.web.app/get/';

export interface UpdateInfo {
  build: number;
  current: number;
  apkUrl: string;
}

export const checkForUpdate = async (_force = false): Promise<UpdateInfo | null> => null;
export const canInstallApks = async (): Promise<boolean> => false;
export const openInstallSettings = async (): Promise<boolean> => false;
export const downloadAndInstall = async (_u: UpdateInfo): Promise<'installing' | 'browser' | 'failed'> => 'failed';
