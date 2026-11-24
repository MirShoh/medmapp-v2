"""Transparent rule-based hospital matching. Every point awarded is explained in `reasons`.

This ranks *published, verified* data only; it is not a medical recommendation. A MedMapp
coordinator and qualified doctors review every case.
"""
from decimal import Decimal

from django.db.models import Min, Q

from catalog.serializers import HospitalCard
from clinics.models import Hospital


def match_hospitals(specialty=None, treatment=None, country=None, budget_usd=None, language="", services=(),
                    limit=8, request=None):
    qs = (Hospital.objects.filter(is_active=True).select_related("city__country")
          .prefetch_related("specialties", "accreditations", "treatments")
          .annotate(min_price_usd=Min("packages__price", filter=Q(packages__currency="USD", packages__is_active=True))))
    if specialty:
        qs = qs.filter(Q(specialties=specialty) | Q(treatments__specialty=specialty))
    if treatment:
        qs = qs.filter(Q(treatments=treatment) | Q(specialties=treatment.specialty))
    results = []
    for h in qs.distinct():
        score, reasons = 0, []
        if treatment and treatment in h.treatments.all():
            score += 30
            reasons.append("Offers the requested treatment")
        elif specialty or treatment:
            score += 18
            reasons.append("Has the relevant specialty department")
        if h.is_verified:
            score += 15
            reasons.append("Profile verified by MedMapp")
        acc = [a.code for a in h.accreditations.all()]
        if acc:
            score += min(10, 5 * len(acc))
            reasons.append("Accreditation: " + ", ".join(acc))
        if country and h.city.country_id == country.pk:
            score += 20
            reasons.append(f"Located in preferred destination ({country.name})")
        if budget_usd and h.min_price_usd is not None:
            if h.min_price_usd <= Decimal(budget_usd):
                score += 15
                reasons.append("Published package price within budget")
            else:
                score -= 5
                reasons.append("Published package price above budget")
        if language and language.lower() in (h.languages or "").lower():
            score += 10
            reasons.append(f"Supports {language}")
        for s in services or []:
            if s.lower() in (h.services_available or "").lower():
                score += 3
                reasons.append(f"Provides: {s}")
        if h.is_popular:
            score += 2
        results.append((score, h, reasons))
    results.sort(key=lambda x: (-x[0], x[1].name))
    ctx = {"request": request}
    return [{"score": s, "reasons": r, "hospital": HospitalCard(h, context=ctx).data} for s, h, r in results[:limit]]
