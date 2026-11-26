#!/bin/sh
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_reference
python manage.py make_thumbnails   # card-size copies of catalogue photos (skips existing ones)
# gthread workers: each process serves several requests at once, so short live-chat polls and badge checks never
# queue behind a slow request. Workers are recycled after N requests to keep memory flat.
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}   --worker-class gthread --workers ${GUNICORN_WORKERS:-3} --threads ${GUNICORN_THREADS:-4}   --timeout 120 --keep-alive 5 --max-requests 2000 --max-requests-jitter 200 --access-logfile -
