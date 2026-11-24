from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from audit.service import log as audit
from notifications.service import notify_staff

from .models import STAFF_ROLES, Account, Role, get_account
from .permissions import ROLE_PERMISSIONS, HasPerm

User = get_user_model()


def portal_for(acc):
    if acc.role == Role.PATIENT:
        return "dashboard"
    if acc.role == Role.HOSPITAL_PARTNER:
        return "partner"
    return "admin"


def user_payload(user):
    acc = get_account(user)
    perms = sorted(acc.permissions()) if acc else []
    return {
        "id": user.pk,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": user.get_full_name() or user.username,
        "role": acc.role,
        "role_label": acc.get_role_display(),
        "phone": acc.phone,
        "preferred_language": acc.preferred_language,
        "hospital": ({"id": acc.hospital_id, "name": acc.hospital.name, "slug": acc.hospital.slug}
                     if acc.hospital_id else None),
        "is_approved": acc.is_approved,
        "permissions": perms,
        "portal": portal_for(acc),
    }


REFRESH_COOKIE = "mm_refresh"


def set_refresh_cookie(response, refresh):
    """Web clients keep the refresh token only in an httpOnly cookie (unreadable by JavaScript)."""
    from django.conf import settings as dj

    response.set_cookie(REFRESH_COOKIE, refresh, max_age=int(dj.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
                        httponly=True, secure=not dj.DEBUG, samesite="Lax", path="/api/v2/auth/")
    return response


def is_super(user):
    acc = get_account(user)
    return bool(user.is_superuser or (acc and acc.role == Role.SUPER_ADMIN))


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    acc = get_account(user)
    refresh["role"] = acc.role
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class AuthThrottle(ScopedRateThrottle):
    scope_attr = "throttle_scope"


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True, min_length=8)
    preferred_language = serializers.ChoiceField(choices=["uz", "ru", "en"], default="uz")
    consent = serializers.BooleanField()
    # partner sign-up only
    hospital_name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, v):
        if User.objects.filter(Q(email__iexact=v) | Q(username__iexact=v)).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return v.lower()

    def validate_consent(self, v):
        if not v:
            raise serializers.ValidationError("Consent to personal data processing is required.")
        return v

    def validate_phone(self, v):
        v = v.strip()
        if Account.objects.filter(phone=v).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return v

    def validate(self, attrs):
        validate_password(attrs["password"], User(email=attrs["email"], first_name=attrs["first_name"]))
        return attrs


class RegisterView(APIView):
    """Patient self-registration. Creates User + Account(patient) + CRM Patient + consent record."""

    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"
    role = Role.PATIENT

    @transaction.atomic
    def post(self, request):
        s = RegisterSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        user = User.objects.create_user(username=d["email"], email=d["email"], password=d["password"],
                                        first_name=d["first_name"], last_name=d.get("last_name", ""))
        acc = Account.objects.create(user=user, role=self.role, phone=d["phone"],
                                     preferred_language=d["preferred_language"],
                                     is_approved=self.role != Role.HOSPITAL_PARTNER)
        if self.role == Role.PATIENT:
            from audit.service import client_ip
            from cases.models import ConsentRecord
            from crm.services import get_or_create_patient

            patient = get_or_create_patient(user.get_full_name(), d["phone"], d["email"], user=user)
            ConsentRecord.objects.create(patient=patient, scope="data_processing", ip_address=client_ip(request),
                                         recorded_by=user)
            audit(request, "auth.registered", user, actor=user)
            return token_response(request, user, status.HTTP_201_CREATED)
        # partner: pending approval, no tokens
        audit(request, "partner.registered", user, actor=user, summary=d.get("hospital_name", ""))
        notify_staff("system", key="partner_registered", body=
                     f"{user.get_full_name()} · {d.get('hospital_name', '')} · {acc.phone}", link="/admin/users")
        return Response({"detail": "Registration received. A MedMapp administrator will review and approve "
                                   "your partner account.", "pending_approval": True},
                        status=status.HTTP_201_CREATED)


class PartnerRegisterView(RegisterView):
    role = Role.HOSPITAL_PARTNER


