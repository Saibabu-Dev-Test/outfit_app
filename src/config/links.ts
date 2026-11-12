// Public web address of the app, in one place. Share links, the /get/ download page, Open Graph
// tags (web/webpack.config.js reads SHARE_BASE from this file) and the update fallback use it.
// To move to a cleaner free name (e.g. https://outfit-app.web.app): create + deploy that site with
// `SITE=outfit-app bash scripts/deploy-hosting.sh`, then change SHARE_BASE here and push.
// Keep it on one line: webpack reads it with a regex. No trailing slash.
export const SHARE_BASE = 'https://outfit-vote-9edca.web.app';

export const APP_WEB_URL = `${SHARE_BASE}/`;
// Android download page (the only page Hosting serves; every other path redirects here).
// Share links add ?ref=CODE. APP_WEB_URL (the site root) also lands here.
export const APP_GET_URL = `${SHARE_BASE}/get/`;

// Release APK names (main.yml also keeps the old app-*-release.apk names for older installs)
export const APK_NAME = 'Outfit.apk'; // arm64-v8a (almost every phone since 2017)
export const APK_UNIVERSAL_NAME = 'Outfit-universal.apk'; // every CPU type, bigger
