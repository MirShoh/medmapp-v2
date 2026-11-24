import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from catalog.models import CURRENCIES


def tx_id():
    return f"TX-{timezone.now():%y%m}-{uuid.uuid4().hex[:8].upper()}"


class Currency(models.Model):
    code = models.CharField(max_length=3, primary_key=True)
    name = models.CharField(max_length=60)
    symbol = models.CharField(max_length=6, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Currencies"
        ordering = ["code"]

    def __str__(self):
        return self.code


class Payment(models.Model):
    """A money movement. 'confirmed' is set only on a provider/bank confirmation recorded by finance staff."""

    DIRECTIONS = [("incoming", "Incoming (patient → MedMapp)"), ("outgoing", "Outgoing (MedMapp → hospital)")]
    KINDS = [("treatment", "Treatment payment"), ("service_fee", "MedMapp service fee"),
             ("deposit", "Deposit"), ("hospital_payment", "Hospital payment"), ("refund", "Refund")]
    STATUSES = [("pending", "Pending"), ("confirmed", "Confirmed"), ("failed", "Failed"),
                ("refunded", "Refunded"), ("cancelled", "Cancelled")]
    METHODS = [("bank_transfer", "Bank transfer"), ("card", "Card"), ("cash", "Cash"), ("payme", "Payme"),
               ("click", "Click"), ("stripe", "Stripe"), ("other", "Other")]
    uid = models.CharField(max_length=24, unique=True, default=tx_id, editable=False)
    patient = models.ForeignKey("crm.Patient", null=True, blank=True, on_delete=models.SET_NULL, related_name="payments")
    case = models.ForeignKey("cases.MedicalCase", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="payments")
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="payments")
    direction = models.CharField(max_length=10, choices=DIRECTIONS, default="incoming", db_index=True)
    kind = models.CharField(max_length=20, choices=KINDS, default="treatment")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True,
                                     help_text="USD equivalent at the recorded rate (for reporting)")
    status = models.CharField(max_length=10, choices=STATUSES, default="pending", db_index=True)
    method = models.CharField(max_length=20, choices=METHODS, default="bank_transfer")
    provider_reference = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.uid} {self.amount} {self.currency} ({self.status})"


class Expense(models.Model):
    CATEGORIES = [("travel", "Travel"), ("hotel", "Hotel"), ("interpreter", "Interpreter"),
                  ("marketing", "Marketing"), ("operations", "Operations"), ("other", "Other")]
    case = models.ForeignKey("cases.MedicalCase", null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="expenses")
    category = models.CharField(max_length=20, choices=CATEGORIES, default="other")
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    spent_on = models.DateField(default=timezone.now)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-spent_on"]


class Commission(models.Model):
    STATUSES = [("expected", "Expected"), ("invoiced", "Invoiced"), ("received", "Received"),
                ("cancelled", "Cancelled")]
    case = models.ForeignKey("cases.MedicalCase", on_delete=models.CASCADE, related_name="commissions")
    hospital = models.ForeignKey("clinics.Hospital", on_delete=models.CASCADE, related_name="commissions")
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="expected", db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
