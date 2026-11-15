module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest/setup.js'],
  // server/earn-worker is a Cloudflare Worker (wrangler): never run anything from it as a test.
  // __tests__/bitlabsWorker.test.ts imports only its pure / fetch-injectable modules.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/earn-worker/'],
  // ESM-only packages that must go through Babel
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@react-native-async-storage|@react-native-clipboard|@react-native-google-signin|react-native-.*|firebase|@firebase)/)',
  ],
};
