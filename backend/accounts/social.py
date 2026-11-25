"""Passwordless patient sign-in: one-time SMS code and "Sign in with Google".

Both only ever open *patient* accounts. Staff and hospital partners keep their own password login, so a stolen
phone or Google account can never reach the admin or partner portals through these routes.

SMS: `SMS_PROVIDER=console` (default; the code is written to the server log, for local development) or `eskiz`
(Eskiz.uz: ESKIZ_EMAIL / ESKIZ_PASSWORD / ESKIZ_FROM). Codes are stored hashed, live 5 minutes, allow 5 attempts,
and one phone can ask for a new code once a minute and 5 times an hour.

Google: the browser gets an ID token from Google Identity Services; we verify it with Google (audience must be our
GOOGLE_CLIENT_ID, email must be verified) and sign the patient in by that email.
"""
import hashlib
import hmac
import json
import logging
import secrets
import urllib.parse
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.service import client_ip
from audit.service import log as audit

from .api import AuthThrottle, token_response
from .models import Account, OtpCode, Role

User = get_user_model()
log = logging.getLogger("medmapp.auth")

CODE_TTL = timedelta(minutes=5)
MAX_ATTEMPTS = 5
RESEND_AFTER = timedelta(seconds=60)
MAX_PER_HOUR = 5


# ----------------------------------------------------------------------------- helpers
def normalize_phone(raw):
    """'+998 (90) 123-45-67' / '90 123 45 67' -> '998901234567'. Returns '' when it is not a plausible number."""
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) == 9:  # local Uzbek number without the country code
        digits = "998" + digits
    return digits if 10 <= len(digits) <= 15 else ""


