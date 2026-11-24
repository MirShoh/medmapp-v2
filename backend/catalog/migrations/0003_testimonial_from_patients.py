"""Testimonial moves from the removed `patients` app into catalog (table `patients_testimonial` is kept).

Also drops the tables of the removed legacy apps (`patients_userprofile`, `requests_consultationrequest`).
Safety: if one of them still has rows, the migration stops with an error and nothing is dropped - export the data
first (`python manage.py dbshell` / a backup), then empty the table and run `migrate` again.
"""
import django.db.models.deletion
from django.db import migrations, models

LEGACY_TABLES = ("patients_userprofile", "requests_consultationrequest")


def tables(schema_editor):
    return set(schema_editor.connection.introspection.table_names())


def ensure_testimonial_table(apps, schema_editor):
    if "patients_testimonial" not in tables(schema_editor):  # fresh database: the old app never created it
        schema_editor.create_model(apps.get_model("catalog", "Testimonial"))


def drop_legacy(apps, schema_editor):
    existing = tables(schema_editor)
    qn = schema_editor.quote_name
    with schema_editor.connection.cursor() as cur:
        for t in LEGACY_TABLES:
            if t in existing:
                cur.execute(f"SELECT COUNT(*) FROM {qn(t)}")
                n = cur.fetchone()[0]
                if n:
                    raise RuntimeError(f"Legacy table {t} still has {n} row(s). Export them before removing the old app.")
        for t in LEGACY_TABLES:
            if t in existing:
                schema_editor.execute(f"DROP TABLE {qn(t)}")
        cur.execute("DELETE FROM django_migrations WHERE app IN ('patients', 'requests', 'frontend')")


class Migration(migrations.Migration):
    dependencies = [("catalog", "0002_alter_treatmentpackage_currency_and_more"), ("core", "0004_alter_city_unique_together")]

    operations = [
        migrations.SeparateDatabaseAndState(state_operations=[
            migrations.CreateModel(
                name="Testimonial",
                fields=[
                    ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                    ("patient_name", models.CharField(max_length=255, verbose_name="Bemor ismi")),
                    ("patient_name_uz", models.CharField(max_length=255, null=True, verbose_name="Bemor ismi")),
                    ("patient_name_ru", models.CharField(max_length=255, null=True, verbose_name="Bemor ismi")),
                    ("patient_name_en", models.CharField(max_length=255, null=True, verbose_name="Bemor ismi")),
                    ("photo", models.ImageField(blank=True, null=True, upload_to="testimonials/", verbose_name="Rasm")),
                    ("treatment_received", models.CharField(blank=True, max_length=255, verbose_name="Olingan davolanish")),
                    ("treatment_received_uz", models.CharField(blank=True, max_length=255, null=True, verbose_name="Olingan davolanish")),
                    ("treatment_received_ru", models.CharField(blank=True, max_length=255, null=True, verbose_name="Olingan davolanish")),
                    ("treatment_received_en", models.CharField(blank=True, max_length=255, null=True, verbose_name="Olingan davolanish")),
                    ("review_text", models.TextField(verbose_name="Sharh matni")),
                    ("review_text_uz", models.TextField(null=True, verbose_name="Sharh matni")),
                    ("review_text_ru", models.TextField(null=True, verbose_name="Sharh matni")),
                    ("review_text_en", models.TextField(null=True, verbose_name="Sharh matni")),
                    ("video_url", models.URLField(blank=True, verbose_name="Video URL")),
                    ("is_featured", models.BooleanField(default=False, verbose_name="Tanlangan (featured)")),
                    ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratildi")),
                    ("country", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="core.country", verbose_name="Mamlakat")),
                ],
                options={"verbose_name": "Sharh", "verbose_name_plural": "Sharhlar", "ordering": ["-is_featured", "-created_at"],
                         "db_table": "patients_testimonial"},
            ),
        ]),
        migrations.RunPython(ensure_testimonial_table, migrations.RunPython.noop),
        migrations.RunPython(drop_legacy, migrations.RunPython.noop),
    ]
