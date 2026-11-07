// Shown when the APK is not signed with the official certificate (see AppLockModule.kt,
// EXPECTED_SIGNING_SHA256). The session was already wiped; this screen has no way forward.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { googleSignOut } from '../services/googleAuth';

export default function TamperScreen() {
  useEffect(() => {
    googleSignOut();
    signOut(auth).catch(() => undefined);
  }, []);
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.title}>This copy of OUTFIT was modified.</Text>
      <Text style={styles.sub}>Install the official app.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#FAF9FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0A1940', textAlign: 'center' },
  sub: { fontSize: 14, color: '#6B6B8A', marginTop: 8, textAlign: 'center' },
});
