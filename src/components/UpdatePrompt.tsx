// Automatic updates are opt-in (OFF by default). First launch only: one question,
// "Check for updates automatically?" Yes turns it on; "No, I'll decide later" leaves it off
// (Settings > Automatic updates can change it any time).
// When on: "New update available (build N)": non-blocking modal on launch (Android, max once per 6 h).
// Update now = download the APK inside the app and open the Android installer
// (asks for "Install unknown apps" first). Web: never shows (checkForUpdate is a no-op there).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius, themedStyles } from '../theme';
import {
  UpdateInfo,
  canInstallApks,
  checkForUpdate,
  downloadAndInstall,
  openInstallSettings,
  isUpdateSupported,
  setAutoUpdate,
  wasAutoUpdateAsked,
} from '../native/appUpdate';

export default function UpdatePrompt() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [askOptIn, setAskOptIn] = useState(false);
  const waitingPermission = useRef(false);

  useEffect(() => {
    let alive = true;
    // Let the first screen settle before asking or checking
    const t = setTimeout(async () => {
      if (!isUpdateSupported()) return;
      if (!(await wasAutoUpdateAsked())) {
        if (alive) setAskOptIn(true);
        return;
      }
      checkForUpdate().then(u => alive && u && setUpdate(u));
    }, 4000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const start = async (u: UpdateInfo) => {
    setBusy(true);
    setNote('Downloading… you can keep using the app.');
    const r = await downloadAndInstall(u);
    setBusy(false);
    if (r === 'installing') {
      setNote('');
      setUpdate(null);
    } else if (r === 'browser') {
      setNote('');
      setUpdate(null);
    } else {
      setNote('Could not download the update. Please try again later.');
    }
  };

  const updateNow = async () => {
    if (!update || busy) return;
    if (!(await canInstallApks())) {
      // Settings > Install unknown apps; continues when the user comes back
      waitingPermission.current = true;
      setNote('Allow "Install unknown apps" for OUTFIT, then come back here.');
      if (!(await openInstallSettings())) {
        waitingPermission.current = false;
        start(update); // browser fallback inside
      }
      return;
    }
    start(update);
  };

  // Back from the settings screen: go on when the permission was given
  useEffect(() => {
    const sub = AppState.addEventListener('change', async s => {
      if (s !== 'active' || !waitingPermission.current || !update) return;
      waitingPermission.current = false;
      if (await canInstallApks()) start(update);
      else setNote('Permission not given. Tap Update now to try again.');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const answerOptIn = async (on: boolean) => {
    setAskOptIn(false);
    await setAutoUpdate(on);
    if (on) checkForUpdate(true).then(u => u && setUpdate(u));
  };

  if (askOptIn) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => answerOptIn(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.emoji}>🔄</Text>
            <Text style={styles.title}>Check for updates automatically?</Text>
            <Text style={styles.sub}>
              Outfit can tell you when a new version is ready. Nothing is downloaded or installed unless you tap Update now.
              You can change this any time in Settings › Automatic updates.
            </Text>
            <TouchableOpacity style={styles.primary} onPress={() => answerOptIn(true)} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.later} onPress={() => answerOptIn(false)} activeOpacity={0.7}>
              <Text style={styles.laterText}>No, I'll decide later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  if (!update) return null;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => {
        if (!busy) setUpdate(null);
      }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✨</Text>
          <Text style={styles.title}>New update available (build {update.build})</Text>
          <Text style={styles.sub}>Get the latest OUTFIT features and fixes. Your account and photos stay as they are.</Text>
          {!!note && <Text style={styles.note}>{note}</Text>}
          <TouchableOpacity style={styles.primary} onPress={updateNow} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>Update now</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={() => setUpdate(null)} activeOpacity={0.7}>
            <Text style={styles.laterText}>{busy ? 'Hide' : 'Later'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: 'center' },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extraBold, color: colors.textPrimary, textAlign: 'center' },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 19 },
  note: { fontSize: fontSize.sm, color: colors.primary, textAlign: 'center', marginTop: spacing.md },
  primary: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    height: 50,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  later: { marginTop: spacing.sm, padding: spacing.sm },
  laterText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold },
}));
