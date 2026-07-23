# QUANTUMEXE POS

Full-stack POS (React + Express + PostgreSQL/Prisma) with **Firebase Hosting + Cloud Functions**.

## Architecture (Firebase-friendly)

| Layer | Tech |
|-------|------|
| Frontend | React → **Firebase Hosting** |
| API | Express → **Cloud Functions** (`api`) |
| Database | **PostgreSQL** (Neon free) via `DATABASE_URL` |

> Full Firestore rewrite නෙවෙයි — ඔයාට familiar Firebase deploy එක, තියෙන POS API එකම Functions එකේ run වෙනවා.

## Local development

```bash
# Postgres (Neon URL or local)
# apps/api/.env → DATABASE_URL=...

npm install
npm run db:push
npm run db:seed
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000  
- Login: `0771234567` / `123456`

## Firebase deploy

### 1) One-time setup

1. [Firebase Console](https://console.firebase.google.com) → create project (e.g. `quantumexe-pos`)
2. Upgrade to **Blaze** (pay-as-you-go) — Cloud Functions වලට ඕන (free tier usage තියෙනවා)
3. Enable **Hosting** + **Functions**
4. Create free [Neon](https://neon.tech) Postgres → copy `DATABASE_URL`
5. Update `.firebaserc` project id if different

```bash
npm install -g firebase-tools
firebase login
firebase use quantumexe-pos
```

### 2) Set secrets

```bash
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
```

(Or set in Google Cloud Console → Cloud Functions → environment variables)

Update `functions/src/index.ts` to declare secrets if using Secret Manager — or use `.env` for Firebase:

```bash
firebase functions:config:set  # legacy
# Prefer params / secrets in Gen 2
```

Simplest for first deploy — create `functions/.env`:

```
DATABASE_URL=postgresql://...
JWT_SECRET=your-long-secret
```

Then seed DB once:

```bash
DATABASE_URL="..." npm run db:push
DATABASE_URL="..." npm run db:seed
```

### 3) Deploy

```bash
npm run firebase:deploy
```

Live URL: `https://quantumexe-pos.web.app` (or your project domain)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Local API + web |
| `npm run firebase:deploy` | Build + deploy Hosting + Functions |
| `npm run db:seed` | Seed demo data |
