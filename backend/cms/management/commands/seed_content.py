"""Public-site editorial content: destination pages, indicative prices, notable doctors, FAQ and blog guides.

Idempotent and safe to re-run: text fields are only filled while empty, so anything staff edit in the admin is kept.
Prices from this command are matched by their source label and refreshed; hospital quotations are never touched.

    python manage.py seed_content
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from blog.models import BlogCategory, Post
from catalog.models import FAQ, Treatment, TreatmentPrice
from clinics.models import Hospital
from core.models import Country, Specialty
from doctors.models import Doctor

from . import _blog_data as B
from . import _content_data as C

LANGS = ("uz", "ru", "en")


def fill(obj, field, values):
    """Fill field_uz/_ru/_en only where empty; the base field mirrors Uzbek."""
    for lang, v in zip(LANGS, values, strict=False):
        if not getattr(obj, f"{field}_{lang}", ""):
            setattr(obj, f"{field}_{lang}", v)
    if not getattr(obj, field, ""):
        setattr(obj, field, values[0])


class Command(BaseCommand):
    help = "Fill destination pages, indicative prices, notable doctors, FAQ and blog guides (never overwrites staff edits)."

    @transaction.atomic
    def handle(self, *args, **opts):
        # destinations
        for slug, d in C.COUNTRIES.items():
            c = Country.objects.filter(slug=slug).first()
            if not c:
                continue
            for field in ("tagline", "intro", "medical_overview", "travel_info", "visa_info"):
                fill(c, field, d[field])
            if not c.visa_info_source:
                c.visa_info_source = d["visa_info_source"]
                c.visa_info_updated = date.fromisoformat(C.VISA_DATE)
            if not c.languages:
                c.languages = d["languages"]
            c.save()

        # indicative prices
        n_prices = 0
        for country_slug, rows in C.PRICES.items():
            country = Country.objects.get(slug=country_slug)
            for t_slug, lo, hi in rows:
                t = Treatment.objects.filter(slug=t_slug).first()
                if not t:
                    continue
                TreatmentPrice.objects.update_or_create(
                    treatment=t, country=country, hospital=None, source=C.PRICE_SOURCE,
                    defaults={"price_from": lo, "price_to": hi, "currency": "USD", "updated_on": date.fromisoformat(C.VISA_DATE)})
                n_prices += 1

        # notable doctors
        for d in C.DOCTORS:
            h = Hospital.objects.filter(slug=d["hospital"]).first()
            if not h:
                continue
            doc = Doctor.objects.filter(slug=d["slug"]).first() or Doctor(slug=d["slug"], experience_years=0)
            fill(doc, "full_name", (d["name"],) * 3)
            fill(doc, "specialty_title", d["title"])
            fill(doc, "position", d["position"])
            fill(doc, "biography", d["bio"])
            fill(doc, "meta_description", d["bio"])
            doc.specialty = doc.specialty or Specialty.objects.filter(slug=d["specialty"]).first()
            doc.is_active = True
            doc.is_popular = True
            doc.save()
            doc.hospitals.add(h)

        # general FAQ
        for i, (q_uz, q_ru, q_en, a_uz, a_ru, a_en) in enumerate(C.FAQS):
            f = FAQ.objects.filter(scope="general", question_uz=q_uz).first() or FAQ(scope="general", order=i)
            fill(f, "question", (q_uz, q_ru, q_en))
            fill(f, "answer", (a_uz, a_ru, a_en))
            f.is_active = True
            f.save()

        # blog
        cats = {}
        for slug, names in B.CATEGORIES.items():
            cat = BlogCategory.objects.filter(slug=slug).first() or BlogCategory(slug=slug)
            fill(cat, "name", names)
            cat.save()
            cats[slug] = cat
        now = timezone.now()
        for p in B.POSTS:
            post = Post.objects.filter(slug=p["slug"]).first()
            if post is None:
                post = Post(slug=p["slug"], status="published", published_date=now - timedelta(days=p["days_ago"]))
            fill(post, "title", p["title"])
            fill(post, "summary", p["summary"])
            fill(post, "content", p["content"])
            fill(post, "meta_title", p["title"])
            fill(post, "meta_description", p["summary"])
            post.category = post.category or cats[p["category"]]
            post.save()

        self.stdout.write(self.style.SUCCESS(
            f"Content: {len(C.COUNTRIES)} destination pages, {n_prices} indicative prices, {len(C.DOCTORS)} doctors, "
            f"{len(C.FAQS)} FAQ, {len(B.POSTS)} blog posts"))
