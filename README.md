# Wanderly

A full-stack travel agency website — landing page, destinations directory, contact
and trip-request forms, all backed by a real database.

Built from your design (colors, layout, copy) and extended with a working backend,
a full destinations page, a "Plan my trip" flow, and a newsletter signup.

## Stack

- **Backend:** Node.js only — no framework, no npm dependencies. Uses the built-in
  `node:http` server and the built-in `node:sqlite` database (bundled with Node 22.5+).
  This was a deliberate choice: zero `npm install` risk, nothing to go out of date,
  and it's still a legitimate, fully working REST API + database for your portfolio.
  If you'd rather show Express on your resume, the code is small enough to port in
  an afternoon — every route is in `server/index.js`.
- **Frontend:** Vanilla HTML / CSS / JS. No build step, no bundler — open it, edit it,
  deploy it. All data-driven sections (destinations, testimonials) are fetched from
  the API at runtime, not hardcoded, so editing the database is enough to update the site.
- **Database:** SQLite file at `server/data/wanderly.db` (auto-created, gitignored).

## Run it locally

```bash
node server/seed.js                              # populate destinations + testimonials (safe to re-run)
node server/create-admin.js <username> <password> # create your admin login (password: 8+ chars)
node server/index.js                              # starts the server on http://localhost:3000
```

Requires Node.js 22.5+ (for `node:sqlite`). Check with `node -v`.

No `npm install` is needed to run the site as-is.

## Admin dashboard

A password-protected admin panel lives at **`/admin/login.html`**. From there you can:

- Add, edit, and delete **destinations** (what shows on the homepage and directory)
- Add, edit, and delete **testimonials** (homepage carousel)
- Read and update the status of **contact messages** and **trip requests**, and delete them
- View and remove **newsletter subscribers**
- See at-a-glance counts of everything on the Overview page

Create your login with `node server/create-admin.js <username> <password>` — re-running it
with the same username resets that password. There's no self-serve "forgot password" flow;
resetting it is always done from the command line on the server.

How it works, if you're curious: `POST /api/admin/login` checks the username/password
(hashed with `scrypt`, no plaintext ever stored) and sets an `HttpOnly`, `SameSite=Strict`
session cookie. Sessions live in memory on the server (`server/auth.js`), so restarting the
server logs everyone out — a deliberate trade-off to keep this dependency-free. Every
write-capable `/api/admin/*` route checks that cookie server-side; the admin page itself
doesn't leak any data on its own, all real data comes from those protected endpoints.
Login attempts are rate-limited (6 per 5 minutes per IP).

## Project structure

```
wanderly/
  server/
    index.js     — HTTP server, routing, all API endpoints
    db.js        — SQLite connection + schema
    seed.js      — seed data for destinations & testimonials
    data/        — the .db file lives here (gitignored)
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
    images/       — logo + placeholder photos (see below)
    admin/
      login.html    — admin sign-in
      index.html    — admin dashboard shell
      css/admin.css
      js/admin.js         — dashboard SPA logic (routing, tables, modals)
      js/admin-login.js   — login form logic
  server/
    auth.js         — password hashing + session/cookie handling
    create-admin.js — CLI to create/reset the admin login
```

## API

| Method | Route                     | Purpose                          |
|--------|---------------------------|-----------------------------------|
| GET    | `/api/destinations`       | all destinations (`?featured=true` for the homepage set) |
| GET    | `/api/destinations/:slug` | one destination                  |
| GET    | `/api/testimonials`       | all testimonials                 |
| POST   | `/api/contact`            | contact form → saved to `contact_messages` |
| POST   | `/api/trip-requests`      | "Plan my trip" form → saved to `trip_requests` |
| POST   | `/api/newsletter`         | footer signup → saved to `newsletter_subscribers` |

All POST routes validate input server-side and return `422` with a `fields` object
on bad input, `429` if you hit the (very light) rate limit, `201` on success.

### Admin API (all require a valid session cookie — see "Admin dashboard" above)

| Method | Route                            | Purpose                          |
|--------|-----------------------------------|-----------------------------------|
| POST   | `/api/admin/login`                | sign in, sets session cookie     |
| POST   | `/api/admin/logout`               | clears session cookie            |
| GET    | `/api/admin/me`                   | current admin username           |
| GET    | `/api/admin/stats`                | dashboard counts                 |
| POST/PUT/DELETE | `/api/admin/destinations[/:id]` | create / update / delete a destination |
| POST/PUT/DELETE | `/api/admin/testimonials[/:id]` | create / update / delete a testimonial |
| GET/PATCH/DELETE | `/api/admin/contact-messages[/:id]` | list / update status / delete |
| GET/PATCH/DELETE | `/api/admin/trip-requests[/:id]`    | list / update status / delete |
| GET/DELETE | `/api/admin/newsletter[/:id]`         | list / remove a subscriber |

Right now submissions just land in the database — nobody emails you automatically.
To wire up real email notifications later, the cleanest path is adding `nodemailer`
(`npm install nodemailer`) inside the `/api/contact` and `/api/trip-requests` handlers
in `server/index.js` — everything else is already structured to make that a small change.

## Swapping in your real images

Right now every photo is a solid brand-color placeholder (generated, not a real photo)
so you can see the full layout. Replace these files with real images at these sizes
and everything will just work — no code changes needed, just matching filenames:

| File                                    | Recommended size | Notes |
|------------------------------------------|-------------------|-------|
| `public/images/hero-boat.jpg`             | 1920 × 1080px     | Full-bleed hero background — text sits over the dark left side, boat/wake should read on the right |
| `public/images/contact-bg.jpg`            | 1800 × 1200px     | Beach / aerial wave shot, sits behind a dark overlay |
| `public/images/cta-bg.jpg`                | 1920 × 1080px     | Mountains / hiker silhouette, also behind a dark overlay |
| `public/images/destinations/*.jpg`        | 900 × 675px (4:3) | One per destination — filenames are in `server/seed.js` |
| `public/images/testimonials/*.jpg`        | 160 × 160px (square) | Cropped to a circle in the UI |

Keep them as optimized JPG or WebP, ideally under 300KB each, for fast loading.

Your original logo files (`logo.svg`, `logo-white.svg`, `logo.png`) are already in place.

## Deploying

Since there's no build step, most Node-friendly hosts (Render, Railway, Fly.io, a VPS)
work by just running `node server/seed.js && node server/index.js`. Set the `PORT`
environment variable if your host requires it — the server already reads it.

For GitHub: everything in this folder is ready to push as-is. The `.gitignore`
already excludes the local database and `node_modules`.
