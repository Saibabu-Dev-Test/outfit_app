#!/usr/bin/env node
// Builds the firebase.json catch-all redirect regex: every path that is NOT one of the public
// pages/files below goes to the /get/ download page. Firebase Hosting applies redirects before
// static files and its RE2 regexes have no lookahead, so the "not these paths" rule is spelled
// out as a trie. Usage: node scripts/hosting-redirect-regex.js            (prints the regex)
//                       node scripts/hosting-redirect-regex.js --write    (updates firebase.json)
// __tests__/hostingRedirect.test.ts checks firebase.json matches this output.
const fs = require('fs');
const path = require('path');

// prefix: the path and anything after it is served as-is. exact: only that exact path.
// '' exact = the root page / itself (served from hosting-public/index.html, a copy of /get/, so
// partner site verification that reads / without following redirects sees its <head>).
const KEEP = [
  { p: '', kind: 'exact' },
  { p: 'get/', kind: 'prefix' },
  { p: 'icons/', kind: 'prefix' },
  { p: 'privacy', kind: 'prefix' },
  { p: 'terms', kind: 'prefix' },
  { p: 'about', kind: 'prefix' },
  { p: 'contact', kind: 'prefix' },
  { p: 'robots.txt', kind: 'exact' },
  { p: 'sw.js', kind: 'exact' },
  { p: 'app-ads.txt', kind: 'exact' },
  { p: 'offerwall.txt', kind: 'exact' },
];

const esc = c => (/[.\\^$|?*+()[\]{}]/.test(c) ? '\\' + c : c);
const escClass = c => (/[\\\]^-]/.test(c) ? '\\' + c : c);

function build(keep = KEEP) {
  const root = { kids: new Map(), kind: null };
  for (const { p, kind } of keep) {
    let n = root;
    for (const c of p) {
      if (!n.kids.has(c)) n.kids.set(c, { kids: new Map(), kind: null });
      n = n.kids.get(c);
    }
    n.kind = kind;
  }
  // regex for the suffixes after node that leave the path NOT kept
  const f = n => {
    if (n.kids.size === 0) return n.kind === 'exact' ? '.+' : null;
    const keys = [...n.kids.keys()].sort();
    const alts = [];
    if (n.kind !== 'exact') alts.push('');
    alts.push(`[^${keys.map(escClass).join('')}].*`);
    for (const k of keys) {
      const child = n.kids.get(k);
      if (child.kind === 'prefix') continue;
      alts.push(`${esc(k)}(?:${f(child)})`);
    }
    return alts.join('|');
  };
  return `^(?:|[^/].*|/(?:${f(root)}))$`;
}

module.exports = { build, KEEP };

if (require.main === module) {
  const re = build();
  if (process.argv.includes('--write')) {
    const file = path.join(__dirname, '..', 'firebase.json');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const r = cfg.hosting.redirects.find(x => x.regex && x.destination === '/get/');
    if (!r) throw new Error('catch-all /get/ redirect not found in firebase.json');
    r.regex = re;
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    console.log('firebase.json updated');
  } else console.log(re);
}
