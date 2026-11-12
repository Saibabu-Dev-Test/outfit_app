module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Reanimated 4 (used by react-native-keyboard-controller): worklets plugin, must stay last
  plugins: ['react-native-worklets/plugin'],
};
