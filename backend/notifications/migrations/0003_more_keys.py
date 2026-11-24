"""Second pass: status / stage changes, chat messages and quotation decisions stored with old English titles."""
import re

from django.db import migrations

CASE = {"Request received": "request_received", "Coordinator assigned": "coordinator_assigned", "Medical documents review": "documents_review",
        "Hospital consultation": "hospital_consultation", "Medical opinion received": "opinion_received", "Quotation available": "quotation_available",
        "Treatment confirmed": "treatment_confirmed", "Travel preparation": "travel_preparation", "Treatment in progress": "in_treatment",
        "Follow-up": "follow_up", "Closed": "closed", "Cancelled": "cancelled"}
STAGE = {"New leads": "new", "Contacted": "contacted", "Qualification": "qualification", "Documents pending": "documents_pending",
         "Medical review": "medical_review", "Quotation sent": "quotation_sent", "Negotiation": "negotiation", "Confirmed": "confirmed",
         "Travel preparation": "travel_preparation", "In treatment": "in_treatment", "Completed": "completed", "Lost / Cancelled": "lost"}
DECISION = re.compile(r"^Patient (accepted|rejected) quotation (\S+)$")


def forwards(apps, schema_editor):
    from notifications.texts import render
    Notification = apps.get_model("notifications", "Notification")
    for n in Notification.objects.filter(key=""):
        key, args, body = None, None, n.body
        m = DECISION.match(n.title)
        head, sep, tail = n.title.partition(": ")
        if m:
            key, args = "quotation_decision", {"decision": m[1], "ref": m[2]}
        elif n.type == "status_change" and sep and head.startswith("MM-") and tail in CASE:
            key, args = "case_status", {"ref": head, "status": CASE[tail]}
        elif n.type == "status_change" and sep and tail in STAGE:
            key, args = "lead_stage", {"name": head, "stage": STAGE[tail]}
        elif n.type == "chat" and n.link.startswith("/admin/") and sep:
            key, args, body = "chat_from_patient", {"name": head}, n.body or tail
        elif n.type == "chat" and n.link.startswith("/dashboard/"):
            key, args, body = "chat_reply", {}, n.body or n.title
        if key:
            n.key, n.args, n.body = key, args, body
            n.title = render(key, args, "uz")[:255] or n.title
            n.save(update_fields=["key", "args", "body", "title"])


class Migration(migrations.Migration):
    dependencies = [("notifications", "0002_notification_key")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
