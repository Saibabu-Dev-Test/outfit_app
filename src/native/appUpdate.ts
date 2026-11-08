// In-app update for the sideloaded Android APK (no Play Store). Android only.
// The latest GitHub release is build-N, and the APK's versionCode is that same N (build.gradle).
import { Linking, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
export const GET_PAGE_URL = 'https://outfit-vote-9edca.web.app/get/';
// Not under "outfit:" so logout's storage cleanup keeps it
const LAST_CHECK_KEY = 'outfitupdate:lastCheck';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export interface UpdateInfo {
  build: number; // N of build-N
  current: number; // this install's versionCode
  apkUrl: string; // arm64 APK, or universal when the phone isn't arm64
}

// Newer release than this install, or null. At most once per 6 hours. Never throws.
export const checkForUpdate = async (force = false): Promise<UpdateInfo | null> => {
  if (!Native) return null;
  try {
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
    const apkUrl =
      (arm64 && urlOf('app-arm64-v8a-release.apk')) ||
      urlOf('app-universal-release.apk') ||
      urlOf('app-release.apk') ||
      `${LATEST_DL}app-universal-release.apk`;
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
      const r = await Native.downloadAndInstall(u.apkUrl, `OUTFIT update (build ${u.build})`);
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
