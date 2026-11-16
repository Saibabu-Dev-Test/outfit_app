// Firebase Hosting: the public legal pages and app-ads.txt are served, everything else goes to /get/.
export {};
// Node built-ins without @types/node (jest runs in node)
declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { build, KEEP } = require('../scripts/hosting-redirect-regex.js');
const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const catchAll = firebase.hosting.redirects.find((r: any) => r.regex && r.destination === '/get/');

describe('hosting catch-all redirect', () => {
  it('firebase.json matches scripts/hosting-redirect-regex.js', () => {
    expect(catchAll.regex).toBe(build());
  });

  const re = new RegExp(catchAll.regex);
  it.each(['/get/', '/get/?ref=AB12', '/icons/og.png', '/privacy', '/privacy/', '/terms/', '/about/', '/contact/', '/app-ads.txt', '/robots.txt', '/sw.js'])(
    'serves %s',
    (p: string) => expect(re.test(p)).toBe(false),
  );
  it.each(['/', '/get', '/home', '/a', '/ab', '/app', '/app-ads.txt2', '/sw.json', '/robots.txt.bak', '/x/privacy/'])(
    'redirects %s to /get/',
    (p: string) => expect(re.test(p)).toBe(true),
  );

  it('every kept page has a source file', () => {
    for (const { p } of KEEP) {
      if (['get/', 'icons/'].includes(p)) continue;
      const src = p.endsWith('.txt') || p.endsWith('.js') ? p : `${p}/index.html`;
      const inPublic = fs.existsSync(path.join(root, 'web', 'public', src));
      const committed = fs.existsSync(path.join(root, 'hosting-public', src));
      expect(inPublic || committed).toBe(true);
    }
  });

  it('app-ads.txt lists the AdMob publisher', () => {
    expect(fs.readFileSync(path.join(root, 'web', 'public', 'app-ads.txt'), 'utf8').trim()).toBe(
      'google.com, pub-8006246175093661, DIRECT, f08c47fec0942fa0',
    );
  });
});
