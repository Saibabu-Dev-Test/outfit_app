// Fingerprint app lock: covers the app on cold start and after > 30 s in background.
// Also asks once after the first login/sign-up whether to turn it on.
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
  isLockEnabled,
  isLockSupported,
  LOCK_AFTER_MS,
  markLockAsked,
  setLockEnabled,
  wasLockAsked,
} from '../native/appLock';

export default function AppLockGate() {
  const { isAuthenticated, freshLogin, clearFreshLogin } = useAuth();
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
    else if (r === 'error' && !(await isLockSupported())) {
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
      // A fresh login just proved who this is; only lock a restored session
      if (alive && on && !freshLogin) setLocked(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Background > 30 s: lock again
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (prompting.current) return; // the PIN screen also backgrounds the app
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const since = backgroundAt.current;
        backgroundAt.current = null;
        if (enabledRef.current && isAuthenticated && since && Date.now() - since > LOCK_AFTER_MS) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  // Show the prompt right away when locked
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  // Ask once after the first successful login/sign-up
  useEffect(() => {
    if (!isAuthenticated || !freshLogin) return;
    clearFreshLogin();
    (async () => {
      if ((await wasLockAsked()) || !(await isLockSupported())) return;
      await markLockAsked();
      Alert.alert(
        'Enable fingerprint lock?',
        'Unlock Outfit with your fingerprint when you open it. You can change this in Profile.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              prompting.current = true;
              const r = await authenticate('Turn on app lock', 'Confirm with your fingerprint');
              prompting.current = false;
              if (r === 'success') {
                await setLockEnabled(true);
                enabledRef.current = true;
              }
            },
          },
        ],
      );
    })();
  }, [isAuthenticated, freshLogin, clearFreshLogin]);

  if (!locked || !isAuthenticated) return null;
  return (
    <View style={styles.overlay}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Outfit is locked</Text>
      <Text style={styles.sub}>Unlock with your fingerprint or phone PIN</Text>
      <TouchableOpacity style={styles.button} onPress={unlock} disabled={checking} activeOpacity={0.8}>
        {checking ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>Unlock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAF9FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 1000,
    elevation: 1000,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#0A1940' },
  sub: { fontSize: 13, color: '#6B6B8A', marginTop: 6, textAlign: 'center' },
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
});
