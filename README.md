# Afturk Backend

Node.js + Express backend for the Afturk food delivery platform — customer,
vendor, rider, and admin all talk to this one API.

## Stack
- **Express** — API server
- **Prisma + PostgreSQL** — database and schema
- **JWT** — auth (role-based: CUSTOMER, VENDOR, RIDER, ADMIN)
- **Paystack** — payments, splits, and payouts
- **node-cron** — scheduled vendor/rider payout jobs

## 1. Install dependencies
```bash
npm install
```

## 2. Set up your database
You need a PostgreSQL database (free options: [Neon](https://neon.tech),
[Supabase](https://supabase.com), or [Railway](https://railway.app)).

Copy `.env.example` to `.env` and fill in:
```bash
cp .env.example .env
```
- `DATABASE_URL` — your Postgres connection string
- `JWT_SECRET` — any long random string
- `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` — from your Paystack dashboard (test mode keys to start)
- `PAYSTACK_WEBHOOK_SECRET` — same as your secret key unless Paystack gives you a dedicated one

## 3. Create the database tables
```bash
npx prisma migrate dev --name init
```
This reads `prisma/schema.prisma` and creates every table (users, vendors,
riders, orders, earnings, applications, etc.) in your database.

## 4. Run it
```bash
npm run dev
```
Server starts on `http://localhost:4000`. Check `GET /health` to confirm it's up.

## 5. Connect Paystack's webhook
In your Paystack dashboard, set the webhook URL to:
`https://your-deployed-domain.com/payments/webhook`
(Paystack can't reach `localhost`, so use a tool like [ngrok](https://ngrok.com)
while testing locally, or point it at your real deployment.)

## How the pieces fit together

| Route | Who calls it | What it does |
|---|---|---|
| `POST /applications` | Vendor/rider sign-up forms | Submits a pending application |
| `GET /admin/applications` | Admin dashboard | Lists pending/approved/declined applications |
| `PATCH /admin/applications/:id/approve` | Admin dashboard | Creates the Vendor/Rider account + login |
| `POST /orders` | Customer app | Places an order, starts Paystack checkout |
| `POST /payments/webhook` | Paystack | Confirms payment, creates vendor/rider earnings |
| `PATCH /orders/:id/advance` | Vendor/rider app | Moves an order through its status pipeline |
| `POST /admin/payouts/vendors/run` | Cron (nightly) or admin | Pays out all vendors with available earnings |
| `POST /admin/payouts/riders/run` | Cron (weekly) or admin | Pays out all riders with available earnings |
| `POST /admin/payouts/riders/manual` | Admin dashboard | One-off emergency payout for a single rider |
| `POST /admin/commission-rules` | Admin dashboard | Updates vendor %, rider %, service fee |

## What's stubbed vs. real

- **Paystack transfers** (`initiateTransfer` calls in `payoutService.js`) are
  commented out — uncomment once you've created transfer recipients for each
  vendor/rider (`createTransferRecipient` in `paystackService.js`) during their
  onboarding, so you have a `recipientCode` to pay out to.
- **Refunds** are noted in `cancelOrder` but not wired to Paystack's refund
  endpoint yet — add that call once you decide your refund policy.
- **SMS/email** for sending approved vendors/riders their temp password isn't
  included — the API currently returns it directly in the approval response.

## Next steps
1. Deploy this somewhere (Render, Railway, Fly.io all have free tiers to start)
2. Point the vendor/rider registration forms and admin dashboard at your deployed URL
3. Add refund handling and transfer recipient creation before going live with real payouts
