#!/usr/bin/env node
// App only, no website: assembles what Firebase Hosting serves into hosting-public/.
//   hosting-public/get/index.html  the Android download page (share links: /get/?ref=CODE),
//                                  __SHARE_BASE__ filled from SHARE_BASE in src/config/links.ts
//   hosting-public/icons/*         icons + og.png for link previews
//   hosting-public/{privacy,terms,about,contact}/index.html  public legal pages (store listing,
//                                  AdMob and offerwall partner review), from web/public/<page>/
//   hosting-public/app-ads.txt     AdMob authorized sellers, from web/public/app-ads.txt
//   hosting-public/offerwall.txt   Offerwall.GG site verification, from web/public/offerwall.txt
//   hosting-public/index.html      the root page /: same as get/index.html (served, not redirected)
//   hosting-public/sw.js           kill-switch for the old PWA service worker (committed)
//   hosting-public/robots.txt      (committed)
// No web app bundle is ever deployed. firebase.json redirects every other path to /get/.
// Runs as the firebase.json predeploy step and from scripts/deploy-hosting.sh. Node only, no deps.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'hosting-public');
const pub = path.join(root, 'web', 'public');

const linksTs = fs.readFileSync(path.join(root, 'src', 'config', 'links.ts'), 'utf8');
const m = /export const SHARE_BASE = '([^']+)'/.exec(linksTs);
if (!m) throw new Error('SHARE_BASE not found in src/config/links.ts');
const shareBase = m[1].replace(/\/+$/, '');

// Public pages served at /<page>/ (keep in step with KEEP in scripts/hosting-redirect-regex.js)
const PAGES = ['privacy', 'terms', 'about', 'contact'];
for (const d of ['get', 'icons', ...PAGES]) fs.rmSync(path.join(out, d), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'get'), { recursive: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
for (const d of PAGES) {
  fs.mkdirSync(path.join(out, d), { recursive: true });
  fs.copyFileSync(path.join(pub, d, 'index.html'), path.join(out, d, 'index.html'));
}
for (const f of ['app-ads.txt', 'offerwall.txt']) fs.copyFileSync(path.join(pub, f), path.join(out, f));

const page = fs.readFileSync(path.join(pub, 'get', 'index.html'), 'utf8').replace(/__SHARE_BASE__/g, shareBase);
fs.writeFileSync(path.join(out, 'get', 'index.html'), page);
fs.writeFileSync(path.join(out, 'index.html'), page);
for (const f of fs.readdirSync(path.join(pub, 'icons'))) {
  fs.copyFileSync(path.join(pub, 'icons', f), path.join(out, 'icons', f));
}
for (const f of ['sw.js', 'robots.txt']) {
  if (!fs.existsSync(path.join(out, f))) throw new Error(`hosting-public/${f} is missing`);
}
console.log(`hosting-public ready (get/, icons/, ${PAGES.join('/, ')}/, index.html, app-ads.txt, offerwall.txt, sw.js, robots.txt) for ${shareBase}`);
