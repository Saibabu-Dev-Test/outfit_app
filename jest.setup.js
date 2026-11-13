// Native modules that don't exist under Jest
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
