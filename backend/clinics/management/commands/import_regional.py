"""Add well-known hospitals (India, Turkey, Azerbaijan, Uzbekistan, Germany, South Korea, UAE, Thailand) to the catalogue.

Idempotent (matched by slug). Only fields this import manages are overwritten; staff edits to photos, logos,
verification, contacts, packages and prices are kept. Descriptions are only filled while empty.
Hospitals are never marked verified here: staff confirm details with each hospital first.

    python manage.py import_regional
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Accreditation, Treatment
from clinics.models import Hospital
from core.models import City, Country, Specialty

from . import _regional_data as D
from . import _regional_data_more as M

CITIES = {**D.CITIES, **M.CITIES}
HOSPITALS = D.HOSPITALS + M.HOSPITALS

LANGS = ("uz", "ru", "en")


def tr(obj, field, values, only_empty=False):
    """Set field_uz/_ru/_en from a (uz, ru, en) tuple; the base field mirrors Uzbek (default language)."""
    for lang, v in zip(LANGS, values, strict=False):
        if only_empty and getattr(obj, f"{field}_{lang}", ""):
            continue
        setattr(obj, f"{field}_{lang}", v)
    if not only_empty or not getattr(obj, field, ""):
        setattr(obj, field, values[0])


class Command(BaseCommand):
    help = "Import well-known hospitals in 8 countries (unverified catalogue entries)."

    @transaction.atomic
    def handle(self, *args, **opts):
        countries = {c.slug: c for c in Country.objects.filter(slug__in={v[0] for v in CITIES.values()})}
        missing = {v[0] for v in CITIES.values()} - set(countries)
        if missing:
            raise SystemExit(f"Run `python manage.py seed_reference` first (missing countries: {', '.join(sorted(missing))})")

        for slug, fields in D.COUNTRY_TEXT.items():
            c = countries[slug]
            tr(c, "tagline", fields["tagline"], only_empty=True)
            tr(c, "intro", fields["intro"], only_empty=True)
            if not c.languages:
                c.languages = fields["languages"]
            c.save()

        cities = {}
        for key, (country_slug, names) in CITIES.items():
            country = countries[country_slug]
            city = (City.objects.filter(country=country, name_en=names[2]).first()
                    or City.objects.filter(country=country, name__in=names).first() or City(country=country))
            tr(city, "name", names)
            city.save()
            cities[key] = city

        specialties = {s.slug: s for s in Specialty.objects.all()}
        treatments = {t.slug: t for t in Treatment.objects.all()}
        accreditations = {a.code: a for a in Accreditation.objects.all()}
        created = 0
        for x in HOSPITALS:
            obj = Hospital.objects.filter(slug=x["slug"]).first()
            if obj is None:
                obj, created = Hospital(slug=x["slug"], is_verified=False), created + 1
            tr(obj, "name", x["name"])
            tr(obj, "short_description", x["short"])
            tr(obj, "meta_description", x["short"])
            tr(obj, "description", x["short"], only_empty=True)
            obj.city = cities[x["city"]]
            obj.hospital_type = x["type"]
            if x["founded"] and not obj.founded_year:
                obj.founded_year = x["founded"]
            if x["website"] and not obj.website:
                obj.website = x["website"]
            obj.is_active = True
            obj.save()
            obj.specialties.set([specialties[s] for s in x["specialties"] if s in specialties])
            obj.treatments.set([treatments[t] for t in x["treatments"] if t in treatments])
            obj.accreditations.set([accreditations[a] for a in x["accreditations"] if a in accreditations])

        by_country = {}
        for x in HOSPITALS:
            c = CITIES[x["city"]][0]
            by_country[c] = by_country.get(c, 0) + 1
        self.stdout.write(self.style.SUCCESS(
            f"Regional hospitals: {len(HOSPITALS)} ({created} new) — "
            + ", ".join(f"{k}: {v}" for k, v in sorted(by_country.items()))))
