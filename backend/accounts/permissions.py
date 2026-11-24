"""Granular role-based permissions. Enforced on the backend for every staff/partner endpoint."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role, get_account

# Permission codes: "<module>.<action>"
ALL_PERMISSIONS = {
    "dashboard.view",
    "crm.view", "crm.edit", "crm.assign", "crm.delete", "crm.export",
    "patients.view", "patients.edit", "patients.delete",
    "medical.view", "medical.edit",              # medical cases, opinions, referrals
    "documents.view", "documents.upload", "documents.share", "documents.delete",
    "tasks.view", "tasks.edit",
    "catalog.view", "catalog.edit",              # hospitals, doctors, countries, treatments, packages
    "quotations.view", "quotations.edit",
    "travel.view", "travel.edit",
    "finance.view", "finance.edit",
    "reports.view",
    "cms.edit", "blog.edit",
    "users.view", "users.edit",
    "integrations.view", "integrations.edit",
    "settings.edit",
    "audit.view",
}

ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: {"*"},
    Role.ADMIN: ALL_PERMISSIONS - {"settings.edit"},
    Role.SALES_MANAGER: {
        "dashboard.view", "crm.view", "crm.edit", "crm.export", "patients.view", "patients.edit",
        "tasks.view", "tasks.edit", "catalog.view", "quotations.view", "travel.view", "documents.view",
        "documents.upload", "reports.view",
    },
    Role.MEDICAL_COORDINATOR: {
        "dashboard.view", "crm.view", "crm.edit", "patients.view", "patients.edit", "medical.view",
        "medical.edit", "documents.view", "documents.upload", "documents.share", "tasks.view", "tasks.edit",
        "catalog.view", "quotations.view", "quotations.edit", "travel.view", "travel.edit",
    },
    Role.FINANCE_MANAGER: {
        "dashboard.view", "patients.view", "finance.view", "finance.edit", "quotations.view", "reports.view",
        "crm.view",
    },
    Role.CONTENT_MANAGER: {"catalog.view", "catalog.edit", "cms.edit", "blog.edit"},
    Role.HOSPITAL_PARTNER: set(),
    Role.PATIENT: set(),
}


def user_has_perm(user, code):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    acc = get_account(user)
    return bool(acc and acc.is_staff_role and acc.has_perm(code))


class HasPerm(BasePermission):
    """Usage: permission_classes = [HasPerm.of("crm.view", write="crm.edit")]"""

    read_code = None
    write_code = None

    @classmethod
    def of(cls, read, write=None):
        return type(f"HasPerm_{read}_{write}", (cls,), {"read_code": read, "write_code": write or read})

    def has_permission(self, request, view):
        code = self.read_code if request.method in SAFE_METHODS else self.write_code
        return user_has_perm(request.user, code)


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        acc = get_account(request.user)
        return request.user.is_superuser or (acc and acc.is_staff_role)


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        acc = get_account(request.user)
        return bool(acc and acc.role == Role.PATIENT)


class IsApprovedPartner(BasePermission):
    message = "Partner account is not approved or not linked to a hospital."

    def has_permission(self, request, view):
        acc = get_account(request.user)
        return bool(acc and acc.role == Role.HOSPITAL_PARTNER and acc.is_approved and acc.hospital_id)
