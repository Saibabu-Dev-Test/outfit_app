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
import { spacing, borderRadius } from '../../theme';
import { sendOtp, verifyOtp } from '../../services/authApi';

interface OtpScreenProps {
  navigation: any;
  route: any;
  onLoginSuccess?: (user?: any) => void;
}

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;
const EMPTY_OTP = Array(OTP_LENGTH).fill('');

const getErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.data?.message || err?.message || fallback;

export default function OtpScreen({ navigation, route, onLoginSuccess }: OtpScreenProps) {
  const { phone = '', countryCode = '', fullPhone = '', otpAlreadySent = false } =
    route?.params || {};

  // Always send E.164 to the backend, e.g. +919876543210
  const phoneE164 =
    countryCode && phone ? `${countryCode}${phone}` : String(fullPhone).replace(/\s/g, '');
  const displayPhone = fullPhone || phoneE164;

  const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const verifyingRef = useRef(false);
  const mountedRef = useRef(true);

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const canResend = secondsLeft === 0 && !resending && !loading;

  // Track mount state so async calls don't update a closed screen
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // One interval for the whole screen; accurate even after backgrounding
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Send the first OTP when the screen opens (unless previous screen did)
  useEffect(() => {
    if (!phoneE164) {
      setError('Phone number missing. Please go back and enter it again.');
      return;
    }
    if (otpAlreadySent) return;
    sendOtp({ phoneNumber: phoneE164 })
      .then(() => {
        if (mountedRef.current) setInfo(`Code sent to ${displayPhone}`);
      })
      .catch((err) => {
        if (mountedRef.current) setError(getErrorMessage(err, 'Could not send the code.'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusBox = (index: number) => {
    inputRefs.current[Math.min(Math.max(index, 0), OTP_LENGTH - 1)]?.focus();
  };

  const resetOtp = () => {
    setOtp(EMPTY_OTP);
    setTimeout(() => focusBox(0), 50);
  };

  const verify = async (code: string) => {
    if (verifyingRef.current) return;
    if (code.length !== OTP_LENGTH) {
      setError(`Please enter the complete ${OTP_LENGTH}-digit code`);
      return;
    }
    if (!phoneE164) {
      setError('Phone number missing. Please go back and enter it again.');
      return;
    }

    verifyingRef.current = true;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await verifyOtp({ phoneNumber: phoneE164, otp: code });
      if (!res?.user) {
        throw new Error(res?.message || 'Incorrect code. Please try again.');
      }
      if (!mountedRef.current) return;
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'MainApp' }] });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(getErrorMessage(err, 'Incorrect code. Please try again.'));
        resetOtp();
      }
    } finally {
      verifyingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    setError('');
    const digits = text.replace(/\D/g, '');
    const next = [...otp];

    // Cleared the box
    if (!digits) {
      next[index] = '';
      setOtp(next);
      return;
    }

    // Typed one digit (or typed over an existing one)
    const isSingleEntry = digits.length === 1 || (digits.length === 2 && !!otp[index]);
    if (isSingleEntry) {
      next[index] = digits.slice(-1);
      setOtp(next);
      if (index < OTP_LENGTH - 1) focusBox(index + 1);
      const code = next.join('');
      if (code.length === OTP_LENGTH) verify(code);
      return;
    }

    // Paste or SMS autofill: spread digits across boxes
    let pos = index;
    for (const d of digits) {
      if (pos >= OTP_LENGTH) break;
      next[pos] = d;
      pos += 1;
    }
    setOtp(next);
    const code = next.join('');
    if (code.length === OTP_LENGTH) {
      verify(code);
    } else {
      focusBox(pos);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      focusBox(index - 1);
    }
  };

  const handleResend = async () => {
    if (!canResend || !phoneE164) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      await sendOtp({ phoneNumber: phoneE164 });
      if (!mountedRef.current) return;
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setNow(Date.now());
      setInfo('A new code has been sent');
      resetOtp();
    } catch (err: any) {
      if (mountedRef.current) setError(getErrorMessage(err, 'Could not resend the code.'));
    } finally {
      if (mountedRef.current) setResending(false);
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

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
            accessibilityLabel="Go back"
            activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.keyBadge}>
              <Text style={styles.keyIcon}>🔐</Text>
            </View>

            <Text style={styles.cardTitle}>Verify OTP</Text>
            <Text style={styles.cardSubtitle}>
              Enter the {OTP_LENGTH}-digit code sent to{' '}
              <Text style={styles.phoneHighlight}>{displayPhone || 'your phone'}</Text>
            </Text>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={loading}
              activeOpacity={0.7}
              style={styles.editNumberTouch}>
              <Text style={styles.editNumberText}>Edit Phone Number</Text>
            </TouchableOpacity>

            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  style={[
                    styles.otpBox,
                    digit !== '' && styles.otpBoxFilled,
                    !!error && styles.otpBoxError,
                  ]}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH} // allows paste / autofill
                  value={digit}
                  editable={!loading}
                  autoFocus={idx === 0}
                  textContentType={idx === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={idx === 0 ? 'sms-otp' : 'off'}
                  selectTextOnFocus
                  caretHidden
                  accessibilityLabel={`Digit ${idx + 1} of ${OTP_LENGTH}`}
                  onChangeText={(val) => handleOtpChange(val, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                />
              ))}
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!error && !!info && <Text style={styles.infoText}>{info}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={() => verify(otp.join(''))}
              disabled={loading}
              accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive code? </Text>
              <TouchableOpacity onPress={handleResend} disabled={!canResend} activeOpacity={0.7}>
                {resending ? (
                  <ActivityIndicator color="#E91E63" size="small" />
                ) : (
                  <Text style={[styles.resendActionText, !canResend && styles.resendDisabledText]}>
                    {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend OTP'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base, borderWidth: 1, borderColor: '#EBE9F3' },
  backIcon: { fontSize: 20, color: '#0A1940', fontWeight: 'bold' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: '#EBE9F3', shadowColor: 'rgba(10, 25, 64, 0.05)', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 3 },
  keyBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3EFFF', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  keyIcon: { fontSize: 28 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0A1940', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#6B6B8A', textAlign: 'center', lineHeight: 19 },
  phoneHighlight: { color: '#0A1940', fontWeight: '700' },
  editNumberTouch: { marginTop: 6, marginBottom: spacing.xl },
  editNumberText: { fontSize: 12, color: '#E91E63', fontWeight: '700' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: spacing.base, marginBottom: spacing.md },
  otpBox: { width: 54, height: 58, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: '#E0DBF0', backgroundColor: '#FAF9FC', textAlign: 'center', fontSize: 22, fontWeight: '800', color: '#0A1940' },
  otpBoxFilled: { borderColor: '#E91E63', backgroundColor: '#FFFFFF' },
  otpBoxError: { borderColor: '#F8B4B4' },
  errorText: { color: '#E91E63', fontSize: 12, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' },
  infoText: { color: '#2E7D32', fontSize: 12, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' },
  primaryButton: { backgroundColor: '#E91E63', borderRadius: borderRadius.md, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, shadowColor: 'rgba(233, 30, 99, 0.3)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, minHeight: 20 },
  resendLabel: { fontSize: 13, color: '#6B6B8A' },
  resendActionText: { fontSize: 13, color: '#E91E63', fontWeight: '700' },
  resendDisabledText: { color: '#9E9EBA', fontWeight: '500' },
});
