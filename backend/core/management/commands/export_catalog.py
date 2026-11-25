"""Pack the public catalogue (hospitals, doctors, treatments, countries, blog, pages, site settings) and every
public photo into one zip, to move it to a server: `manage.py export_catalog medmapp-catalog.zip`.

Not included: users, patients, leads, chats, cases, payments, medical documents (private files live in
PRIVATE_MEDIA_ROOT, which is never read here). Blog post authors are dropped (they are local user accounts).
Load it on the server with `manage.py import_catalog`.
"""
import json
import zipfile
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core import serializers
from django.core.management.base import BaseCommand

CATALOG_APPS = ("core", "clinics", "doctors", "catalog", "blog", "cms", "services")
USER_FIELDS = {"author", "user", "created_by", "updated_by"}


def catalog_models():
    out = []
    for label in CATALOG_APPS:
        try:
            out += list(apps.get_app_config(label).get_models())
        except LookupError:
            continue
    return out


class Command(BaseCommand):
    help = "Export the public catalogue and its photos to a zip file."

    def add_arguments(self, parser):
        parser.add_argument("output", nargs="?", default="medmapp-catalog.zip")

    def handle(self, *args, output, **options):
        rows = []
        for model in catalog_models():
            data = json.loads(serializers.serialize("json", model._default_manager.all().order_by("pk")))
            for row in data:
                for f in USER_FIELDS & set(row["fields"]):
                    row["fields"][f] = None
            rows += data
            if data:
                self.stdout.write(f"  {model._meta.label:32s} {len(data)}")
        media = Path(settings.MEDIA_ROOT)
        private = Path(settings.PRIVATE_MEDIA_ROOT).resolve()
        files = 0
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("catalog.json", json.dumps(rows, ensure_ascii=False))
            if media.exists():
                for f in sorted(media.rglob("*")):
                    if f.is_file() and private not in f.resolve().parents:
                        z.write(f, f"media/{f.relative_to(media).as_posix()}", compress_type=zipfile.ZIP_STORED)
                        files += 1
        size = Path(output).stat().st_size / 1024 / 1024
        self.stdout.write(self.style.SUCCESS(f"{len(rows)} records and {files} photos -> {output} ({size:.1f} MB)"))
