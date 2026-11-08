// Auth: Google account on the device + mobile number + password. No OTP, no SMS.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, borderRadius, themedStyles, statusBarStyle, colors } from '../../theme';
import SelectModal from '../../components/SelectModal';
import {
  cancelAuthFlow,
  checkResetSim,
  completeSignUp,
  loginWithGoogleEmailPhoneAndPassword,
  pickGoogleAccountForLogin,
  resetPasswordWithPhone,
  startForgotPassword,
  startGoogleSignUp,
  switchGoogleAccount,
  GoogleStepResponse,
  SIM_RESET_MESSAGE,
} from '../../services/authApi';
import { pickSimNumber, SIM_REQUIRED_MESSAGE } from '../../native/phoneHint';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: (user?: any) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳', length: 10 },
  { code: '+1', country: 'US', flag: '🇺🇸', length: 10 },
  { code: '+44', country: 'UK', flag: '🇬🇧', length: 10 },
  { code: '+61', country: 'AU', flag: '🇦🇺', length: 9 },
  { code: '+971', country: 'AE', flag: '🇦🇪', length: 9 },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const MIN_PASSWORD = 6;

// Brute-force guard: 5 wrong passwords -> Sign In locked for 60 s (survives app restart).
// Not 'outfit:' prefixed, so logout doesn't clear it.
const GUARD_KEY = 'loginGuard:v1';
const MAX_WRONG = 5;
const LOCK_MS = 60 * 1000;
type Guard = { fails: number; lockedUntil: number };
const readGuard = async (): Promise<Guard> => {
  try {
    const g = JSON.parse((await AsyncStorage.getItem(GUARD_KEY)) || '{}');
    return { fails: Number(g.fails) || 0, lockedUntil: Number(g.lockedUntil) || 0 };
  } catch {
    return { fails: 0, lockedUntil: 0 };
  }
};
const writeGuard = (g: Guard) => AsyncStorage.setItem(GUARD_KEY, JSON.stringify(g)).catch(() => {});

const getErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.data?.message || err?.message || fallback;

