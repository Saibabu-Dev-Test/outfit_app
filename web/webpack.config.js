// Web (PWA) build of the same src/ app with react-native-web.
//   npm run web:build   -> web/dist (static files for GitHub Pages)
// PUBLIC_PATH sets the base path (GitHub Pages project site: /outfit_app/).
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const root = path.resolve(__dirname, '..');
const publicPath = process.env.PUBLIC_PATH || '/outfit_app/';
const buildId = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 12) : String(Date.now());
// Public site address for Open Graph tags: SHARE_BASE in src/config/links.ts (one source of truth)
const linksTs = require('fs').readFileSync(path.join(root, 'src', 'config', 'links.ts'), 'utf8');
const shareBaseMatch = /export const SHARE_BASE = '([^']+)'/.exec(linksTs);
if (!shareBaseMatch) throw new Error('SHARE_BASE not found in src/config/links.ts');
const shareBase = shareBaseMatch[1].replace(/\/+$/, '');

// RN packages ship untranspiled JSX / Flow / TS and must go through Babel
const compileModules = [
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-image-picker',
  '@react-navigation',
  '@react-native-async-storage',
  '@react-native/new-app-screen',
];

module.exports = (env, argv) => {
  const prod = argv.mode !== 'development';
  return {
    mode: prod ? 'production' : 'development',
    context: root,
    entry: path.join(__dirname, 'index.web.js'),
    output: {
      path: path.join(__dirname, 'dist'),
      publicPath,
      filename: prod ? 'static/js/[name].[contenthash:8].js' : 'static/js/[name].js',
      chunkFilename: prod ? 'static/js/[name].[contenthash:8].chunk.js' : 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[contenthash:8][ext]',
      clean: true,
    },
    devtool: prod ? false : 'cheap-module-source-map',
    resolve: {
      // .web.* files replace the Android-only modules (fingerprint vault, SIM picker, notifications...)
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.jsx', '.json', '.cjs', '.mjs'],
      alias: {
        'react-native$': 'react-native-web',
        'react-native-gesture-handler$': path.join(__dirname, 'empty.js'),
      },
      // One copy of React for the app and react-native-web
      modules: [path.join(root, 'node_modules'), 'node_modules'],
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          include: /node_modules/,
          resolve: { fullySpecified: false },
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          include: [
            path.join(root, 'App.tsx'),
            path.join(root, 'src'),
            __dirname,
            ...compileModules.map(m => path.join(root, 'node_modules', m)),
          ],
          exclude: [path.join(__dirname, 'dist'), path.join(__dirname, 'public')],
          use: {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              configFile: false,
              cacheDirectory: true,
              presets: [['module:@react-native/babel-preset', { disableImportExportTransform: true }]],
            },
          },
        },
        {
          test: /\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(!prod),
        'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, 'public', 'index.html'),
        templateParameters: { publicPath, shareBase },
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: path.join(__dirname, 'public', 'manifest.json') },
          { from: path.join(__dirname, 'public', 'icons'), to: 'icons' },
          // Static app download page (/get/?ref=CODE); Firebase Hosting serves it before the SPA rewrite
          {
            from: path.join(__dirname, 'public', 'get'),
            to: 'get',
            transform: c => c.toString().replace(/__SHARE_BASE__/g, shareBase),
          },
          {
            from: path.join(__dirname, 'public', 'sw.js'),
            transform: c => c.toString().replace('__BUILD_ID__', buildId),
          },
        ],
      }),
    ],
    performance: { hints: false },
    devServer: { historyApiFallback: true, port: 8080 },
  };
};
