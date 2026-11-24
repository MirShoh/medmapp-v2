from django.conf import settings
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "Super Admin"
    ADMIN = "admin", "Admin"
    SALES_MANAGER = "sales_manager", "Sales Manager"
    MEDICAL_COORDINATOR = "medical_coordinator", "Medical Coordinator"
    FINANCE_MANAGER = "finance_manager", "Finance Manager"
    CONTENT_MANAGER = "content_manager", "Content Manager"
    HOSPITAL_PARTNER = "hospital_partner", "Hospital Partner"
    PATIENT = "patient", "Patient"


STAFF_ROLES = {
    Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER,
    Role.MEDICAL_COORDINATOR, Role.FINANCE_MANAGER, Role.CONTENT_MANAGER,
}


class Account(models.Model):
    """Role + contact data attached to every Django user (keeps auth.User intact)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account")
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.PATIENT, db_index=True)
    phone = models.CharField(max_length=32, blank=True, db_index=True)
    preferred_language = models.CharField(max_length=5, default="uz", choices=settings.LANGUAGES)
    # Hospital partners are bound to exactly one hospital; they only ever see its referrals.
    hospital = models.ForeignKey(
        "clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL, related_name="partner_accounts"
    )
    is_approved = models.BooleanField(
        default=True, help_text="Hospital partner accounts require admin approval before login."
    )
    extra_permissions = models.JSONField(default=list, blank=True)
    revoked_permissions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Account"
        verbose_name_plural = "Accounts"

    def __str__(self):
        return f"{self.user.get_username()} ({self.get_role_display()})"

    @property
    def is_staff_role(self):
        return self.role in STAFF_ROLES

    def permissions(self):
        from .permissions import ROLE_PERMISSIONS

        perms = set(ROLE_PERMISSIONS.get(self.role, set()))
        perms |= set(self.extra_permissions or [])
        perms -= set(self.revoked_permissions or [])
        return perms

    def has_perm(self, code):
        perms = self.permissions()
        return "*" in perms or code in perms


def get_account(user):
    """Return (and lazily create) the Account for a user."""
    if not user or not user.is_authenticated:
        return None
    acc = getattr(user, "account", None)
    if acc is None:
        role = Role.SUPER_ADMIN if user.is_superuser else Role.PATIENT
        acc, _ = Account.objects.get_or_create(user=user, defaults={"role": role})
    return acc


class OtpCode(models.Model):
    """One-time SMS sign-in code (stored as an HMAC, never in clear text)."""

    phone = models.CharField(max_length=16, db_index=True)  # digits only, e.g. 998901234567
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