class LoginView(APIView):
    throttle_classes = [AuthThrottle]
    throttle_scope = "auth"

    def post(self, request):
        login = (request.data.get("login") or request.data.get("email") or "").strip()
        password = request.data.get("password") or ""
        portal = request.data.get("portal")  # optional: admin | partner | dashboard
        if not login or not password:
            return Response({"detail": "Login and password are required."}, status=400)
        username = login
        if "@" in login:
            u = User.objects.filter(email__iexact=login).first()
            username = u.username if u else login
        elif login.lstrip("+").isdigit():
            acc = Account.objects.filter(phone=login).select_related("user").first()
            username = acc.user.username if acc else login
        user = authenticate(request, username=username, password=password)
        if user is None:
            audit(request, "auth.login_failed", summary=login[:120])
            return Response({"detail": "Invalid credentials."}, status=401)
        acc = get_account(user)
        if acc.role == Role.HOSPITAL_PARTNER and not acc.is_approved:
            return Response({"detail": "Your partner account is awaiting admin approval."}, status=403)
        if portal and portal != portal_for(acc):
            return Response({"detail": "This account cannot sign in to this portal.",
                             "portal": portal_for(acc)}, status=403)
        audit(request, "auth.login", user, actor=user)
        return token_response(request, user)


def token_response(request, user, status_code=200):
    from django.contrib.auth.models import update_last_login

    update_last_login(None, user)
    tokens = tokens_for(user)
    body = {"user": user_payload(user), "access": tokens["access"]}
    if request.headers.get("X-Client") == "mobile":
        body["refresh"] = tokens["refresh"]
    return set_refresh_cookie(Response(body, status=status_code), tokens["refresh"])


class CookieTokenRefreshView(APIView):
    """Rotate tokens. Web: refresh token read from the httpOnly cookie. Mobile: `{"refresh": ...}` in the body."""

    throttle_classes = [AuthThrottle]
    throttle_scope = "auth_refresh"

    def post(self, request):
        from rest_framework_simplejwt.exceptions import TokenError
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer

        raw = request.data.get("refresh") or request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            return Response({"detail": "No refresh token."}, status=401)
        s = TokenRefreshSerializer(data={"refresh": raw})
        try:
            s.is_valid(raise_exception=True)
        except (TokenError, serializers.ValidationError):
            resp = Response({"detail": "Session expired. Please sign in again."}, status=401)
            resp.delete_cookie(REFRESH_COOKIE, path="/api/v2/auth/")
            return resp
        data = s.validated_data
        body = {"access": data["access"]}
        if request.data.get("refresh"):
            body["refresh"] = data.get("refresh", raw)
        resp = Response(body)
        return set_refresh_cookie(resp, data.get("refresh", raw))


class LogoutView(APIView):
    def post(self, request):
        raw = request.data.get("refresh") or request.COOKIES.get(REFRESH_COOKIE)
        try:
            RefreshToken(raw).blacklist()
        except Exception:  # noqa: BLE001 - already invalid/blacklisted/missing
            pass
        if request.user.is_authenticated:
            audit(request, "auth.logout", request.user)
        resp = Response(status=204)
        resp.delete_cookie(REFRESH_COOKIE, path="/api/v2/auth/")
        return resp


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(user_payload(request.user))

    def patch(self, request):
        u, acc = request.user, get_account(request.user)
        for f in ("first_name", "last_name"):
            if f in request.data:
                setattr(u, f, str(request.data[f])[:150])
        u.save()
        if "phone" in request.data:
            acc.phone = str(request.data["phone"])[:32]
        if request.data.get("preferred_language") in ("uz", "ru", "en"):
            acc.preferred_language = request.data["preferred_language"]
        acc.save()
        return Response(user_payload(u))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        u = request.user
        if not u.check_password(request.data.get("old_password", "")):
            return Response({"detail": "Current password is incorrect."}, status=400)
        new = request.data.get("new_password", "")
        validate_password(new, u)
        u.set_password(new)
        u.save()
        audit(request, "auth.password_changed", u)
        return Response({"detail": "Password changed."})


