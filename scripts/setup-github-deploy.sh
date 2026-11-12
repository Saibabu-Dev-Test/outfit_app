#!/usr/bin/env bash
# One-time setup (run in Google Cloud Shell as the project owner, babusai927@gmail.com):
#   curl -sL https://raw.githubusercontent.com/Saibabu-Dev-Test/outfit_app/main/scripts/setup-github-deploy.sh | bash
# Lets GitHub Actions (.github/workflows/firebase-deploy.yml) deploy Firestore rules/indexes and
# Hosting with NO stored key: Workload Identity Federation trusts only this repo's workflows.
set -euo pipefail
P=outfit-vote-9edca
REPO=Saibabu-Dev-Test/outfit_app
SA=github-deployer
POOL=github
PROV=github-oidc
gcloud config set project "$P" >/dev/null
NUM=$(gcloud projects describe "$P" --format='value(projectNumber)')
SA_EMAIL="$SA@$P.iam.gserviceaccount.com"
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  firebaserules.googleapis.com firebasehosting.googleapis.com firestore.googleapis.com \
  cloudresourcemanager.googleapis.com serviceusage.googleapis.com --project "$P"
gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA" --display-name "GitHub Actions deploy ($REPO)"
for R in roles/firebaserules.admin roles/firebasehosting.admin roles/datastore.indexAdmin \
         roles/serviceusage.serviceUsageConsumer roles/firebase.viewer; do
  gcloud projects add-iam-policy-binding "$P" --member "serviceAccount:$SA_EMAIL" --role "$R" \
    --condition=None --quiet >/dev/null
done
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe "$PROV" --location global \
  --workload-identity-pool "$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROV" --location global \
    --workload-identity-pool "$POOL" --display-name "GitHub OIDC" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$REPO'"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$NUM/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" \
  --quiet >/dev/null
echo "WIF_PROVIDER=projects/$NUM/locations/global/workloadIdentityPools/$POOL/providers/$PROV"
echo "SERVICE_ACCOUNT=$SA_EMAIL"
echo "GITHUB DEPLOY SETUP OK"
