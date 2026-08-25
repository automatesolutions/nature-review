# Deploy Review Inbox to GCP Cloud Run

Project: **Natura Labs FB Page Review**  
Project ID: `natura-labs-fb-page-review`  
Org: `naturalabs.io`

Do **not** set `AUTH_DEV_BYPASS` on Cloud Run. Production uses Google Workspace (`@naturalabs.io`) plus `INGEST_SECRET` for n8n.

Suggested region (Philippines / UTC+8): `asia-southeast1`

This repo includes a root [`cloudbuild.yaml`](../cloudbuild.yaml): a push to GitHub builds `review-app/` and deploys Cloud Run service `review-inbox`.

---

## GitHub auto-deploy (do this)

1. Push this repo to GitHub (`main`).
2. Finish **Firestore**, **Artifact Registry**, **Secret Manager**, and **IAM** below (sections 1–5) **before** the first Cloud Build. The YAML maps secret *names*; the secrets must already exist.
3. Cloud Run Overview → **Connect repository**.
4. Install the **Google Cloud Build** GitHub App and select this repo / `main`.
5. Build configuration: **Dockerfile** at `/Dockerfile` (repository root), **or** Cloud Build configuration file `/cloudbuild.yaml`.
   - The Next.js app is in `review-app/`. The root `Dockerfile` copies from that folder so Cloud Run’s default trigger (`/workspace/Dockerfile`) works.
6. Service name `review-inbox`, region `asia-southeast1`. Later builds reuse that service.
7. After the first green build, copy the `*.run.app` URL into Google OAuth (origin + `/api/auth/callback/google`) and:

```powershell
gcloud run services update review-inbox `
  --region asia-southeast1 `
  --update-env-vars "AUTH_URL=https://review-inbox-xxxxx-as.a.run.app"
```

`--update-env-vars` in `cloudbuild.yaml` does not wipe `AUTH_URL`.

If Connect repository fails, use **Cloud Build → Triggers → Create trigger** → GitHub → config file `cloudbuild.yaml` on `main`.

---

## 0. One-time on your PC

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. In PowerShell:

```powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project natura-labs-fb-page-review
```

Confirm: `gcloud config get-value project`

---

## 1. Enable APIs

```powershell
gcloud services enable `
  run.googleapis.com `
  artifactregistry.googleapis.com `
  cloudbuild.googleapis.com `
  secretmanager.googleapis.com `
  firestore.googleapis.com `
  iam.googleapis.com
```

---

## 2. Firestore (required — Cloud Run has no persistent JSON file)

Console: **Firestore** → **Create database** → **Native mode** → region `asia-southeast1` (or same as Cloud Run).

Or:

```powershell
gcloud firestore databases create --location=asia-southeast1
```

---

## 3. Artifact Registry

```powershell
gcloud artifacts repositories create review-inbox `
  --repository-format=docker `
  --location=asia-southeast1 `
  --description="Natura Review Inbox"
```

---

## 4. Secrets

Generate a session secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create secrets (replace values). Use the **same** `INGEST_SECRET` and `N8N_APPROVE_WEBHOOK` you already use locally.

```powershell
echo -n "PASTE_AUTH_SECRET" | gcloud secrets create AUTH_SECRET --data-file=-
echo -n "PASTE_GOOGLE_CLIENT_ID.apps.googleusercontent.com" | gcloud secrets create AUTH_GOOGLE_ID --data-file=-
echo -n "PASTE_GOOGLE_CLIENT_SECRET" | gcloud secrets create AUTH_GOOGLE_SECRET --data-file=-
echo -n "PASTE_INGEST_SECRET" | gcloud secrets create INGEST_SECRET --data-file=-
echo -n "https://naturalabs.app.n8n.cloud/webhook/approval-router" | gcloud secrets create N8N_APPROVE_WEBHOOK --data-file=-
```

**Google OAuth (Web client)** — GCP **APIs & Services** → **Credentials** → **Create OAuth client ID** → **Web application**.

After Cloud Run exists you will add:

- Authorized JavaScript origins: `https://REVIEW-INBOX-xxxxx-as.a.run.app`
- Redirect URI: `https://REVIEW-INBOX-xxxxx-as.a.run.app/api/auth/callback/google`

Consent screen: **External** is OK on a trial project. Restrict emails with Cloud Run env `AUTH_ALLOWED_EMAIL_DOMAIN=naturalabs.io`. Add OAuth **test users**. Scopes `openid email profile`.

