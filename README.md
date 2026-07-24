# QUANTUMEXE POS

Full-stack POS — React + Express + **Firebase Firestore** (no Neon).

## Stack

- **Web:** Vite React → Firebase Hosting
- **API:** Express → Firebase Cloud Functions
- **DB:** Cloud Firestore (`apps/api/src/fsdb.ts`)

## Local development

1. Create a Firebase project in [Firebase Console](https://console.firebase.google.com)
2. Enable **Firestore**
3. Download a service account key (Project settings → Service accounts)
4. Set env in `apps/api/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
JWT_SECRET=quantumexe-dev-secret
```

5. Install + seed + run:

```bash
npm install
npm run db:seed -w apps/api
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- Login: `0771234567` / `123456`

## Deploy (Firebase)

```bash
npx firebase login
npx firebase use your-project-id
npm install --prefix functions
npx firebase deploy
```

After first deploy, seed Firestore once (local with service account):

```bash
npm run db:seed -w apps/api
```

## Demo login

- Username: `0771234567`
- Password: `123456`
