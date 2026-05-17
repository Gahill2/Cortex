# Firebase / Firestore setup for Cortex

Use Firebase for **shared config across machines** and (later) **online app data**. Secrets must never be readable from the browser client.

## 1. Firebase console

1. Open [Firebase console](https://console.firebase.google.com/) → your project.
2. **Build → Firestore Database** → create database (production mode recommended).
3. Start in a region close to you (e.g. `us-central1`).

## 2. Service account (backend + sync script only)

1. **Project settings → Service accounts** → **Generate new private key** (JSON).
2. Save as e.g. `backend/firebase-service-account.json` (already gitignored via `*.json` patterns — verify it is **not** committed).
3. In `backend/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
FIRESTORE_ENV_DOC=cortex_config/env
```

Alternatively set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` instead of the JSON path.

## 3. Store shared env in Firestore

Create document **`cortex_config/env`** (collection + doc id match `FIRESTORE_ENV_DOC`).

Fields are **flat string keys** matching `backend/.env` names, e.g.:

- `JWT_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, …

Do **not** expose this collection to web/mobile clients. Use **Firestore rules** that deny all client reads on `cortex_config`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /cortex_config/{doc} {
      allow read, write: if false;
    }
  }
}
```

Only the **Node backend** (Admin SDK) or the **sync script** reads/writes this doc.

## 4. Pull env on each dev machine

From `backend/`:

```bash
npm run sync:env:pull
```

Writes/overrides `backend/.env` from Firestore (keeps local-only keys if you add `SYNC_ENV_PRESERVE_LOCAL=true` later).

Push local `.env` **up** to Firestore (trusted machine only):

```bash
npm run sync:env:push
```

## 5. API health

`GET /api/firebase/status` — reports whether Admin SDK is configured and can reach Firestore.

## 6. Next phases (not done yet)

- User prefs / dashboard layout in Firestore.
- Notion / Canva / OpenClaw modules wired to backend features.
- Production deploy (Cloud Run / Functions) with secrets in Secret Manager instead of a Firestore env doc.
