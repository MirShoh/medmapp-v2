#!/bin/sh
# Nightly backup: database dump + private medical files. Run from cron on the Docker host:
#   0 2 * * * /opt/medmapp/deploy/backup.sh >> /var/log/medmapp-backup.log 2>&1
# Store the output directory on encrypted, off-site storage. Keep at least 30 days.
set -e
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M)
OUT=${BACKUP_DIR:-/var/backups/medmapp}/$STAMP
mkdir -p "$OUT"
docker compose exec -T db pg_dump -U "${DB_USER:-medmapp}" -Fc "${DB_NAME:-medmapp}" > "$OUT/db.dump"
docker compose run --rm -u root -v "$OUT":/out backend tar czf /out/private_media.tgz -C /data private_media media
find "${BACKUP_DIR:-/var/backups/medmapp}" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "backup ok: $OUT"
# Restore: pg_restore -U medmapp -d medmapp --clean db.dump ; tar xzf private_media.tgz -C /data
