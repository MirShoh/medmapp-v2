# MedMapp architecture

A map of the code for developers joining the project. For setup see `README.md`, for the workflow `CONTRIBUTING.md`.

## Overview

```
Browser ──► Next.js (web/, port 3000) ──/api/* proxy──► Django + DRF (backend/, port 8000) ──► PostgreSQL / SQLite
              │  server components fetch public data                 │
              │  with 60 s revalidation (lib/server.ts)              ├─► Redis (cache, rate limits)  — production
              └─ client components use TanStack Query                └─► SMS, e-mail, Telegram, Google, Anthropic
```

* The browser only talks to its own origin. `next.config.ts` rewrites `/api/*` and `/media/*` to Django, so there is no CORS
  in production and cookies stay first-party.
* Four front ends share one API: the public site, the patient portal (`/dashboard`), the staff console (`/admin`) and the
  hospital partner portal (`/partner`). Permissions are always enforced in Django; the UI only hides what a user cannot use.

## Backend (`backend/`)

| App | What it owns |
|---|---|
| `accounts` | `Account` (role, phone, hospital) next to Django's `User`; JWT login, SMS / Google sign-in (`social.py`), roles and permissions (`permissions.py`) |
| `core` | Countries, cities, specialties, site settings |
| `catalog` | Treatments, prices, packages, services, FAQ, accreditations, testimonials; **public read API** (`public_api.py`) |
| `clinics`, `doctors` | Hospitals and doctors (+ seed data and import commands) |
| `crm` | Patients, leads (Kanban), tasks, notes, communications, support chat (`chat_api.py`), request numbers (`Counter`) |
| `cases` | Medical cases, documents, referrals to hospitals, opinions, quotations, travel; patient and partner portal APIs (`portal_api.py`) |
| `finance` | Payments, commissions, expenses, exchange rates |
| `notifications` | In-app notifications + e-mail / Telegram / WhatsApp delivery (`service.py`, titles in `texts.py`) |
| `audit` | Append-only audit log (`audit.service.log`) |
| `analytics` | Dashboard and reports |
| `cms`, `blog` | Page sections, menus, legal pages, blog |
| `assistant` | AI assistant (Anthropic Claude; off without `ANTHROPIC_API_KEY`) |
| `config` | Settings, URL map (`api_v2.py`), generic admin CRUD (`crud.py`, `admin_crud.py`), public API cache (`public_cache.py`) |

The current API is `/api/v2/` (`config/api_v2.py`). A few old `/api/v1/` catalog endpoints remain for compatibility.

### Conventions (please keep them)

* **Text is translatable, never English sentences in the database.** System events are stored as keys and arguments and
  translated when shown:
  * case history → `CaseStatusHistory.event` + `event_arg` (UI: `caseEvent.*` messages)
  * activity timeline → `LeadActivity.meta["key"]` (UI: `activityMsg.*`)
  * notifications → `Notification.key` + `args`, rendered by `notifications/texts.py` in the reader's language
  * user-facing catalog fields use django-modeltranslation (`name_uz`, `name_ru`, `name_en`; see `*/translation.py`).
* **Audit every important change**: `audit(request, "object.verb", obj, summary=..., changes=...)`. The audit log is never
  rewritten.
* **Permissions**: views use `HasPerm.of("area.view", write="area.edit")`. New permission codes go into
  `accounts/permissions.py`.
* **Admin CRUD for simple models**: add one line to `config/admin_crud.py` (`crud(Model, search=..., filters=...)`) and a
  resource definition in `web/components/admin/resources.ts`. Lists load related rows automatically (no N+1).
* **Personal data**: medical files live in `PRIVATE_MEDIA_ROOT` and are served only through signed, expiring links
  (`cases/access.py`). Hospitals see minimal patient data and only documents with an active consent.
* **Request numbers**: `MM-0001`, shared by leads and cases (`crm.models.next_reference`).
* **Performance**: anonymous `GET /api/v2/public/*` responses are cached (`PUBLIC_CACHE_SECONDS`, default 120 s) and
  invalidated on any catalog save. Use `select_related` / `prefetch_related` in custom querysets; the tests check query
  counts for admin lists.

## Web (`web/`)

| Path | Contents |
|---|---|
| `app/[locale]/(site)` | Public pages (server components, SEO metadata, JSON-LD) |
| `app/[locale]/(auth)` | Patient login / registration |
| `app/[locale]/dashboard`, `admin`, `partner` | The three portals (client components inside `PortalShell`) |
| `components/site`, `dashboard`, `admin`, `partner`, `portal`, `ui` | UI by area; `ui/` holds the shared primitives (Button, Card, Field, Modal…) |
| `lib/api.ts` | `api()` fetch wrapper: access token in memory, refresh via httpOnly cookie, retries |
| `lib/auth.tsx` | `AuthProvider`, `useAuth()` (login, SMS / Google, logout, permissions) |
| `lib/server.ts` | `serverGet()` for server components (60 s revalidation) |
| `messages/uz.json`, `ru.json`, `en.json` | All UI text. Uzbek is the default locale and has no URL prefix |

Conventions:

* Every visible string goes into all three message files (same key). Never hard-code English in components.
* Data fetching in client components: TanStack Query (`useQuery`, invalidate after mutations).
* Styling: Tailwind utility classes and the design tokens in `app/globals.css` (`navy-*`, `teal-*`, `ink-*`, `line`, `mist`).

## Production

`docker-compose.yml`: PostgreSQL 16, Redis 7, backend (Gunicorn, `GUNICORN_WORKERS`), scheduler (reminders every 5 min),
Next.js, Nginx (TLS, gzip, public media only). `deploy/backup.sh` dumps the database and private files.
Required on the server: `DEBUG=False`, a `SECRET_KEY` of at least 50 random characters, `DB_PASSWORD`, `ALLOWED_HOSTS`.
