"""Short-lived cache for anonymous public API reads (GET /api/v2/public/...).

The public catalog (hospitals, doctors, treatments, prices, CMS sections, blog) is the same for every visitor, so
a response is stored per URL + language for PUBLIC_CACHE_SECONDS. Any save / delete in a catalog app bumps a
version number, which makes all cached entries stale at once - edits in the admin show up immediately.

Requests with an Authorization header are never cached (they may be personalised). Responses carry
`X-Cache: HIT|MISS` for debugging. With REDIS_URL set the cache is shared by all gunicorn workers.
"""
from django.conf import settings
from django.core.cache import cache
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

PREFIX = "/api/v2/public/"
VERSION_KEY = "public-cache-version"
CATALOG_APPS = {"catalog", "clinics", "doctors", "core", "cms", "blog", "services"}


def _version():
    v = cache.get(VERSION_KEY)
    if v is None:
        v = 1
        cache.set(VERSION_KEY, v, None)
    return v


def bump_version(**kwargs):
    sender = kwargs.get("sender")
    if sender is not None and getattr(sender, "_meta", None) and sender._meta.app_label not in CATALOG_APPS:
        return
    try:
        cache.incr(VERSION_KEY)
    except ValueError:  # key missing (cache restarted)
        cache.set(VERSION_KEY, 2, None)


for _signal in (post_save, post_delete, m2m_changed):
    receiver(_signal, dispatch_uid=f"public-cache-{_signal}")(bump_version)


class PublicCacheMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.ttl = getattr(settings, "PUBLIC_CACHE_SECONDS", 120)

    def __call__(self, request):
        if (self.ttl <= 0 or request.method != "GET" or not request.path.startswith(PREFIX)
                or request.headers.get("Authorization")):
            return self.get_response(request)
        from django.utils.translation import get_language

        lang = (get_language() or settings.LANGUAGE_CODE)[:2]  # set by LocaleMiddleware / LanguageQueryMiddleware
        key = f"pub:{_version()}:{lang}:{request.get_full_path()}"
        hit = cache.get(key)
        if hit is not None:
            from django.http import HttpResponse

            content, content_type = hit
            response = HttpResponse(content, content_type=content_type)
            response["X-Cache"] = "HIT"
            response["Vary"] = "Accept-Language"
            return response
        response = self.get_response(request)
        if response.status_code == 200 and not response.streaming and "json" in response.get("Content-Type", ""):
            if hasattr(response, "render") and not getattr(response, "is_rendered", True):
                response.render()
            cache.set(key, (response.content, response["Content-Type"]), self.ttl)
        response["X-Cache"] = "MISS"
        return response