def code_hash(phone, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def account_by_phone(phone):
    """Accounts store the phone as typed; compare digits only."""
    for acc in Account.objects.filter(phone__contains=phone[-4:]).select_related("user"):
        if normalize_phone(acc.phone) == phone:
            return acc
    return None


def create_patient(request, *, full_name, phone="", email="", method):
    from cases.models import ConsentRecord
    from crm.services import get_or_create_patient

    first, _, last = (full_name or "").strip().partition(" ")
    username = email.lower() if email else f"phone-{phone}"
    user = User(username=username, email=email.lower(), first_name=first[:150], last_name=last[:150])
    user.set_unusable_password()  # passwordless account; a password can be added later via "forgot password"
    user.save()
    Account.objects.create(user=user, role=Role.PATIENT, phone=f"+{phone}" if phone else "",
                           preferred_language=(request.data.get("preferred_language") or "uz")[:2])
    patient = get_or_create_patient(user.get_full_name() or username, f"+{phone}" if phone else "", email, user=user)
    ConsentRecord.objects.create(patient=patient, scope="data_processing", ip_address=client_ip(request), recorded_by=user)
    audit(request, "auth.registered", user, actor=user, summary=method)
    return user


def patient_only(acc):
    if acc.role != Role.PATIENT:
        return Response({"detail": "This sign-in method is only for patients. Staff and partners use their own login page.",
                         "code": "not_patient"}, status=403)
    if not acc.user.is_active:
        return Response({"detail": "This account is disabled."}, status=403)
    return None


# ----------------------------------------------------------------------------- SMS delivery
def send_sms(phone, text):
    provider = getattr(settings, "SMS_PROVIDER", "console")
    if provider == "eskiz":
        return _eskiz_send(phone, text)
    log.warning("SMS to +%s: %s", phone, text)  # console provider: development only
    return True


def _eskiz_token(force=False):
    tok = None if force else cache.get("eskiz_token")
    if tok:
        return tok
    data = urllib.parse.urlencode({"email": settings.ESKIZ_EMAIL, "password": settings.ESKIZ_PASSWORD}).encode()
    with urllib.request.urlopen(urllib.request.Request("https://notify.eskiz.uz/api/auth/login", data=data), timeout=15) as r:
        tok = json.load(r)["data"]["token"]
    cache.set("eskiz_token", tok, 60 * 60 * 24 * 20)  # tokens live 30 days
    return tok


def _eskiz_send(phone, text, retry=True):
    data = urllib.parse.urlencode({"mobile_phone": phone, "message": text, "from": settings.ESKIZ_FROM}).encode()
    req = urllib.request.Request("https://notify.eskiz.uz/api/message/sms/send", data=data,
                                 headers={"Authorization": f"Bearer {_eskiz_token(force=not retry)}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        if e.code == 401 and retry:
            return _eskiz_send(phone, text, retry=False)
        log.error("Eskiz SMS failed: %s %s", e.code, e.read()[:300])
        return False
    except Exception:  # network trouble: report, never crash the request
        log.exception("Eskiz SMS failed")
        return False


# ----------------------------------------------------------------------------- one-time codes
SMS_TEXT = {
    "login": "MedMapp: kirish kodi {code}. Kodni hech kimga bermang.",
    "register": "MedMapp: telefon raqamingizni tasdiqlash kodi {code}. Kodni hech kimga bermang.",
    "reset": "MedMapp: parolni tiklash kodi {code}. Agar siz so'ramagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.",
}


def issue_code(request, phone, purpose, send=True):
    """Create and text a 6-digit code. Returns (body, None) or (None, error Response).

    Limits are per phone number across all purposes: a new code after 60 s, at most 5 an hour.
    `send=False` answers exactly like a real send without texting anyone (used when the number has no account, so
    the reset form does not reveal which numbers are registered).
    """
    now = timezone.now()
    recent = OtpCode.objects.filter(phone=phone, created_at__gte=now - timedelta(hours=1))
    last = recent.order_by("-created_at").first()
    if last and now - last.created_at < RESEND_AFTER:
        wait = int((RESEND_AFTER - (now - last.created_at)).total_seconds()) + 1
        return None, Response({"detail": f"Please wait {wait} s before asking for a new code.", "retry_after": wait}, status=429)
    if recent.count() >= MAX_PER_HOUR:
        return None, Response({"detail": "Too many codes requested. Try again in an hour.", "retry_after": 3600}, status=429)
    code = f"{secrets.randbelow(1_000_000):06d}"
    OtpCode.objects.create(phone=phone, purpose=purpose, code_hash=code_hash(phone, code), ip_address=client_ip(request))
    if send and not send_sms(phone, SMS_TEXT[purpose].format(code=code)):
        return None, Response({"detail": "Could not send the SMS. Please try again later."}, status=502)
    body = {"sent": True, "phone": f"+{phone}", "expires_in": int(CODE_TTL.total_seconds()),
            "retry_after": int(RESEND_AFTER.total_seconds())}
    if send and settings.DEBUG and settings.SMS_PROVIDER == "console":
        body["dev_code"] = code  # local development only: no real SMS is sent
    return body, None


def check_code(request, phone, code, purpose):
    """Validate the latest unused code for this phone + purpose. Returns (otp, None) or (None, error Response).
    The caller marks the code used (`use_code`) once the action succeeded. Call inside a transaction."""
    code = "".join(ch for ch in str(code or "") if ch.isdigit())
    otp = (OtpCode.objects.select_for_update().filter(phone=phone, purpose=purpose, used_at__isnull=True,
                                                      created_at__gte=timezone.now() - CODE_TTL)
           .order_by("-created_at").first()) if phone else None
    if not otp or otp.attempts >= MAX_ATTEMPTS:
        return None, Response({"detail": "The code has expired. Ask for a new one.", "code": "expired"}, status=400)
    if not hmac.compare_digest(otp.code_hash, code_hash(phone, code)):
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        audit(request, "auth.login_failed", summary=f"sms {purpose} +{phone[:5]}…")
        return None, Response({"detail": "Wrong code.", "code": "wrong_code", "attempts_left": MAX_ATTEMPTS - otp.attempts},
                              status=400)
    return otp, None


def use_code(otp):
    otp.used_at = timezone.now()
    otp.save(update_fields=["used_at"])


# ----------------------------------------------------------------------------- views
class AuthMethodsView(APIView):
    """Which sign-in buttons the login page should show."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"google_client_id": settings.GOOGLE_CLIENT_ID or None, "sms": settings.SMS_LOGIN_ENABLED})


class SmsRequestView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AuthThrottle]
    throttle_scope = "sms"

    def post(self, request):
        if not settings.SMS_LOGIN_ENABLED:
            return Response({"detail": "SMS sign-in is not available."}, status=404)
        phone = normalize_phone(request.data.get("phone"))
        if not phone:
            return Response({"phone": ["Enter a valid phone number."]}, status=400)
        acc = account_by_phone(phone)
        if acc and (resp := patient_only(acc)):
            return resp
        body, error = issue_code(request, phone, "login")
        if error:
            return error
        return Response({**body, "new_user": acc is None})


class SmsVerifyView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"

    @transaction.atomic
    def post(self, request):
        phone = normalize_phone(request.data.get("phone"))
        otp, error = check_code(request, phone, request.data.get("code"), "login")
        if error:
            return error
        acc = account_by_phone(phone)
        if acc:
            if resp := patient_only(acc):
                return resp
            user = acc.user
        else:
            # New patient: the same code is used once more together with the name and consent.
            name = str(request.data.get("full_name") or "").strip()
            if not name:
                return Response({"need_profile": True}, status=200)
            if request.data.get("consent") is not True:
                return Response({"consent": ["Consent to personal data processing is required."]}, status=400)
            user = create_patient(request, full_name=name[:255], phone=phone, method="sms")
        use_code(otp)
        audit(request, "auth.login", user, actor=user, summary="sms")
        return token_response(request, user, status.HTTP_201_CREATED if not acc else 200)


def verify_google_token(token):
    """Ask Google to validate the ID token. Returns the claims or None."""
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": token})
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            claims = json.load(r)
    except Exception:
        return None
    if claims.get("aud") != settings.GOOGLE_CLIENT_ID:
        return None
    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        return None
    if str(claims.get("email_verified")).lower() != "true" or not claims.get("email"):
        return None
    return claims


class GoogleLoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"

    @transaction.atomic
    def post(self, request):
        if not settings.GOOGLE_CLIENT_ID:
            return Response({"detail": "Google sign-in is not configured."}, status=404)
        token = str(request.data.get("credential") or "")
        claims = verify_google_token(token) if token else None
        if not claims:
            return Response({"detail": "Google sign-in failed. Please try again."}, status=400)
        email = claims["email"].lower()
        user = User.objects.filter(email__iexact=email).select_related("account").first()
        created = False
        if user:
            acc = getattr(user, "account", None)
            if not acc:
                return Response({"detail": "This sign-in method is only for patients.", "code": "not_patient"}, status=403)
            if resp := patient_only(acc):
                return resp
        else:
            if User.objects.filter(username__iexact=email).exists():
                return Response({"detail": "Google sign-in failed. Please try again."}, status=400)
            name = claims.get("name") or " ".join(filter(None, [claims.get("given_name"), claims.get("family_name")])) or email
            user = create_patient(request, full_name=name, email=email, method="google")
            created = True
        audit(request, "auth.login", user, actor=user, summary="google")
        return token_response(request, user, status.HTTP_201_CREATED if created else 200)
