const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Firebase JS SDK fix: with package "exports" on, Metro bundles TWO copies
 * of @firebase/app (cjs + esm) -> "Component auth has not been registered yet".
 * Exports are turned off ONLY for firebase packages, so one copy is bundled.
 * (Turning it off globally breaks RN 0.87's own packages.)
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs'],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith('firebase/') || moduleName.startsWith('@firebase/')) {
        return context.resolveRequest(
          { ...context, unstable_enablePackageExports: false },
          moduleName,
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