const TITLES: Record<AuthMode, { title: string; subtitle: string; button: string }> = {
  login: {
    title: 'Welcome Back',
    subtitle: 'Continue with your Google account, then enter your mobile number & password',
    button: 'Sign In',
  },
  register: {
    title: 'Get Started',
    subtitle: 'Step 1: continue with Google. Step 2: select the SIM number in this phone & set a password',
    button: 'Create Account',
  },
  forgot: {
    title: 'Reset Password',
    subtitle: 'Continue with the same Google account, select the SIM number in this phone, then set a new password',
    button: 'Change Password',
  },
};

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [referralCode, setReferralCode] = useState('');
  // Register/reset: the number must come from the SIM picker (not typed)
  const [simPicked, setSimPicked] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  // Brute-force lock (login only)
  const [lockedUntil, setLockedUntil] = useState(0);
  const [lockLeft, setLockLeft] = useState(0); // seconds

  // RN 0.87 ref type (useRef<TextInput> no longer type-checks)
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const submittingRef = useRef(false); // blocks double taps

  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';
  const needsConfirm = isRegister || isForgot; // new password typed twice
  const needsSim = isRegister || isForgot; // SIM must be in this phone
  const busy = loading || googleLoading || simLoading;
  const copy = TITLES[authMode];
  const locked = authMode === 'login' && lockLeft > 0;

  // Restore a lock that was running when the app closed
  useEffect(() => {
    readGuard().then(g => {
      if (g.lockedUntil > Date.now()) setLockedUntil(g.lockedUntil);
    });
  }, []);

  // Countdown
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockLeft(left);
      return left;
    };
    if (tick() === 0) return;
    const id = setInterval(() => {
      if (tick() === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const recordWrongPassword = async (): Promise<string | null> => {
    const g = await readGuard();
    const fails = g.fails + 1;
    if (fails >= MAX_WRONG) {
      const until = Date.now() + LOCK_MS;
      await writeGuard({ fails: 0, lockedUntil: until });
      setLockedUntil(until);
      return `${MAX_WRONG} wrong passwords. Sign In is locked for ${LOCK_MS / 1000} seconds.`;
    }
    await writeGuard({ fails, lockedUntil: 0 });
    const left = MAX_WRONG - fails;
    return left <= 2 ? `${left} ${left === 1 ? 'try' : 'tries'} left before a ${LOCK_MS / 1000}-second lock.` : null;
  };

  // force: called from handleSubmit while still busy
  const switchMode = (mode: AuthMode, keepSuccess = false, force = false) => {
    if (busy && !force) return;
    // Sign-up / forgot keep a Firebase session between steps; drop it
    if (authMode !== 'login' && googleEmail) cancelAuthFlow();
    setAuthMode(mode);
    setGoogleEmail(null);
    setError('');
    if (!keepSuccess) setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSimPicked(false);
    if (mode !== 'login') {
      // Number must be picked from the SIM again
      setPhoneNumber('');
      setShowCountryPicker(false);
    }
  };

  // Strip non-digits and a leading trunk 0 (common for UK/AU/AE)
  const normalizeLocal = (raw: string) => raw.replace(/\D/g, '').replace(/^0+/, '');

  const handleGoogle = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setError('');
    setSuccessMsg('');
    setGoogleLoading(true);
    try {
      let res: GoogleStepResponse;
      if (authMode === 'login') res = await pickGoogleAccountForLogin(true);
      else if (authMode === 'register') res = await startGoogleSignUp();
      else res = await startForgotPassword();

      if (res.email) {
        setGoogleEmail(res.email);
        if (isRegister && !name && res.name) setName(res.name);
      } else if (!res.cancelled && res.message) {
        setError(res.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // SIM number picker -> fills the (read-only) mobile field
  const handlePickSim = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setError('');
    setSimLoading(true);
    try {
      const res = await pickSimNumber();
      if (!res.ok) {
        setSimPicked(false);
        setPhoneNumber('');
        setError(isForgot ? SIM_RESET_MESSAGE : SIM_REQUIRED_MESSAGE);
        return;
      }
      if (isForgot && googleEmail) {
        // Must be the SIM of the registered number (checked in the app)
        const simError = checkResetSim(googleEmail, res.number);
        if (simError) {
          setSimPicked(false);
          setPhoneNumber('');
          setError(simError);
          return;
        }
      }
      const hasPlus = res.number.startsWith('+');
      const digits = res.number.replace(/\D/g, '');
      // Longest country code first (+971 before +9...)
      const byLength = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
      let country = hasPlus
        ? byLength.find(c => digits.startsWith(c.code.slice(1)))
        : undefined;
      let local = country ? digits.slice(country.code.length - 1) : digits;
      if (!country) {
        // No country code from the picker: assume the selected one
        country = selectedCountry;
        local = normalizeLocal(digits);
      }
      local = normalizeLocal(local);
      if (local.length !== country.length) {
        setSimPicked(false);
        setPhoneNumber('');
        setError('This SIM number is not supported yet');
        return;
      }
      setSelectedCountry(country);
      setPhoneNumber(local);
      setSimPicked(true);
    } finally {
      setSimLoading(false);
    }
  };

  const handleChangeAccount = async () => {
    if (busy) return;
    setGoogleLoading(true);
    await switchGoogleAccount();
    setGoogleEmail(null);
    setGoogleLoading(false);
    setError('');
  };

  const validate = (): string | null => {
    if (!googleEmail) return 'Please continue with Google first';
    if (needsSim && !simPicked) return isForgot ? SIM_RESET_MESSAGE : SIM_REQUIRED_MESSAGE;
    const digits = normalizeLocal(phoneNumber);
    if (digits.length !== selectedCountry.length) {
      return `Enter a valid ${selectedCountry.length}-digit mobile number`;
    }
    if (isRegister && selectedCountry.code === '+91' && !/^[6-9]/.test(digits)) {
      return 'Indian mobile numbers start with 6, 7, 8 or 9';
    }
    if (!password) return isForgot ? 'Please enter a new password' : 'Please enter your password';
    if (needsConfirm) {
      if (password.length < MIN_PASSWORD) {
        return `Password must be at least ${MIN_PASSWORD} characters`;
      }
      if (!confirmPassword) return 'Please confirm your password';
      if (password !== confirmPassword) return 'Passwords do not match';
    }
    return null;
  };

  const finishLogin = (user: any) => {
    if (onLoginSuccess) {
      onLoginSuccess(user);
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
    }
  };

  const handleSubmit = async () => {
    if (submittingRef.current || locked) return;
    Keyboard.dismiss();
    setShowCountryPicker(false);
    setError('');
    setSuccessMsg('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formattedPhone = `${selectedCountry.code}${normalizeLocal(phoneNumber)}`;
    submittingRef.current = true;
    setLoading(true);

    try {
      if (isRegister) {
        // authApi returns { message } with no user on failure (it doesn't throw)
        const regRes = await completeSignUp({
          phoneNumber: formattedPhone,
          password,
          name,
          gender,
          referralCode: referralCode.trim() || undefined,
        });
        if (!regRes?.user) {
          setError(regRes?.message || 'Could not create your account. Please try again.');
          return;
        }
        setSuccessMsg('Account created! Signing you in...');
        finishLogin(regRes.user);
        return;
      }

      if (isForgot) {
        const resetRes = await resetPasswordWithPhone({
          email: googleEmail!,
          phoneNumber: formattedPhone,
          newPassword: password,
        });
        if (!resetRes.success) {
          setError(resetRes.message);
          return;
        }
        // Back to Sign In with the number still filled in
        switchMode('login', true, true);
        setSuccessMsg(resetRes.message);
        return;
      }

      const loginRes = await loginWithGoogleEmailPhoneAndPassword({
        email: googleEmail!,
        phoneNumber: formattedPhone,
        password,
      });
      if (!loginRes?.user) {
        let msg = loginRes?.message || 'Sign in did not finish. Try again.';
        if (loginRes?.wrongPassword) {
          const extra = await recordWrongPassword();
          if (extra) msg = `${msg} ${extra}`;
        }
        setError(msg);
        return;
      }
      writeGuard({ fails: 0, lockedUntil: 0 });
      setSuccessMsg(loginRes.message || 'Signed in!');
      finishLogin(loginRes.user);
    } catch (err: any) {
      console.warn('Auth error:', err);
      setSuccessMsg('');
      setError(getErrorMessage(err, 'Unexpected error. Please try again.'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={statusBarStyle()}
        {...(Platform.OS === 'android' ? { backgroundColor: colors.background } : {})}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexOne}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>👗</Text>
            </View>
            <Text style={styles.appName}>OUTFIT</Text>
            <Text style={styles.tagline}>Your AI Personal Stylist & Daily Colour Guide</Text>
          </View>

          <View style={styles.card}>
            {/* Tabs (hidden on Reset Password) */}
            {!isForgot && (
              <View style={styles.tabContainer}>
                {(['login', 'register'] as AuthMode[]).map((mode) => {
                  const active = authMode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.tabButton, active && styles.tabButtonActive]}
                      onPress={() => switchMode(mode)}
                      disabled={busy}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}>
                      <Text style={[styles.tabText, active && styles.tabTextActive]}>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.cardTitle}>{copy.title}</Text>
            <Text style={styles.cardSubtitle}>{copy.subtitle}</Text>

            {/* Step 1: Google account on this device */}
            <Text style={styles.inputLabel}>Google Account</Text>
            {googleEmail ? (
              <View style={styles.googleChip}>
                <Text style={styles.googleChipText} numberOfLines={1}>✓ {googleEmail}</Text>
                <TouchableOpacity onPress={handleChangeAccount} disabled={busy} accessibilityRole="button">
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.googleButton, busy && styles.buttonDisabled]}
                onPress={handleGoogle}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button">
                {googleLoading ? (
                  <ActivityIndicator color="#E91E63" size="small" />
                ) : (
                  <>
                    <Text style={styles.googleG}>G</Text>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!googleEmail && (
              <Text style={styles.stepHint}>
                Use the Gmail account on this phone. No OTP or SMS needed.
              </Text>
            )}

            {/* Step 2: details */}
            {!!googleEmail && (
              <>
                {isRegister && (
                  <>
                    <Text style={[styles.inputLabel, styles.labelSpacing]}>Name</Text>
                    <TextInput
                      style={styles.textInputBox}
                      placeholder="Your name"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      editable={!busy}
                      value={name}
                      onChangeText={setName}
                    />

                    <Text style={[styles.inputLabel, styles.labelSpacing]}>Gender</Text>
                    <TouchableOpacity
                      style={styles.selectBox}
                      onPress={() => setShowGenderPicker(true)}
                      disabled={busy}
                      activeOpacity={0.7}>
                      <Text style={gender ? styles.selectValue : styles.selectPlaceholder}>
                        {gender || 'Select (optional)'}
                      </Text>
                      <Text style={styles.dropdownChevron}>▾</Text>
                    </TouchableOpacity>
                    <SelectModal
                      visible={showGenderPicker}
                      title="Gender"
                      options={GENDER_OPTIONS}
                      selected={gender}
                      onSelect={setGender}
                      onClose={() => setShowGenderPicker(false)}
                    />

                    <Text style={[styles.inputLabel, styles.labelSpacing]}>Referral Code</Text>
                    <TextInput
                      style={styles.textInputBox}
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={6}
                      editable={!busy}
                      value={referralCode}
                      onChangeText={t => {
                        setError('');
                        setReferralCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      }}
                    />
                  </>
                )}

                {/* Mobile */}
                <Text style={[styles.inputLabel, styles.labelSpacing]}>Mobile Number</Text>
                <View style={styles.inputRow}>
                  <TouchableOpacity
                    style={styles.countryPickerButton}
                    activeOpacity={0.7}
                    disabled={busy || needsSim}
                    accessibilityLabel={`Country code ${selectedCountry.code}`}
                    onPress={() => setShowCountryPicker((v) => !v)}>
                    <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                    {!needsSim && (
                      <Text style={styles.dropdownChevron}>{showCountryPicker ? '▴' : '▾'}</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.inputDivider} />

                  {needsSim ? (
                    <Text
                      style={[styles.phoneInput, styles.phoneReadOnly, !phoneNumber && styles.phonePlaceholder]}
                      numberOfLines={1}>
                      {phoneNumber || 'Select your SIM number'}
                    </Text>
                  ) : (
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Mobile number"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    maxLength={selectedCountry.length + 1}
                    editable={!busy}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    onFocus={() => setShowCountryPicker(false)}
                    value={phoneNumber}
                    onChangeText={(text) => {
                      setError('');
                      setPhoneNumber(text.replace(/\D/g, ''));
                    }}
                  />
                  )}
                </View>

                {needsSim && (
                  <>
                    <TouchableOpacity
                      style={[styles.simButton, busy && styles.buttonDisabled]}
                      onPress={handlePickSim}
                      disabled={busy}
                      activeOpacity={0.8}
                      accessibilityRole="button">
                      {simLoading ? (
                        <ActivityIndicator color="#E91E63" size="small" />
                      ) : (
                        <Text style={styles.simButtonText}>
                          📱 {simPicked ? 'Change SIM number' : 'Select your SIM number'}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.stepHint}>
                      The SIM card of this number must be in this phone.
                    </Text>
                  </>
                )}

                {showCountryPicker && (
                  <View style={styles.countryDropdown}>
                    {COUNTRY_CODES.map((item) => (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.countryOption,
                          selectedCountry.code === item.code && styles.countryOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedCountry(item);
                          setShowCountryPicker(false);
                          setError('');
                        }}>
                        <Text style={styles.countryOptionText}>
                          {item.flag} {item.country} ({item.code})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Password */}
                <Text style={[styles.inputLabel, styles.labelSpacing]}>
                  {isForgot ? 'New Password' : 'Password'}
                </Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    ref={passwordRef}
                    style={styles.passwordInput}
                    placeholder={needsConfirm ? `Create password (min ${MIN_PASSWORD} chars)` : 'Enter password'}
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={needsConfirm ? 'newPassword' : 'password'}
                    autoComplete={needsConfirm ? 'new-password' : 'password'}
                    editable={!busy}
                    returnKeyType={needsConfirm ? 'next' : 'go'}
                    onSubmitEditing={() =>
                      needsConfirm ? confirmRef.current?.focus() : handleSubmit()
                    }
                    value={password}
                    onChangeText={(text) => {
                      setError('');
                      setPassword(text);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    activeOpacity={0.7}>
                    <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
                  </TouchableOpacity>
                </View>

                {authMode === 'login' && (
                  <TouchableOpacity
                    style={styles.forgotRow}
                    onPress={() => switchMode('forgot')}
                    disabled={busy}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {needsConfirm && (
                  <>
                    <Text style={[styles.inputLabel, styles.labelSpacing]}>Confirm Password</Text>
                    <View
                      style={[
                        styles.passwordRow,
                        !!confirmPassword && confirmPassword !== password && styles.inputErrorBorder,
                      ]}>
                      <TextInput
                        ref={confirmRef}
                        style={styles.passwordInput}
                        placeholder="Re-enter your password"
                        placeholderTextColor={colors.textMuted}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="newPassword"
                        autoComplete="new-password"
                        editable={!busy}
                        returnKeyType="go"
                        onSubmitEditing={handleSubmit}
                        value={confirmPassword}
                        onChangeText={(text) => {
                          setError('');
                          setConfirmPassword(text);
                        }}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowConfirmPassword((v) => !v)}
                        accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                        activeOpacity={0.7}>
                        <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
                      </TouchableOpacity>
                    </View>
                    {!!confirmPassword && confirmPassword !== password && (
                      <Text style={styles.hintError}>Passwords don't match yet</Text>
                    )}
                  </>
                )}
              </>
            )}

            {!!successMsg && (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓ {successMsg}</Text>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            )}

            {!!googleEmail && (
              <TouchableOpacity
                style={[styles.primaryButton, (busy || locked) && styles.buttonDisabled]}
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={busy || locked}
                accessibilityRole="button">
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {locked ? `Try again in ${lockLeft}s` : copy.button}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => switchMode(isRegister || isForgot ? 'login' : 'register')}
              disabled={busy}>
              <Text style={styles.switchText}>
                {isForgot ? 'Remembered it? ' : isRegister ? 'Already have an account? ' : 'New here? '}
                <Text style={styles.termsLink}>
                  {isRegister || isForgot ? 'Sign In' : 'Create Account'}
                </Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  heroSection: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  logoBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border, shadowColor: 'rgba(10, 25, 64, 0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  logoIcon: { fontSize: 30 },
  appName: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: 4 },
  tagline: { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, shadowColor: 'rgba(10, 25, 64, 0.05)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 3 },
  tabContainer: { flexDirection: 'row', backgroundColor: colors.divider, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.lg },
  tabButton: { flex: 1, paddingVertical: spacing.xs + 2, alignItems: 'center', borderRadius: borderRadius.sm },
  tabButtonActive: { backgroundColor: colors.surface, shadowColor: 'rgba(10, 25, 64, 0.08)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#E91E63', fontWeight: '800' },
  cardTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpacing: { marginTop: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.background, height: 52, paddingHorizontal: spacing.sm },
  countryPickerButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  flagText: { fontSize: 18, marginRight: 6 },
  countryCodeText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginRight: 4 },
  dropdownChevron: { fontSize: 12, color: colors.textSecondary },
  inputDivider: { width: 1, height: 24, backgroundColor: '#D0CBDF', marginHorizontal: spacing.sm },
  phoneInput: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary, height: '100%' },
  countryDropdown: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, marginTop: spacing.xs, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  countryOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryOptionSelected: { backgroundColor: colors.divider },
  countryOptionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.background, height: 52, paddingHorizontal: spacing.md },
  inputErrorBorder: { borderColor: '#F8B4B4' },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary, height: '100%' },
  eyeButton: { padding: spacing.xs },
  eyeIcon: { fontSize: 18 },
  hintError: { color: '#E91E63', fontSize: 12, marginTop: 4, fontWeight: '500' },
  errorBanner: { backgroundColor: '#FDE8E8', borderColor: '#F8B4B4', borderWidth: 1, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { color: '#E91E63', fontSize: 13, fontWeight: '600' },
  successBanner: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7', borderWidth: 1, borderRadius: borderRadius.sm, padding: spacing.sm, marginTop: spacing.sm },
  successText: { color: '#2E7D32', fontSize: 13, fontWeight: '600' },
  primaryButton: { backgroundColor: '#E91E63', borderRadius: borderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, shadowColor: 'rgba(233, 30, 99, 0.3)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  switchRow: { alignItems: 'center', marginTop: spacing.md },
  switchText: { fontSize: 13, color: colors.textSecondary },
  termsText: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 17, marginTop: spacing.md },
  termsLink: { color: colors.textPrimary, fontWeight: '700' },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  googleG: { fontSize: 18, fontWeight: '900', color: '#4285F4', marginRight: spacing.sm },
  googleButtonText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  googleChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#A5D6A7', backgroundColor: '#F1F8F2', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 52 },
  googleChipText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  changeLink: { fontSize: 13, fontWeight: '700', color: '#E91E63', paddingLeft: spacing.sm },
  stepHint: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
  textInputBox: { borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.background, height: 52, paddingHorizontal: spacing.md, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.background, height: 52, paddingHorizontal: spacing.md },
  selectValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  selectPlaceholder: { fontSize: 15, color: colors.textMuted },
  phoneReadOnly: { textAlignVertical: 'center', lineHeight: 52 },
  phonePlaceholder: { color: colors.textMuted, fontWeight: '500', fontSize: 15 },
  simButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: '#E91E63', backgroundColor: '#FFF0F5', marginTop: spacing.sm },
  simButtonText: { fontSize: 14, fontWeight: '700', color: '#E91E63' },
  forgotRow: { alignSelf: 'flex-end', marginTop: spacing.sm },
  forgotText: { fontSize: 13, fontWeight: '700', color: '#E91E63' },
}));
