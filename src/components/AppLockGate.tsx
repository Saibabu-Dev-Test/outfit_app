// App lock (optional, OFF by default; the user turns it on in Settings → App lock). When it is on,
// it covers the app after > 1 min in background (cold start with a fingerprint is handled by
// SessionLockScreen, which decrypts the hardware-bound session before Firebase can read it).
// Fallback: the phone's PIN / pattern. When it is off, nothing here shows: the app opens straight in.
// Older builds forced the lock on for everyone; migrateToOptionalLock() turns that off once.
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
  FINGERPRINTS_CHANGED_MESSAGE,
  getLockCapability,
  isAppLockOn,
  LOCK_AFTER_MS,
  migrateToOptionalLock,
  setLockEnabled,
  setPrivacy,
  setSoftLock,
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
    } else if (r === 'error') {
      // Fingerprint / screen lock removed from the phone: the lock can't work, turn it off
      const cap = await getLockCapability();
      if (cap !== 'biometric') {
        await setLockEnabled(false);
        if (cap !== 'screenlock') await setSoftLock(false);
        enabledRef.current = false;
        setLocked(false);
      }
    }
  }, []);

  // Cold start / after login: lock only when the user turned the lock on
  useEffect(() => {
    if (!isAuthenticated) {
      enabledRef.current = false;
      setLocked(false);
      return;
    }
    let alive = true;
    (async () => {
      if (Platform.OS === 'android') await migrateToOptionalLock();
      const on = await isAppLockOn();
      enabledRef.current = on;
      // A fresh login just proved who this is, and a cold start already asked for the
      // fingerprint to decrypt the session; lock only a restored session that skipped both
      if (alive && on && !freshLogin && !wasUnlockedThisLaunch()) setLocked(true);
      if (freshLogin) clearFreshLogin();
      if (alive) setPrivacy(on, false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, uid]);

  // Background > 1 min with the lock on: lock again
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
          isAppLockOn().then(on => {
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

  if (!isAuthenticated || !locked) return null;

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
