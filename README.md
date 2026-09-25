<img width="666" height="290" alt="Group 437" src="https://github.com/user-attachments/assets/7b787681-f786-45c6-9e22-12ac520ed1a7" />
# Wanderly

A full-stack travel agency website — landing page, destinations directory, contact
and trip-request forms, an admin dashboard, and image uploads, all backed by a real
database.

Built from your design (colors, layout, copy) and extended with a working backend,
a full destinations page, a "Plan my trip" flow, a newsletter signup, and an admin
panel to manage all of it.

## Stack

- **Backend:** Node.js, no framework — the built-in `node:http` server, with one
  real dependency: [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts).
  That single client talks to either a local SQLite file (zero setup, for
  development) or a remote [Turso](https://turso.tech) database (for production,
  on hosts whose filesystem doesn't persist across restarts/redeploys) — same code,
  just an env var to switch.
- **Frontend:** Vanilla HTML / CSS / JS. No build step, no bundler — open it, edit
  it, deploy it. All data-driven sections (destinations, testimonials, images) are
  fetched from the API at runtime, not hardcoded, so editing the database is enough
  to update the site.
- **Database:** libSQL via `@libsql/client` — a local file at `server/data/wanderly.db`
  by default, or a remote Turso database when `DATABASE_URL` / `DATABASE_AUTH_TOKEN`
  are set. Schema lives in `server/db/schema.sql` and is applied by `npm run migrate`.

## Run it locally

```bash
npm install                                   # installs the one dependency, @libsql/client
npm run migrate                               # creates the local SQLite file + schema
npm run seed                                  # populates destinations + testimonials (safe to re-run)
npm run create-admin -- <username> <password> # create your admin login (password: 8+ chars)
npm start                                     # starts the server on http://localhost:3000
```

Requires Node.js 20.6+ (for `--env-file`). Check with `node -v`.

Copy `.env.example` to `.env` to override the port, point at a remote Turso database,
or change the admin session length — none of it is required to run locally.

## Admin dashboard

A password-protected admin panel lives at **`/admin/login.html`**. From there you can:

- Add, edit, and delete **destinations** (what shows on the homepage and directory)
- Add, edit, and delete **testimonials** (homepage carousel)
- Upload and remove **images** (stored in the database as blobs, served from `/api/images/:id`)
- Read and update the status of **contact messages** and **trip requests**, and delete them
- View and remove **newsletter subscribers**
- See at-a-glance counts and recent activity on the Overview page

Create your login with `npm run create-admin -- <username> <password>` — re-running it
with the same username resets that password. There's no self-serve "forgot password"
flow; resetting it is always done from the command line on the server.

How it works, if you're curious: `POST /api/admin/login` checks the username/password
(hashed with `scrypt`, no plaintext ever stored) and sets an `HttpOnly`, `SameSite=Strict`
session cookie. Sessions live in memory on the server (`server/auth.js`), so restarting
the server logs everyone out — a deliberate trade-off to keep this dependency-free.
Every write-capable `/api/admin/*` route checks that cookie server-side; the admin page
itself doesn't leak any data on its own, all real data comes from those protected
endpoints. Login attempts are rate-limited (6 per 5 minutes per IP).

## Project structure

```
wanderly/
  server/
    index.js        — HTTP server entrypoint
    config/env.js    — reads PORT, DATABASE_URL, DATABASE_AUTH_TOKEN, SESSION_TTL_MS
    db/
      client.js      — libSQL client (local file or Turso, based on env)
      schema.sql     — table definitions
      migrate.js     — applies schema.sql
      query.js       — thin query helper
    lib/
      http.js        — JSON responses + static file serving
      logger.js       — request logging
      rateLimit.js    — in-memory fixed-window rate limiter
      validate.js     — shared input validation helpers
    middleware/
      requireAdmin.js — session-cookie auth guard for admin routes
    routes/
      public.js            — destinations, testimonials, images, contact, trip-requests, newsletter
      adminAuth.js         — login / logout / current admin
      adminStats.js        — dashboard counts + recent activity
      adminDestinations.js — CRUD for destinations
      adminTestimonials.js — CRUD for testimonials
      adminLeads.js        — contact messages, trip requests, newsletter subscribers
      adminImages.js       — image upload / delete
    auth.js          — password hashing + session/cookie handling
    create-admin.js  — CLI to create/reset the admin login
    seed.js          — seed data for destinations & testimonials
    data/            — local SQLite file lives here (gitignored)
  public/
    index.html         — landing page
    destinations.html  — full destinations directory (search + filter)
    404.html
    css/
      tokens.css  — design tokens (colors, type, spacing)
      style.css   — all component + layout styles
    js/
      main.js         — nav, modal, forms, carousel, scroll reveals
      destinations.js — search/filter logic for the directory page
    images/       — logo files
    admin/
      login.html          — admin sign-in
      index.html          — admin dashboard shell
      css/admin.css
      js/admin.js         — dashboard SPA logic (routing, tables, modals)
      js/admin-login.js   — login form logic
  tests/
    api.test.js      — spins up the server against a temp SQLite file and hits the API
    validate.test.js — unit tests for the validation helpers
```

## API

| Method | Route                     | Purpose                          |
|--------|---------------------------|-----------------------------------|
| GET    | `/api/destinations`       | all destinations (`?featured=true` for the homepage set) |
| GET    | `/api/destinations/:slug` | one destination                  |
| GET    | `/api/testimonials`       | all testimonials                 |
| GET    | `/api/images/:id`         | serves an uploaded image by id   |
| POST   | `/api/contact`            | contact form → saved to `contact_messages` |
| POST   | `/api/trip-requests`      | "Plan my trip" form → saved to `trip_requests` |
| POST   | `/api/newsletter`         | footer signup → saved to `newsletter_subscribers` |

All POST routes validate input server-side and return `422` with a `fields` object
on bad input, `429` if you hit the (very light) rate limit, `201` on success.

### Admin API (all require a valid session cookie — see "Admin dashboard" above)

| Method           | Route                                | Purpose                                |
|------------------|----------------------------------------|-------------------------------------------|
| POST             | `/api/admin/login`                    | sign in, sets session cookie           |
| POST             | `/api/admin/logout`                   | clears session cookie                  |
| GET              | `/api/admin/me`                       | current admin username                 |
| GET              | `/api/admin/stats`                    | dashboard counts                       |
| GET              | `/api/admin/activity`                 | recent admin activity                  |
| POST/PUT/DELETE  | `/api/admin/destinations[/:id]`       | create / update / delete a destination |
| POST/PUT/DELETE  | `/api/admin/testimonials[/:id]`       | create / update / delete a testimonial |
| GET/PATCH/DELETE | `/api/admin/contact-messages[/:id]`   | list / update status / delete          |
| GET/PATCH/DELETE | `/api/admin/trip-requests[/:id]`      | list / update status / delete          |
| GET/DELETE       | `/api/admin/newsletter[/:id]`         | list / remove a subscriber             |
| POST/DELETE      | `/api/admin/images[/:id]`             | upload / delete an image (JPEG, PNG, WebP, or AVIF; ~3MB max) |

Right now submissions just land in the database — nobody emails you automatically.
To wire up real email notifications later, the cleanest path is adding `nodemailer`
(`npm install nodemailer`) inside the `/api/contact` and `/api/trip-requests` handlers
in `server/routes/public.js` — everything else is already structured to make that a
small change.

## Images

Images are uploaded through the admin dashboard and stored directly in the database
as blobs (`images` table), served back at `/api/images/:id`. There's no filesystem
step and no separate object storage account to manage — destinations, testimonials,
and any other image field just point at that URL. Logo files (`logo.svg`,
`logo-white.svg`, `logo.png`) are the only images still served as static files, from
`public/images/`.

## Testing

```bash
npm test
```

Runs `tests/api.test.js` (spins up the server against a temporary SQLite database
and exercises the API end-to-end) and `tests/validate.test.js` (unit tests for the
shared validation helpers), using Node's built-in test runner.

## Deploying

Since there's no build step, most Node-friendly hosts (Render, Railway, Fly.io, a VPS)
work by running `npm install && npm run migrate && npm run seed && npm start`. Set
`PORT` if your host requires it — the server already reads it.

On a host with an ephemeral filesystem (e.g. Render's free tier), the local SQLite
file gets wiped on every restart/redeploy. Point the app at a
[Turso](https://turso.tech) database instead so data persists:

1. `turso db create wanderly`
2. Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (from `turso db show` / `turso db tokens create`) as environment variables on your host
3. Run `npm run migrate` once against that database, then `npm run create-admin -- <username> <password>`

For GitHub: everything in this folder is ready to push as-is. `.gitignore` already
excludes the local database and `node_modules`.

## License

MIT — see [LICENSE](LICENSE).
