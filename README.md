<p align="center">
  <img src="https://github.com/user-attachments/assets/e8f146b6-cf1f-4d29-8614-69444b1d3753" width="96" alt="Wanderly logo" />
</p>

<h1 align="center">Wanderly</h1>

<p align="center">
  <b>A full-stack travel agency website, designed and built from scratch.</b><br/>
  Custom Node.js backend · Vanilla frontend · libSQL / Turso database · Admin dashboard
</p>

<p align="center">
  <a href="https://wanderly-wfy4.onrender.com"><b>Live demo →</b></a> ·
  <a href="https://www.behance.net/gallery/228953887/Wanderly-Travel-Brand-Identity-Visual-System-Design"><b>Brand identity on Behance →</b></a>
</p>

<p align="center">
  <a href="https://github.com/roukaiafadla/wanderly/actions/workflows/test.yml"><img src="https://github.com/roukaiafadla/wanderly/actions/workflows/test.yml/badge.svg" alt="Tests" /></a>
  <img src="https://img.shields.io/badge/Node.js-20.6%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20.6+" />
  <img src="https://img.shields.io/badge/database-libSQL%20%2F%20Turso-4FF8D2?logoColor=white" alt="libSQL / Turso" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
</p>

<!--
  SCREENSHOTS: add your images to docs/screenshots/, then remove the opening and closing comment markers around this block.
  <p align="center">
    <img src="docs/screenshots/home.png" alt="Wanderly landing page" width="900" />
  </p>
  <p align="center">
    <img src="docs/screenshots/admin.png" alt="Wanderly admin dashboard" width="900" />
  </p>
-->

---

## Overview

Wanderly is a travel agency website with a landing page, a searchable destinations directory, a "Plan my trip" flow, contact and newsletter forms, and an admin dashboard with image uploads to manage all content, all backed by a real database.

