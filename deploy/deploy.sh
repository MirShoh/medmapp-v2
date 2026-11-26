#!/usr/bin/env bash
# MedMapp deploy / update. Run on the server as root from the repository folder (/opt/medmapp):
#
#   bash deploy/deploy.sh                                    first install (asks domain + e-mail) and every update
#   bash deploy/deploy.sh --import /root/medmapp-catalog.zip     first install with the catalogue from a laptop
#   bash deploy/deploy.sh --domain medmapp.uz                    move a running site to another domain
#                         [--public | --test]                    ... as the real site, or as a hidden test site
#
# A test site (e.g. test.medmapp.uz) asks for a password on every page and tells search engines not to index it.
# First run: creates .env files with fresh random secrets, gets a free Let's Encrypt certificate, builds and starts
# everything, installs the nightly backup and certificate renewal. Later runs: pull the latest code and rebuild.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

IMPORT="" NEW_DOMAIN="" MODE=""
ARGS=("$@")
while [ $# -gt 0 ]; do
  case "$1" in
    --import) IMPORT=$(realpath "${2:?give the path of the catalogue zip}"); shift 2 ;;
    --domain) NEW_DOMAIN="${2:?give the new domain, e.g. medmapp.uz}"; shift 2 ;;
    --public) MODE=public; shift ;;
    --test) MODE=test; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

rand() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "${1:-48}"; }
say() { echo; echo "==> $*"; }
set_kv() { # set_kv FILE KEY VALUE  (replace the line, or append it)
  if grep -q "^$2=" "$1"; then sed -i "s|^$2=.*|$2=$3|" "$1"; else echo "$2=$3" >> "$1"; fi
}
# medmapp.uz -> "medmapp.uz www.medmapp.uz";  test.medmapp.uz -> "test.medmapp.uz" (no www for subdomains)
names_for() { if [ "$(echo "$1" | tr -cd '.' | wc -c)" -le 1 ]; then echo "$1 www.$1"; else echo "$1"; fi; }

# Write everything that depends on the domain: .env (nginx + web build), backend/.env (allowed hosts, links),
# deploy/htpasswd (test site password).
apply_domain() { # apply_domain DOMAIN public|test
  local d=$1 mode=$2 names hosts origins
  names=$(names_for "$d")
  hosts=$(echo "$names" | tr ' ' ','),localhost,backend
  origins=$(for n in $names; do printf 'https://%s,' "$n"; done); origins=${origins%,}
  set_kv .env DOMAIN "$d"
  set_kv .env SITE_URL "https://$d"
  set_kv .env SERVER_NAMES "\"$names\""
  set_kv backend/.env ALLOWED_HOSTS "$hosts"
  set_kv backend/.env CORS_ALLOWED_ORIGINS "$origins"
  set_kv backend/.env CSRF_TRUSTED_ORIGINS "$origins"
  set_kv backend/.env FRONTEND_URL "https://$d"
  set_kv backend/.env DEFAULT_FROM_EMAIL "\"MedMapp <no-reply@${d#test.}>\""
  if [ "$mode" = test ]; then
    set_kv .env ROBOTS_TAG "\"noindex, nofollow\""
    set_kv .env AUTH_BASIC MedMapp-test
    local pw; pw=$(rand 12)
    printf 'medmapp:%s\n' "$(openssl passwd -apr1 "$pw")" > deploy/htpasswd
    echo
    echo "    TEST SITE PASSWORD (write it down, it is not shown again):"
    echo "      login: medmapp      password: $pw"
    echo "    New password later: bash deploy/deploy.sh --domain $d --test"
  else
    set_kv .env ROBOTS_TAG '""'
    set_kv .env AUTH_BASIC off
    : > deploy/htpasswd
  fi
  chmod 600 .env backend/.env deploy/htpasswd
}

get_cert() { # get_cert DOMAIN  (stops nginx for a minute: certbot answers the check on port 80 itself)
  local d=$1 args=()
  for n in $(names_for "$d"); do args+=(-d "$n"); done
  say "Getting a free SSL certificate for $(names_for "$d") (Let's Encrypt)"
  echo "    DNS A record(s) for $(names_for "$d") must already point to this server."
  docker compose stop nginx >/dev/null 2>&1 || true
  docker run --rm -p 80:80 -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certonly --standalone \
    --cert-name "$d" "${args[@]}" -m "$LETSENCRYPT_EMAIL" --agree-tos -n
  cp -L "/etc/letsencrypt/live/$d/fullchain.pem" "/etc/letsencrypt/live/$d/privkey.pem" deploy/certs/
  chmod 600 deploy/certs/privkey.pem
}

