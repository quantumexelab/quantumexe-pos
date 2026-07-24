# QUANTUMEXE POS

## Working setup (`info@quantumexe.com`, no service-account JSON key)

Org policy blocks downloading keys. So we use:

| Layer | Where |
|-------|--------|
| **Database** | Firebase Firestore |
| **API** | Firebase Cloud Functions (default credentials — **no JSON key**) |
| **Website** | Vercel |

### 1) Upgrade Firebase to Blaze (you must click)

https://console.firebase.google.com/project/quantumexe-pos/usage/details  
→ **Modify plan** → **Blaze**

(Free quota exists; light demo use is usually $0.)

### 2) Deploy API (Cloud Functions + Hosting rewrite)

```bash
npx firebase login
npx firebase use quantumexe-pos
npx firebase deploy --only functions,hosting,firestore
```

API URL: `https://quantumexe-pos.web.app/api/...`

### 3) Vercel (frontend only)

Environment variable:

```
VITE_API_BASE=https://quantumexe-pos.web.app
```

(Do **not** put `/api` at the end.)

Redeploy Vercel. Then seed once:

```bash
curl -X POST https://quantumexe-pos.web.app/api/setup/seed
```

Login: `0771234567` / `123456`

---

## Why not the JSON key?

Company org policy still blocks `Generate private key`.  
Cloud Functions run **inside Google**, so Admin SDK works **without** that download.
