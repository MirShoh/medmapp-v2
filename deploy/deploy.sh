#!/usr/bin/env bash
# MedMapp deploy / update. Run on the server as root from the repository folder (/opt/medmapp):
#
#   bash deploy/deploy.sh                                  first install (asks domain + e-mail) and every update
#   bash deploy/deploy.sh --import /root/medmapp-catalog.zip   first install with the catalogue from a laptop
#
# First run: creates .env files with fresh random secrets, gets a free Let's Encrypt certificate, builds and starts
# everything, installs the nightly backup and certificate renewal. Later runs: pull the latest code and rebuild.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
IMPORT=""
[ "${1:-}" = "--import" ] && IMPORT=$(realpath "${2:?give the path of the catalogue zip}")

rand() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "${1:-48}"; }
say() { echo; echo "==> $*"; }

# ------------------------------------------------------------------ 1. configuration (first run only)
FIRST=0
if [ ! -f .env ] || [ ! -f backend/.env ]; then
  FIRST=1
  say "First install: configuration"
  read -rp "Domain [medmapp.uz]: " DOMAIN; DOMAIN=${DOMAIN:-medmapp.uz}
  read -rp "E-mail for the SSL certificate and server notices: " EMAIL
  [ -n "$EMAIL" ] || { echo "E-mail is required (Let's Encrypt sends expiry warnings there)."; exit 1; }
  DB_PASSWORD=$(rand 32)
  INTERNAL_API_TOKEN=$(rand 48)
  cat > .env <<ENV
# docker compose variables (generated $(date +%F)). Keep this file private.
DOMAIN=$DOMAIN
LETSENCRYPT_EMAIL=$EMAIL
SITE_URL=https://$DOMAIN
DB_PASSWORD=$DB_PASSWORD
INTERNAL_API_TOKEN=$INTERNAL_API_TOKEN
ENV
  cp backend/.env.example backend/.env
  set_env() { # set_env KEY VALUE  (replace the line, or append it)
    if grep -q "^$1=" backend/.env; then sed -i "s|^$1=.*|$1=$2|" backend/.env; else echo "$1=$2" >> backend/.env; fi
  }
  set_env SECRET_KEY "$(rand 64)"
  set_env DEBUG False
  set_env ALLOWED_HOSTS "$DOMAIN,www.$DOMAIN,localhost,backend"
  set_env CORS_ALLOWED_ORIGINS "https://$DOMAIN,https://www.$DOMAIN"
  set_env CSRF_TRUSTED_ORIGINS "https://$DOMAIN,https://www.$DOMAIN"
  set_env FRONTEND_URL "https://$DOMAIN"
  set_env DB_PASSWORD "$DB_PASSWORD"
  set_env INTERNAL_API_TOKEN "$INTERNAL_API_TOKEN"
  set_env DEFAULT_FROM_EMAIL "MedMapp <no-reply@$DOMAIN>"
  # e-mails go to the log until SMTP is filled in (EMAIL_HOST ...) - then switch this to the smtp backend
  set_env EMAIL_BACKEND django.core.mail.backends.console.EmailBackend
  chmod 600 .env backend/.env
  if [ "$DOMAIN" != "medmapp.uz" ]; then sed -i "s/medmapp\.uz/$DOMAIN/g" deploy/nginx.conf; fi
  echo "    .env and backend/.env created (secrets generated)."
fi
set -a; . ./.env; set +a

# ------------------------------------------------------------------ 2. code
if [ "$FIRST" = 0 ] && [ -d .git ] && [ -z "${MEDMAPP_PULLED:-}" ]; then
  say "Updating code"
  git pull --ff-only
  # continue with the freshly pulled version of this script
  MEDMAPP_PULLED=1 exec bash deploy/deploy.sh "$@"
fi

# ------------------------------------------------------------------ 3. TLS certificate (first run)
mkdir -p deploy/certs deploy/acme
if [ ! -f deploy/certs/fullchain.pem ]; then
  say "Getting a free SSL certificate for $DOMAIN (Let's Encrypt)"
  echo "    The domain must already point to this server (DNS A records for $DOMAIN and www.$DOMAIN)."
  docker compose stop nginx >/dev/null 2>&1 || true
  docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certonly --standalone \
    -d "$DOMAIN" -d "www.$DOMAIN" -m "$LETSENCRYPT_EMAIL" --agree-tos -n
  cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "/etc/letsencrypt/live/$DOMAIN/privkey.pem" deploy/certs/
  chmod 600 deploy/certs/privkey.pem
fi

# ------------------------------------------------------------------ 4. build
say "Building images (first time takes a few minutes)"
docker compose build

# ------------------------------------------------------------------ 5. catalogue import (optional, fresh database)
if [ -n "$IMPORT" ]; then
  say "Importing the catalogue from $IMPORT"
  docker compose up -d db redis
  docker compose run --rm -v "$IMPORT":/import/catalog.zip:ro backend \
    sh -c "python manage.py migrate --noinput && python manage.py import_catalog /import/catalog.zip"
fi

# ------------------------------------------------------------------ 6. start
say "Starting"
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

# ------------------------------------------------------------------ 7. nightly jobs (installed once)
CRON=/etc/cron.d/medmapp
if [ ! -f "$CRON" ]; then
  say "Installing nightly backup (02:00) and certificate renewal (03:30)"
  cat > "$CRON" <<CR
SHELL=/bin/bash
0 2 * * * root cd $ROOT && set -a && . ./.env && set +a && bash deploy/backup.sh >> /var/log/medmapp-backup.log 2>&1
30 3 * * * root cd $ROOT && bash deploy/renew-cert.sh >> /var/log/medmapp-cert.log 2>&1
CR
fi

# ------------------------------------------------------------------ 8. check
say "Checking (the backend needs ~30 s on first start)"
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null "https://$DOMAIN/api/v2/public/site/"; then break; fi
  sleep 3
done
curl -fsS -o /dev/null -w "    API   %{http_code}\n" "https://$DOMAIN/api/v2/public/site/" || echo "    API not answering yet: docker compose logs backend"
curl -fsS -o /dev/null -w "    Site  %{http_code}\n" "https://$DOMAIN/" || echo "    Site not answering yet: docker compose logs web"
echo
echo "Done. Create the first admin (once):  docker compose exec backend python manage.py createsuperuser"
