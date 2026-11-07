// 1) REPLACE this line:
//    import { sendOtp, verifyOtp } from '../../services/authApi';
// WITH:

// ⚠️ PLACEHOLDER SCREEN (UI only)
// OTP login is not connected yet: no backend call, no SMS, no login.
// Replace these stubs with @react-native-firebase/auth when OTP is ready.
const OTP_ENABLED = false;

const sendOtp = async (_params: { phoneNumber: string }): Promise<void> => {
  // no-op for now
};

const verifyOtp = async (_params: {
  phoneNumber: string;
  otp: string;
}): Promise<{ user?: any; message?: string }> => ({
  message: 'OTP login is coming soon. Please sign in with your password.',
});


// 2) REPLACE:
//    const inputRefs = useRef<Array<TextInput | null>>([]);
// WITH (RN 0.87 ref type):
const inputRefs = useRef<Array<React.ComponentRef<typeof TextInput> | null>>([]);


// 3) In the "Send the first OTP" useEffect, REPLACE:
//    if (otpAlreadySent) return;
// WITH:
if (otpAlreadySent || !OTP_ENABLED) return;
