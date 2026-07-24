# QUANTUMEXE POS

**Architecture (what you asked for)**

| Layer | Service |
|-------|---------|
| **Hosting (web + API)** | **Vercel** |
| **Database** | **Firebase Firestore** |

No Neon. Firebase Hosting is optional / not required.

## Local

```bash
npm install
# apps/api/.env — Firebase Admin credentials (see below)
npm run db:seed -w apps/api
npm run dev
```

- Web http://localhost:5173 · API http://localhost:4000  
- Login `0771234567` / `123456`

## Vercel deploy

1. Link repo / `npx vercel`
2. Project → Settings → Environment Variables:

```
FIREBASE_PROJECT_ID=quantumexe-pos
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@quantumexe-pos.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
JWT_SECRET=any-long-random-string
```

3. Deploy, then seed once:

```bash
curl -X POST https://YOUR-APP.vercel.app/api/setup/seed
```

### Service account key blocked by org?

Firebase console → Generate private key fails with org policy. Then either:

- Ask org admin to allow service account keys for this project, **or**
- Create the Firebase project under a **personal Gmail** (not company Workspace) and use that key

## Firebase console (DB only)

- Enable **Firestore** on project `quantumexe-pos`
- You do **not** need Firebase Hosting or Blaze for the Vercel setup
