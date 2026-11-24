from django.conf import settings
from django.db import models


class Notification(models.Model):
    TYPES = [("new_lead", "New lead"), ("new_task", "New task"), ("new_document", "New medical document"),
             ("status_change", "Status change"), ("follow_up", "Follow-up reminder"),
             ("hospital_response", "Hospital response"), ("new_quotation", "New quotation"),
             ("payment_update", "Payment update"), ("system", "System")]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(max_length=20, choices=TYPES, default="system", db_index=True)
    title = models.CharField(max_length=255)  # rendered in Uzbek; shown only when `key` is empty (old rows)
    key = models.CharField(max_length=40, blank=True)  # notifications/texts.py; rendered in the reader's language
    args = models.JSONField(default=dict, blank=True)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=500, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class DeliveryLog(models.Model):
    """External channel deliveries (email/telegram/whatsapp) with their real outcome."""

    channel = models.CharField(max_length=16)
    target = models.CharField(max_length=255, blank=True)
    event = models.CharField(max_length=32)
    success = models.BooleanField(default=False)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
