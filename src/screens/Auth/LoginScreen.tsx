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

interface LoginScreenProps {
  navigation: any;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
];

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = () => {
    setError('');
    const cleanedNumber = phoneNumber.trim();

    if (!cleanedNumber || cleanedNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);

    // Simulate OTP trigger
    setTimeout(() => {
      setLoading(false);
      navigation.navigate('Otp', {
        fullPhone: `${selectedCountry.code} ${cleanedNumber}`,
        phone: cleanedNumber,
        countryCode: selectedCountry.code,
      });
    }, 800);
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
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>
              Enter your mobile number to sign in or create an account
            </Text>

            {/* Mobile Input Container */}
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

            {/* Validation Error Message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              activeOpacity={0.8}
              onPress={handleSendOtp}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send OTP</Text>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#EBE9F3',
    shadowColor: 'rgba(10, 25, 64, 0.06)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  logoIcon: {
    fontSize: 32,
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0A1940',
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 13,
    color: '#6B6B8A',
    marginTop: 6,
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
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A1940',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B6B8A',
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0DBF0',
    borderRadius: borderRadius.md,
    backgroundColor: '#FAF9FC',
    height: 54,
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
  errorText: {
    color: '#E91E63',
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginLeft: 2,
  },
  primaryButton: {
    backgroundColor: '#E91E63',
    borderRadius: borderRadius.md,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
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
  termsText: {
    fontSize: 11,
    color: '#8E8EA8',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: spacing.lg,
  },
  termsLink: {
    color: '#0A1940',
    fontWeight: '700',
  },
});
