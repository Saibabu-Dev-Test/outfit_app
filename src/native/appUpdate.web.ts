// Web build: no in-app update (the web app updates itself through Firebase Hosting)
import { APP_GET_URL } from '../config/links';

export const GET_PAGE_URL = APP_GET_URL;

export interface UpdateInfo {
  build: number;
  current: number;
  apkUrl: string;
}

export const checkForUpdate = async (_force = false): Promise<UpdateInfo | null> => null;
export const canInstallApks = async (): Promise<boolean> => false;
export const openInstallSettings = async (): Promise<boolean> => false;
export const downloadAndInstall = async (_u: UpdateInfo): Promise<'installing' | 'browser' | 'failed'> => 'failed';

export const isAutoUpdateOn = async (): Promise<boolean> => false;
export const setAutoUpdate = async (_on: boolean): Promise<void> => {};
export const wasAutoUpdateAsked = async (): Promise<boolean> => true;
export const isUpdateSupported = (): boolean => false;
