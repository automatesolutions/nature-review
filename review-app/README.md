# Natura Labs Review Inbox

Internal web app for reviewing **persona lifestyle posts** (image + caption + Postbridge `mediaId`) before n8n schedules them. Replaces Slack Send-and-Wait.

Personas: Linda Chambers, Becca Rose, Brooke Swift (Montana Tallow), Claire Donovan, Rebecca Lang (Lumerval). This is **not** the Lumerval paid-ad composition gallery.

## Run locally

```bash
cd review-app
cp .env.example .env.local
# set AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, INGEST_SECRET
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a first local test you do **not** need Google: `.env.example` sets `AUTH_DEV_BYPASS=true` (works only with `npm run dev`, not Cloud Run). Sign in with Google later by filling `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and removing the bypass.

Generate `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Local store is `data/inbox.json` (created from seed data on first read). You can edit captions, Approve/Deny, refresh, and change status again. If you edit an **Approved** caption, the card returns to **Pending** until you re-Approve (n8n is not called until Approve).

## Environment variables

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Auth.js session secret |
| `AUTH_URL` | Canonical origin, e.g. `http://localhost:3000` or `https://review.naturalabs.io` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth web client |
| `AUTH_TRUST_HOST` | `true` on Cloud Run |
| `AUTH_ALLOWED_EMAIL_DOMAIN` | Google emails must end with `@` this domain (default `naturalabs.io`). Cloud Run env var, not a secret. |
| `INGEST_SECRET` | Shared secret for n8n `POST /api/inbox` (`x-ingest-secret`) |
| `N8N_APPROVE_WEBHOOK` | Central workflow URL; called on Approve |
| `N8N_DENY_WEBHOOK` | Optional; Deny / Request changes. If unset, those actions use the approve URL with `action` |
| `STORE` | `json` (local) or `firestore` (Cloud Run default when `K_SERVICE` is set) |
| `GOOGLE_CLOUD_PROJECT` | Firestore project |
| `FIRESTORE_DATABASE` | Optional, default `(default)` |

If webhook URLs are empty, status still saves; the app logs a warning (mock mode).

## Google OAuth (Workspace)

1. Google Auth Platform → Audience: **Internal** if this GCP project is in the `naturalabs.io` org; otherwise **External** (typical on a personal free-trial project).
2. If External and still in Testing, add each reviewer under **Audience → Test users**.
3. Scopes: `openid`, `email`, `profile`.
4. Credentials → OAuth 2.0 Client ID → **Web application**.
5. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://review.naturalabs.io`
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://review.naturalabs.io/api/auth/callback/google`
7. Sign-in is rejected unless the Google email is verified and ends with `@AUTH_ALLOWED_EMAIL_DOMAIN` (default `naturalabs.io`). Set that on Cloud Run as a **variable**, not a secret. `hd` is not enough by itself.

If Google shows **Error 401: invalid_client** and the URL contains `client_id=undefined`, `.env.local` is missing `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Client ID looks like `….apps.googleusercontent.com`). Paste both, save, **restart** `npm run dev`. The login page stays disabled until those values exist.

n8n does **not** use Google login.

## Connect existing n8n (Slack Wait → this inbox → Postbridge)

Two hops. The Review Inbox **never** calls Postbridge itself.

```
Persona WF (HF + caption + Merge)
        │  POST /api/inbox  (Pending card)
        ▼
Review Inbox  →  user clicks Approve
        │  POST N8N_APPROVE_WEBHOOK
        ▼
Central WF  →  Persona switch  →  Postbridge Schedule Post
```

Do **not** keep Slack Send-and-Wait on the live path. Do **not** POST to Postbridge from the persona workflow after Merge (that posts unreviewed copy).

### A) Persona workflow (e.g. Montans_PostBridge_HF_BeccaRose)

After **Merge / combine** (caption + CloudFront `imageUrl` + Postbridge `mediaId`):

1. Disconnect **Send message and wait for response** (leave it unused).
2. Point the existing **HTTP Request** (the one after Merge) at the inbox, **not** `api.post-bridge` and **not** Slack.

- Method: `POST`
- URL (local tunnel or Cloud Run): `https://<inbox-host>/api/inbox`
- Headers:
  - `Content-Type: application/json`
  - `x-ingest-secret`: same value as `INGEST_SECRET` in `.env.local`
- Body (JSON, map your Merge fields):

```json
{
  "persona": "Becca Rose",
  "personaKey": "becca_rose",
  "caption": "{{ $json.caption }}",
  "imageUrl": "{{ $json.imageUrl }}",
  "mediaId": "{{ $json.mediaId }}",
  "postType": "lifestyle",
  "runDate": "{{ $now.format('yyyy-MM-dd') }}",
  "weekdayName": "{{ $now.format('ccc') }}"
}
```

Use whatever keys your Merge actually outputs (`caption`, `text`, `url`, `media_id`, etc.). `personaKey` must be exactly one of: `linda_chambers` | `becca_rose` | `brooke_swift` | `claire_donovan` | `rebecca_lang`.

Repeat the same HTTP Request on Linda / Brooke / Claire / Rebecca workflows, only changing `persona` + `personaKey`.

