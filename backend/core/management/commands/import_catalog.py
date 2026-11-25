"""Load a catalogue zip made by `export_catalog` into this database and MEDIA_ROOT.

Run it on a fresh database right after `migrate` and before anything else fills the catalogue (the Docker
entrypoint runs `seed_reference`, which then updates the imported rows by slug):

    docker compose run --rm backend sh -c "python manage.py migrate && python manage.py import_catalog /import/medmapp-catalog.zip"

Refuses to run when the database already has hospitals, unless --force (rows are then matched by primary key).
"""
import json
import zipfile
from pathlib import Path

from django.conf import settings
from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = "Import a catalogue zip made by export_catalog (data + public photos)."

    def add_arguments(self, parser):
        parser.add_argument("archive")
        parser.add_argument("--force", action="store_true", help="import even if the catalogue is not empty")

    def handle(self, *args, archive, force=False, **options):
        from clinics.models import Hospital

        if Hospital.objects.exists() and not force:
            raise CommandError("The database already has hospitals. Import into a fresh database, or use --force.")
        media = Path(settings.MEDIA_ROOT)
        with zipfile.ZipFile(archive) as z:
            rows = json.loads(z.read("catalog.json"))
            photos = [n for n in z.namelist() if n.startswith("media/") and not n.endswith("/")]
            for name in photos:
                rel = Path(name[len("media/"):])
                if rel.is_absolute() or ".." in rel.parts:  # never write outside MEDIA_ROOT
                    raise CommandError(f"Unsafe path in archive: {name}")
                target = media / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(name))
        with transaction.atomic():
            objects = list(serializers.deserialize("json", json.dumps(rows), ignorenonexistent=True))
            for obj in objects:
                obj.save()
        self._reset_sequences({type(o.object) for o in objects})
        self.stdout.write(self.style.SUCCESS(f"{len(objects)} records and {len(photos)} photos imported"))

    def _reset_sequences(self, models):
        """PostgreSQL: move id sequences past the imported ids so new rows do not collide."""
        from django.core.management.color import no_style
        from django.db import connection

        sql = connection.ops.sequence_reset_sql(no_style(), list(models))
        if sql:
            with connection.cursor() as cur:
                for stmt in sql:
                    cur.execute(stmt)
