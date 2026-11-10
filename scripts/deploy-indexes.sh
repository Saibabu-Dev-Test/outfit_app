#!/usr/bin/env bash
# Creates every composite index in firestore.indexes.json on outfit-vote-9edca (run in Google Cloud Shell as a project owner).
set -uo pipefail
P=outfit-vote-9edca
curl -sfL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/firestore.indexes.json -o /tmp/firestore.indexes.json
T=$(gcloud auth print-access-token)
python3 - "$P" "$T" <<'PY'
import json,sys,urllib.request,urllib.error
P,T=sys.argv[1],sys.argv[2]
idx=json.load(open('/tmp/firestore.indexes.json')).get('indexes',[])
ok=exist=fail=0
for i in idx:
    url=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/collectionGroups/{i['collectionGroup']}/indexes"
    body={"queryScope":i.get("queryScope","COLLECTION"),"fields":[{"fieldPath":f["fieldPath"],**({"order":f["order"]} if "order" in f else {"arrayConfig":f["arrayConfig"]})} for f in i["fields"]]}
    req=urllib.request.Request(url,data=json.dumps(body).encode(),method="POST",headers={"Authorization":"Bearer "+T,"Content-Type":"application/json","x-goog-user-project":P})
    name=i['collectionGroup']+": "+", ".join(f["fieldPath"] for f in i["fields"])
    try:
        urllib.request.urlopen(req); ok+=1; print("CREATED",name)
    except urllib.error.HTTPError as e:
        msg=e.read().decode()
        if e.code==409 or "ALREADY_EXISTS" in msg: exist+=1; print("EXISTS ",name)
        else: fail+=1; print("FAILED ",name,e.code,msg[:200])
print(f"INDEXES DONE: created={ok} existing={exist} failed={fail}")
PY
