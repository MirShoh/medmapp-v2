"""Rate limits that do not apply to the site's own server.

Next.js renders public pages on the server and fetches the API from one address (the web container). Counted as
an anonymous visitor, that address hit the 120/min limit as soon as pages were rebuilt or refreshed in bulk, and
pages failed with HTTP 429. Requests carrying the shared INTERNAL_API_TOKEN (header X-Internal-Token) skip the
anonymous/user limits; every other client is limited as before. Without a token configured nothing is exempt.
"""
import hmac

from django.conf import settings
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


def is_internal(request) -> bool:
    token = getattr(settings, "INTERNAL_API_TOKEN", "")
    sent = request.META.get("HTTP_X_INTERNAL_TOKEN", "")
    return bool(token) and bool(sent) and hmac.compare_digest(sent, token)


class SiteAnonThrottle(AnonRateThrottle):
    def allow_request(self, request, view):
        return True if is_internal(request) else super().allow_request(request, view)


class SiteUserThrottle(UserRateThrottle):
    def allow_request(self, request, view):
        return True if is_internal(request) else super().allow_request(request, view)
