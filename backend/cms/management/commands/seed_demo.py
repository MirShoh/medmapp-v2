"""LOCAL DEVELOPMENT ONLY. Creates test accounts and clearly labelled [DEMO] CRM leads.

Refuses to run when DEBUG is off. Generated passwords are written to backend/.demo-credentials
(git-ignored) — never printed to logs.
"""
import secrets
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Account, Role
from catalog.models import TreatmentPackage
from clinics.models import Hospital
from crm.models import Lead, LeadSource, LeadStage
from crm.services import get_or_create_patient
from doctors.models import Doctor

User = get_user_model()

USERS = [("superadmin@demo.medmapp.local", Role.SUPER_ADMIN, "Demo", "Superadmin"),
         ("sales@demo.medmapp.local", Role.SALES_MANAGER, "Demo", "Sales"),
         ("coordinator@demo.medmapp.local", Role.MEDICAL_COORDINATOR, "Demo", "Coordinator"),
         ("finance@demo.medmapp.local", Role.FINANCE_MANAGER, "Demo", "Finance"),
         ("content@demo.medmapp.local", Role.CONTENT_MANAGER, "Demo", "Content"),
         ("partner@demo.medmapp.local", Role.HOSPITAL_PARTNER, "Demo", "Partner"),
         ("patient@demo.medmapp.local", Role.PATIENT, "Demo", "Patient")]


class Command(BaseCommand):
    help = "Create [DEMO] data and test accounts for local development."

    @transaction.atomic
    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("seed_demo only runs with DEBUG=True (local development).")
        creds = []
        # Test accounts and CRM leads only: the catalogue comes from the real partner import, never from fake hospitals.
        if not Hospital.objects.filter(is_active=True).exclude(slug__startswith="demo-").exists():
            call_command("import_partners")
        hospitals = list(Hospital.objects.filter(is_active=True).exclude(slug__startswith="demo-").select_related("city__country")[:3])
        for email, role, first, last in USERS:
            u = User.objects.filter(username=email).first()
            if not u:
                pwd = secrets.token_urlsafe(12)
                u = User.objects.create_user(username=email, email=email, password=pwd, first_name=first, last_name=last,
                                             is_superuser=role == Role.SUPER_ADMIN, is_staff=role == Role.SUPER_ADMIN)
                creds.append(f"{role.value:22} {email}  {pwd}")
            Account.objects.update_or_create(user=u, defaults={"role": role, "phone": "+998900000000",
                                                               "hospital": hospitals[0] if role == Role.HOSPITAL_PARTNER else None})
            if role == Role.PATIENT:
                get_or_create_patient("Demo Patient", "+998900000001", email, user=u)
        src = LeadSource.objects.get(code="website")
        sales = User.objects.get(username="sales@demo.medmapp.local")
        if not Lead.objects.filter(full_name__startswith="[DEMO]").exists():
            for i, stage in enumerate(LeadStage.values):
                p = get_or_create_patient(f"[DEMO] Lead {i + 1}", f"+99890100{i:04d}")
                Lead.objects.create(patient=p, full_name=p.full_name, phone=p.phone, stage=stage, source=src,
                                    position=1000, assigned_to=sales if i % 2 else None,
                                    destination=hospitals[i % 3].city.country,
                                    specialty=hospitals[i % 3].specialties.first(),
                                    next_follow_up=timezone.now() + timedelta(days=i - 3))
        translate_demo()
        if creds:
            path = Path(settings.BASE_DIR) / ".demo-credentials"
            with path.open("a", encoding="utf-8") as f:
                f.write("\n".join(creds) + "\n")
            self.stdout.write(self.style.SUCCESS(f"Demo data created. Test account credentials written to {path}"))
        else:
            self.stdout.write("Demo data already present.")


DEMO_DESC = (
    "Demonstration record for local testing — not a real hospital.",
    "Демонстрационная запись для локального тестирования — не реальная клиника.",
    "Lokal sinov uchun namunaviy yozuv — haqiqiy klinika emas.",
)


def translate_demo():
    """Give every [DEMO] record proper UZ/RU/EN text (older runs stored English in all languages)."""
    from ._seed_texts import fill

    for h in Hospital.objects.filter(slug__startswith="demo-"):
        fill(h, "short_description", DEMO_DESC)
        h.save()
    for d in Doctor.objects.filter(slug__startswith="demo-"):
        original = d.full_name_en or d.full_name_uz or d.full_name
        if not original.startswith("[DEMO] Doctor "):
            continue
        city = original.replace("[DEMO] Doctor ", "")
        fill(d, "full_name", (f"[DEMO] Doctor {city}", f"[DEMO] Врач, {city}", f"[DEMO] Shifokor, {city}"),
             seed_en=f"[DEMO] Doctor {city}")
        fill(d, "specialty_title", ("Demo specialist", "Демо-специалист", "Namunaviy mutaxassis"))
        d.save()
    for p in TreatmentPackage.objects.filter(slug__startswith="demo-").select_related("treatment"):
        t = p.treatment
        fill(p, "name", (f"[DEMO] {t.name_en} package", f"[DEMO] Пакет: {t.name_ru}", f"[DEMO] {t.name_uz} paketi"),
             seed_en=f"[DEMO] {t.name_en} package")
        nl = chr(10)
        fill(p, "included_services", (f"Demo item 1{nl}Demo item 2", f"Демо-пункт 1{nl}Демо-пункт 2",
                                      f"Namunaviy band 1{nl}Namunaviy band 2"))
        p.save()