# ---------------- Staff: users & roles ----------------
class StaffUserSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=Role.choices, source="account.role")
    phone = serializers.CharField(source="account.phone", required=False, allow_blank=True)
    hospital = serializers.IntegerField(source="account.hospital_id", required=False, allow_null=True)
    hospital_name = serializers.CharField(source="account.hospital.name", read_only=True, default=None)
    is_approved = serializers.BooleanField(source="account.is_approved", required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "is_active", "role", "phone",
                  "hospital", "hospital_name", "is_approved", "password", "last_login", "date_joined")
        read_only_fields = ("last_login", "date_joined")

    def validate(self, attrs):
        request = self.context["request"]
        role = attrs.get("account", {}).get("role")
        if role == Role.SUPER_ADMIN and not is_super(request.user):
            raise serializers.ValidationError("Only a super admin can grant the super admin role.")
        if self.instance is not None and is_super(self.instance) and not is_super(request.user):
            raise serializers.ValidationError("Only a super admin can modify a super admin account.")
        phone = attrs.get("account", {}).get("phone")
        if phone and Account.objects.filter(phone=phone).exclude(user=self.instance).exists():
            raise serializers.ValidationError({"phone": "This phone number is already used by another account."})
        return attrs

    @transaction.atomic
    def create(self, validated):
        acc_data = validated.pop("account", {})
        password = validated.pop("password", None)
        validated.setdefault("username", validated.get("email"))
        user = User(**validated)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        Account.objects.create(user=user, role=acc_data.get("role", Role.SALES_MANAGER),
                               phone=acc_data.get("phone", ""), hospital_id=acc_data.get("hospital_id"),
                               is_approved=acc_data.get("is_approved", True))
        return user

    @transaction.atomic
    def update(self, user, validated):
        acc_data = validated.pop("account", {})
        password = validated.pop("password", None)
        for k, v in validated.items():
            setattr(user, k, v)
        if password:
            user.set_password(password)
        user.save()
        acc = get_account(user)
        for k, v in acc_data.items():
            setattr(acc, k, v)
        acc.save()
        return user


class StaffUserViewSet(viewsets.ModelViewSet):
    serializer_class = StaffUserSerializer
    permission_classes = [HasPerm.of("users.view", write="users.edit")]
    search_fields = ("username", "email", "first_name", "last_name", "account__phone")
    filterset_fields = ("account__role", "is_active", "account__is_approved")

    def get_queryset(self):
        return User.objects.select_related("account", "account__hospital").order_by("-date_joined")

    def perform_create(self, serializer):
        u = serializer.save()
        audit(self.request, "user.created", u, summary=f"role={get_account(u).role}")

    def perform_update(self, serializer):
        u = serializer.save()
        audit(self.request, "user.updated", u, changes={k: str(v) for k, v in self.request.data.items()
                                                        if k != "password"})

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied

        if is_super(instance) and not is_super(self.request.user):
            raise PermissionDenied("Only a super admin can deactivate a super admin account.")
        if instance == self.request.user:
            raise PermissionDenied("You cannot deactivate your own account.")
        # deactivate instead of deleting: keeps audit trail intact
        instance.is_active = False
        instance.save()
        audit(self.request, "user.deactivated", instance)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        u = self.get_object()
        acc = get_account(u)
        acc.is_approved = True
        if request.data.get("hospital"):
            acc.hospital_id = int(request.data["hospital"])
        acc.save()
        audit(request, "partner.approved", u)
        return Response(self.get_serializer(u).data)

    @action(detail=False, methods=["get"])
    def roles(self, request):
        return Response([{"value": r.value, "label": r.label, "is_staff": r in STAFF_ROLES,
                          "permissions": sorted(ROLE_PERMISSIONS.get(r, []))} for r in Role])

    @action(detail=False, methods=["get"])
    def staff(self, request):
        qs = self.get_queryset().filter(is_active=True, account__role__in=list(STAFF_ROLES))
        return Response([{"id": u.pk, "name": u.get_full_name() or u.username, "role": u.account.role}
                         for u in qs])


class StaffDirectoryView(APIView):
    """Minimal staff list (id, name, role) for assignment pickers. Any staff role may read it."""

    from .permissions import IsStaffRole as _IsStaff

    permission_classes = [_IsStaff]

    def get(self, request):
        qs = User.objects.filter(is_active=True, account__role__in=list(STAFF_ROLES)).select_related("account")
        return Response([{"id": u.pk, "name": u.get_full_name() or u.username, "role": u.account.role} for u in qs])
