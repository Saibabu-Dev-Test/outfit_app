#!/usr/bin/env bash
# App only, no website for now: Firebase Hosting (https://outfit-vote-9edca.web.app) just downloads
# the Android app. "/" and every other path are 302 redirects to the latest GitHub release APK
# (same as firebase.json; `firebase deploy --only hosting` does the same thing).
# Run in Google Cloud Shell as a project owner:
#   curl -sL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/scripts/deploy-hosting.sh | bash
#
# Optional extra site (a cleaner free *.web.app name, e.g. https://outfit-app.web.app):
#   curl -sL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/scripts/deploy-hosting.sh | SITE=outfit-app bash
# SITE creates that Hosting site in this project if needed (same as `firebase hosting:sites:create
# $SITE`, done here through the Hosting REST API so no `firebase login` is needed) and deploys the
# same build to it too. A name already taken by another Firebase project stops with an error.
#
# The APK bytes don't count against the Hosting free transfer (360 MB/day), only the tiny redirect does.
# Files served: hosting-public/robots.txt and sw.js (no index.html, so "/" reaches the redirect).
set -euo pipefail
P=outfit-vote-9edca
SITE="${SITE:-}"
rm -rf /tmp/webdist && mkdir -p /tmp/webdist
printf 'User-agent: *\nDisallow: /\n' > /tmp/webdist/robots.txt
# Kill-switch for the old PWA service worker (cached website in browsers that visited before)
curl -sfL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/hosting-public/sw.js -o /tmp/webdist/sw.js
export TOKEN=$(gcloud auth print-access-token) P SITE
python3 - <<'PY'
import os, re, gzip, hashlib, json, urllib.request
P=os.environ['P']; T=os.environ['TOKEN']; SITE=os.environ.get('SITE','').strip(); root='/tmp/webdist'
API='https://firebasehosting.googleapis.com/v1beta1'
REL='https://github.com/Saibabu-Dev-Test/outfit_app/releases/latest/download/'
CONFIG = {
    'redirects': [
        {'glob': '/Outfit.apk', 'statusCode': 302, 'location': REL + 'Outfit.apk'},
        {'glob': '/Outfit-universal.apk', 'statusCode': 302, 'location': REL + 'Outfit-universal.apk'},
        # App only: the root and every other path download the app
        # Every path except /sw.js (redirects beat files on Firebase Hosting, and the old PWA's
        # service worker only goes away when /sw.js serves the kill-switch file)
        {'regex': r'^/(?:[^s].*|s(?:[^w].*)?|sw(?:[^.].*)?|sw\.(?:[^j].*)?|sw\.j(?:[^s].*)?|sw\.js.+)?$', 'statusCode': 302, 'location': REL + 'Outfit.apk'},
    ],
}
def call(method, url, body=None, raw=None, ctype='application/json', ok=()):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer '+T, 'Content-Type': ctype, 'x-goog-user-project': P})
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode(); return json.loads(t) if t.strip() else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:800]
        if e.code in ok: return {'_error': e.code, '_msg': msg}
        raise SystemExit(f'ERROR {e.code} {url}: {msg}')

def ensure_site(site):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{4,61}[a-z0-9]', site):
        raise SystemExit(f'SITE "{site}" is not a valid site name (6-63 chars: a-z, 0-9, -)')
    r = call('POST', f'{API}/projects/{P}/sites?siteId={site}', {}, ok=(409,))
    if '_error' not in r:
        print('Created site', site); return
    # 409: exists. Fine only if it is one of ours.
    mine = call('GET', f'{API}/projects/{P}/sites/{site}', ok=(403, 404))
    if '_error' in mine:
        raise SystemExit(f'Site name "{site}" is already taken by another Firebase project. Pick another SITE.')
    print('Site', site, 'already exists in', P)

def deploy(site):
    v = call('POST', f'{API}/sites/{site}/versions', {'config': CONFIG})
    name = v['name']; print('Version', name)
    files = {}; blobs = {}
    for d, _, fs in os.walk(root):
        for f in fs:
            full = os.path.join(d, f); rel = '/' + os.path.relpath(full, root)
            gz = gzip.compress(open(full, 'rb').read(), mtime=0)
            h = hashlib.sha256(gz).hexdigest(); files[rel] = h; blobs[h] = gz
    r = call('POST', f'{API}/{name}:populateFiles', {'files': files})
    need = r.get('uploadRequiredHashes', []); url = r.get('uploadUrl')
    print(len(files), 'files,', len(need), 'to upload')
    for h in need:
        call('POST', f'{url}/{h}', raw=blobs[h], ctype='application/octet-stream')
    call('PATCH', f'{API}/{name}?update_mask=status', {'status': 'FINALIZED'})
    rel = call('POST', f'{API}/sites/{site}/releases?versionName={name}', {})
    print('Released', rel.get('name'))
    print('HOSTING DEPLOYED OK: https://%s.web.app' % site)

deploy(P)
if SITE and SITE != P:
    ensure_site(SITE)
    deploy(SITE)
PY
