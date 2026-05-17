# Firebase / Firestore setup for Cortex

Use Firebase for **shared config across machines** and (later) **online app data**. Secrets must never be readable from the browser client.

## 1. Firebase console

1. Open [Firebase console](https://console.firebase.google.com/) → your project.
2. **Build → Firestore Database** → create database (production mode recommended).
3. Start in a region close to you (e.g. `us-central1`).

## 2. Service account (backend + sync script only)

1. **Project settings → Service accounts** → **Generate new private key** (JSON).
2. Save the download as `backend/firebase-service-account.json` (gitignored; see `firebase-service-account.json.example` for shape).
3. In `backend/.env`, set project id and **uncomment** credentials only after the file exists:

```env
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
FIRESTORE_ENV_DOC=cortex_config/env
```

If `GOOGLE_APPLICATION_CREDENTIALS` points at a missing file, Cortex will **not** call Firestore (avoids ENOENT crashes). Check `GET /api/health` → `firebase.error` for the exact path expected.

Alternatively set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` instead of the JSON path.

## 3. Store shared env in Firestore

Create document **`cortex_config/env`** (collection + doc id match `FIRESTORE_ENV_DOC`).

Fields are **flat string keys** matching `backend/.env` names, e.g. `JWT_SECRET`, `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, …

Do **not** expose this collection to web/mobile clients. Example rules:

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

Writes `backend/.env` from Firestore.

Push local `.env` up (trusted machine only):

```bash
npm run sync:env:push
```

## 5. API (authenticated)

- `GET /api/firebase/status` — Admin SDK + Firestore reachability
- `POST /api/firebase/env/pull` — pull Firestore → `.env` (dev; blocked in production unless `ALLOW_FIREBASE_ENV_SYNC=true`)
- `POST /api/firebase/env/push` — push `.env` → Firestore

## 6. Next phases

See `docs/GOALS.md` Phase 0: user settings, tasks, OAuth tokens in Firestore; Firebase Auth; link-first distribution.
