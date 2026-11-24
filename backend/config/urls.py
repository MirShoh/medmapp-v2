import os

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

schema_view = get_schema_view(
    openapi.Info(title="MedMapp API", default_version="v2",
                 description="MedMapp 2.0 REST API — public catalog, forms, patient portal, partner portal, staff CRM."),
    public=True,
    permission_classes=(permissions.AllowAny,),
    # Document the current API only; the old /api/v1/ endpoints are kept for backwards compatibility.
    patterns=[path("api/v2/", include("config.api_v2"))],
)

admin.site.site_header = "MedMapp — Django admin"


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    # Django admin moved from /admin/ (the Next.js staff console lives at /admin)
    path("django-admin/", admin.site.urls),
    path("api/health/", health),
    path("api/v2/", include("config.api_v2")),
    # Legacy v1 API (kept for backward compatibility)
    path("api/v1/core", include("core.urls")),
    path("api/v1/services", include("services.urls")),
    path("api/v1/clinics", include("clinics.urls")),
    path("api/v1/doctors/", include("doctors.urls")),
    path("api/v1/blog/", include("blog.urls")),
    re_path(r"^swagger\.(?P<format>json|yaml)$", schema_view.without_ui(cache_timeout=0), name="schema-json"),
    path("swagger/", schema_view.with_ui("swagger", cache_timeout=0), name="schema-swagger-ui"),
    path("redoc/", schema_view.with_ui("redoc", cache_timeout=0), name="schema-redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif os.getenv("SERVE_MEDIA") == "1":
    # Local "share" mode (start.ps1 -Share): DEBUG is off but there is no nginx, so Django serves public media.
    # Private medical files live outside MEDIA_ROOT and are never reachable here.
    from django.views.static import serve
    urlpatterns += [re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT})]
