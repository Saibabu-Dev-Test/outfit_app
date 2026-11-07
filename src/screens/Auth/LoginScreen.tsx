import React, { useRef, useState } from 'react';
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
import { spacing, borderRadius } from '../../theme';
import {
  loginWithPhoneAndPassword,
  registerWithPhoneAndPassword,
} from '../../services/authApi';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: (user?: any) => void;
}

type AuthMode = 'login' | 'register';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳', length: 10 },
  { code: '+1', country: 'US', flag: '🇺🇸', length: 10 },
  { code: '+44', country: 'UK', flag: '🇬🇧', length: 10 },
  { code: '+61', country: 'AU', flag: '🇦🇺', length: 9 },
  { code: '+971', country: 'AE', flag: '🇦🇪', length: 9 },
];

const MIN_PASSWORD = 6;

// Pull a readable message out of axios / fetch / plain errors
const getErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.data?.message || err?.message || fallback;

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const submittingRef = useRef(false); // blocks double taps

  const isRegister = authMode === 'register';

  const switchMode = (mode: AuthMode) => {
    if (loading) return;
    setAuthMode(mode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Strip non-digits and a leading trunk 0 (common for UK/AU/AE)
  const normalizePhone = (raw: string) => raw.replace(/\D/g, '').replace(/^0+/, '');

  const validate = (): string | null => {
    const digits = normalizePhone(phoneNumber);
    if (digits.length !== selectedCountry.length) {
      return `Enter a valid ${selectedCountry.length}-digit mobile number`;
    }
    if (isRegister && selectedCountry.code === '+91' && !/^[6-9]/.test(digits)) {
      return 'Indian mobile numbers start with 6, 7, 8 or 9';
    }
    if (!password) return 'Please enter your password';
    if (isRegister) {
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
    if (submittingRef.current) return;
    Keyboard.dismiss();
    setShowCountryPicker(false);
    setError('');
    setSuccessMsg('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formattedPhone = `${selectedCountry.code}${normalizePhone(phoneNumber)}`;
    submittingRef.current = true;
    setLoading(true);

    try {
      if (isRegister) {
        try {
          await registerWithPhoneAndPassword({ phoneNumber: formattedPhone, password });
        } catch (err: any) {
          setError(getErrorMessage(err, 'Could not create your account. Please try again.'));
          return;
        }
        setSuccessMsg('Account created! Signing you in...');
      }

      const loginRes = await loginWithPhoneAndPassword({
        phoneNumber: formattedPhone,
        password,
      });

      if (!loginRes?.user) {
        if (isRegister) {
          // Account exists now; let them sign in manually
          setAuthMode('login');
          setConfirmPassword('');
          setSuccessMsg('');
          setError('Account created, but auto sign-in failed. Please sign in.');
        } else {
          setError(loginRes?.message || 'Invalid mobile number or password');
        }
        return;
      }

      setSuccessMsg(loginRes.message || 'Signed in!');
      finishLogin(loginRes.user);
    } catch (err: any) {
      console.error('Auth error:', err);
      setSuccessMsg('');
      setError(
        getErrorMessage(
          err,
          isRegister ? 'Sign up failed. Please try again.' : 'Invalid mobile number or password',
        ),
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAF9FC' } : {})}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            {/* Tabs */}
            <View style={styles.tabContainer}>
              {(['login', 'register'] as AuthMode[]).map((mode) => {
                const active = authMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.tabButton, active && styles.tabButtonActive]}
                    onPress={() => switchMode(mode)}
                    disabled={loading}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}>
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.cardTitle}>{isRegister ? 'Get Started' : 'Welcome Back'}</Text>
            <Text style={styles.cardSubtitle}>
              {isRegister
                ? 'Create an account using your mobile number & password'
                : 'Sign in with your registered mobile number & password'}
            </Text>

            {/* Mobile */}
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.countryPickerButton}
                activeOpacity={0.7}
                disabled={loading}
                accessibilityLabel={`Country code ${selectedCountry.code}`}
                onPress={() => setShowCountryPicker((v) => !v)}>
                <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                <Text style={styles.dropdownChevron}>{showCountryPicker ? '▴' : '▾'}</Text>
              </TouchableOpacity>

              <View style={styles.inputDivider} />

              <TextInput
                style={styles.phoneInput}
                placeholder="Mobile number"
                placeholderTextColor="#9E9EBA"
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                maxLength={selectedCountry.length + 1}
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setShowCountryPicker(false)}
                value={phoneNumber}
                onChangeText={(text) => {
                  setError('');
                  setPhoneNumber(text.replace(/\D/g, ''));
                }}
              />
            </View>

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
            <Text style={[styles.inputLabel, styles.labelSpacing]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                placeholder={isRegister ? `Create password (min ${MIN_PASSWORD} chars)` : 'Enter password'}
                placeholderTextColor="#9E9EBA"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType={isRegister ? 'newPassword' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'password'}
                editable={!loading}
                returnKeyType={isRegister ? 'next' : 'go'}
                onSubmitEditing={() =>
                  isRegister ? confirmRef.current?.focus() : handleSubmit()
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

            {isRegister && (
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
                    placeholderTextColor="#9E9EBA"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    editable={!loading}
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

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isRegister ? 'Register & Sign In' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => switchMode(isRegister ? 'login' : 'register')}
              disabled={loading}>
              <Text style={styles.switchText}>
                {isRegister ? 'Already have an account? ' : "New here? "}
                <Text style={styles.termsLink}>{isRegister ? 'Sign In' : 'Create Account'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9FC' },
  flexOne: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  heroSection: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  logoBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: '#EBE9F3', shadowColor: 'rgba(10, 25, 64, 0.06)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3 },
  logoIcon: { fontSize: 30 },
  appName: { fontSize: 24, fontWeight: '900', color: '#0A1940', letterSpacing: 4 },
  tagline: { fontSize: 12, color: '#6B6B8A', marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: spacing.xl, borderWidth: 1, borderColor: '#EBE9F3', shadowColor: 'rgba(10, 25, 64, 0.05)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 3 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F3EFFF', borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.lg },
  tabButton: { flex: 1, paddingVertical: spacing.xs + 2, alignItems: 'center', borderRadius: borderRadius.sm },
  tabButtonActive: { backgroundColor: '#FFFFFF', shadowColor: 'rgba(10, 25, 64, 0.08)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B6B8A' },
  tabTextActive: { color: '#E91E63', fontWeight: '800' },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0A1940', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#6B6B8A', lineHeight: 18, marginBottom: spacing.md },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#4A4A6A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSpacing: { marginTop: spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0DBF0', borderRadius: borderRadius.md, backgroundColor: '#FAF9FC', height: 52, paddingHorizontal: spacing.sm },
  countryPickerButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  flagText: { fontSize: 18, marginRight: 6 },
  countryCodeText: { fontSize: 15, fontWeight: '700', color: '#0A1940', marginRight: 4 },
  dropdownChevron: { fontSize: 12, color: '#6B6B8A' },
  inputDivider: { width: 1, height: 24, backgroundColor: '#D0CBDF', marginHorizontal: spacing.sm },
  phoneInput: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0A1940', height: '100%' },
  countryDropdown: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0DBF0', borderRadius: borderRadius.md, marginTop: spacing.xs, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  countryOption: { paddingVertical: spacing.md, paddingHorizontal: spacing.base, borderBottomWidth: 1, borderBottomColor: '#F5F2F8' },
  countryOptionSelected: { backgroundColor: '#F3EFFF' },
  countryOptionText: { fontSize: 14, fontWeight: '600', color: '#0A1940' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E0DBF0', borderRadius: borderRadius.md, backgroundColor: '#FAF9FC', height: 52, paddingHorizontal: spacing.md },
  inputErrorBorder: { borderColor: '#F8B4B4' },
  passwordInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0A1940', height: '100%' },
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
  switchText: { fontSize: 13, color: '#6B6B8A' },
  termsText: { fontSize: 11, color: '#8E8EA8', textAlign: 'center', lineHeight: 17, marginTop: spacing.md },
  termsLink: { color: '#0A1940', fontWeight: '700' },
});
