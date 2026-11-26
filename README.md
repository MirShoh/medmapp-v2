# MedMapp 2.0

**Your Global Healthcare Journey, One Platform.**
A medical tourism platform: a public website, a patient portal, a staff console with a Kanban CRM, and a hospital partner portal. It runs on a single Django backend.

| Part | Path | Stack |
|---|---|---|
| Backend / API | `backend/` | Python 3.12, Django 5.2 LTS, DRF 3.16, SimpleJWT, PostgreSQL (SQLite for local dev) |
| Web app | `web/` | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, next-intl, dnd-kit |
| Deployment | `docker-compose.yml`, `deploy/` | Docker, Gunicorn, PostgreSQL 16, Redis 7, Nginx (TLS, gzip) |
| Original sources | `_src/` | The three uploaded archives, kept locally for reference (not in git) |

The backend extends the original `medmapp_platform` project. The current API is `/api/v2/`; a few `/api/v1/` catalog endpoints remain for compatibility.

**Developers:** start with `docs/ARCHITECTURE.md` (code map and conventions) and `CONTRIBUTING.md` (workflow and checks).

## Web routes

| Route | Who | Notes |
|---|---|---|
| `/` `/treatments` `/hospitals` `/doctors` `/destinations` `/packages` `/tools` `/blog` `/about` `/how-it-works` `/track` `/p/<slug>` | Public | Server-rendered for SEO. Uzbek is the default with no URL prefix; `/ru/...` and `/en/...` for the other languages |
| `/hospitals/compare`, `/packages/compare` | Public | Up to 4 items. Unverified hospitals are flagged |
| `/login`, `/register` | Patients | Password, SMS code or Google |
| `/dashboard/...` | Patients | Cases & journey, documents, quotations, travel, requests, chat with an operator, profile (incl. consents) |
| `/admin/login`, `/admin/...` | Staff | Dashboard, CRM Kanban/table, patients 360°, cases, documents, tasks, quotations, travel, finance, reports, CMS, users & roles, integrations, audit |
| `/partner/login`, `/partner/register`, `/partner/...` | Hospital partners | Referrals, consented documents, opinions, quotations, messages, hospital profile in 3 languages |
| `/django-admin/` | Superusers | Django's built-in admin (it moved from `/admin/`) |
| `/swagger/`, `/redoc/` | Developers | Live OpenAPI documentation |

## Local development

**Quickest way (Windows):** `powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Demo`, then `powershell -ExecutionPolicy Bypass -File .\start.ps1` (stop with `stop.ps1`). Step-by-step guide in Uzbek: `docs/LOKAL_ISHGA_TUSHIRISH.md`.

Manual steps:

Requires Python 3.12 and Node 20+.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env   # then set DEBUG=True, DB_ENGINE=sqlite, SECRET_KEY=anything
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_reference      # countries (+ credited photos), specialties, treatments, services, CMS sections, legal pages (idempotent)
.venv\Scripts\python manage.py import_partners     # partner hospitals/doctors (MediConnex Shanghai guide); removes [DEMO] catalogue records
.venv\Scripts\python manage.py import_regional     # well-known hospitals in India, Turkey, Azerbaijan, Uzbekistan (unverified catalogue entries)
.venv\Scripts\python manage.py seed_content        # destination pages, indicative prices, notable doctors, FAQ, blog guides (fills empty fields only)
.venv\Scripts\python manage.py seed_demo           # optional, DEBUG only: [DEMO] records + test accounts -> backend\.demo-credentials
.venv\Scripts\python manage.py runserver
```

```powershell
cd web
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The browser calls `/api/*` on the same origin, and Next.js forwards those calls to Django at `BACKEND_URL`.

To create the first real super admin, run `python manage.py createsuperuser`. Superusers get the Super Admin role automatically.

### Tests and checks

```powershell
powershell -ExecutionPolicy Bypass -File .\tools-check.ps1   # ruff, migrations, backend tests, web types + lint (same as CI)
```

## Production deployment

**Site on Netlify, API elsewhere:** `netlify.toml` builds `web/` on Netlify; the Django API (with its database and private files) must run on a server and be set as `BACKEND_URL`. Step-by-step guide (Uzbek): `docs/NETLIFY.md`.

**Everything on one server (Docker):** step-by-step guide in Uzbek with ready scripts: `docs/VPS_DEPLOY.md` (`deploy/server-setup.sh`, `deploy/deploy.sh`).

