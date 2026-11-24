"""Attach freely licensed hospital photos (Wikimedia Commons, via each hospital's Wikidata main image).

Files live in clinics/seed_media/hospitals/<slug>.webp with author/licence in credits.json.
A photo is only attached when the hospital has no image yet, so staff uploads are never replaced.

    python manage.py import_hospital_photos
"""
import json
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from clinics.models import Hospital

DIR = Path(__file__).resolve().parents[2] / "seed_media" / "hospitals"


class Command(BaseCommand):
    help = "Attach credited Wikimedia Commons photos to hospitals that have no image."

    def handle(self, *args, **opts):
        credits_file = DIR / "credits.json"
        if not credits_file.exists():
            self.stdout.write("No hospital photos bundled.")
            return
        credits = json.loads(credits_file.read_text(encoding="utf-8"))
        added = 0
        for slug, meta in credits.items():
            src = DIR / f"{slug}.webp"
            h = Hospital.objects.filter(slug=slug).first()
            if not h or not src.exists() or h.image:
                continue
            with src.open("rb") as f:
                h.image.save(f"{slug}.webp", File(f), save=False)
            h.image_credit = meta["credit"][:255]
            h.image_source = meta["source"]
            h.save(update_fields=["image", "image_credit", "image_source"])
            added += 1
        self.stdout.write(self.style.SUCCESS(f"Hospital photos attached: {added} (bundled: {len(credits)})"))
