# QUANTUMEXE POS

Full-stack POS (React + Express + PostgreSQL/Prisma).

## Quick start (local)

```bash
# 1) Start Postgres
docker compose up -d

# 2) Install + DB
npm install
cp .env.example apps/api/.env   # or use the default apps/api/.env
npm run db:push
npm run db:seed
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000

### Default login

- Username: `0771234567`
- Password: `123456`

## Deploy on Vercel

1. Create a free [Neon](https://neon.tech) Postgres database and copy `DATABASE_URL`.
2. In Vercel project → Settings → Environment Variables, add:
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = a long random string
3. Deploy (CLI or GitHub import), then seed once:

```bash
DATABASE_URL="your-neon-url" npm run db:push
DATABASE_URL="your-neon-url" npm run db:seed
```

Or connect the GitHub repo `quantumexelab/quantumexe-pos` in the Vercel dashboard.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + web concurrently |
| `npm run db:reset` | Reset DB + seed |
| `npm run test:e2e` | Playwright smoke |
| `npm run test:smoke` | API smoke |

## Modules

Dashboard, POS, Sales/Returns, Quotation, Stock, GRN, Products, Suppliers, Customers, Users, Employees, Accounts, Reports, Settings, Backup.
