"""Import MedMapp's partner hospitals and doctors (MediConnex Shanghai network) and remove [DEMO] catalogue records.

Idempotent: re-running updates the same records (matched by slug). Staff edits to fields that the import does not
manage (photos, logos, verification, packages, languages, contacts) are kept.

    python manage.py import_partners            # import + remove demo hospitals/doctors/prices
    python manage.py import_partners --keep-demo
"""
from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Account
from catalog.models import Accreditation, Treatment, TreatmentPackage, TreatmentPrice
from clinics.models import Hospital
from core.models import City, Country, Specialty
from doctors.models import Doctor

from . import _partner_data as D

LANGS = ("uz", "ru", "en")


def tr(obj, field, values):
    """Set field_uz/_ru/_en from a (uz, ru, en) tuple; the base field mirrors Uzbek (default language)."""
    for lang, v in zip(LANGS, values, strict=False):
        setattr(obj, f"{field}_{lang}", v)
    setattr(obj, field, values[0])


def lines(values):
    return tuple("\n".join(v) for v in values)


class Command(BaseCommand):
    help = "Import partner hospitals/doctors (MediConnex, Shanghai) and remove [DEMO] catalogue data."

    def add_arguments(self, parser):
        parser.add_argument("--keep-demo", action="store_true", help="Do not delete [DEMO] hospitals and doctors")

    @transaction.atomic
    def handle(self, *args, **opts):
        china = Country.objects.get(slug="china")
        city = City.objects.filter(country=china, name_en="Shanghai").first() or City.objects.filter(country=china, name="Shanghai").first() \
            or City(country=china)
        tr(city, "name", ("Shanxay", "Шанхай", "Shanghai"))
        city.save()

        for slug, icon, names in D.SPECIALTIES:
            s = Specialty.objects.filter(slug=slug).first() or Specialty(slug=slug, order=100)
            if not s.icon:
                s.icon = icon
            if not s.title_en or s.title_en == s.title_uz:
                tr(s, "title", names)
            s.is_active = True
            s.save()

        for code, name, desc in D.ACCREDITATIONS:
            Accreditation.objects.update_or_create(code=code, defaults={"name": name, "description": desc})

        hospitals = {}
        for h in D.HOSPITALS:
            obj = Hospital.objects.filter(slug=h["slug"]).first() or Hospital(slug=h["slug"])
            tr(obj, "name", (h["name"],) * 3)
            tr(obj, "short_description", h["short"])
            tr(obj, "description", h["desc"])
            tr(obj, "meta_description", h["short"])
            tr(obj, "facilities", lines(h["facilities"]))
            obj.city = city
            obj.founded_year = h["founded"]
            obj.bed_count = h["beds"] or 0
            obj.hospital_type = h["type"]
            obj.is_active = True
            obj.is_popular = True
            obj.save()
            obj.specialties.set(Specialty.objects.filter(slug__in=h["specialties"]))
            obj.treatments.set(Treatment.objects.filter(slug__in=h["treatments"]))
            obj.accreditations.set(Accreditation.objects.filter(code__in=h["accreditations"]))
            hospitals[h["slug"]] = obj

        for (slug, name, _zh, hosp, spec, dept, position, years, education, expertise, bio) in D.DOCTORS:
            d = Doctor.objects.filter(slug=slug).first() or Doctor(slug=slug)
            tr(d, "full_name", (name,) * 3)
            tr(d, "specialty_title", D.DEPT[dept])
            tr(d, "position", position)
            tr(d, "expertise", lines(expertise))
            tr(d, "biography", bio)
            tr(d, "education", ("\n".join(education),) * 3)
            tr(d, "meta_description", bio)
            d.specialty = Specialty.objects.filter(slug=spec).first() if spec else None
            d.experience_years = years
            d.is_active = True
            d.is_popular = years >= 30
            d.save()
            d.hospitals.set([hospitals[hosp]])

        updated = date.fromisoformat(D.SOURCE_DATE)
        source = f"{D.SOURCE} — indicative band, not a quotation"
        for t_slug, lo, hi in D.PRICES:
            t = Treatment.objects.filter(slug=t_slug).first()
            if not t:
                continue
            TreatmentPrice.objects.update_or_create(
                treatment=t, country=china, hospital=None, source=source,
                defaults={"price_from": lo, "price_to": hi, "currency": "GBP", "updated_on": updated})

        removed = 0
        if not opts["keep_demo"]:
            demo = Hospital.objects.filter(slug__startswith="demo-")
            first_real = hospitals[D.HOSPITALS[0]["slug"]]
            Account.objects.filter(hospital__in=demo).update(hospital=first_real)
            TreatmentPrice.objects.filter(source__startswith="[DEMO]").delete()
            TreatmentPackage.objects.filter(slug__startswith="demo-").delete()
            removed = Doctor.objects.filter(slug__startswith="demo-").delete()[0]
            removed += demo.delete()[0]

        self.stdout.write(self.style.SUCCESS(
            f"Partners imported: {len(hospitals)} hospitals, {len(D.DOCTORS)} doctors, {len(D.PRICES)} price bands"
            + (f"; removed {removed} demo records" if removed else "")))
