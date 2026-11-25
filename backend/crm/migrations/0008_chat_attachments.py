import crm.models
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("crm", "0007_translatable_texts")]
    operations = [
        migrations.AlterField(model_name="supportmessage", name="text", field=models.TextField(blank=True, max_length=4000)),
        migrations.AddField(model_name="supportmessage", name="attachment",
                            field=models.FileField(blank=True, max_length=300, null=True, storage=crm.models.chat_storage,
                                                   upload_to="chat/%Y/%m/")),
        migrations.AddField(model_name="supportmessage", name="attachment_name", field=models.CharField(blank=True, max_length=255)),
        migrations.AddField(model_name="supportmessage", name="attachment_size", field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name="supportmessage", name="attachment_type", field=models.CharField(blank=True, max_length=100)),
    ]
