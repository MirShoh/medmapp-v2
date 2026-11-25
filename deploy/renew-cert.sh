#!/usr/bin/env bash
# Renew the Let's Encrypt certificate (cron, daily; certbot only renews within 30 days of expiry).
# Uses the webroot that nginx serves at /.well-known/acme-challenge/, then reloads nginx with the new files.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v "$(pwd)/deploy/acme:/var/www/acme" certbot/certbot \
  renew --webroot -w /var/www/acme --quiet
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "/etc/letsencrypt/live/$DOMAIN/privkey.pem" deploy/certs/
chmod 600 deploy/certs/privkey.pem
docker compose exec -T nginx nginx -s reload
echo "$(date '+%F %T') certificate checked"
