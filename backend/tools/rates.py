"""Exchange rates. Never fabricated: rates come from the configured API or an admin-entered named source."""
from decimal import Decimal

import requests as http
from django.conf import settings
from django.utils import timezone

from .models import ExchangeRate


def refresh_from_api():
    cfg = settings.INTEGRATIONS
    url = cfg["currency_api_url"]
    if not url:
        return {"ok": False, "detail": "CURRENCY_API_URL is not configured."}
    headers = {"apikey": cfg["currency_api_key"]} if cfg["currency_api_key"] else {}
    r = http.get(url, headers=headers, timeout=10)
    r.raise_for_status()
    data = r.json()
    rates = data.get("rates") or data.get("conversion_rates") or {}
    base = (data.get("base") or data.get("base_code") or "USD").upper()
    if base != "USD" or not rates:
        return {"ok": False, "detail": f"Unexpected API response (base={base}, {len(rates)} rates)."}
    now = timezone.now()
    host = url.split("/")[2] if "//" in url else url
    for code, val in rates.items():
        if len(code) == 3:
            ExchangeRate.objects.update_or_create(base="USD", quote=code.upper(),
                                                  defaults={"rate": Decimal(str(val)), "source": host, "fetched_at": now})
    return {"ok": True, "count": len(rates), "source": host, "fetched_at": now}


def rate(code):
    code = code.upper()
    if code == "USD":
        return Decimal(1)
    r = ExchangeRate.objects.filter(base="USD", quote=code).first()
    return r.rate if r else None


def to_usd(amount, code):
    r = rate(code)
    if r in (None, 0):
        return None
    return (Decimal(amount) / r).quantize(Decimal("0.01"))


def convert(amount, src, dst):
    a, b = rate(src), rate(dst)
    if a in (None, 0) or b is None:
        return None
    return (Decimal(amount) / a * b).quantize(Decimal("0.01"))
