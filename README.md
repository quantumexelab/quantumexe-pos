# QUANTUMEXE POS

Hybrid retail POS: **shop PC SQLite (primary)** + **Firestore cloud backup** when online.

## Windows shop PC (recommended) — install like an app

### Build the installer (on your build machine, once)

1. Install [Node.js LTS](https://nodejs.org) (build PC only).
2. In the project folder double-click **`Build-Windows-Installer.bat`**  
   (or run `npm run desktop:dist`).
3. Get the setup file:
   `apps\desktop\release\QUANTUMEXE-POS-Setup-1.0.0.exe`

### Install on any Windows PC

1. Copy the **Setup .exe** to the shop PC.
2. Run it → Next → Install (creates Desktop shortcut).
3. Open **QUANTUMEXE POS** — **no Node.js / npm needed** on the shop PC.
4. Login: `0771234567` / `123456`

Data is stored on that PC under the app user data folder. Optional cloud backup: put a `desktop.env` next to the bundle (see `desktop.env.example` inside resources) with `SYNC_TO_FIRESTORE=1` and Firebase keys.

**Cloud retention:** Master Admin sets “keep cloud data for N months” per shop. The shop PC auto-creates monthly/annual SQLite copies under `backups/archives/`, then may purge Firestore docs older than that window. Local SQLite is never wiped by retention. Archive search runs on the shop PC (not on the Vercel demo).

### Remote updates (from home — no shop visit)

After shops install **v1.0.0+** with auto-update:

1. Change version in [`apps/desktop/package.json`](apps/desktop/package.json) (e.g. `1.0.0` → `1.0.1`).
2. Create a GitHub token with `repo` scope → `set GH_TOKEN=...`
3. Run **`Publish-Update.bat`** (builds + uploads GitHub Release).
4. Shop PC: open app → “Update available” → download → **Restart now**.

Repo used for releases: `quantumexelab/quantumexe-pos`.

---

## Developer / browser mode

```bash
npm install
npm run db:push -w apps/api
npm run db:seed -w apps/api
npm run dev
```

Or double-click **`Start-POS-Dev.bat`**.

- Web: http://localhost:5173  
- API: http://localhost:4000  

### Sync API (local hybrid)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sync/status` | Last push/pull, errors |
| POST | `/api/sync/push` | Push SQLite → Firestore |
| POST | `/api/sync/pull` | Restore cloud → local |

Set in `apps/api/.env`: `SYNC_TO_FIRESTORE=1` + Firebase Admin fields. Leave `USE_FIRESTORE` unset on the shop PC.

---

## Cloud-only demo (Vercel)

https://quantumexe-pos.vercel.app — remote demo. Day-to-day shop sales should use the **Windows installer** so offline works.

### PayHere shop subscriptions (SaaS)

Shop owners pay QUANTUMEXE (default **Rs. 2,000 / month** or **Rs. 20,000 / year**) via [PayHere](https://www.payhere.lk). PayHere charges the card and settles to your merchant bank — the app never stores card numbers.

**Important — public web checkout needs your own domain.**  
PayHere Integrations does **not** allow `*.vercel.app` (subdomains). `localhost` works only for local/dev. Shop owners paying on the live site need a real domain (e.g. `pos.quantumexe.lk` or `quantumexe.lk`) registered in PayHere **and** pointed at Vercel.

1. Buy/use a domain → Vercel project → **Settings → Domains** → add it (HTTPS). Example: **quantumexe.lk**.
2. PayHere (sandbox or live) → **Integrations → Add Domain/App** → enter that **same** domain (no `https://`) → Save → copy the **Merchant Secret** for that row (not the localhost secret).
3. Enable **Recurring** payments for your merchant.
4. On Vercel env (Production):
   - `PAYHERE_MERCHANT_ID`
   - `PAYHERE_MERCHANT_SECRET` (secret for **that** domain)
   - `PAYHERE_MODE=sandbox` (use `live` in production)
   - `PUBLIC_API_BASE` / `PUBLIC_WEB_BASE` / `PAYHERE_RETURN_BASE` / `PAYHERE_CHECKOUT_BASE` = `https://quantumexe.lk`
5. **Redeploy** after changing env.
6. Flow: shop opens POS (even on vercel.app) → Pay → browser goes to `https://quantumexe.lk/api/billing/bridge?…` → auto-POST to PayHere (correct domain Referer).
7. Webhook: `{PUBLIC_API_BASE}/api/billing/webhook`
8. In the app: **Settings → License** or **Pending access** → Monthly/Annual → **PayHere**.
9. Master Admin **Mark paid** remains a manual fallback.

If `quantumexe.lk` already hosts a marketing site on another host, either move the site to `www.quantumexe.lk` and point apex DNS to this Vercel POS project, or ask for help wiring a reverse-proxy path for `/api/billing/*` only.

Local test only: PayHere domain `localhost` + `apps/api/.env` PayHere vars + `npm run dev` → http://localhost:5173.

Optional amounts: `PAYHERE_AMOUNT_MONTHLY`, `PAYHERE_AMOUNT_ANNUAL`.
