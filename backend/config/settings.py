"""MedMapp 2.0 backend settings.

All secrets come from environment variables (see ../.env.example).
"""
import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [x.strip() for x in os.getenv(name, default).split(",") if x.strip()]


DEBUG = env_bool("DEBUG", False)
SECRET_KEY = os.getenv("SECRET_KEY") or ("dev-insecure-key-change-me" if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required when DEBUG is off")
if not DEBUG and len(SECRET_KEY) < 50:
    raise RuntimeError("SECRET_KEY must be at least 50 random characters on a server (it signs logins, file links and SMS codes)")

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "127.0.0.1,localhost")

INSTALLED_APPS = [
    "modeltranslation",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "solo",
    "adminsortable2",
    "drf_yasg",
    # legacy local apps (preserved)
    "core.apps.CoreConfig",
    "services",
    "clinics",
    "doctors",
    "blog",
    # MedMapp 2.0 apps
    "accounts",
    "audit",
    "catalog",
    "crm",
    "cases",
    "finance",
    "notifications",
    "cms",
    "assistant",
    "tools",
    "analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "config.middleware.LanguageQueryMiddleware",
    "django.middleware.common.CommonMiddleware",
    "config.public_cache.PublicCacheMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Cache: Redis when REDIS_URL is set (shared by all gunicorn workers: rate limits, public API cache);
# otherwise an in-process memory cache (fine for local development).
if os.getenv("REDIS_URL"):
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": os.getenv("REDIS_URL"),
                          "KEY_PREFIX": "medmapp"}}
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "medmapp"}}
PUBLIC_CACHE_SECONDS = int(os.getenv("PUBLIC_CACHE_SECONDS", "120"))  # 0 disables (config/public_cache.py)

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database: PostgreSQL in production, SQLite fallback for local dev/tests ---
if os.getenv("DB_ENGINE", "postgres").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.getenv("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "medmapp"),
            "USER": os.getenv("DB_USER", "medmapp"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGES = [("uz", "O‘zbekcha"), ("ru", "Русский"), ("en", "English")]
LANGUAGE_CODE = "uz"
MODELTRANSLATION_DEFAULT_LANGUAGE = "uz"
MODELTRANSLATION_FALLBACK_LANGUAGES = ("uz", "en", "ru")
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [p for p in (BASE_DIR / "static",) if p.exists()]
STATIC_ROOT = BASE_DIR / "staticfiles"

# Public media (hospital photos, blog images...)
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", BASE_DIR / "media"))
# Private medical documents: NEVER served by URL. Only via signed, expiring API downloads.
PRIVATE_MEDIA_ROOT = Path(os.getenv("PRIVATE_MEDIA_ROOT", BASE_DIR / "private_media"))
CKEDITOR_UPLOAD_PATH = "uploads/"

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "25"))
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
ALLOWED_DOCUMENT_EXTENSIONS = env_list(
    "ALLOWED_DOCUMENT_EXTENSIONS", "pdf,jpg,jpeg,png,webp,dcm,doc,docx,txt,zip"
)
SIGNED_URL_TTL_SECONDS = int(os.getenv("SIGNED_URL_TTL_SECONDS", "600"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 24,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    # Requests reach Django through one proxy (Nginx in production, the Next.js rewrite locally); use the client
    # address it adds to X-Forwarded-For, otherwise every visitor would share the proxy's single rate-limit bucket.
    "NUM_PROXIES": int(os.getenv("NUM_PROXIES", "1")),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "120/min"),
        "user": os.getenv("THROTTLE_USER", "600/min"),
        "auth": os.getenv("THROTTLE_AUTH", "10/min"),
        "sms": os.getenv("THROTTLE_SMS", "10/hour"),
        # Restoring a session happens on every page load, so it gets its own, wider limit (it needs a valid cookie anyway).
        "auth_refresh": os.getenv("THROTTLE_AUTH_REFRESH", "120/min"),
        "public_form": os.getenv("THROTTLE_FORM", "10/min"),
        "assistant": os.getenv("THROTTLE_ASSISTANT", "20/min"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# --- Security hardening (production) ---
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# --- Email ---
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "MedMapp <no-reply@medmapp.uz>")

# --- Integrations (all optional; status exposed at /api/v2/admin/integrations/) ---
INTEGRATIONS = {
    "telegram_bot_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
    "telegram_chat_id": os.getenv("TELEGRAM_CHAT_ID", ""),
    "whatsapp_token": os.getenv("WHATSAPP_TOKEN", ""),
    "whatsapp_phone_id": os.getenv("WHATSAPP_PHONE_ID", ""),
    "google_maps_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
    "currency_api_url": os.getenv("CURRENCY_API_URL", ""),
    "currency_api_key": os.getenv("CURRENCY_API_KEY", ""),
    "ai_api_key": os.getenv("ANTHROPIC_API_KEY", ""),
    "ai_model": os.getenv("AI_MODEL", "claude-opus-5-5"),
    "payment_provider": os.getenv("PAYMENT_PROVIDER", ""),
}

# --- Passwordless patient sign-in (accounts/social.py) ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")  # OAuth "Web application" client from Google Cloud Console
SMS_LOGIN_ENABLED = env_bool("SMS_LOGIN_ENABLED", True)
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "console")  # console (log only, development) | eskiz
ESKIZ_EMAIL = os.getenv("ESKIZ_EMAIL", "")
ESKIZ_PASSWORD = os.getenv("ESKIZ_PASSWORD", "")
ESKIZ_FROM = os.getenv("ESKIZ_FROM", "4546")
# Request numbers: MM-0001, MM-0002, ...
REFERENCE_PREFIX = os.getenv("REFERENCE_PREFIX", "MM")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
}

SWAGGER_USE_COMPAT_RENDERERS = False  # drf-yasg >= 1.21.8: format without the leading dot

SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {"Bearer": {"type": "apiKey", "name": "Authorization", "in": "header"}},
}

# django-ckeditor was removed (CKEditor 4 is end-of-life). The package stays in requirements only because
# historical migrations import ckeditor.fields. Rich text is now stored as plain TextField and sanitized with nh3.
