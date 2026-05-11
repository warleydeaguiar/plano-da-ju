// Fix for Expo Router in monorepo — EXPO_ROUTER_APP_ROOT must be set
// before Metro processes node_modules/expo-router/_ctx.ios.js
process.env.EXPO_ROUTER_APP_ROOT = 'app';

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

// Priority: app node_modules first, then root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// All react/react-native packages live in root node_modules only.
// extraNodeModules pins them to root to guarantee a single instance.
const rnRoot = path.resolve(monorepoRoot, 'node_modules');
config.resolver.extraNodeModules = {
  'react':                 path.resolve(rnRoot, 'react'),
  'react/jsx-runtime':     path.resolve(rnRoot, 'react/jsx-runtime'),
  'react/jsx-dev-runtime': path.resolve(rnRoot, 'react/jsx-dev-runtime'),
  'react-native':          path.resolve(rnRoot, 'react-native'),
  'scheduler':             path.resolve(rnRoot, 'scheduler'),
};

// Monorepo fix: expo-router's _ctx.js uses require.context("./app", ...)
// which Metro resolves relative to _ctx.js (inside node_modules/expo-router/).
// That resolves to node_modules/expo-router/app/ — which doesn't exist.
// We redirect all _ctx imports to platform-specific shims that live at
// projectRoot/ so require.context("./app", ...) correctly finds projectRoot/app/.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept any _ctx variant imported from within expo-router
  if (
    context.originModulePath.includes('expo-router') &&
    /\/_ctx(\.web|\.ios|\.android|\.native)?$/.test(moduleName)
  ) {
    // Pick the platform-specific shim so each platform gets its correct regex
    let suffix = '';
    if (platform === 'web') suffix = '.web';
    else if (platform === 'ios') suffix = '.ios';
    else if (platform === 'android') suffix = '.android';

    const shim = path.resolve(projectRoot, `expo-router-ctx${suffix}.js`);
    return { filePath: shim, type: 'sourceFile' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