It was **designed by me** (full brand identity on [Behance](https://www.behance.net/gallery/228953887/Wanderly-Travel-Brand-Identity-Visual-System-Design)) and **built with a custom backend**: no framework, one dependency.

> **Note:** the demo runs on Render's free tier, so the first load may take around 30 seconds while the server wakes up.

## Highlights

| | |
|---|---|
| **Zero-framework backend** | Built-in `node:http` server with a single dependency, `@libsql/client` |
| **Same code, two databases** | Local SQLite file for development, remote Turso for production, switched by an env var |
| **Full admin dashboard** | Manage destinations, testimonials, images, contact messages, trip requests and subscribers |
| **Secure by default** | `scrypt` password hashing, `HttpOnly` + `SameSite=Strict` session cookie, rate-limited login, server-side validation |
| **Data-driven frontend** | Vanilla HTML/CSS/JS with no build step; all content is fetched from the API at runtime |
| **Tested** | API end-to-end tests and unit tests using Node's built-in test runner |

## Contents

[Stack](#stack) · [Run it locally](#run-it-locally) · [Admin dashboard](#admin-dashboard) · [Project structure](#project-structure) · [API](#api) · [Images](#images) · [Testing](#testing) · [Deploying](#deploying) · [License](#license)

---

## Stack

- **Backend:** Node.js, no framework: the built-in `node:http` server, with one
  real dependency: [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts).
  That single client talks to either a local SQLite file (zero setup, for
  development) or a remote [Turso](https://turso.tech) database (for production,
  on hosts whose filesystem doesn't persist across restarts/redeploys). Same code,
  just an env var to switch.
- **Frontend:** Vanilla HTML / CSS / JS. No build step, no bundler: open it, edit
  it, deploy it. All data-driven sections (destinations, testimonials, images) are
  fetched from the API at runtime, not hardcoded, so editing the database is enough
  to update the site.
- **Database:** libSQL via `@libsql/client`: a local file at `server/data/wanderly.db`
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
or change the admin session length. None of it is required to run locally.

## Admin dashboard

A password-protected admin panel lives at **`/admin/login.html`**. From there you can:

- Add, edit, and delete **destinations** (what shows on the homepage and directory)
- Add, edit, and delete **testimonials** (homepage carousel)
- Upload and remove **images** (stored in the database as blobs, served from `/api/images/:id`)
- Read and update the status of **contact messages** and **trip requests**, and delete them
- View and remove **newsletter subscribers**
- See at-a-glance counts and recent activity on the Overview page

Create your login with `npm run create-admin -- <username> <password>`. Re-running it
with the same username resets that password. There's no self-serve "forgot password"
flow; resetting it is always done from the command line on the server.

<details>
<summary><b>How admin authentication works</b></summary>

<br/>

`POST /api/admin/login` checks the username/password (hashed with `scrypt`, no
plaintext ever stored) and sets an `HttpOnly`, `SameSite=Strict` session cookie.
Sessions live in memory on the server (`server/auth.js`), so restarting the server
logs everyone out. This is a deliberate trade-off that avoids needing a separate
session store. Every write-capable `/api/admin/*` route checks that cookie
server-side; the admin page itself doesn't leak any data on its own, all real data
comes from those protected endpoints. Login attempts are rate-limited (6 per 5
minutes per IP).

</details>

## Project structure

<details>
<summary><b>Show the full file tree</b></summary>

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

</details>

## API

### Public API

| Method | Route                     | Purpose                                                  |
|--------|---------------------------|----------------------------------------------------------|
| GET    | `/api/destinations`       | all destinations (`?featured=true` for the homepage set) |
| GET    | `/api/destinations/:slug` | one destination                                          |
| GET    | `/api/testimonials`       | all testimonials                                         |
| GET    | `/api/images/:id`         | serves an uploaded image by id                           |
| POST   | `/api/contact`            | contact form → saved to `contact_messages`               |
| POST   | `/api/trip-requests`      | "Plan my trip" form → saved to `trip_requests`           |
| POST   | `/api/newsletter`         | footer signup → saved to `newsletter_subscribers`        |

All POST routes validate input server-side and return `422` with a `fields` object
on bad input, `429` if you hit the (very light) rate limit, `201` on success.

<details>
<summary><b>Admin API</b> (all routes require a valid session cookie)</summary>

<br/>

| Method           | Route                               | Purpose                                                        |
|------------------|-------------------------------------|----------------------------------------------------------------|
| POST             | `/api/admin/login`                  | sign in, sets session cookie                                   |
| POST             | `/api/admin/logout`                 | clears session cookie                                          |
| GET              | `/api/admin/me`                     | current admin username                                         |
| GET              | `/api/admin/stats`                  | dashboard counts                                               |
| GET              | `/api/admin/activity`               | recent admin activity                                          |
| POST/PUT/DELETE  | `/api/admin/destinations[/:id]`     | create / update / delete a destination                         |
| POST/PUT/DELETE  | `/api/admin/testimonials[/:id]`     | create / update / delete a testimonial                         |
| GET/PATCH/DELETE | `/api/admin/contact-messages[/:id]` | list / update status / delete                                  |
| GET/PATCH/DELETE | `/api/admin/trip-requests[/:id]`    | list / update status / delete                                  |
| GET/DELETE       | `/api/admin/newsletter[/:id]`       | list / remove a subscriber                                     |
| POST/DELETE      | `/api/admin/images[/:id]`           | upload / delete an image (JPEG, PNG, WebP, or AVIF; ~3MB max)  |

</details>

> **Email notifications:** right now submissions just land in the database, and nobody
> is emailed automatically. To add real notifications, the cleanest path is
> `npm install nodemailer` inside the `/api/contact` and `/api/trip-requests` handlers
> in `server/routes/public.js`. Everything else is already structured to make that a
> small change.

## Images

Images are uploaded through the admin dashboard and stored directly in the database
as blobs (`images` table), served back at `/api/images/:id`. There's no filesystem
step and no separate object storage account to manage: destinations, testimonials,
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
`PORT` if your host requires it. The server already reads it.

On a host with an ephemeral filesystem (e.g. Render's free tier), the local SQLite
file gets wiped on every restart/redeploy. Point the app at a
[Turso](https://turso.tech) database instead so data persists:

1. `turso db create wanderly`
2. Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (from `turso db show` / `turso db tokens create`) as environment variables on your host
3. Run `npm run migrate` once against that database, then `npm run create-admin -- <username> <password>`

> **Heads-up:** never commit your `.env` file or your Turso token. `.gitignore` already
> excludes the local database and `node_modules`.

## License

MIT. See [LICENSE](LICENSE).

---

<p align="center">
  Designed &amp; built by <a href="https://github.com/roukaiafadla"><b>Rekia Fadla</b></a> ·
  <a href="https://www.behance.net/fadlarekia">Behance</a>
</p>