**Local caveat:** n8n in the cloud cannot reach `http://localhost:3000`. Either:

- `ngrok http 3000` (or Cloudflare Tunnel) and use that HTTPS URL in the HTTP Request, or
- ingest only after the app is on Cloud Run (`https://review.naturalabs.io/api/inbox`).

You can still test **Approve → Postbridge** from localhost (step B) without ingest, using cards already in the grid.

### B) Central workflow (Webhook → Persona → Schedule Post)

This is the workflow that today does: Webhook → Slack Wait → **Approved?** → **Persona** → four Postbridge HTTP nodes.

1. Open the **Webhook** node → copy the **Production URL**.
2. Put that URL in the Review Inbox env:

```
N8N_APPROVE_WEBHOOK=https://<your-n8n>/webhook/<id>
```

Restart `npm run dev` after changing env.

3. **Disconnect Slack** “Send message and wait for response”. Connect:

`Webhook` → `Approved?` → `Persona` → Linda / Becca / Brooke / Claire **Schedule Post** (keep those four Postbridge nodes as they are).

4. **Approved?** rules: continue only when

`{{ $json.action }}` equals `approve`

(If the Webhook nests the body, use `{{ $json.body.action }}`. Click **Listen for test event**, Approve one card in the inbox, then pin the incoming JSON so you can see the path.)

5. **Persona** switch: route on `personaKey` (not Slack text):

| Rule | Next node |
|---|---|
| `{{ $json.personaKey }}` = `linda_chambers` | Linda Chambers Schedule Post |
| `{{ $json.personaKey }}` = `becca_rose` | Becca Rose Schedule Post |
| `{{ $json.personaKey }}` = `brooke_swift` | Brooke Swift Schedule Post |
| `{{ $json.personaKey }}` = `claire_donovan` | Claire Donovan Schedule Post |
| `{{ $json.personaKey }}` = `rebecca_lang` | Rebecca Lang Schedule Post |

6. In each Postbridge HTTP body, use the **edited** caption from the inbox:

- caption: `{{ $json.caption }}`
- media id: `{{ $json.mediaId }}`
- image (if required): `{{ $json.imageUrl }}`

Approve payload the inbox sends (`JSON.stringify`, quotes in captions are safe):

```json
{
  "action": "approve",
  "persona": "Claire Donovan",
  "personaKey": "claire_donovan",
  "caption": "<current edited caption>",
  "imageUrl": "https://d3u0tzju9qaucj.cloudfront.net/...",
  "mediaId": "...",
  "comment": "",
  "reviewedAt": "2026-08-24T11:00:00.000Z",
  "reviewedByEmail": "dev@naturalabs.io"
}
```

Deny / Request changes hit the same webhook with `"action": "deny"` or `"changes_requested"` unless you set `N8N_DENY_WEBHOOK`. Those should **not** run Schedule Post (Approved? false path: stop or notify).

### Quick test (no persona WF yet)

1. Set `N8N_APPROVE_WEBHOOK` to the central Webhook Production URL.
2. Restart `npm run dev`.
3. Put the central workflow in **Listen** / production active.
4. In the inbox, Approve a Claire (or any) card.
5. Central WF should run and hit Postbridge with that card’s caption + `mediaId`.

If Approve in the UI succeeds but n8n never fires, the inbox log will say webhook URL missing or `n8n 404` (wrong webhook path / test vs production URL).

## n8n ingest (persona workflow) — field reference

After Merge (image + caption + mediaId), **HTTP Request** instead of Slack Wait:

- Method: `POST`
- URL: `https://review.naturalabs.io/api/inbox`
- Header: `x-ingest-secret` = `INGEST_SECRET`
- Header: `Content-Type: application/json`
- Body (JSON):

```json
{
  "persona": "Claire Donovan",
  "personaKey": "claire_donovan",
  "caption": "Your caption. Quotes are fine.",
  "imageUrl": "https://...",
  "mediaId": "postbridge-media-id",
  "postType": "lifestyle",
  "runDate": "2026-08-24",
  "weekdayName": "Mon"
}
```

Creates a **Pending** row. Brand is inferred from `personaKey` (`claire_donovan` / `rebecca_lang` → Lumerval, others → Montana Tallow).

`personaKey` must be one of: `linda_chambers` | `becca_rose` | `brooke_swift` | `claire_donovan` | `rebecca_lang`.

Always send JSON (n8n JSON body or `JSON.stringify`). Captions with quotes will not break the payload.

## GCP Cloud Run

Step-by-step for project `natura-labs-fb-page-review`: see [DEPLOY-GCP.md](DEPLOY-GCP.md). GitHub auto-deploy uses the repo-root [`cloudbuild.yaml`](../cloudbuild.yaml).

## Swap persistence later

`lib/store` exports `InboxStore` (`list`, `get`, `create`, `update`, `updateMany`). Add `lib/store/supabase.ts` or Airtable and switch `resolveStoreKind()`. No UI change required.

## Out of scope (v1)

Image generation, Higgsfield Souls, caption LLM, Lumerval ad-composition downloads, Postbridge client, Slack Wait.
