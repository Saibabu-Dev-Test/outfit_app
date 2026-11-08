// Cold start with the fingerprint lock on: the saved session is encrypted by a Keystore key that
// needs a fingerprint. Firebase can't read it (and the app shows nothing) until this unlocks it.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  acknowledgeInvalidated,
  FINGERPRINTS_CHANGED_MESSAGE,
  forgetLockedSession,
  setPrivacy,
  unlockSession,
  VaultStatus,
} from '../native/sessionVault';
import { googleSignOut } from '../services/googleAuth';
import { themedStyles, colors } from '../theme';

export default function SessionLockScreen({ status }: { status: VaultStatus }) {
  const [note, setNote] = useState('');
  const asked = useRef(false);
  const busy = status === 'unlocking';

  // No screenshots / recents preview while this is showing
  useEffect(() => {
    setPrivacy(true, true);
    return () => setPrivacy(true, false);
  }, []);

  const unlock = useCallback(async () => {
    setNote('');
    const r = await unlockSession();
    if (r === 'cancelled') setNote('Fingerprint or screen lock needed to open OUTFIT.');
    else if (r === 'lockout') setNote('Too many tries. Wait a little, then try again, or sign out.');
    else if (r === 'error') setNote('Could not read your fingerprint. Try again.');
    else if (r === 'password' || r === 'invalidated') {
      // Next login is a full Google + mobile + password login; let them pick the account
      await googleSignOut();
    }
  }, []);

  // Ask right away once
  useEffect(() => {
    if (status === 'locked' && !asked.current) {
      asked.current = true;
      unlock();
    }
  }, [status, unlock]);

  const usePassword = async () => {
    // Same as the prompt's "Use password instead": wipe the encrypted session, go to login
    const r = await forgetLockedSession();
    if (r) await googleSignOut();
  };

  if (status === 'invalidated') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Sign in again</Text>
        <Text style={styles.sub}>{FINGERPRINTS_CHANGED_MESSAGE}</Text>
        <TouchableOpacity style={styles.button} onPress={acknowledgeInvalidated} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>OUTFIT is locked</Text>
      <Text style={styles.sub}>Unlock with your fingerprint or phone PIN / pattern</Text>
      {!!note && <Text style={styles.note}>{note}</Text>}
      <TouchableOpacity style={styles.button} onPress={unlock} disabled={busy} activeOpacity={0.8}>
        {busy ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.buttonText}>Unlock</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={usePassword} disabled={busy} activeOpacity={0.7}>
        <Text style={styles.linkText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center' },
  note: { fontSize: 13, color: '#C2185B', marginTop: 14, textAlign: 'center' },
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