1. On a Docker host, copy `backend/.env.example` to `backend/.env`. Fill in `SECRET_KEY`, `DB_PASSWORD`, hosts, email and any integrations.
2. Put the TLS certificate files at `deploy/certs/fullchain.pem` and `deploy/certs/privkey.pem` (Let's Encrypt or your own). The domain, a test-site password and noindex come from `.env` (`SERVER_NAMES`, `AUTH_BASIC`, `ROBOTS_TAG`) into `deploy/nginx.conf.template`; `deploy/deploy.sh` writes them for you.
3. Start the stack:

```powershell
$env:DB_PASSWORD='same-value-as-in-backend/.env'; $env:INTERNAL_API_TOKEN='a-long-random-value'; docker compose up -d --build
```

`INTERNAL_API_TOKEN` is a shared secret between the site server and the API (server-side rendering is then not
rate-limited like one anonymous visitor). Put both variables in a `.env` file next to `docker-compose.yml` so they
survive restarts. Generate a value with `python -c "import secrets;print(secrets.token_urlsafe(48))"`.

The backend container runs migrations, `collectstatic`, `seed_reference` and `make_thumbnails` on every start, then starts Gunicorn
(`GUNICORN_WORKERS`, default 3, × `GUNICORN_THREADS`, default 4). Capacity measurements and server sizing: `docs/CAPACITY.md`. Run `python manage.py import_partners` and `python manage.py import_regional` and `python manage.py seed_content` once after the first deploy (re-running refreshes the partner texts it manages).

4. Create the first admin:

```powershell
docker compose exec backend python manage.py createsuperuser
```

5. The `scheduler` service sends task and follow-up reminders every 5 minutes (`python manage.py send_reminders`).
6. Schedule `deploy/backup.sh` nightly (database dump + private medical files). Store the output encrypted and off-site.

Nginx serves only public media. The `private_media` volume (medical documents) is never mounted into Nginx. Those files can only be reached through signed, expiring API links.

## Roles and permissions

Every permission is enforced in the backend. The frontend only hides what a user can't use.

| Role | Access |
|---|---|
| Super Admin | Everything |
| Admin | Everything except system settings; cannot grant Super Admin |
| Sales Manager | CRM, patients, tasks, CSV export, catalog (read) |
| Medical Coordinator | CRM, patients, medical cases, documents (incl. sharing), quotations, travel |
| Finance Manager | Finance, quotations (read), reports |
| Content Manager | Catalog and CMS, blog |
| Hospital Partner | Only referrals sent to their own hospital, and only documents shared with active patient consent. Needs admin approval |
| Patient | Only their own records |

The full permission matrix is in `backend/accounts/permissions.py` and in the admin under **Users & roles**.

## Security and privacy

- Passwords are hashed with Django's PBKDF2 and validated for strength. Logins use JWT: the 30-minute access token lives only in browser memory, and the rotating refresh token is an httpOnly cookie that JavaScript cannot read (it's blacklisted on logout). Native apps can request the refresh token in the response body with `X-Client: mobile`.
- A portal account is never linked to an existing patient record by phone number; staff merge duplicates manually after checking identity.
- Staff-written rich text is sanitized on the server (nh3) before it reaches the public site.
- Rate limits apply to login, public forms and the AI assistant (configurable).
- Medical files are stored outside `MEDIA_ROOT` and have no public URL. Downloads use signed tokens that expire after 10 minutes, and access is checked again at download time.
- Uploads are checked for extension and size, and the file's actual content must match its extension. Files are hashed with SHA-256.
- Hospitals get documents only after the patient consents for that specific hospital. Revoking consent removes access immediately. Hospitals see minimal patient data: first name and last initial, age, gender, country, allergies and chronic conditions. No phone, email, address or full name.
- Every important action is written to an audit log: who did it, what changed, and the IP address.
- Production settings enable HSTS, secure cookies, the SSL redirect, nosniff and frame denial. CSRF protection is on for session use, and the Django ORM prevents SQL injection.
- Integration keys are read only from the server environment and are never sent to the browser.

## Integrations

| Integration | Behaviour when not configured |
|---|---|
| Email (SMTP) | Emails are printed to the logs |
| Telegram bot | Nothing is sent and nothing is claimed as sent |
| WhatsApp Business | Same as Telegram |
| Currency API | The converter says rates aren't configured. Staff can enter a rate manually, but must name its source |
| AI assistant (Claude) | The chat says it's not configured and points visitors to the consultation form |
| Payment provider | None is integrated yet. Finance staff record payments manually, and a payment can only be marked confirmed with a bank or provider reference |

The status of each integration and a delivery log are shown at `/admin/integrations`.

## Content principles

- No invented statistics. The homepage counters are live database counts and are hidden while zero.
- Prices are labelled as estimates or hospital-confirmed, and published estimates show their source and date.
- Medical opinions come only from named, qualified doctors at partner hospitals. Neither MedMapp staff nor the AI gives medical opinions.
- Visa and recovery information carries a source/date and a disclaimer.

Progress, test results and known issues are tracked in `MEDMAPP_PROGRESS.md`. The API reference is in `docs/API.md`. The user guide (in Uzbek) is in `docs/QOLLANMA.md`.
