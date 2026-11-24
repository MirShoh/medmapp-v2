from decimal import Decimal, InvalidOperation

from django.db.models import Avg, Min, Q
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.permissions import HasPerm
from audit.service import log as audit
from catalog.models import Treatment, TreatmentPrice
from core.models import Country, Specialty

from .matching import match_hospitals
from .models import ExchangeRate
from .rates import convert, refresh_from_api


class RatesView(APIView):
    def get(self, request):
        rates = ExchangeRate.objects.filter(base="USD")
        if not rates.exists():
            return Response({"configured": False, "rates": [],
                             "detail": "No exchange rates stored yet. An administrator must configure CURRENCY_API_URL "
                                       "or enter rates with their source."})
        return Response({"configured": True, "base": "USD",
                         "rates": [{"code": r.quote, "rate": r.rate, "source": r.source, "fetched_at": r.fetched_at}
                                   for r in rates]})


class ConvertView(APIView):
    def get(self, request):
        try:
            amount = Decimal(request.GET.get("amount", "0"))
        except InvalidOperation:
            return Response({"amount": "Invalid number."}, status=400)
        src, dst = request.GET.get("from", "USD").upper(), request.GET.get("to", "UZS").upper()
        result = convert(amount, src, dst)
        if result is None:
            return Response({"detail": f"No stored rate for {src}/{dst}."}, status=404)
        r = ExchangeRate.objects.filter(quote__in=[src, dst]).order_by("fetched_at").first()
        return Response({"amount": amount, "from": src, "to": dst, "result": result,
                         "source": r.source if r else "USD base", "fetched_at": r.fetched_at if r else None})


class RefreshRatesView(APIView):
    permission_classes = [HasPerm.of("integrations.edit")]

    def post(self, request):
        if request.data.get("manual"):
            code, val, src = request.data.get("code", "").upper(), request.data.get("rate"), request.data.get("source", "")
            if len(code) != 3 or not val or not src.strip():
                return Response({"detail": "Code, rate and the source of the rate are required."}, status=400)
            from django.utils import timezone

            ExchangeRate.objects.update_or_create(base="USD", quote=code, defaults={
                "rate": Decimal(str(val)), "source": src.strip()[:255], "fetched_at": timezone.now()})
            audit(request, "rates.manual_entry", summary=f"USD/{code}={val} ({src})")
            return Response({"ok": True})
        try:
            res = refresh_from_api()
        except Exception as exc:  # noqa: BLE001
            return Response({"ok": False, "detail": str(exc)[:300]}, status=502)
        audit(request, "rates.refreshed", summary=str(res)[:300])
        return Response(res, status=200 if res.get("ok") else 400)


class MatchView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_form"

    def post(self, request):
        d = request.data
        specialty = Specialty.objects.filter(pk=d.get("specialty") or 0).first()
        treatment = Treatment.objects.filter(pk=d.get("treatment") or 0).select_related("specialty").first()
        country = Country.objects.filter(pk=d.get("country") or 0).first()
        budget = d.get("budget_usd") or None
        if not (specialty or treatment):
            return Response({"detail": "Choose a treatment or specialty."}, status=400)
        results = match_hospitals(specialty, treatment, country, budget, d.get("language", ""),
                                  d.get("services") or [], request=request)
        return Response({"results": results,
                         "disclaimer": "Ranking is based on published, verified information only and is not a medical "
                                       "recommendation. A MedMapp coordinator and qualified doctors review every case."})


class DestinationFinderView(APIView):
    """Compare destinations for a treatment using stored estimated prices and partner hospital coverage."""

    def get(self, request):
        t = Treatment.objects.filter(Q(pk=request.GET.get("treatment") or 0) | Q(slug=request.GET.get("slug", "-"))).first()
        if not t:
            return Response({"detail": "Choose a treatment."}, status=400)
        rows = []
        for c in Country.objects.filter(is_destination=True, is_active=True):
            prices = TreatmentPrice.objects.filter(treatment=t, country=c, currency="USD")
            hospitals = c.cities.filter(hospitals__is_active=True, hospitals__treatments=t).values("hospitals").distinct().count()
            agg = prices.aggregate(lo=Min("price_from"), avg=Avg("price_from"))
            if not hospitals and agg["lo"] is None:
                continue
            last = prices.order_by("-updated_on").first()
            rows.append({"country": {"id": c.id, "name": c.name, "slug": c.slug, "flag": c.flag},
                         "hospitals": hospitals, "price_from_usd": agg["lo"],
                         "source": last.source if last else None, "updated_on": last.updated_on if last else None,
                         "visa_info_updated": c.visa_info_updated})
        rows.sort(key=lambda r: (r["price_from_usd"] is None, r["price_from_usd"] or 0))
        return Response({"treatment": {"id": t.id, "name": t.name, "slug": t.slug}, "destinations": rows,
                         "note": "Prices are published estimates, not quotations. Final cost is confirmed by the hospital."})


class CostCompareView(APIView):
    def get(self, request):
        t = Treatment.objects.filter(pk=request.GET.get("treatment") or 0).first()
        if not t:
            return Response({"detail": "Choose a treatment."}, status=400)
        from catalog.serializers import TreatmentPriceSerializer

        prices = TreatmentPrice.objects.filter(treatment=t).select_related("country", "hospital", "treatment")
        return Response({"treatment": t.name, "prices": TreatmentPriceSerializer(prices, many=True).data})
