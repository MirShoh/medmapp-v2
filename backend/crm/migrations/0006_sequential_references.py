"""Lead.reference + shared counter; renumber existing requests and cases as MM-0001, MM-0002, ... by date."""
from django.conf import settings
from django.db import migrations, models


def renumber(apps, schema_editor):
    Lead = apps.get_model("crm", "Lead")
    Case = apps.get_model("cases", "MedicalCase")
    Counter = apps.get_model("crm", "Counter")
    prefix = settings.REFERENCE_PREFIX
    n = 0
    for lead in Lead.objects.order_by("created_at", "pk"):
        n += 1
        lead.reference = f"{prefix}-{n:04d}"
        lead.save(update_fields=["reference"])
    for case in Case.objects.order_by("created_at", "pk"):  # temporary values avoid unique clashes
        case.reference = f"TMP-{case.pk}"
        case.save(update_fields=["reference"])
    used = set()
    for case in Case.objects.order_by("created_at", "pk"):
        lead = Lead.objects.filter(pk=case.lead_id).first() if case.lead_id else None
        if lead and lead.reference not in used:
            ref = lead.reference
        else:
            n += 1
            ref = f"{prefix}-{n:04d}"
        used.add(ref)
        case.reference = ref
        case.save(update_fields=["reference"])
    Counter.objects.update_or_create(name="reference", defaults={"value": n})


class Migration(migrations.Migration):
    dependencies = [("crm", "0005_patient_passport"), ("cases", "0004_history_event")]
    operations = [
        migrations.CreateModel(
            name="Counter",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=32, unique=True)),
                ("value", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.AddField(model_name="lead", name="reference",
                            field=models.CharField(blank=True, editable=False, max_length=20, null=True, unique=True)),
        migrations.RunPython(renumber, migrations.RunPython.noop),
    ]