check() {
  local d=$1
  [ -s deploy/htpasswd ] && echo "    (test site: the check below may show 401 = password protection works)"
  say "Checking https://$d (the backend needs ~30 s on first start)"
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "https://$d/api/v2/public/site/" || true)
    case "$code" in 200|401) break ;; esac
    sleep 3
  done
  curl -s -o /dev/null -w "    API   %{http_code}\n" "https://$d/api/v2/public/site/" || true
  curl -s -o /dev/null -w "    Site  %{http_code}\n" "https://$d/" || true
}

mkdir -p deploy/certs deploy/acme
[ -f deploy/htpasswd ] || : > deploy/htpasswd   # must exist as a file (docker would create a folder)

# ------------------------------------------------------------------ A. move to another domain
if [ -n "$NEW_DOMAIN" ]; then
  [ -f .env ] || { echo "Not installed yet: run bash deploy/deploy.sh first."; exit 1; }
  set -a; . ./.env; set +a
  if [ -z "$MODE" ]; then case "$NEW_DOMAIN" in test.*|staging.*) MODE=test ;; *) MODE=public ;; esac; fi
  say "Moving the site to $NEW_DOMAIN ($MODE)"
  apply_domain "$NEW_DOMAIN" "$MODE"
  set -a; . ./.env; set +a
  get_cert "$NEW_DOMAIN"
  say "Rebuilding the site for https://$NEW_DOMAIN (links, sitemap and SEO tags use the domain)"
  docker compose build web
  docker compose up -d --remove-orphans
  check "$NEW_DOMAIN"
  echo
  echo "Done: https://$NEW_DOMAIN"
  exit 0
fi

# ------------------------------------------------------------------ 1. configuration (first run only)
FIRST=0
if [ ! -f .env ] || [ ! -f backend/.env ]; then
  FIRST=1
  say "First install: configuration"
  read -rp "Domain [test.medmapp.uz]: " DOMAIN; DOMAIN=${DOMAIN:-test.medmapp.uz}
  case "$DOMAIN" in test.*|staging.*) DEF=Y ;; *) DEF=N ;; esac
  read -rp "Test site (password on every page, hidden from Google)? [$DEF]: " T; T=${T:-$DEF}
  case "$T" in [Yy]*) MODE=test ;; *) MODE=public ;; esac
  read -rp "E-mail for the SSL certificate and server notices: " EMAIL
  [ -n "$EMAIL" ] || { echo "E-mail is required (Let's Encrypt sends expiry warnings there)."; exit 1; }
  DB_PASSWORD=$(rand 32)
  INTERNAL_API_TOKEN=$(rand 48)
  cat > .env <<ENV
# docker compose variables (generated $(date +%F)). Keep this file private.
LETSENCRYPT_EMAIL=$EMAIL
DB_PASSWORD=$DB_PASSWORD
INTERNAL_API_TOKEN=$INTERNAL_API_TOKEN
ENV
  cp backend/.env.example backend/.env
  set_kv backend/.env SECRET_KEY "$(rand 64)"
  set_kv backend/.env DEBUG False
  set_kv backend/.env DB_PASSWORD "$DB_PASSWORD"
  set_kv backend/.env INTERNAL_API_TOKEN "$INTERNAL_API_TOKEN"
  # e-mails go to the log until SMTP is filled in (EMAIL_HOST ...) - then switch this to the smtp backend
  set_kv backend/.env EMAIL_BACKEND django.core.mail.backends.console.EmailBackend
  apply_domain "$DOMAIN" "$MODE"
  echo "    .env and backend/.env created (secrets generated)."
fi
set -a; . ./.env; set +a

# ------------------------------------------------------------------ 2. code
if [ "$FIRST" = 0 ] && [ -d .git ] && [ -z "${MEDMAPP_PULLED:-}" ]; then
  say "Updating code"
  git pull --ff-only
  # continue with the freshly pulled version of this script
  MEDMAPP_PULLED=1 exec bash deploy/deploy.sh "${ARGS[@]}"
fi

# ------------------------------------------------------------------ 3. TLS certificate (first run)
[ -f deploy/certs/fullchain.pem ] || get_cert "$DOMAIN"

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

check "$DOMAIN"
echo
echo "Done: https://$DOMAIN"
echo "Create the first admin (once):  docker compose exec backend python manage.py createsuperuser"
