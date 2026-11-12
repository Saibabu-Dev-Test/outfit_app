/* eslint-env jest */
// Native modules that have no JS fallback in Jest. The app's own web stand-ins (plain views) are
// used for the keyboard controller.
jest.mock('react-native-keyboard-controller', () => require('../src/components/keyboard.web'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ type: 'cancelled', data: null })),
    signInSilently: jest.fn(() => Promise.resolve({ type: 'noSavedCredentialFound', data: null })),
    signOut: jest.fn(() => Promise.resolve(null)),
    revokeAccess: jest.fn(() => Promise.resolve(null)),
    getTokens: jest.fn(() => Promise.resolve({ idToken: '', accessToken: '' })),
    hasPreviousSignIn: jest.fn(() => false),
    getCurrentUser: jest.fn(() => null),
  },
  isErrorWithCode: () => false,
  isSuccessResponse: (r) => r?.type === 'success',
  isCancelledResponse: (r) => r?.type === 'cancelled',
  isNoSavedCredentialFoundResponse: (r) => r?.type === 'noSavedCredentialFound',
  statusCodes: {},
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: jest.fn(() => Promise.resolve('')),
  setString: jest.fn(),
  hasString: jest.fn(() => Promise.resolve(false)),
}));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: true })),
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: true })),
}));
// Only Animated.View + useAnimatedStyle are used (CustomTabBar)
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const Animated = { View, createAnimatedComponent: c => c };
  return { __esModule: true, default: Animated, ...Animated, useAnimatedStyle: fn => fn(), useSharedValue: v => ({ value: v }) };
});