You can create the OAuth client first with a placeholder, then edit URIs after the first deploy.

---

## 5. IAM for Cloud Run → Firestore and secrets

```powershell
$PROJECT="natura-labs-fb-page-review"
$PROJECT_NUMBER=(gcloud projects describe $PROJECT --format="value(projectNumber)")
$SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT `
  --member="serviceAccount:$SA" `
  --role="roles/datastore.user"

foreach ($name in @("AUTH_SECRET","AUTH_GOOGLE_ID","AUTH_GOOGLE_SECRET","INGEST_SECRET","N8N_APPROVE_WEBHOOK")) {
  gcloud secrets add-iam-policy-binding $name `
    --member="serviceAccount:$SA" `
    --role="roles/secretmanager.secretAccessor"
}
```

Cloud Build (GitHub) needs to push images and deploy Cloud Run:

```powershell
$CB="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT `
  --member="serviceAccount:$CB" `
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT `
  --member="serviceAccount:$CB" `
  --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding $SA `
  --member="serviceAccount:$CB" `
  --role="roles/iam.serviceAccountUser"
```

---

## 6. Build and deploy

From the **`review-app`** folder:

```powershell
cd "C:\Users\jonel\OneDrive\Desktop\Jonel_Projects\Natura_Labs\Natura Review\review-app"

$PROJECT="natura-labs-fb-page-review"
$REGION="asia-southeast1"
$IMAGE="$REGION-docker.pkg.dev/$PROJECT/review-inbox/app:latest"

gcloud builds submit --tag $IMAGE

# First deploy: AUTH_URL can be a placeholder; update after you have the run.app URL.
gcloud run deploy review-inbox `
  --image $IMAGE `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080 `
  --set-env-vars "STORE=firestore,AUTH_TRUST_HOST=true,GOOGLE_CLOUD_PROJECT=$PROJECT" `
  --set-secrets "AUTH_SECRET=AUTH_SECRET:latest,AUTH_GOOGLE_ID=AUTH_GOOGLE_ID:latest,AUTH_GOOGLE_SECRET=AUTH_GOOGLE_SECRET:latest,INGEST_SECRET=INGEST_SECRET:latest,N8N_APPROVE_WEBHOOK=N8N_APPROVE_WEBHOOK:latest"
```

Copy the service URL, e.g. `https://review-inbox-xxxxx-as.a.run.app`.

Update OAuth origins/redirect to that URL, then:

```powershell
gcloud run services update review-inbox `
  --region asia-southeast1 `
  --update-env-vars "AUTH_URL=https://review-inbox-xxxxx-as.a.run.app"
```

Open that URL, sign in with **@naturalabs.io**.

`--allow-unauthenticated` only means Cloud Run IAM is public. The app still requires Google for humans. n8n uses `x-ingest-secret`.

---

## 7. Point n8n at Cloud Run (drop ngrok)

Persona HTTP Request URL:

`https://review-inbox-xxxxx-as.a.run.app/api/inbox`

Header `x-ingest-secret` = production `INGEST_SECRET`.

Approve webhook stays:

`https://naturalabs.app.n8n.cloud/webhook/approval-router`

---

## 8. Optional custom domain

Cloud Run → **Manage custom domains** → `review.naturalabs.io` (or similar) → Cloud DNS + managed cert.

Then update OAuth origins and `AUTH_URL` to `https://review.naturalabs.io`.

---

## Console clicks (if you prefer UI)

1. Select project **Natura Labs FB Page Review**.
2. **Firestore** → create Native DB.
3. **Artifact Registry** → Docker repo `review-inbox` in `asia-southeast1`.
4. **Secret Manager** → add the five secrets.
5. **Cloud Run** → **Connect repository** → Cloud Build config `/cloudbuild.yaml` (preferred). Manual: **Deploy container** after `gcloud builds submit`.
6. Container port **8080**. Env: `STORE=firestore`, `GOOGLE_CLOUD_PROJECT=natura-labs-fb-page-review`, `AUTH_TRUST_HOST=true`. Map secrets as above.

Do **not** use **Deploy an application** → App Engine unless you rewrite the app. This Dockerfile is for **Cloud Run**.

---

## Free trial notes

Cloud Run + Firestore fit a $300 trial if you keep min instances at **0**. After trial ends, billing must be enabled or the service stops.
