#!/usr/bin/env python3
"""Builds src/data/locations/india.json: every state / UT -> district -> sub-district of India from the
official Local Government Directory (LGD, lgdirectory.gov.in, Ministry of Panchayati Raj).

Input (downloaded by hand, see src/data/locations/README.md):
  --lgd DIR      the daily LGD parquet dumps from https://ramseraph.github.io/opendata/lgd/
                 (states.*.parquet, districts.*.parquet, subdistricts.*.parquet)
  --local DIR    optional: planemad's LGD CSV exports (gist-sub.csv, gist-dist.csv) for the names in
                 the local script. A local name is used only when the LGD code AND the English name
                 still match the current dump (same entity); Telugu script for AP / TG, Devanagari for
                 Hindi-speaking states only (never Marathi / Konkani labelled as Hindi).
Needs: pip install pyarrow.   Run: python3 scripts/lgd/build-locations.py --lgd ~/lgd --local ~/lgd
"""
import argparse, csv, glob, json, os, re, sys
import pyarrow.parquet as pq

# LGD state code -> the app's state code (src/constants/indiaStates.ts)
APP_CODE = {
    '28': 'AP', '12': 'AR', '18': 'AS', '10': 'BR', '22': 'CG', '30': 'GA', '24': 'GJ', '6': 'HR', '2': 'HP',
    '20': 'JH', '29': 'KA', '32': 'KL', '23': 'MP', '27': 'MH', '14': 'MN', '17': 'ML', '15': 'MZ', '13': 'NL',
    '21': 'OD', '3': 'PB', '8': 'RJ', '11': 'SK', '33': 'TN', '36': 'TG', '16': 'TR', '9': 'UP', '5': 'UK',
    '19': 'WB', '35': 'AN', '4': 'CH', '38': 'DH', '7': 'DL', '1': 'JK', '37': 'LA', '31': 'LD', '34': 'PY',
}
# What the state itself calls its sub-district level (Census of India 2011 sub-district names)
LEVEL = {
    'AP': 'mandal', 'TG': 'mandal',
    'KA': 'taluk', 'KL': 'taluk', 'TN': 'taluk', 'PY': 'taluk',
    'MH': 'taluka', 'GJ': 'taluka', 'GA': 'taluka', 'DH': 'taluka',
    'BR': 'block', 'JH': 'block', 'WB': 'block', 'ML': 'block', 'MZ': 'block', 'TR': 'block',
    'AS': 'circle', 'AR': 'circle', 'NL': 'circle',
    'MN': 'subdivision', 'SK': 'subdivision', 'DL': 'subdivision', 'LD': 'subdivision',
}  # everything else: tehsil
HINDI_STATES = {'BR', 'CG', 'HR', 'HP', 'JH', 'MP', 'RJ', 'UP', 'UK', 'DL', 'CH'}
TE = re.compile('[\u0C00-\u0C7F]')
DEVA = re.compile('[\u0900-\u097F]')

def one(d, pat):
    f = sorted(glob.glob(os.path.join(d, pat)))
    if len(f) != 1:
        sys.exit(f'expected one {pat} in {d}, found {f}')
    return f[0]

def clean(n):
    return re.sub(r'\s+', ' ', str(n or '').replace('*', '')).strip()

def norm(n):
    return re.sub(r'[^a-z0-9]', '', clean(n).lower())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lgd', required=True)
    ap.add_argument('--local', default='')
    ap.add_argument('--observed', default='', help='LGD observed_on date of the dumps (YYYY-MM-DD)')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'locations', 'india.json'))
    a = ap.parse_args()
    S = pq.read_table(one(a.lgd, 'states.*.parquet')).to_pylist()
    D = pq.read_table(one(a.lgd, 'districts.*.parquet')).to_pylist()
    T = pq.read_table(one(a.lgd, 'subdistricts.*.parquet')).to_pylist()

    loc_sub, loc_dist = {}, {}
    if a.local:
        for r in csv.DictReader(open(os.path.join(a.local, 'gist-sub.csv'), encoding='utf-8')):
            loc_sub[r['Sub-District Code']] = (norm(r['Sub-District Name']), clean(r['Sub-District Name(In Local)']))
        for r in csv.DictReader(open(os.path.join(a.local, 'gist-dist.csv'), encoding='utf-8')):
            loc_dist[r['District Code']] = (norm(r['District Name']), clean(r['District Name Local']))

    def local(table, code, name, app):
        x = table.get(str(code))
        if not x or x[0] != norm(name) or not x[1]:
            return '', ''
        if app in ('AP', 'TG') and TE.search(x[1]):
            return x[1], ''
        if app in HINDI_STATES and DEVA.search(x[1]):
            return '', x[1]
        return '', ''

    subs = {}
    for t in T:
        subs.setdefault(str(t['district_code']), []).append(t)
    dists = {}
    for d in D:
        dists.setdefault(str(d['state_code']), []).append(d)

    states = []
    for s in S:
        code = str(s['state_code'])
        app = APP_CODE[code]
        ds = []
        for d in sorted(dists.get(code, []), key=lambda x: clean(x['district_name']).lower()):
            te, hi = local(loc_dist, d['district_code'], d['district_name'], app)
            ss = []
            for t in sorted(subs.get(str(d['district_code']), []), key=lambda x: clean(x['subdistrict_name']).lower()):
                tte, thi = local(loc_sub, t['subdistrict_code'], t['subdistrict_name'], app)
                row = [int(t['subdistrict_code']), clean(t['subdistrict_name']), tte, thi]
                while row and row[-1] == '':
                    row.pop()
                ss.append(row)
            dd = {'c': int(d['district_code']), 'n': clean(d['district_name']), 's': ss}
            if te:
                dd['te'] = te
            if hi:
                dd['hi'] = hi
            ds.append(dd)
        states.append({'c': app, 'lgd': int(code), 'n': clean(s['state_name']), 't': 'state' if s['state_or_ut'] == 'S' else 'ut', 'lv': LEVEL.get(app, 'tehsil'), 'd': ds})
    states.sort(key=lambda x: (x['t'] != 'state', x['n'].lower()))
    out = {
        'source': 'Local Government Directory (lgdirectory.gov.in), daily dump via ramseraph.github.io/opendata/lgd',
        'observed': a.observed,
        'counts': {
            'states': sum(1 for x in states if x['t'] == 'state'),
            'uts': sum(1 for x in states if x['t'] == 'ut'),
            'districts': sum(len(x['d']) for x in states),
            'subdistricts': sum(len(d['s']) for x in states for d in x['d']),
        },
        'states': states,
    }
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    print(json.dumps(out['counts']), os.path.getsize(a.out), 'bytes ->', os.path.normpath(a.out))

if __name__ == '__main__':
    main()
