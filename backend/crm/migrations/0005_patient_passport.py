from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("crm", "0004_support_chat")]
    operations = [
        migrations.AddField(model_name="patient", name="passport_number",
                            field=models.CharField(blank=True, db_index=True, max_length=20)),
    ]
