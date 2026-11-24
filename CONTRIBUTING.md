# Working on MedMapp

Read `docs/ARCHITECTURE.md` first: it explains where things live and the conventions the code follows.

## Setup (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Demo   # venv, packages, database, demo data
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Dev     # Django :8000 + Next.js dev server :3000
backend\.venv\Scripts\python -m pip install -r backend\requirements-dev.txt   # lint tools
```

Demo logins are written to `backend/.demo-credentials` (never commit it; local use only).

## Before every commit

```powershell
powershell -ExecutionPolicy Bypass -File .\tools-check.ps1
```

It runs exactly what CI runs (`.github/workflows/ci.yml`):

| Check | Command (manual) |
|---|---|
| Python lint | `cd backend; .venv\Scripts\python -m ruff check .` (`--fix` for safe fixes) |
| Migrations committed | `.venv\Scripts\python manage.py makemigrations --check --dry-run` |
| Backend tests | `.venv\Scripts\python manage.py test tests` |
| Types + lint (web) | `cd web; npm run check` |

## Rules of thumb

* **One change, one branch, one pull request.** Branch names: `feature/…`, `fix/…`. Small PRs are reviewed faster.
* **Never commit** `.env` files, `backend/.demo-credentials`, databases, `media/`, `private_media/` or `backups/`
  (all in `.gitignore`). Patient data never goes into git, issues or screenshots.
* **Models changed?** Run `python manage.py makemigrations`, read the generated file, commit it together with the code.
  Data migrations must be safe to run on the production database (no silent data loss).
* **New UI text?** Add the key to `web/messages/uz.json`, `ru.json` and `en.json`.
* **New endpoint?** Permission class, audit call for changes, a test in `backend/tests/` (permission + happy path).
* **System texts** (history, timeline, notifications) are stored as keys, not sentences — see ARCHITECTURE.md.
* Keep comments for the *why*; the code shows the *what*.

## Useful commands

```powershell
cd backend
.venv\Scripts\python manage.py shell                 # Django shell
.venv\Scripts\python manage.py send_reminders        # what the scheduler runs every 5 minutes
.venv\Scripts\python manage.py seed_content          # fill empty catalog texts (idempotent)
```

API documentation: http://127.0.0.1:8000/swagger/ (generated from the code).
