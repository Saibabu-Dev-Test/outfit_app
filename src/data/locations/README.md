# India locations (State -> District -> Sub-district)

`india.json` is the complete administrative hierarchy used by the Hospitals / Govt location pickers:
**28 states + 8 union territories, 790 districts, 7,112 sub-districts** (Mandal / Tehsil / Taluk /
Taluka / Block / Circle / Sub-division, the state's own name for the level).

## Source

- **Local Government Directory (LGD)**, Ministry of Panchayati Raj, Government of India:
  https://lgdirectory.gov.in/ (the official register of administrative units and their codes;
  also published monthly on data.gov.in: https://www.data.gov.in/catalog/local-government-directory-lgd).
- Taken from the daily LGD dumps mirrored without captcha at
  https://ramseraph.github.io/opendata/lgd/ (states, districts and subdistricts datasets,
  **observed 2026-11-25**, downloaded 2026-11-25):
  - `states.3a760944dab3b3ff.parquet` (36 rows, sha256 3a760944…)
  - `districts.8edd1bf95e5bfeec.parquet` (790 rows, sha256 8edd1bf9…)
  - `subdistricts.17ca75d9c4f1b13b.parquet` (7,112 rows, sha256 17ca75d9…)
- Telugu / Hindi names: the "Name (In Local)" columns of the LGD exports published by planemad
  (https://gist.github.com/planemad/b2195c7feb506f8436659f36da1e58af and
  https://gist.github.com/planemad/cd6b523725c4d8d46712639302edf6e4). A local name is used only when the
  LGD code AND the English name still match today's dump; Telugu script only for Andhra Pradesh /
  Telangana, Devanagari only for Hindi-speaking states. 581 sub-districts have a Telugu name and 925 a
  Hindi name; everything else shows the English LGD name.

Names are LGD's own spelling (a trailing `*`, LGD's marker on some new units, is removed).
The sub-district level name per state follows the Census of India 2011 terms
(`scripts/lgd/build-locations.py`, `LEVEL`).

## Known gaps (as in LGD itself)

- **Mumbai** (Maharashtra) and **Kolkata** (West Bengal) have no sub-districts in LGD (fully urban
  districts). The picker shows the district only; `__tests__/locations.test.ts` lists them explicitly.

## Regenerate

```
pip install pyarrow
# download states.*.parquet, districts.*.parquet, subdistricts.*.parquet from
# https://ramseraph.github.io/opendata/lgd/data/metadata.json (+ the two gist CSVs) into ~/lgd
python3 scripts/lgd/build-locations.py --lgd ~/lgd --local ~/lgd --observed YYYY-MM-DD
```

Update the date + counts above when you do.
