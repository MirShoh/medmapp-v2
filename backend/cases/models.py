import hashlib
import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.utils import timezone
from django.utils.deconstruct import deconstructible

from catalog.models import CURRENCIES


def new_reference(lead=None):
    """A case keeps the number its request (lead) already got (MM-0007); otherwise the next number in sequence."""
    from crm.models import next_reference

    if lead is not None and lead.reference and not MedicalCase.objects.filter(reference=lead.reference).exists():
        return lead.reference
    while True:
        ref = next_reference()
        if not MedicalCase.objects.filter(reference=ref).exists():
            return ref


@deconstructible
class PrivateStorage(FileSystemStorage):
    """Storage outside MEDIA_ROOT with no base_url: files can't be reached by any public URL."""

    def __init__(self, **kwargs):
        kwargs.setdefault("location", settings.PRIVATE_MEDIA_ROOT)
        kwargs["base_url"] = None
        super().__init__(**kwargs)

    def url(self, name):  # pragma: no cover - guard
        raise ValueError("Private files have no public URL. Use the signed download endpoint.")


private_storage = PrivateStorage()


def document_upload_to(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"patients/{instance.patient_id}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"


class CaseStatus(models.TextChoices):
    REQUEST_RECEIVED = "request_received", "Request received"
    COORDINATOR_ASSIGNED = "coordinator_assigned", "Coordinator assigned"
    DOCUMENTS_REVIEW = "documents_review", "Medical documents review"
    HOSPITAL_CONSULTATION = "hospital_consultation", "Hospital consultation"
    OPINION_RECEIVED = "opinion_received", "Medical opinion received"
    QUOTATION_AVAILABLE = "quotation_available", "Quotation available"
    TREATMENT_CONFIRMED = "treatment_confirmed", "Treatment confirmed"
    TRAVEL_PREPARATION = "travel_preparation", "Travel preparation"
    IN_TREATMENT = "in_treatment", "Treatment in progress"
    FOLLOW_UP = "follow_up", "Follow-up"
    CLOSED = "closed", "Closed"
    CANCELLED = "cancelled", "Cancelled"


JOURNEY = [c for c in CaseStatus.values if c not in ("closed", "cancelled")]


class MedicalCase(models.Model):
    TYPES = [("treatment", "Treatment"), ("second_opinion", "Second medical opinion"),
             ("consultation", "Consultation"), ("diagnostics", "Diagnostics")]
    reference = models.CharField(max_length=20, unique=True, editable=False)
    patient = models.ForeignKey("crm.Patient", on_delete=models.CASCADE, related_name="cases")
    lead = models.ForeignKey("crm.Lead", null=True, blank=True, on_delete=models.SET_NULL, related_name="cases")
    case_type = models.CharField(max_length=20, choices=TYPES, default="treatment", db_index=True)
    title = models.CharField(max_length=255)
    specialty = models.ForeignKey("core.Specialty", null=True, blank=True, on_delete=models.SET_NULL)
    treatment = models.ForeignKey("catalog.Treatment", null=True, blank=True, on_delete=models.SET_NULL)
    preferred_destination = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.SET_NULL)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=CaseStatus.choices, default=CaseStatus.REQUEST_RECEIVED,
                              db_index=True)
    coordinator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="coordinated_cases")
    selected_hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL,
                                          related_name="selected_cases")
    patient_visible_note = models.TextField(blank=True, help_text="Latest update shown to the patient")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} {self.title}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = new_reference(self.lead)
        super().save(*args, **kwargs)

    @property
    def journey_index(self):
        return JOURNEY.index(self.status) if self.status in JOURNEY else -1


