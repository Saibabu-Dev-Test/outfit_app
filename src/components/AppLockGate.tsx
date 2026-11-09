// App lock (required for every signed-in user on Android). Covers the app after > 1 min in
// background (cold start with a fingerprint is handled by SessionLockScreen, which decrypts the
// hardware-bound session before Firebase can read it). Fallback: the phone's PIN / pattern.
// After sign-in (and on every return to the app) it makes sure a lock is on:
//   fingerprint enrolled  -> hardware-bound lock (enableHardwareLock); app blocked until it is on
//   only PIN / pattern    -> prompt-only lock with the screen lock
//   no screen lock        -> blocking screen asking to set one (opens security settings)
//   no lock hardware      -> allowed, with a one-time notice
// Web: no-op (appLock.web.ts).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  authenticate,
  enableHardwareLock,
  FINGERPRINTS_CHANGED_MESSAGE,
  getLockCapability,
  isLockEnabled,
  isLockSupported,
  isSoftLockOn,
  LOCK_AFTER_MS,
  openSecuritySettings,
  setLockEnabled,
  setPrivacy,
  setSoftLock,
  setUserLockPref,
  takeNoLockNotice,
  wasUnlockedThisLaunch,
} from '../native/appLock';
import { signOutKeepLock } from '../services/authApi';
import { themedStyles, colors } from '../theme';

// What blocks the app until the lock requirement is met
type Need = null | 'setup' | 'screenlock';

const lockIsOn = async (): Promise<boolean> =>
  ((await isLockEnabled()) && (await isLockSupported())) || (await isSoftLockOn());

