#!/usr/bin/env bash
# Puts the latest CI web build live on Firebase Hosting: https://outfit-vote-9edca.web.app
# Run in Google Cloud Shell as a project owner:
#   curl -sL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/scripts/deploy-hosting.sh | bash
set -euo pipefail
P=outfit-vote-9edca
rm -rf /tmp/webdist && mkdir -p /tmp/webdist
curl -sfL https://github.com/Saibabu-Dev-Test/outfit_app/releases/download/web-latest/web-firebase.tar.gz | tar -xz -C /tmp/webdist
ls /tmp/webdist | head
export TOKEN=$(gcloud auth print-access-token) P
python3 - <<'PY'
import os, gzip, hashlib, json, urllib.request
P=os.environ['P']; T=os.environ['TOKEN']; root='/tmp/webdist'
API='https://firebasehosting.googleapis.com/v1beta1'
def call(method, url, body=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': 'Bearer '+T, 'Content-Type': ctype, 'x-goog-user-project': P})
    try:
        with urllib.request.urlopen(req) as r:
            t = r.read().decode(); return json.loads(t) if t.strip() else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f'ERROR {e.code} {url}: {e.read().decode()[:800]}')
v = call('POST', f'{API}/sites/{P}/versions', {'config': {'rewrites': [{'glob': '**', 'path': '/index.html'}]}})
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
rel = call('POST', f'{API}/sites/{P}/releases?versionName={name}', {})
print('Released', rel.get('name'))
print('HOSTING DEPLOYED OK: https://%s.web.app' % P)
PY
