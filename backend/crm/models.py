from django.conf import settings
from django.db import models
from django.utils import timezone

from catalog.models import CURRENCIES


class Counter(models.Model):
    """Named gap-free counters (request numbers)."""

    name = models.CharField(max_length=32, unique=True)
    value = models.PositiveIntegerField(default=0)


def format_reference(n):
    return f"{settings.REFERENCE_PREFIX}-{n:04d}"


def next_reference():
    """MM-0001, MM-0002, ... shared by requests (leads) and cases, so a case can keep its request's number."""
    from django.db import transaction

    with transaction.atomic():
        c, _ = Counter.objects.select_for_update().get_or_create(name="reference")
        c.value += 1
        c.save(update_fields=["value"])
        return format_reference(c.value)


class LeadStage(models.TextChoices):
    NEW = "new", "New leads"
    CONTACTED = "contacted", "Contacted"
    QUALIFICATION = "qualification", "Qualification"
    DOCUMENTS_PENDING = "documents_pending", "Documents pending"
    MEDICAL_REVIEW = "medical_review", "Medical review"
    QUOTATION_SENT = "quotation_sent", "Quotation sent"
    NEGOTIATION = "negotiation", "Negotiation"
    CONFIRMED = "confirmed", "Confirmed"
    TRAVEL_PREPARATION = "travel_preparation", "Travel preparation"
    IN_TREATMENT = "in_treatment", "In treatment"
    COMPLETED = "completed", "Completed"
    LOST = "lost", "Lost / Cancelled"


class Priority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class LeadSource(models.Model):
    code = models.SlugField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Patient(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="patient")
    full_name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=32, db_index=True)
    email = models.EmailField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    # Stored normalised (upper case, no spaces) so "ae 3500767" and "AE3500767" match.
    passport_number = models.CharField(max_length=20, blank=True, db_index=True)
    GENDERS = [("male", "Male"), ("female", "Female"), ("other", "Other")]
    gender = models.CharField(max_length=10, choices=GENDERS, blank=True)
    country = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="resident_patients")
    city = models.CharField(max_length=120, blank=True)
    address = models.CharField(max_length=300, blank=True)
    preferred_language = models.CharField(max_length=5, default="uz")
    # medical information (sensitive)
    blood_type = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    current_medications = models.TextField(blank=True)
    medical_notes = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    assigned_manager = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                         on_delete=models.SET_NULL, related_name="managed_patients")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name

    def save(self, *args, **kwargs):
        self.passport_number = normalize_passport(self.passport_number)
        super().save(*args, **kwargs)


def normalize_passport(value):
    return "".join(ch for ch in (value or "") if ch.isalnum()).upper()[:20]


class Lead(models.Model):
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads")
    reference = models.CharField(max_length=20, unique=True, null=True, blank=True, editable=False)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, db_index=True)
    email = models.EmailField(blank=True)
    resident_country = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.SET_NULL,
                                         related_name="+")
    resident_region = models.CharField(max_length=120, blank=True)
    destination = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="destination_leads")
    specialty = models.ForeignKey("core.Specialty", null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="leads")
    treatment = models.ForeignKey("catalog.Treatment", null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name="leads")
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="leads")
    doctor = models.ForeignKey("doctors.Doctor", null=True, blank=True, on_delete=models.SET_NULL,
                               related_name="leads")
    package = models.ForeignKey("catalog.TreatmentPackage", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="leads")
    service = models.ForeignKey("catalog.MedicalService", null=True, blank=True, on_delete=models.SET_NULL,
                                related_name="leads")
    message = models.TextField(blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    stage = models.CharField(max_length=24, choices=LeadStage.choices, default=LeadStage.NEW, db_index=True)
    position = models.FloatField(default=0, help_text="Order inside Kanban column")
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL, db_index=True)
    source = models.ForeignKey(LeadSource, null=True, blank=True, on_delete=models.SET_NULL, related_name="leads")
    source_detail = models.CharField(max_length=255, blank=True, help_text="Page URL, campaign, form name")
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="assigned_leads")
    next_follow_up = models.DateTimeField(null=True, blank=True, db_index=True)
    follow_up_notified_at = models.DateTimeField(null=True, blank=True,
                                                 help_text="When the manager was last reminded about next_follow_up")
    lost_reason = models.CharField(max_length=255, blank=True)
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    consent_given = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                   related_name="+")
    stage_changed_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["stage", "position", "-created_at"]
        indexes = [models.Index(fields=["stage", "position"]), models.Index(fields=["assigned_to", "stage"])]

    def __str__(self):
        return f"{self.full_name} [{self.get_stage_display()}]"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = next_reference()
        super().save(*args, **kwargs)


class LeadActivity(models.Model):
    TYPES = [
        ("created", "Created"), ("stage_changed", "Stage changed"), ("assigned", "Manager assigned"),
        ("note", "Note"), ("call", "Call"), ("message", "Message"), ("email", "Email"),
        ("document", "Document uploaded"), ("quotation", "Quotation"), ("payment", "Payment"),
        ("task", "Task"), ("updated", "Updated"), ("case", "Medical case"),
    ]
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="activities")
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    type = models.CharField(max_length=20, choices=TYPES, db_index=True)
    message = models.TextField(blank=True)
    from_stage = models.CharField(max_length=24, blank=True)
    to_stage = models.CharField(max_length=24, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Lead activities"


class Communication(models.Model):
    CHANNELS = [("phone", "Phone"), ("telegram", "Telegram"), ("whatsapp", "WhatsApp"), ("email", "Email"),
                ("sms", "SMS"), ("meeting", "Meeting"), ("other", "Other")]
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.CASCADE,
                                related_name="communications")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="communications")
    channel = models.CharField(max_length=12, choices=CHANNELS, default="phone")
    direction = models.CharField(max_length=8, choices=[("in", "Inbound"), ("out", "Outbound")], default="out")
    summary = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    occurred_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-occurred_at"]


class InternalNote(models.Model):
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.CASCADE, related_name="notes")
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="notes")
    text = models.TextField()
    is_pinned = models.BooleanField(default=False)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_pinned", "-created_at"]


class Task(models.Model):
    STATUSES = [("open", "Open"), ("in_progress", "In progress"), ("done", "Done"), ("cancelled", "Cancelled")]
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    lead = models.ForeignKey(Lead, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.CASCADE, related_name="tasks")
    case = models.ForeignKey("cases.MedicalCase", null=True, blank=True, on_delete=models.CASCADE,
                             related_name="tasks")
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="tasks")
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    reminder_sent = models.BooleanField(default=False)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=12, choices=STATUSES, default="open", db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "due_at"]

    def __str__(self):
        return self.title


def chat_storage():
    from cases.models import private_storage

    return private_storage


class SupportMessage(models.Model):
    """Direct chat between a patient and MedMapp staff (one conversation per patient)."""

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="support_messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    from_staff = models.BooleanField(default=False, db_index=True)
    text = models.TextField(max_length=4000, blank=True)
    # optional file / photo (private storage: served only through signed, expiring links)
    attachment = models.FileField(storage=chat_storage, upload_to="chat/%Y/%m/", blank=True, null=True, max_length=300)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_size = models.PositiveIntegerField(default=0)
    attachment_type = models.CharField(max_length=100, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["patient", "created_at"])]

    def __str__(self):
        return f"{self.patient_id}: {self.text[:40]}"