export default function AppLockGate() {
  const { isAuthenticated, freshLogin, clearFreshLogin, user } = useAuth();
  const uid = user?.id;
  const [locked, setLocked] = useState(false);
  const [need, setNeed] = useState<Need>(null);
  const [checking, setChecking] = useState(false);
  const [setupError, setSetupError] = useState('');
  const enabledRef = useRef(false);
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);
  const ensuring = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setChecking(true);
    const r = await authenticate();
    prompting.current = false;
    setChecking(false);
    if (r === 'success') setLocked(false);
    else if (r === 'password') {
      // Full Google + mobile + password login instead
      setLocked(false);
      await signOutKeepLock();
    } else if (r === 'invalidated') {
      setLocked(false);
      await signOutKeepLock();
      Alert.alert('Sign in again', FINGERPRINTS_CHANGED_MESSAGE);
    } else if (r === 'error') {
      // Fingerprint / screen lock removed from the phone: don't trap the user here; the
      // requirement check below asks them to set a lock again
      const cap = await getLockCapability();
      if (cap !== 'biometric') {
        await setLockEnabled(false);
        if (cap !== 'screenlock') await setSoftLock(false);
        enabledRef.current = false;
        setLocked(false);
      }
    }
  }, []);

  // Turn the required lock on with what this phone has. Never offers "Not now".
  const ensureLock = useCallback(async () => {
    if (Platform.OS !== 'android' || !isAuthenticated || !uid || ensuring.current || prompting.current) return;
    ensuring.current = true;
    try {
      const cap = await getLockCapability();
      if (cap === 'biometric') {
        if ((await isLockEnabled()) && (await isLockSupported())) {
          enabledRef.current = true;
          setNeed(null);
          return;
        }
        // Fingerprint added since (or first sign-in): needs the hardware lock turned on
        setNeed('setup');
        return;
      }
      // No fingerprint: the hardware lock can't stay on
      if (await isLockEnabled()) await setLockEnabled(false);
      if (cap === 'screenlock') {
        await setSoftLock(true);
        await setUserLockPref(uid, true);
        enabledRef.current = true;
        setNeed(null);
        return;
      }
      await setSoftLock(false);
      enabledRef.current = false;
      if (cap === 'none') {
        setNeed('screenlock');
        return;
      }
      // 'unsupported': allowed, tell them once
      setNeed(null);
      if (await takeNoLockNotice(uid)) {
        Alert.alert(
          'App lock not available',
          'This phone has no screen lock, so Outfit can\'t be locked. Anyone holding your phone can open the app.',
        );
      }
    } finally {
      ensuring.current = false;
    }
  }, [isAuthenticated, uid]);

  const turnOnHardwareLock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    setChecking(true);
    setSetupError('');
    // New Keystore key + one fingerprint, then the session is stored encrypted
    const r = await enableHardwareLock();
    prompting.current = false;
    setChecking(false);
    if (r.ok) {
      enabledRef.current = true;
      await setSoftLock(false);
      await setUserLockPref(uid, true);
      setNeed(null);
      return;
    }
    if (r.message) setSetupError(r.message);
    else setSetupError('App lock is required. Tap "Turn on app lock" and confirm with your fingerprint.');
    // Phone changed under us (fingerprint removed): re-check what it can do
    ensureLock();
  }, [uid, ensureLock]);

  // Cold start / after login: lock if on, then make sure the required lock is set up
  useEffect(() => {
    if (!isAuthenticated) {
      enabledRef.current = false;
      setLocked(false);
      setNeed(null);
      return;
    }
    let alive = true;
    (async () => {
      const on = await lockIsOn();
      enabledRef.current = on;
      // A fresh login just proved who this is, and a cold start already asked for the
      // fingerprint to decrypt the session; lock only a restored session that skipped both
      if (alive && on && !freshLogin && !wasUnlockedThisLaunch()) setLocked(true);
      if (freshLogin) clearFreshLogin();
      if (alive) ensureLock();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, uid]);

  // First time on the setup screen: show the fingerprint prompt right away
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (need === 'setup' && !autoPrompted.current && !locked) {
      autoPrompted.current = true;
      turnOnHardwareLock();
    }
  }, [need, locked, turnOnHardwareLock]);

  // Background > 1 min: lock again. Every return: re-check the requirement (a screen lock may
  // have just been set in Settings, or removed).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (prompting.current) return; // the fingerprint prompt can background the app
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        if (!isAuthenticated) return;
        if (since && Date.now() - since > LOCK_AFTER_MS) {
          lockIsOn().then(on => {
            enabledRef.current = on;
            if (on) setLocked(true);
          });
        }
        ensureLock();
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, ensureLock]);

  // Show the prompt right away when locked; no screenshots / recents preview of the lock screen
  useEffect(() => {
    setPrivacy(enabledRef.current, locked);
    if (locked) unlock();
  }, [locked, unlock]);

  if (!isAuthenticated) return null;

  if (locked) {
    return (
      <View style={styles.overlay}>
        <Text style={styles.icon}>🔒</Text>
        <Text style={styles.title}>Outfit is locked</Text>
        <Text style={styles.sub}>Unlock with your fingerprint or phone PIN / pattern</Text>
        <TouchableOpacity style={styles.button} onPress={unlock} disabled={checking} activeOpacity={0.8}>
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Unlock</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={async () => {
            setLocked(false);
            await signOutKeepLock();
          }}
          disabled={checking}
          activeOpacity={0.7}>
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (need === 'setup') {
    return (
      <View style={styles.overlay}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Turn on app lock</Text>
        <Text style={styles.sub}>
          App lock is required for everyone. Outfit will open with your fingerprint (or your phone PIN / pattern).
        </Text>
        {!!setupError && <Text style={styles.error}>{setupError}</Text>}
        <TouchableOpacity style={styles.button} onPress={turnOnHardwareLock} disabled={checking} activeOpacity={0.8}>
          {checking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Turn on app lock</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => signOutKeepLock()} disabled={checking} activeOpacity={0.7}>
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (need === 'screenlock') {
    return (
      <View style={styles.overlay}>
        <Text style={styles.icon}>📱</Text>
        <Text style={styles.title}>Set a screen lock</Text>
        <Text style={styles.sub}>
          Outfit needs your phone to have a screen lock (fingerprint, PIN, pattern or password) so only you can open
          the app. Set one in your phone settings, then come back.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openSecuritySettings} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Open security settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={ensureLock} activeOpacity={0.7}>
          <Text style={styles.linkText}>I've set it, check again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={() => signOutKeepLock()} activeOpacity={0.7}>
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = themedStyles(() => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 1000,
    elevation: 1000,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  button: {
    marginTop: 24,
    backgroundColor: '#E91E63',
    borderRadius: 12,
    height: 52,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  error: { fontSize: 13, color: '#D32F2F', marginTop: 12, textAlign: 'center' },
  linkButton: { marginTop: 18, padding: 8 },
  linkText: { color: '#E91E63', fontSize: 14, fontWeight: '600' },
}));
