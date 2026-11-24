"""Old English system texts -> translatable keys (LeadActivity.meta["key"]), case titles (the audit log itself is never rewritten)."""
import re

from django.db import migrations

PATTERNS = [
    (re.compile(r"^Lead created from (.+)$"), lambda m, src: {"key": "lead_created", "source": src.get(m[1], m[1])}),
    (re.compile(r"^Lead created manually$"), lambda m, src: {"key": "lead_created_manual"}),
    (re.compile(r"^Patient record created$"), lambda m, src: {"key": "patient_created"}),
    (re.compile(r"^Medical case (\S+) opened$"), lambda m, src: {"key": "case_opened", "ref": m[1]}),
    (re.compile(r"^Document uploaded: (.+)$"), lambda m, src: {"key": "document_uploaded", "title": m[1]}),
    (re.compile(r"^Quotation sent: (.+)$"), lambda m, src: {"key": "quotation_sent", "hospital": m[1]}),
    (re.compile(r"^Assigned to (.+)$"), lambda m, src: {"key": "assigned", "name": m[1]}),
    (re.compile(r"^Unassigned$"), lambda m, src: {"key": "unassigned"}),
]
STATUS = re.compile(r"^(\S+): (.+) → (.+)$")


def forwards(apps, schema_editor):
    Activity = apps.get_model("crm", "LeadActivity")
    Source = apps.get_model("crm", "LeadSource")
    Case = apps.get_model("cases", "MedicalCase")
    src = {s.name: s.code for s in Source.objects.all()}
    labels = dict((label, key) for key, label in [
        ("request_received", "Request received"), ("coordinator_assigned", "Coordinator assigned"),
        ("documents_review", "Medical documents review"), ("hospital_consultation", "Hospital consultation"),
        ("opinion_received", "Medical opinion received"), ("quotation_available", "Quotation available"),
        ("treatment_confirmed", "Treatment confirmed"), ("travel_preparation", "Travel preparation"),
        ("in_treatment", "Treatment in progress"), ("follow_up", "Follow-up"), ("closed", "Closed"), ("cancelled", "Cancelled")])
    for a in Activity.objects.all():
        if (a.meta or {}).get("key"):
            continue
        meta = None
        for rx, build in PATTERNS:
            m = rx.match(a.message or "")
            if m:
                meta = build(m, src)
                break
        if meta is None and a.type == "case":
            m = STATUS.match(a.message or "")
            if m and m[2] in labels and m[3] in labels:
                meta = {"key": "case_status", "ref": m[1], "from": labels[m[2]], "to": labels[m[3]]}
        if meta:
            a.meta = {**(a.meta or {}), **meta}
            a.save(update_fields=["meta"])
    for c in Case.objects.filter(title__startswith="Second opinion · "):
        rest = c.title[len("Second opinion · "):]
        c.title = "" if rest == "General" else rest
        if not c.title:
            c.title = (c.description or "")[:80] or c.title
        c.save(update_fields=["title"])


class Migration(migrations.Migration):
    dependencies = [("crm", "0006_sequential_references"), ("cases", "0004_history_event")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
