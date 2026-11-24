"""Translatable notification titles: key + args. Old English titles are converted where the pattern is known."""
import re

from django.db import migrations, models

PATTERNS = [
    (r"^New lead: (?P<name>.+)$", "lead_new"), (r"^Lead assigned: (?P<name>.+)$", "lead_assigned"),
    (r"^New task: (?P<title>.+)$", "task_new"), (r"^Reminder: (?P<title>.+)$", "task_reminder"),
    (r"^Follow up: (?P<name>.+)$", "lead_follow_up"), (r"^New document for (?P<name>.+)$", "document_new"),
    (r"^You coordinate case (?P<ref>\S+)$", "case_coordinator"), (r"^New referral (?P<ref>\S+)$", "referral_new"),
    (r"^Medical opinion available for (?P<ref>\S+)$", "opinion_available"), (r"^New quotation for (?P<ref>\S+)$", "quotation_new"),
    (r"^Opinion received: (?P<ref>\S+)$", "opinion_received"), (r"^Quotation from (?P<hospital>.+): (?P<ref>\S+)$", "quotation_from"),
    (r"^Message from (?P<hospital>.+) \((?P<ref>\S+)\)$", "partner_message"), (r"^MedMapp message on (?P<ref>\S+)$", "medmapp_message"),
    (r"^New hospital partner registration$", "partner_registered"), (r"^(?P<name>.+) uploaded (?P<n>\d+) document\(s\)$", "patient_uploaded"),
]


def forwards(apps, schema_editor):
    from notifications.texts import render
    Notification = apps.get_model("notifications", "Notification")
    compiled = [(re.compile(p), k) for p, k in PATTERNS]
    for n in Notification.objects.filter(key=""):
        for rx, key in compiled:
            m = rx.match(n.title)
            if m:
                n.key, n.args = key, m.groupdict()
                n.title = render(key, n.args, "uz")[:255] or n.title
                n.save(update_fields=["key", "args", "title"])
                break


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]
    operations = [
        migrations.AddField(model_name="notification", name="key", field=models.CharField(blank=True, max_length=40)),
        migrations.AddField(model_name="notification", name="args", field=models.JSONField(blank=True, default=dict)),
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
