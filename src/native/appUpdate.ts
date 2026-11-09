// In-app update for the sideloaded Android APK (no Play Store). Android only.
// The latest GitHub release is build-N, and the APK's versionCode is that same N (build.gradle).
import { Linking, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APK_NAME, APK_UNIVERSAL_NAME, APP_GET_URL } from '../config/links';

interface NativeUpdate {
  getInfo: () => Promise<{ versionCode: number; versionName: string; abis: string[] }>;
  canInstall: () => Promise<boolean>;
  openInstallSettings: () => Promise<boolean>;
  downloadAndInstall: (url: string, title: string) => Promise<string>;
}

const Native: NativeUpdate | undefined =
  Platform.OS === 'android' ? (NativeModules.OutfitAppUpdate as NativeUpdate | undefined) : undefined;

const REPO = 'Saibabu-Dev-Test/outfit_app';
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_DL = `https://github.com/${REPO}/releases/latest/download/`;
export const GET_PAGE_URL = APP_GET_URL;
// Not under "outfit:" so logout's storage cleanup keeps it
const LAST_CHECK_KEY = 'outfitupdate:lastCheck';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
// Automatic update check is the user's choice: OFF until they turn it on (Settings or the
// one-time first-launch question). Not under "outfit:" so logout keeps the choice.
const ENABLED_KEY = 'outfitupdate:enabled';
const ASKED_KEY = 'outfitupdate:asked';

export const isAutoUpdateOn = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === '1';
  } catch {
    return false;
  }
};

export const setAutoUpdate = async (on: boolean): Promise<void> => {
  try {
    await AsyncStorage.multiSet([
      [ENABLED_KEY, on ? '1' : '0'],
      [ASKED_KEY, '1'],
    ]);
  } catch {}
};

// True once the user has answered the first-launch question (or changed the Settings switch)
export const wasAutoUpdateAsked = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === '1';
  } catch {
    return true;
  }
};

export const isUpdateSupported = (): boolean => !!Native;

export interface UpdateInfo {
  build: number; // N of build-N
  current: number; // this install's versionCode
  apkUrl: string; // arm64 APK, or universal when the phone isn't arm64
}

// Newer release than this install, or null. At most once per 6 hours. Never throws.
export const checkForUpdate = async (force = false): Promise<UpdateInfo | null> => {
  if (!Native) return null;
  try {
    // Never contacts GitHub unless the user turned automatic updates on (or asked manually)
    if (!force && !(await isAutoUpdateOn())) return null;
    if (!force) {
      const last = Number(await AsyncStorage.getItem(LAST_CHECK_KEY)) || 0;
      if (Date.now() - last < CHECK_EVERY_MS) return null;
    }
    const info = await Native.getInfo();
    const res = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    // Counted only when GitHub answered (offline launches check again next time)
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    const rel: any = await res.json();
    const m = /^build-(\d+)$/.exec(String(rel?.tag_name || ''));
    const build = m ? Number(m[1]) : 0;
    const current = Number(info?.versionCode) || 0;
    if (!build || build <= current) return null;
    const assets: any[] = Array.isArray(rel?.assets) ? rel.assets : [];
    const urlOf = (name: string) =>
      assets.find(a => a?.name === name)?.browser_download_url || (assets.length ? '' : `${LATEST_DL}${name}`);
    const arm64 = (info?.abis || [])[0] === 'arm64-v8a';
    // Outfit.apk / Outfit-universal.apk first; the old names stay as a fallback (older releases)
    const apkUrl =
      (arm64 && (urlOf(APK_NAME) || urlOf('app-arm64-v8a-release.apk'))) ||
      urlOf(APK_UNIVERSAL_NAME) ||
      urlOf('app-universal-release.apk') ||
      urlOf('app-release.apk') ||
      `${LATEST_DL}${APK_UNIVERSAL_NAME}`;
    return { build, current, apkUrl };
  } catch (e: any) {
    console.warn('update check failed:', e?.message);
    return null;
  }
};

export const canInstallApks = async (): Promise<boolean> => {
  try {
    return !!(await Native?.canInstall());
  } catch {
    return false;
  }
};

export const openInstallSettings = async (): Promise<boolean> => {
  try {
    return !!(await Native?.openInstallSettings());
  } catch {
    return false;
  }
};

// Downloads the APK and opens the installer. Falls back to the browser when the native path fails.
// 'installing' | 'browser' | 'failed'. Never throws.
export const downloadAndInstall = async (u: UpdateInfo): Promise<'installing' | 'browser' | 'failed'> => {
  try {
    if (Native) {
      const r = await Native.downloadAndInstall(u.apkUrl, `Outfit update (build ${u.build})`);
      if (r === 'installing') return 'installing';
    }
  } catch (e: any) {
    console.warn('in-app update failed:', e?.code, e?.message);
  }
  for (const url of [u.apkUrl, GET_PAGE_URL]) {
    try {
      await Linking.openURL(url);
      return 'browser';
    } catch {}
  }
  return 'failed';
};
