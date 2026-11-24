"""Access rules for private medical files + signed, expiring download tokens."""
from django.conf import settings
from django.core import signing

from accounts.models import Role, get_account
from accounts.permissions import user_has_perm

from .models import ConsentRecord, MedicalDocument

SALT = "medmapp.private-file"


def make_token(kind, obj_id, user, ttl=None):
    return signing.dumps({"k": kind, "i": obj_id, "u": user.pk}, salt=SALT, compress=True)


def read_token(token, ttl=None):
    return signing.loads(token, salt=SALT, max_age=ttl or settings.SIGNED_URL_TTL_SECONDS)


def partner_can_access(user, doc: MedicalDocument):
    acc = get_account(user)
    if not (acc and acc.role == Role.HOSPITAL_PARTNER and acc.is_approved and acc.hospital_id):
        return False
    shared = doc.referrals.filter(hospital_id=acc.hospital_id).exists()
    if not shared:
        return False
    return ConsentRecord.objects.filter(patient=doc.patient, scope="share_with_hospital", granted=True,
                                        revoked_at__isnull=True, hospital_id=acc.hospital_id).exists()


def can_access_document(user, doc: MedicalDocument):
    if doc.is_deleted or not user.is_authenticated:
        return False
    if user_has_perm(user, "documents.view"):
        return True
    if doc.patient.user_id == user.pk:
        return True
    return partner_can_access(user, doc)
