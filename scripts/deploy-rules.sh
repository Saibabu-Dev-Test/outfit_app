#!/usr/bin/env bash
# Publishes firestore.rules from main to the outfit-vote-9edca Firestore (run in Google Cloud Shell as a project owner).
set -euo pipefail
P=outfit-vote-9edca
API=https://firebaserules.googleapis.com/v1/projects/$P
curl -sfL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/firestore.rules -o /tmp/firestore.rules
head -1 /tmp/firestore.rules
python3 -c "import json;print(json.dumps({'source':{'files':[{'name':'firestore.rules','content':open('/tmp/firestore.rules').read()}]}}))" > /tmp/ruleset.json
T=$(gcloud auth print-access-token)
H=(-H "Authorization: Bearer $T" -H "Content-Type: application/json" -H "x-goog-user-project: $P")
R=$(curl -s -X POST "${H[@]}" -d @/tmp/ruleset.json "$API/rulesets")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('name') or '')")
if [ -z "$N" ]; then echo "RULESET FAILED: $R"; exit 1; fi
echo "Created $N"
curl -s -X PATCH "${H[@]}" -d "{\"release\":{\"name\":\"projects/$P/releases/cloud.firestore\",\"rulesetName\":\"$N\"}}" "$API/releases/cloud.firestore"
echo
echo "RULES PUBLISHED OK"
