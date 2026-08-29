import React, { useState, useEffect, useRef } from 'react';
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

interface OtpScreenProps {
  navigation: any;
  route: any;
  onLoginSuccess?: () => void;
}

export default function OtpScreen({ navigation, route, onLoginSuccess }: OtpScreenProps) {
  const { fullPhone = '+91 9876543210' } = route.params || {};

  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inputRef0 = useRef<any>(null);
  const inputRef1 = useRef<any>(null);
  const inputRef2 = useRef<any>(null);
  const inputRef3 = useRef<any>(null);

  const inputRefs = [inputRef0, inputRef1, inputRef2, inputRef3];

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    setError('');
    const cleanDigit = text.replace(/[^0-9]/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = cleanDigit;
    setOtp(newOtp);

    // Auto focus next input
    if (cleanDigit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleResendOtp = () => {
    if (!canResend) return;
    setOtp(['', '', '', '']);
    setTimer(30);
    setCanResend(false);
    setError('');
    inputRef0.current?.focus();
  };

  const handleVerify = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 4) {
      setError('Please enter the complete 4-digit code');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        });
      }
    }, 1000);
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

          {/* Top Back Navigation Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Header Card */}
          <View style={styles.card}>
            <View style={styles.keyBadge}>
              <Text style={styles.keyIcon}>🔐</Text>
            </View>

            <Text style={styles.cardTitle}>Verify OTP</Text>
            <Text style={styles.cardSubtitle}>
              Code sent to <Text style={styles.phoneHighlight}>{fullPhone}</Text>
            </Text>

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              style={styles.editNumberTouch}>
              <Text style={styles.editNumberText}>Edit Phone Number</Text>
            </TouchableOpacity>

            {/* OTP 4-Digit Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={inputRefs[idx]}
                  style={[
                    styles.otpBox,
                    digit !== '' && styles.otpBoxFilled,
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(val) => handleOtpChange(val, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  selectTextOnFocus
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit CTA */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleVerify}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            {/* Resend Section */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive code? </Text>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={!canResend}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.resendActionText,
                    !canResend && styles.resendDisabledText,
                  ]}>
                  {canResend ? 'Resend OTP' : `Resend in ${timer}s`}
                </Text>
              </TouchableOpacity>
            </View>

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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    borderWidth: 1,
    borderColor: '#EBE9F3',
  },
  backIcon: {
    fontSize: 20,
    color: '#0A1940',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.05)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
  },
  keyBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3EFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  keyIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A1940',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6B8A',
    textAlign: 'center',
  },
  phoneHighlight: {
    color: '#0A1940',
    fontWeight: '700',
  },
  editNumberTouch: {
    marginTop: 6,
    marginBottom: spacing.xl,
  },
  editNumberText: {
    fontSize: 12,
    color: '#E91E63',
    fontWeight: '700',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  otpBox: {
    width: 54,
    height: 58,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    backgroundColor: '#FAF9FC',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#0A1940',
  },
  otpBoxFilled: {
    borderColor: '#E91E63',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    color: '#E91E63',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: '#E91E63',
    borderRadius: borderRadius.md,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendLabel: {
    fontSize: 13,
    color: '#6B6B8A',
  },
  resendActionText: {
    fontSize: 13,
    color: '#E91E63',
    fontWeight: '700',
  },
  resendDisabledText: {
    color: '#9E9EBA',
    fontWeight: '500',
  },
});
