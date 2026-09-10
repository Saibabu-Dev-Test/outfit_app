import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius } from '../../theme';
import {
  loginWithPhoneAndPassword,
  registerWithPhoneAndPassword,
} from '../../services/authApi';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
];

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
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

  const handlePhonePasswordAuth = async () => {
    setError('');
    setSuccessMsg('');
    const cleanedNumber = phoneNumber.trim();

    if (!cleanedNumber || cleanedNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (authMode === 'register') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      if (!confirmPassword) {
        setError('Please confirm your password');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setLoading(true);

    const formattedPhone = `${selectedCountry.code}${cleanedNumber}`;

    try {
      if (authMode === 'register') {
        const regRes = await registerWithPhoneAndPassword({
          phoneNumber: formattedPhone,
          password,
        });

        setSuccessMsg('Account created successfully! Logging you in...');

        // Auto login after successful registration
        const loginRes = await loginWithPhoneAndPassword({
          phoneNumber: formattedPhone,
          password,
        });

        setLoading(false);
        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
          });
        }
      } else {
        const loginRes = await loginWithPhoneAndPassword({
          phoneNumber: formattedPhone,
          password,
        });

        setSuccessMsg(loginRes.message || 'Login successful!');
        setLoading(false);

        if (onLoginSuccess) {
          onLoginSuccess();
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainApp' }],
          });
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An error occurred during authentication');
    }
  };

  const handleSendOtp = () => {
    setError('');
    const cleanedNumber = phoneNumber.trim();

    if (!cleanedNumber || cleanedNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Otp', {
        fullPhone: `${selectedCountry.code} ${cleanedNumber}`,
        phone: cleanedNumber,
        countryCode: selectedCountry.code,
      });
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? { backgroundColor: '#FAF9FC' } : {})}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flexOne}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Top Brand Hero Banner */}
          <View style={styles.heroSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoIcon}>👗</Text>
            </View>
            <Text style={styles.appName}>OUTFIT</Text>
            <Text style={styles.tagline}>Your AI Personal Stylist & Daily Colour Guide</Text>
          </View>

          {/* Main Login Card */}
          <View style={styles.card}>
            {/* Mode Switcher Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, authMode === 'login' && styles.tabButtonActive]}
                onPress={() => {
                  setAuthMode('login');
                  setError('');
                  setSuccessMsg('');
                  setConfirmPassword('');
                }}>
                <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, authMode === 'register' && styles.tabButtonActive]}
                onPress={() => {
                  setAuthMode('register');
                  setError('');
                  setSuccessMsg('');
                  setConfirmPassword('');
                }}>
                <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>
              {authMode === 'login' ? 'Welcome Back' : 'Get Started'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {authMode === 'login'
                ? 'Sign in with your registered mobile number & password'
                : 'Create an account using your mobile number & password'}
            </Text>

            {/* Mobile Input Container */}
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={styles.inputRow}>
              {/* Country Code Picker Dropdown Trigger */}
              <TouchableOpacity
                style={styles.countryPickerButton}
                activeOpacity={0.7}
                onPress={() => setShowCountryPicker(!showCountryPicker)}>
                <Text style={styles.flagText}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
                <Text style={styles.dropdownChevron}>▾</Text>
              </TouchableOpacity>

              <View style={styles.inputDivider} />

              <TextInput
                style={styles.phoneInput}
                placeholder="Mobile number"
                placeholderTextColor="#9E9EBA"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  setError('');
                  setPhoneNumber(text.replace(/[^0-9]/g, ''));
                }}
              />
            </View>

            {/* Country Selection Dropdown List */}
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
                    }}>
                    <Text style={styles.countryOptionText}>
                      {item.flag} {item.country} ({item.code})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Password Input Container */}
            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder={authMode === 'login' ? 'Enter password' : 'Create password (min 6 chars)'}
                placeholderTextColor="#9E9EBA"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setError('');
                  setPassword(text);
                }}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}>
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            {/* Confirm Password Input Container (Create Account mode only) */}
            {authMode === 'register' && (
              <>
                <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Confirm Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#9E9EBA"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setError('');
                      setConfirmPassword(text);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    activeOpacity={0.7}>
                    <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Success Notification Banner */}
            {successMsg ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>✓ {successMsg}</Text>
              </View>
            ) : null}

            {/* Validation Error Message */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handlePhonePasswordAuth}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {authMode === 'login' ? 'Sign In with Password' : 'Register & Sign In'}
                </Text>
              )}
            </TouchableOpacity>


          

            {/* Terms and Disclaimer */}
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
  container: {
    flex: 1,
    backgroundColor: '#FAF9FC',
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  logoIcon: {
    fontSize: 30,
  },
  appName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0A1940',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 12,
    color: '#6B6B8A',
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3EFFF',
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(10, 25, 64, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B6B8A',
  },
  tabTextActive: {
    color: '#E91E63',
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A1940',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6B8A',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A6A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    backgroundColor: '#FAF9FC',
    height: 52,
    paddingHorizontal: spacing.sm,
  },
  countryPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  flagText: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A1940',
    marginRight: 4,
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#6B6B8A',
  },
  inputDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#D0CBDF',
    marginHorizontal: spacing.sm,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0A1940',
    height: '100%',
  },
  countryDropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  countryOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F2F8',
  },
  countryOptionSelected: {
    backgroundColor: '#F3EFFF',
  },
  countryOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A1940',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    backgroundColor: '#FAF9FC',
    height: 52,
    paddingHorizontal: spacing.md,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0A1940',
    height: '100%',
  },
  eyeButton: {
    padding: spacing.xs,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorBanner: {
    backgroundColor: '#FDE8E8',
    borderColor: '#F8B4B4',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    color: '#E91E63',
    fontSize: 13,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  successText: {
    color: '#2E7D32',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#E91E63',
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    shadowColor: 'rgba(233, 30, 99, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0DBF0',
  },
  orText: {
    fontSize: 12,
    color: '#8E8EA8',
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#E91E63',
    borderRadius: borderRadius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#E91E63',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 11,
    color: '#8E8EA8',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: spacing.md,
  },
  termsLink: {
    color: '#0A1940',
    fontWeight: '700',
  },
});
