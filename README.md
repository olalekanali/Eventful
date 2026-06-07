# Eventful

> **Your passport to a world of unforgettable moments.**
> A production-grade, full-stack event ticketing platform — Node.js, Express, TypeScript, EJS, and MongoDB Atlas.

Eventful is a complete, server-rendered web app for event creators, eventees, and platform admins. Every piece runs on the server: pages are rendered with EJS, forms post normally, and the only client-side JavaScript is a tiny scanner helper. No SPA, no API to call from the browser — just classic, fast, search-engine-friendly HTML.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Roles & Pages](#roles--pages)
4. [Quick Start](#quick-start)
5. [Configuration](#configuration)
6. [Project Structure](#project-structure)
7. [Key Flows](#key-flows)
8. [Best Practices Implemented](#best-practices-implemented)

---

## Features

| Feature | Description |
|---|---|
| **Server-rendered EJS** | Layouts, partials, and reusable templates. Lighting-fast first paint, SEO-friendly, no client-side build step. |
| **Session auth** | MongoDB-backed sessions, bcrypt password hashing, role-based access (eventee / creator / admin). |
| **Event management** | Full CRUD with draft → published → cancelled → completed workflow, search, filters, pagination. |
| **QR-coded tickets** | HMAC-SHA256-signed payloads, tamper-proof, scanned at the entrance. |
| **Paystack payments** | Hosted checkout, callback verification, webhook signature verification, atomic seat reservation. |
| **Smart reminders** | Creator defaults + eventee-set personal reminders, cron worker dispatches emails. |
| **Email notifications** | Ticket confirmations with embedded QR + reminder emails (graceful no-op if SMTP is unconfigured). |
| **Creator analytics** | Tickets sold, unique attendees, revenue, scan rates — overall and per-event. |
| **Admin dashboard** | Platform stats, user management, role changes, event oversight. |
| **Social shareability** | Pre-formatted share URLs for Twitter, Facebook, WhatsApp, LinkedIn, Telegram, email, and copy-to-clipboard. |
| **Production hardening** | Helmet (CSP, HSTS), compression, rate limiting, CSRF-resistant sessions, graceful shutdown, structured logging. |

---

## Tech Stack

- **Runtime:** Node.js 20+ with TypeScript (ES2021 target)
- **Framework:** Express 4
- **Templating:** EJS + express-ejs-layouts
- **Database:** MongoDB Atlas with Mongoose ODM
- **Sessions:** express-session + connect-mongo
- **Auth:** bcryptjs (no native build needed)
- **Payments:** Paystack REST API via Axios
- **Email:** Nodemailer (SMTP)
- **Jobs:** node-cron for reminder dispatch
- **Validation:** express-validator
- **Logging:** Winston
- **Security:** Helmet, express-rate-limit
- **Dev:** ts-node-dev for hot reload

---

## Roles & Pages

### Eventee
- Browse and search events
- View event details and share on social media
- Purchase tickets via Paystack
- View own tickets with QR codes
- Set personal reminders
- Email a ticket to themselves

### Creator
- Everything an eventee can see
- Create / edit / delete events with default reminders
- View per-event analytics
- See full attendee list
- Scan QR tickets at the entrance
- Cross-event creator dashboard with revenue rollups

### Admin
- Everything plus:
- Platform-wide stats
- Browse, search, deactivate users
- Change any user's role
- Browse every event on the platform

---

## Quick Start

### Prerequisites

- **Node.js ≥ 20**
- **MongoDB Atlas account** (free tier works) — https://cloud.mongodb.com
- **Paystack test account** — https://dashboard.paystack.com

### 1. Get a MongoDB Atlas connection string

1. Sign in at https://cloud.mongodb.com
2. Create a free M0 cluster
3. Add a database user with a strong password
4. Under **Network Access**, allow your IP (or `0.0.0.0/0` for development)
5. Click **Connect** on your cluster → **Drivers** → **Node.js**, copy the URI
6. The URI looks like: `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
7. **Insert `/eventful` before the `?`** so it ends as `.mongodb.net/eventful?retryWrites=...`

### 2. Set up the project

```bash
unzip eventful.zip && cd eventful
npm install
cp .env.example .env       # (.env already exists; just edit it)
```

### 3. Fill in `.env`

At minimum:
```
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/eventful?retryWrites=true&w=majority
SESSION_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_SECRET=<same command, different value>
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxx
```

### 4. Run the app

**Development (hot-reload):**
```bash
npm run start:dev
```

**Production:**
```bash
npm run build
npm start
```

Visit: **http://localhost:3000**

You'll land on the home page. Click **Get started** to create a creator or eventee account.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | Atlas connection string with database name |
| `SESSION_SECRET` | ✅ | Used to sign session cookies |
| `JWT_SECRET` | ✅ | Used for QR signing |
| `PAYSTACK_SECRET_KEY` | ✅ | From the Paystack dashboard |
| `PAYSTACK_CALLBACK_URL` | ✅ | Where Paystack redirects after payment (`http://localhost:3000/payments/verify` in dev) |
| `MAIL_*` | ❌ | Optional — emails are logged to console if unset |
| `RATE_LIMIT_*` | ❌ | Optional — defaults to 100 req/min per IP |

---

## Project Structure

```
src/
├── config/                Typed environment config, database connection
├── controllers/           Express route handlers (one file per resource)
├── middlewares/           auth, flash, errors, validate
├── models/                Mongoose schemas: User, Event, Ticket, Payment, Reminder
├── routes/                Express routers, including the webhook route with raw body
├── services/              Business logic: auth, events, tickets, payments, paystack, qrcode, mail, reminders, analytics
├── types/                 Ambient type augmentation (express.d.ts)
├── utils/                 logger, errors, enums, async-handler
├── views/
│   ├── layouts/           main.ejs (page shell)
│   ├── partials/          header, footer, flash, event-card, pagination
│   ├── pages/
│   │   ├── auth/          login, register
│   │   ├── events/        list, show, form
│   │   ├── tickets/       list, show
│   │   ├── payments/      verify, list
│   │   ├── dashboard/     eventee, creator, admin
│   │   ├── creator/       events, analytics, attendees, scanner
│   │   └── admin/         users, events
│   ├── errors/            404, error
│   └── pages/home.ejs     Landing page
├── public/
│   ├── css/main.css       Plain CSS design system
│   ├── js/app.js          Tiny client helpers (copy buttons, flash dismiss)
│   └── images/favicon.svg
├── app.ts                 Express setup, middleware ordering
└── server.ts              Bootstrap, DB connection, cron startup, graceful shutdown
```

---

## Key Flows

### Buying a ticket
1. Eventee browses `/events`, opens an event detail page
2. Submits the quantity form to `POST /payments/initiate`
3. Server atomically reserves seats via `$inc` with conditional `$expr` capacity check
4. Server creates a `Payment` row, calls Paystack `/transaction/initialize`
5. User is redirected to Paystack's hosted checkout
6. After payment, Paystack redirects back to `/payments/verify?reference=...`
7. Server confirms with Paystack `/transaction/verify`, marks payment SUCCESS, generates QR
8. Eventee sees the verify page → links to their new ticket

### Scanning at the venue
1. Creator opens `/tickets/scanner`
2. Pastes the QR payload (from any QR-reading app)
3. Server verifies the HMAC signature with timing-safe compare
4. Confirms the ticket belongs to one of this creator's events
5. Checks status: PAID → marks USED + records `scannedAt`/`scannedBy`
6. Returns `{ valid: true/false, message }` to the inline JS, which colors the result

### Reminders
1. Creator chooses default reminders when creating the event (`["1_week", "1_day"]`)
2. When an eventee buys a ticket, `setupDefaultsForUser()` schedules reminder rows
3. Eventee can layer their own reminders from the ticket page
4. Every minute, the cron worker queries `{ sent: false, fireAt: { $lte: now } }` and dispatches emails

---

## Best Practices Implemented

✅ **Atomic ticket reservation** — `findOneAndUpdate` with a `$expr` capacity check. No overselling under concurrency, no multi-doc transactions needed.

✅ **Session-based auth backed by Mongo** — Sessions persist across server restarts and scale horizontally.

✅ **Webhook signature verification** — Paystack webhook validates `x-paystack-signature` against the raw request body using HMAC-SHA512, mounted before any body parser.

✅ **QR tamper resistance** — HMAC-SHA256 signature in payload, verified with `crypto.timingSafeEqual`.

✅ **Idempotent payment verification** — Both the callback and webhook can run; only the first call finalizes.

✅ **Role-based authorization** — `requireAuth`, `requireRoles`, `requireGuest` middleware composed at the router level.

✅ **Soft deletes** — `deletedAt` field on users and events for audit trail.

✅ **Strong DTO validation** — `express-validator` on every state-mutating endpoint, with flash error feedback.

✅ **Security headers** — Helmet with a tight CSP, HSTS in production, secure cookies behind proxy.

✅ **Rate limiting** — Global limiter + stricter limiter on `/auth/login` and `/auth/register`.

✅ **Graceful shutdown** — SIGTERM/SIGINT close the HTTP server cleanly with a 10s force-exit safety.

✅ **Structured logging** — Winston with JSON in production, color console in dev.

✅ **Type-safe config** — Single `config` object with `required()` validation at startup.

✅ **Method override** — POST forms can express PATCH/DELETE via `_method=PATCH` so plain HTML forms work everywhere.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run start:dev` | Dev with hot reload (ts-node-dev) |
| `npm run build` | Compile TypeScript and copy views + public assets |
| `npm start` | Run the compiled production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## License

MIT