class CaseStatusHistory(models.Model):
    case = models.ForeignKey(MedicalCase, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24)
    note = models.TextField(blank=True)
    # System events are stored as a key (+ argument such as a hospital name) and translated when shown;
    # `note` is only for text a staff member typed.
    event = models.CharField(max_length=32, blank=True)
    event_arg = models.CharField(max_length=255, blank=True)
    visible_to_patient = models.BooleanField(default=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class MedicalDocument(models.Model):
    CATEGORIES = [
        ("report", "Medical report"), ("blood_test", "Blood test"), ("mri", "MRI"), ("ct", "CT scan"),
        ("xray", "X-ray"), ("ultrasound", "Ultrasound"), ("prescription", "Prescription"),
        ("discharge", "Discharge summary"), ("diagnosis", "Previous diagnosis"), ("opinion", "Medical opinion"),
        ("passport", "Travel document"), ("other", "Other"),
    ]
    patient = models.ForeignKey("crm.Patient", on_delete=models.CASCADE, related_name="documents")
    case = models.ForeignKey(MedicalCase, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents")
    category = models.CharField(max_length=20, choices=CATEGORIES, default="other", db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    document_date = models.DateField(null=True, blank=True)
    file = models.FileField(storage=private_storage, upload_to=document_upload_to, max_length=300)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-document_date", "-uploaded_at"]

    def __str__(self):
        return self.title

    def compute_hash(self):
        h = hashlib.sha256()
        for chunk in self.file.chunks():
            h.update(chunk)
        return h.hexdigest()


class ConsentRecord(models.Model):
    SCOPES = [("data_processing", "Personal & medical data processing"),
              ("share_with_hospital", "Share documents with hospital"),
              ("contact", "Contact by MedMapp"), ("marketing", "Marketing communications")]
    patient = models.ForeignKey("crm.Patient", on_delete=models.CASCADE, related_name="consents")
    scope = models.CharField(max_length=24, choices=SCOPES)
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.CASCADE)
    case = models.ForeignKey(MedicalCase, null=True, blank=True, on_delete=models.CASCADE, related_name="consents")
    granted = models.BooleanField(default=True)
    text_version = models.CharField(max_length=20, default="v1")
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-granted_at"]

    @property
    def is_active(self):
        return self.granted and self.revoked_at is None


class CaseReferral(models.Model):
    """A case sent to a partner hospital. Partners see only their referrals + shared documents."""

    STATUSES = [("pending", "Pending"), ("sent", "Sent to hospital"), ("reviewing", "Hospital reviewing"),
                ("opinion_submitted", "Opinion submitted"), ("quoted", "Quotation submitted"),
                ("accepted", "Accepted"), ("declined", "Declined")]
    case = models.ForeignKey(MedicalCase, on_delete=models.CASCADE, related_name="referrals")
    hospital = models.ForeignKey("clinics.Hospital", on_delete=models.CASCADE, related_name="referrals")
    status = models.CharField(max_length=20, choices=STATUSES, default="pending", db_index=True)
    shared_documents = models.ManyToManyField(MedicalDocument, blank=True, related_name="referrals")
    message_to_hospital = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("case", "hospital")
        ordering = ["-created_at"]


class ReferralMessage(models.Model):
    referral = models.ForeignKey(CaseReferral, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class MedicalOpinion(models.Model):
    case = models.ForeignKey(MedicalCase, on_delete=models.CASCADE, related_name="opinions")
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL)
    doctor = models.ForeignKey("doctors.Doctor", null=True, blank=True, on_delete=models.SET_NULL)
    doctor_name = models.CharField(max_length=255, blank=True, help_text="Qualified professional giving opinion")
    summary = models.TextField()
    recommended_treatment = models.TextField(blank=True)
    file = models.FileField(storage=private_storage, upload_to="opinions/%Y/%m/", blank=True, null=True)
    released_to_patient = models.BooleanField(default=False)
    released_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class HospitalQuotation(models.Model):
    STATUSES = [("draft", "Draft"), ("submitted", "Submitted by hospital"), ("sent", "Sent to patient"),
                ("accepted", "Accepted"), ("rejected", "Rejected"), ("expired", "Expired")]
    TYPES = [("estimate", "Estimated price"), ("confirmed", "Hospital-confirmed quotation")]
    case = models.ForeignKey(MedicalCase, on_delete=models.CASCADE, related_name="quotations")
    hospital = models.ForeignKey("clinics.Hospital", on_delete=models.CASCADE, related_name="quotations")
    treatment_plan = models.TextField()
    amount_min = models.DecimalField(max_digits=12, decimal_places=2)
    amount_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    quote_type = models.CharField(max_length=10, choices=TYPES, default="estimate")
    hospital_stay_days = models.PositiveIntegerField(null=True, blank=True)
    total_stay_days = models.PositiveIntegerField(null=True, blank=True)
    includes = models.TextField(blank=True)
    excludes = models.TextField(blank=True)
    additional_expenses = models.TextField(blank=True)
    valid_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="draft", db_index=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class Appointment(models.Model):
    case = models.ForeignKey(MedicalCase, on_delete=models.CASCADE, related_name="appointments")
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL)
    doctor = models.ForeignKey("doctors.Doctor", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    KINDS = [("video", "Video consultation"), ("in_person", "In person"), ("procedure", "Procedure"),
             ("follow_up", "Follow-up")]
    kind = models.CharField(max_length=12, choices=KINDS, default="video")
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, default="scheduled",
                              choices=[("scheduled", "Scheduled"), ("done", "Done"), ("cancelled", "Cancelled")])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_at"]


class TravelPlan(models.Model):
    case = models.OneToOneField(MedicalCase, on_delete=models.CASCADE, related_name="travel_plan")
    arrival_date = models.DateField(null=True, blank=True)
    departure_date = models.DateField(null=True, blank=True)
    companions = models.PositiveSmallIntegerField(default=0)
    flight_details = models.TextField(blank=True)
    hotel_name = models.CharField(max_length=255, blank=True)
    hotel_details = models.TextField(blank=True)
    airport_transfer = models.TextField(blank=True)
    interpreter = models.CharField(max_length=255, blank=True)
    VISA = [("not_required", "Not required"), ("pending", "Pending"), ("invitation_sent", "Invitation sent"),
            ("applied", "Applied"), ("approved", "Approved"), ("rejected", "Rejected")]
    visa_status = models.CharField(max_length=20, choices=VISA, default="pending")
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
