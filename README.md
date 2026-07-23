# REOX POS Clone

Full-stack POS clone (React + Express + SQLite/Prisma) with modules matching the ReoX demo feature map.

## Quick start

```bash
cd C:\Users\p\Projects\reox-pos-clone
npm install
npm run db:push -w apps/api
npm run db:seed -w apps/api
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000

### Default login

- Username: `0771234567`
- Password: `123456`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | API + web concurrently |
| `npm run db:reset -w apps/api` | Reset SQLite DB + seed |
| `npm run test:e2e -w apps/web` | Playwright smoke (login → POS sale) |
| `npm run test:smoke` | API smoke (login → dashboard → sale) |

## Modules

Dashboard, POS, Sales/Returns, Quotation, Stock, GRN, Products, Suppliers, Customers, Users, Employees, Accounts, Reports, Settings, Backup.
