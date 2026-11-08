// Fingerprint app lock: covers the app after > 1 min in background (cold start is handled by
// SessionLockScreen, which decrypts the hardware-bound session before Firebase can read it).
// Fallback: the phone's PIN / pattern. "Sign out" on the lock screen.
// After a login on Android: asks each user once whether to turn it on, and turns it back on
// for a user who had it on (sign-out clears the device lock; the per-user choice is kept).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
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
  isLockEnabled,
  isLockSupported,
  LOCK_AFTER_MS,
  markLockAsked,
  getUserLockPref,
  setUserLockPref,
  setLockEnabled,
  setPrivacy,
  wasLockAsked,
  wasUnlockedThisLaunch,
} from '../native/appLock';
import { signOutKeepLock } from '../services/authApi';
import { themedStyles, colors } from '../theme';

export default function AppLockGate() {
  const { isAuthenticated, freshLogin, clearFreshLogin, user } = useAuth();
  const uid = user?.id;
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const enabledRef = useRef(false);
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

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
    } else if (r === 'error' && !(await isLockSupported())) {
      // Fingerprint removed from the phone: don't trap the user
      await setLockEnabled(false);
      enabledRef.current = false;
      setLocked(false);
    }
  }, []);

  // Cold start / after login: lock if enabled
  useEffect(() => {
    if (!isAuthenticated) {
      enabledRef.current = false;
      setLocked(false);
      return;
    }
    let alive = true;
    (async () => {
      const on = (await isLockEnabled()) && (await isLockSupported());
      enabledRef.current = on;
      // A fresh login just proved who this is, and a cold start already asked for the
      // fingerprint to decrypt the session; lock only a restored session that skipped both
      if (alive && on && !freshLogin && !wasUnlockedThisLaunch()) setLocked(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Background > 1 min: lock again
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (prompting.current) return; // the fingerprint prompt can background the app
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        if (isAuthenticated && since && Date.now() - since > LOCK_AFTER_MS) {
          // Re-read the setting: it may have been switched in Profile since login
          isLockEnabled().then(on => {
            enabledRef.current = on;
            if (on) setLocked(true);
          });
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Show the prompt right away when locked; no screenshots / recents preview of the lock screen
  useEffect(() => {
    setPrivacy(enabledRef.current, locked);
    if (locked) unlock();
  }, [locked, unlock]);

  // After a login: ask this user once, or turn the lock back on if they had it on
  useEffect(() => {
    if (!isAuthenticated || !freshLogin || !uid) return;
    clearFreshLogin();
    (async () => {
      if (!(await isLockSupported())) return;
      if (await isLockEnabled()) {
        // Kept through "Sign out" on the lock screen: already on for this session
        if ((await getUserLockPref(uid)) !== false) await setUserLockPref(uid, true);
        return;
      }
      const turnOn = async () => {
        prompting.current = true;
        // New Keystore key + one fingerprint, then the session is stored encrypted
        const r = await enableHardwareLock();
        prompting.current = false;
        if (r.ok) {
          enabledRef.current = true;
          await setUserLockPref(uid, true);
        } else if (r.message) Alert.alert('Fingerprint lock', r.message);
      };
      const pref = await getUserLockPref(uid);
      if (pref === true) {
        await turnOn();
        return;
      }
      if (pref === false || (await wasLockAsked(uid))) return;
      await markLockAsked(uid);
      Alert.alert(
        'Use fingerprint to unlock Outfit?',
        'Each time you open Outfit, unlock it with your fingerprint (or your phone PIN / pattern). You can change this in Profile.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => setUserLockPref(uid, false) },
          { text: 'Use fingerprint', onPress: turnOn },
        ],
      );
    })();
  }, [isAuthenticated, freshLogin, clearFreshLogin, uid]);

  if (!locked || !isAuthenticated) return null;
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
  linkButton: { marginTop: 18, padding: 8 },
  linkText: { color: '#E91E63', fontSize: 14, fontWeight: '600' },
}));
