import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Account, Role
from audit.models import AuditLog
from cases.models import CaseReferral, ConsentRecord, MedicalCase, MedicalDocument
from catalog.models import Treatment, TreatmentPackage, TreatmentPrice
from clinics.models import Hospital
from core.models import City, Country, Specialty
from crm.models import Lead, LeadActivity, LeadStage, Patient, Task
from doctors.models import Doctor
from finance.models import Payment
from notifications.models import Notification

User = get_user_model()
PDF = b"%PDF-1.4\n%test document\n"
TMP = tempfile.mkdtemp()


def pdf(name="report.pdf"):
    return SimpleUploadedFile(name, PDF, content_type="application/pdf")


@override_settings(PRIVATE_MEDIA_ROOT=TMP + "/private", MEDIA_ROOT=TMP + "/media",
                   REST_FRAMEWORK={**__import__("django.conf").conf.settings.REST_FRAMEWORK,
                                   "DEFAULT_THROTTLE_CLASSES": []})
class Base(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_reference", verbosity=0)
        cls.turkey = Country.objects.get(slug="turkey")
        cls.india = Country.objects.get(slug="india")
        cls.cardio = Specialty.objects.get(slug="cardiology")
        cls.cabg = Treatment.objects.get(slug="cabg")
        cls.ist = City.objects.create(country=cls.turkey, name="Istanbul")
        cls.delhi = City.objects.create(country=cls.india, name="Delhi")
        cls.h1 = Hospital.objects.create(name="Alpha Heart", slug="alpha-heart", city=cls.ist, is_verified=True,
                                         languages="English, Russian", services_available="Interpreter")
        cls.h1.specialties.add(cls.cardio)
        cls.h1.treatments.add(cls.cabg)
        cls.h2 = Hospital.objects.create(name="Beta Clinic", slug="beta-clinic", city=cls.delhi)
        cls.h2.specialties.add(cls.cardio)
        TreatmentPackage.objects.create(name="CABG package", slug="cabg-alpha", hospital=cls.h1, treatment=cls.cabg,
                                        price=Decimal("6000"))
        TreatmentPrice.objects.create(treatment=cls.cabg, country=cls.turkey, price_from=Decimal("5500"),
                                      source="Hospital price list 2026")
        doc = Doctor.objects.create(full_name="Dr. Test", slug="dr-test", specialty_title="Cardiac surgeon",
                                    specialty=cls.cardio, experience_years=20, languages="English")
        doc.hospitals.add(cls.h1)

    def setUp(self):
        from django.core.cache import cache

        cache.clear()  # rate-limit counters must not leak between tests

    def user(self, role, email=None, hospital=None, approved=True):
        email = email or f"{role}@t.local"
        u = User.objects.create_user(username=email, email=email, password="Str0ng-pass!")
        Account.objects.create(user=u, role=role, hospital=hospital, is_approved=approved)
        return u

    def client_for(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)


class AuthTests(Base):
    def test_register_login_me_logout(self):
        c = APIClient()
        r = c.post("/api/v2/auth/register/", {"first_name": "Aziz", "email": "aziz@x.uz", "phone": "+998901112233",
                                              "password": "Very-strong-9", "consent": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["user"]["role"], "patient")
        self.assertTrue(Patient.objects.filter(user__email="aziz@x.uz").exists())
        self.assertTrue(ConsentRecord.objects.filter(patient__user__email="aziz@x.uz", scope="data_processing").exists())
        r = c.post("/api/v2/auth/login/", {"login": "+998901112233", "password": "Very-strong-9"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("refresh", r.data)  # web: refresh token only in the httpOnly cookie
        cookie = r.cookies["mm_refresh"]
        self.assertTrue(cookie["httponly"])
        refresh = cookie.value
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(c.get("/api/v2/auth/me/").data["email"], "aziz@x.uz")
        r2 = c.post("/api/v2/auth/refresh/", {}, format="json")  # cookie-based rotation
        self.assertEqual(r2.status_code, 200)
        self.assertIn("access", r2.data)
        self.assertEqual(c.post("/api/v2/auth/logout/", {}, format="json").status_code, 204)
        self.assertEqual(APIClient().post("/api/v2/auth/refresh/", {"refresh": refresh}, format="json").status_code, 401)
        mobile = APIClient().post("/api/v2/auth/login/", {"login": "aziz@x.uz", "password": "Very-strong-9"},
                                  format="json", HTTP_X_CLIENT="mobile")
        self.assertIn("refresh", mobile.data)

    def test_register_requires_consent_and_strong_password(self):
        r = APIClient().post("/api/v2/auth/register/", {"first_name": "A", "email": "a@x.uz", "phone": "1",
                                                        "password": "12345678", "consent": False}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_bad_login_is_audited(self):
        r = APIClient().post("/api/v2/auth/login/", {"login": "nobody@x.uz", "password": "x"}, format="json")
        self.assertEqual(r.status_code, 401)
        self.assertTrue(AuditLog.objects.filter(action="auth.login_failed").exists())

    def test_partner_requires_approval(self):
        r = APIClient().post("/api/v2/auth/partner-register/", {"first_name": "P", "email": "p@h.com", "phone": "+90555",
                                                                "password": "Very-strong-9", "consent": True,
                                                                "hospital_name": "X"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("access", r.data)
        r = APIClient().post("/api/v2/auth/login/", {"login": "p@h.com", "password": "Very-strong-9"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_portal_mismatch_rejected(self):
        self.user(Role.PATIENT, "pp@x.uz")
        r = APIClient().post("/api/v2/auth/login/", {"login": "pp@x.uz", "password": "Str0ng-pass!", "portal": "admin"},
                             format="json")
        self.assertEqual(r.status_code, 403)


class PermissionTests(Base):
    def test_anonymous_and_patient_cannot_access_crm(self):
        self.assertEqual(APIClient().get("/api/v2/admin/leads/").status_code, 401)
        patient = self.user(Role.PATIENT)
        self.assertEqual(self.client_for(patient).get("/api/v2/admin/leads/").status_code, 403)
        self.assertEqual(self.client_for(patient).get("/api/v2/admin/dashboard/").status_code, 403)

    def test_content_manager_cannot_see_patients_or_finance(self):
        cm = self.client_for(self.user(Role.CONTENT_MANAGER))
        self.assertEqual(cm.get("/api/v2/admin/patients/").status_code, 403)
        self.assertEqual(cm.get("/api/v2/admin/payments/").status_code, 403)
        self.assertEqual(cm.get("/api/v2/admin/hospitals/").status_code, 200)

    def test_sales_cannot_delete_or_edit_users(self):
        sales = self.client_for(self.user(Role.SALES_MANAGER))
        lead = Lead.objects.create(full_name="X", phone="1")
        self.assertEqual(sales.delete(f"/api/v2/admin/leads/{lead.pk}/").status_code, 403)
        self.assertEqual(sales.post("/api/v2/admin/users/", {"email": "n@x.uz", "role": "admin"}, format="json").status_code, 403)

    def test_admin_cannot_grant_super_admin(self):
        admin = self.client_for(self.user(Role.ADMIN))
        r = admin.post("/api/v2/admin/users/", {"email": "n@x.uz", "username": "n@x.uz", "role": "super_admin"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_removed_legacy_endpoints_are_gone(self):
        """The old /api/v1/requests/ and /api/v1/patients/ apps were removed (moved to backups/legacy-code)."""
        self.assertEqual(APIClient().get("/api/v1/requests/consultations/").status_code, 404)
        self.assertEqual(APIClient().get("/api/v1/patients/").status_code, 404)


class PublicSiteTests(Base):
    def test_consultation_form_creates_lead_activity_notification(self):
        admin = self.user(Role.ADMIN)
        r = APIClient().post("/api/v2/forms/consultation/", {
            "full_name": "Malika", "phone": "+998 90 123 45 67", "treatment": self.cabg.pk,
            "destination": self.turkey.pk, "consent": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.get(pk=r.data["id"])
        self.assertEqual(lead.stage, LeadStage.NEW)
        self.assertIsNotNone(lead.patient)
        self.assertTrue(LeadActivity.objects.filter(lead=lead, type="created").exists())
        self.assertTrue(Notification.objects.filter(user=admin, type="new_lead").exists())

    def test_consultation_requires_consent_and_valid_phone(self):
        r = APIClient().post("/api/v2/forms/consultation/", {"full_name": "A", "phone": "abc", "consent": False},
                             format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("phone", r.data)
        self.assertIn("consent", r.data)

    def test_honeypot_drops_bots(self):
        APIClient().post("/api/v2/forms/consultation/", {"full_name": "Bot", "phone": "+99890000000", "consent": True,
                                                        "website": "spam"}, format="json")
        self.assertFalse(Lead.objects.filter(full_name="Bot").exists())

    def test_hospital_filters_and_compare(self):
        c = APIClient()
        r = c.get("/api/v2/public/hospitals/", {"country": "turkey"})
        self.assertEqual([h["slug"] for h in r.data["results"]], ["alpha-heart"])
        r = c.get("/api/v2/public/hospitals/", {"specialty": "cardiology", "verified": "1"})
        self.assertEqual(r.data["count"], 1)
        r = c.get("/api/v2/public/hospitals/", {"price_max": "5000"})
        self.assertEqual(r.data["count"], 0)
        r = c.get("/api/v2/public/hospitals/", {"language": "russian"})
        self.assertEqual(r.data["count"], 1)
        r = c.get("/api/v2/public/hospitals/compare/", {"ids": f"{self.h2.pk},{self.h1.pk}"})
        self.assertEqual([h["slug"] for h in r.data], ["beta-clinic", "alpha-heart"])
        self.assertFalse(r.data[0]["is_verified"])

    def test_destination_treatment_doctor_pages(self):
        c = APIClient()
        d = c.get("/api/v2/public/destinations/turkey/").data
        self.assertEqual(d["hospitals"][0]["slug"], "alpha-heart")
        self.assertEqual(len(c.get("/api/v2/public/destinations/").data), 9)  # 7 abroad + Azerbaijan + Uzbekistan
        t = c.get("/api/v2/public/treatments/cabg/").data
        self.assertEqual(t["prices"][0]["source"], "Hospital price list 2026")
        self.assertEqual(len(t["packages"]), 1)
        self.assertEqual(c.get("/api/v2/public/doctors/", {"hospital": "alpha-heart"}).data["count"], 1)
        self.assertEqual(c.get("/api/v2/public/doctors/", {"experience_min": "25"}).data["count"], 0)

    def test_multilingual_content(self):
        c = APIClient()
        self.assertEqual(c.get("/api/v2/public/destinations/turkey/", HTTP_ACCEPT_LANGUAGE="ru").data["name"], "Турция")
        self.assertEqual(c.get("/api/v2/public/destinations/turkey/", HTTP_ACCEPT_LANGUAGE="en").data["name"], "Turkey")
        self.assertEqual(c.get("/api/v2/public/destinations/turkey/?lang=uz").data["name"], "Turkiya")

    def test_home_stats_are_real_counts(self):
        stats = APIClient().get("/api/v2/public/home/").data["stats"]
        self.assertEqual(stats["hospitals"], 2)
        self.assertEqual(stats["doctors"], 1)
        self.assertEqual(stats["patients_helped"], 0)

    def test_matching_ranks_by_relevance(self):
        r = APIClient().post("/api/v2/tools/match/", {"treatment": self.cabg.pk, "country": self.turkey.pk,
                                                      "budget_usd": 7000, "language": "Russian"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["results"][0]["hospital"]["slug"], "alpha-heart")
        self.assertIn("Offers the requested treatment", r.data["results"][0]["reasons"])

    def test_currency_never_fabricated(self):
        r = APIClient().get("/api/v2/tools/convert/", {"amount": "100", "from": "USD", "to": "UZS"})
        self.assertEqual(r.status_code, 404)
        self.assertFalse(APIClient().get("/api/v2/tools/rates/").data["configured"])

    @override_settings(INTEGRATIONS={**__import__("django.conf").conf.settings.INTEGRATIONS, "ai_api_key": ""})
    def test_assistant_reports_missing_configuration(self):
        r = APIClient().post("/api/v2/assistant/chat/", {"message": "Hi"}, format="json")
        self.assertEqual(r.status_code, 503)
        self.assertFalse(r.data["configured"])

    def test_search(self):
        r = APIClient().get("/api/v2/public/search/", {"q": "alpha"})
        self.assertEqual(r.data["hospitals"][0]["slug"], "alpha-heart")


class CRMTests(Base):
    def setUp(self):
        super().setUp()
        self.sales = self.user(Role.SALES_MANAGER)
        self.c = self.client_for(self.sales)

    def test_board_has_twelve_columns(self):
        Lead.objects.create(full_name="A", phone="1", stage=LeadStage.CONTACTED)
        cols = self.c.get("/api/v2/admin/leads/board/").data
        self.assertEqual(len(cols), 12)
        self.assertEqual(next(c for c in cols if c["stage"] == "contacted")["count"], 1)

    def test_drag_drop_persists_with_history(self):
        a = Lead.objects.create(full_name="A", phone="1", stage=LeadStage.QUALIFICATION, position=1000)
        b = Lead.objects.create(full_name="B", phone="2", stage=LeadStage.QUALIFICATION, position=2000)
        x = Lead.objects.create(full_name="X", phone="3", stage=LeadStage.NEW)
        r = self.c.post(f"/api/v2/admin/leads/{x.pk}/move/", {"stage": "qualification", "before_id": a.pk,
                                                               "after_id": b.pk}, format="json")
        self.assertEqual(r.status_code, 200)
        x.refresh_from_db()
        self.assertEqual(x.stage, "qualification")
        self.assertEqual(x.position, 1500)
        act = LeadActivity.objects.get(lead=x, type="stage_changed")
        self.assertEqual((act.from_stage, act.to_stage, act.actor), ("new", "qualification", self.sales))
        self.assertTrue(AuditLog.objects.filter(action="lead.stage_changed", object_id=str(x.pk)).exists())

    def test_manual_lead_filters_export_and_bulk(self):
        r = self.c.post("/api/v2/admin/leads/", {"full_name": "Manual", "phone": "+998", "priority": "high"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.c.get("/api/v2/admin/leads/", {"priority": "high"}).data["count"], 1)
        self.assertEqual(self.c.get("/api/v2/admin/leads/", {"q": "manu"}).data["count"], 1)
        resp = self.c.get("/api/v2/admin/leads/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Manual", resp.content.decode("utf-8-sig"))
        r = self.c.post("/api/v2/admin/leads/bulk/", {"ids": [r.data["id"]], "action": "move", "stage": "contacted"},
                        format="json")
        self.assertEqual(r.data["updated"], 1)

    def test_overdue_follow_up_filter(self):
        Lead.objects.create(full_name="Late", phone="1", next_follow_up=timezone.now() - timedelta(days=1))
        self.assertEqual(self.c.get("/api/v2/admin/leads/", {"overdue": "1"}).data["count"], 1)

    def test_patient_360_and_notes(self):
        p = Patient.objects.create(full_name="Dilnoza", phone="+9989")
        self.c.post("/api/v2/admin/notes/", {"patient": p.pk, "text": "Called, waiting for MRI"}, format="json")
        prof = self.c.get(f"/api/v2/admin/patients/{p.pk}/profile/").data
        self.assertEqual(prof["notes"][0]["text"], "Called, waiting for MRI")
        self.assertEqual(prof["timeline"][0]["type"], "note")
        self.assertNotIn("payments", prof)  # sales has no finance.view

    def test_task_assignment_notifies(self):
        coord = self.user(Role.MEDICAL_COORDINATOR)
        r = self.c.post("/api/v2/admin/tasks/", {"title": "Call back", "assignee": coord.pk}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Notification.objects.filter(user=coord, type="new_task").exists())


class DocumentsAndCasesTests(Base):
    def setUp(self):
        super().setUp()
        self.patient_user = self.user(Role.PATIENT, "pat@x.uz")
        self.pc = self.client_for(self.patient_user)

    def test_upload_private_and_signed_download(self):
        r = self.pc.post("/api/v2/me/documents/", {"files": [pdf()], "category": "mri"}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        doc = MedicalDocument.objects.get(pk=r.data[0]["id"])
        self.assertNotIn("file", r.data[0])
        with self.assertRaises(ValueError):
            doc.file.url  # no public URL exists
        link = self.pc.post(f"/api/v2/me/documents/{doc.pk}/link/").data["url"]
        resp = APIClient().get(link)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b"".join(resp.streaming_content), PDF)
        other = self.client_for(self.user(Role.PATIENT, "other@x.uz"))
        self.assertEqual(other.get(f"/api/v2/me/documents/{doc.pk}/").status_code, 404)
        self.assertEqual(APIClient().get("/api/v2/files/forged-token/").status_code, 404)

    def test_upload_validation(self):
        bad = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
        self.assertEqual(self.pc.post("/api/v2/me/documents/", {"files": [bad]}, format="multipart").status_code, 400)
        fake = SimpleUploadedFile("x.pdf", b"not a pdf", content_type="application/pdf")
        self.assertEqual(self.pc.post("/api/v2/me/documents/", {"files": [fake]}, format="multipart").status_code, 400)

    @override_settings(SIGNED_URL_TTL_SECONDS=-1)
    def test_signed_link_expires(self):
        r = self.pc.post("/api/v2/me/documents/", {"files": [pdf()]}, format="multipart")
        link = self.pc.post(f"/api/v2/me/documents/{r.data[0]['id']}/link/").data["url"]
        self.assertEqual(APIClient().get(link).status_code, 404)

    def test_second_opinion_flow_end_to_end(self):
        r = APIClient().post("/api/v2/forms/second-opinion/", {
            "full_name": "Bobur", "phone": "+998977777777", "specialty": self.cardio.pk, "message": "Need opinion",
            "consent": "true", "files": [pdf()]}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        case = MedicalCase.objects.get(reference=r.data["reference"])
        self.assertEqual(case.case_type, "second_opinion")
        self.assertEqual(case.documents.count(), 1)
        track = APIClient().post("/api/v2/forms/track/", {"reference": case.reference, "phone": "+998977777777"},
                                 format="json")
        self.assertEqual(track.data["status"], "request_received")
        self.assertEqual(APIClient().post("/api/v2/forms/track/", {"reference": case.reference, "phone": "+1"},
                                          format="json").status_code, 404)

        coord = self.client_for(self.user(Role.MEDICAL_COORDINATOR))
        doc_id = case.documents.first().pk
        r = coord.post(f"/api/v2/admin/cases/{case.pk}/refer/", {"hospital": self.h1.pk, "documents": [doc_id]},
                       format="json")
        self.assertEqual(r.status_code, 409)  # no consent yet
        coord.post(f"/api/v2/admin/cases/{case.pk}/consent/", {"scope": "share_with_hospital", "hospital": self.h1.pk},
                   format="json")
        r = coord.post(f"/api/v2/admin/cases/{case.pk}/refer/", {"hospital": self.h1.pk, "documents": [doc_id]},
                       format="json")
        self.assertEqual(r.status_code, 201, r.data)
        ref = CaseReferral.objects.get(case=case)

        partner = self.client_for(self.user(Role.HOSPITAL_PARTNER, "ph@x.com", hospital=self.h1))
        lst = partner.get("/api/v2/partner/referrals/").data
        self.assertEqual(lst["count"], 1)
        detail = partner.get(f"/api/v2/partner/referrals/{ref.pk}/").data
        self.assertEqual(len(detail["documents"]), 1)
        self.assertNotIn("phone", detail["patient"])
        link = partner.post(f"/api/v2/partner/referrals/{ref.pk}/documents/{doc_id}/link/").data["url"]
        self.assertEqual(APIClient().get(link).status_code, 200)
        r = partner.post(f"/api/v2/partner/referrals/{ref.pk}/opinion/", {"summary": "Surgery indicated",
                                                                          "doctor_name": "Prof. X"}, format="json")
        self.assertEqual(r.status_code, 201)
        r = partner.post(f"/api/v2/partner/referrals/{ref.pk}/quotation/", {"treatment_plan": "CABG",
                                                                            "amount_min": "7000", "currency": "USD",
                                                                            "quote_type": "confirmed"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertNotIn("patient_name", r.data)
        self.assertNotIn("patient_name", partner.get(f"/api/v2/partner/referrals/{ref.pk}/").data["quotations"][0])

        other_partner = self.client_for(self.user(Role.HOSPITAL_PARTNER, "ph2@x.com", hospital=self.h2))
        self.assertEqual(other_partner.get(f"/api/v2/partner/referrals/{ref.pk}/").status_code, 404)
        unapproved = self.client_for(self.user(Role.HOSPITAL_PARTNER, "ph3@x.com", hospital=self.h1, approved=False))
        self.assertEqual(unapproved.get("/api/v2/partner/referrals/").status_code, 403)

        # consent revoked -> partner loses document access
        ConsentRecord.objects.filter(patient=case.patient).update(revoked_at=timezone.now())
        self.assertEqual(APIClient().get(link).status_code, 404)

        opinion_id = case.opinions.first().pk
        coord.post(f"/api/v2/admin/cases/{case.pk}/opinions/{opinion_id}/release/")
        self.assertTrue(case.opinions.get(pk=opinion_id).released_to_patient)

    def test_patient_dashboard_shows_only_released_items(self):
        patient = Patient.objects.get(user=self.patient_user) if Patient.objects.filter(user=self.patient_user).exists() \
            else Patient.objects.create(user=self.patient_user, full_name="Pat", phone="+1")
        case = MedicalCase.objects.create(patient=patient, title="Knee", status="quotation_available")
        case.opinions.create(summary="internal draft", released_to_patient=False)
        case.quotations.create(hospital=self.h1, treatment_plan="x", amount_min=1, status="draft")
        d = self.pc.get(f"/api/v2/me/cases/{case.pk}/").data
        self.assertEqual(d["opinions"], [])
        self.assertEqual(d["quotations"], [])
        self.assertTrue(d["journey"][5]["current"])
        self.assertEqual(self.pc.get("/api/v2/me/overview/").data["cases"][0]["reference"], case.reference)

    def test_patient_creates_case_from_portal(self):
        r = self.pc.post("/api/v2/me/cases/", {"title": "Heart check", "specialty": self.cardio.pk}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Lead.objects.filter(source__code="patient_portal").exists())


class FinanceAndDashboardTests(Base):
    def test_payment_confirmation_requires_reference(self):
        fm = self.client_for(self.user(Role.FINANCE_MANAGER))
        r = fm.post("/api/v2/admin/payments/", {"amount": "100", "currency": "USD", "status": "confirmed"}, format="json")
        self.assertEqual(r.status_code, 400)
        r = fm.post("/api/v2/admin/payments/", {"amount": "100", "currency": "USD", "status": "confirmed",
                                                "kind": "service_fee", "provider_reference": "BANK-123"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Payment.objects.get().amount_usd, Decimal("100.00"))
        Payment.objects.update(paid_at=timezone.now())
        s = fm.get("/api/v2/admin/payments/summary/").data
        self.assertEqual(s["service_fees"], Decimal("100.00"))

    def test_dashboard_values_come_from_db(self):
        Lead.objects.create(full_name="A", phone="1", stage=LeadStage.NEW)
        Lead.objects.create(full_name="B", phone="2", stage=LeadStage.COMPLETED)
        Lead.objects.create(full_name="C", phone="3", stage=LeadStage.LOST)
        d = self.client_for(self.user(Role.ADMIN)).get("/api/v2/admin/dashboard/").data
        self.assertEqual(d["kpis"]["total_leads"], 3)
        self.assertEqual(d["kpis"]["conversion_rate"], 50.0)
        self.assertIn("total_revenue", d["kpis"])
        sales = self.client_for(self.user(Role.SALES_MANAGER)).get("/api/v2/admin/dashboard/").data
        self.assertNotIn("total_revenue", sales["kpis"])

    def test_catalog_crud_is_audited(self):
        cm = self.client_for(self.user(Role.CONTENT_MANAGER))
        r = cm.post("/api/v2/admin/countries/", {"name": "Malaysia", "name_en": "Malaysia", "name_ru": "Малайзия",
                                                 "name_uz": "Malayziya", "slug": "malaysia", "is_destination": True},
                    format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(AuditLog.objects.filter(action="country.created").exists())
        self.assertEqual(APIClient().get("/api/v2/public/destinations/malaysia/", HTTP_ACCEPT_LANGUAGE="ru").data["name"],
                         "Малайзия")
        r = cm.delete(f"/api/v2/admin/specialties/{self.cardio.pk}/")
        self.assertEqual(r.status_code, 409)  # protected by treatments


class AggregationRegressionTests(Base):
    def test_stage_counts_ignore_default_ordering(self):
        """Regression: grouping must not include Lead.Meta.ordering columns (position/created_at)."""
        Lead.objects.create(full_name="A", phone="1", stage=LeadStage.CONTACTED, position=0)
        Lead.objects.create(full_name="B", phone="2", stage=LeadStage.CONTACTED, position=1000)
        admin = self.client_for(self.user(Role.ADMIN))
        cols = admin.get("/api/v2/admin/leads/board/").data
        self.assertEqual(next(c for c in cols if c["stage"] == "contacted")["count"], 2)
        stages = admin.get("/api/v2/admin/dashboard/").data["charts"]["stages"]
        self.assertEqual(next(s for s in stages if s["key"] == "contacted")["value"], 2)


class SecurityRegressionTests(Base):
    def test_registering_with_someones_phone_does_not_expose_their_records(self):
        victim = Patient.objects.create(full_name="Victim", phone="+998900001111")
        MedicalCase.objects.create(patient=victim, title="Victim case")
        r = APIClient().post("/api/v2/auth/register/", {"first_name": "Mal", "email": "mal@x.uz", "phone": "+998900001111",
                                                        "password": "Very-strong-9", "consent": True}, format="json")
        self.assertEqual(r.status_code, 201)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(c.get("/api/v2/me/overview/").data["cases"], [])
        victim.refresh_from_db()
        self.assertIsNone(victim.user)

    def test_duplicate_phone_registration_rejected(self):
        self.user(Role.PATIENT, "a1@x.uz")
        Account.objects.filter(user__username="a1@x.uz").update(phone="+998901234000")
        r = APIClient().post("/api/v2/auth/register/", {"first_name": "B", "email": "b@x.uz", "phone": "+998901234000",
                                                        "password": "Very-strong-9", "consent": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("phone", r.data)

    def test_patient_cannot_attach_document_to_foreign_case(self):
        other = Patient.objects.create(full_name="Other", phone="1")
        foreign = MedicalCase.objects.create(patient=other, title="Other case")
        pc = self.client_for(self.user(Role.PATIENT, "p9@x.uz"))
        doc_id = pc.post("/api/v2/me/documents/", {"files": [pdf()]}, format="multipart").data[0]["id"]
        r = pc.patch(f"/api/v2/me/documents/{doc_id}/", {"case": foreign.pk}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertFalse(MedicalDocument.objects.filter(case=foreign).exists())

    def test_admin_cannot_modify_super_admin(self):
        sa = self.user(Role.SUPER_ADMIN, "sa@x.uz")
        admin = self.client_for(self.user(Role.ADMIN, "ad@x.uz"))
        self.assertEqual(admin.patch(f"/api/v2/admin/users/{sa.pk}/", {"password": "Hijacked-pass-1"}, format="json").status_code, 400)
        self.assertEqual(admin.delete(f"/api/v2/admin/users/{sa.pk}/").status_code, 403)
        sa.refresh_from_db()
        self.assertTrue(sa.check_password("Str0ng-pass!"))
        self.assertTrue(sa.is_active)

    def test_public_form_cannot_create_lead_sources(self):
        from crm.models import LeadSource

        n = LeadSource.objects.count()
        APIClient().post("/api/v2/forms/consultation/", {"full_name": "A", "phone": "+998900000000", "consent": True,
                                                        "source": "spam-source-x"}, format="json")
        self.assertEqual(LeadSource.objects.count(), n)


class RemindersAndSanitizingTests(Base):
    def test_send_reminders_once(self):
        sales = self.user(Role.SALES_MANAGER)
        Task.objects.create(title="Call", assignee=sales, due_at=timezone.now() - timedelta(minutes=5))
        Lead.objects.create(full_name="L", phone="1", assigned_to=sales, next_follow_up=timezone.now() - timedelta(hours=1))
        call_command("send_reminders", verbosity=0)
        call_command("send_reminders", verbosity=0)  # idempotent
        self.assertEqual(Notification.objects.filter(user=sales, type="follow_up").count(), 2)

    def test_rich_text_is_sanitized_on_public_api(self):
        self.h1.description = '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
        self.h1.description_uz = self.h1.description
        self.h1.save()
        d = APIClient().get("/api/v2/public/hospitals/alpha-heart/").data["description"]
        self.assertNotIn("script", d)
        self.assertNotIn("onclick", d)
        self.assertNotIn("javascript:", d)
        self.assertIn("Hi", d)


class PartnerImportAndContentTests(Base):
    def test_import_partners_is_idempotent_and_removes_demo(self):
        demo = Hospital.objects.create(slug="demo-x", name="[DEMO] X", city=self.ist)
        Doctor.objects.create(slug="demo-x-doctor", full_name="[DEMO] Doc", specialty_title="Demo")
        call_command("import_partners", verbosity=0)
        call_command("import_partners", verbosity=0)
        self.assertFalse(Hospital.objects.filter(pk=demo.pk).exists())
        self.assertFalse(Doctor.objects.filter(slug__startswith="demo-").exists())
        self.assertEqual(Hospital.objects.filter(slug="renji-hospital-shanghai").count(), 1)
        renji = Hospital.objects.get(slug="renji-hospital-shanghai")
        self.assertEqual(renji.city.country.slug, "china")
        self.assertTrue(renji.short_description_ru and renji.short_description_uz != renji.short_description_en)
        self.assertGreaterEqual(Doctor.objects.filter(hospitals=renji).count(), 3)
        p = TreatmentPrice.objects.get(treatment__slug="knee-replacement", country__slug="china", hospital=None)
        self.assertEqual((p.currency, int(p.price_from), int(p.price_to)), ("GBP", 3300, 6600))
        self.assertIn("not a quotation", p.source)

    def test_import_regional_is_idempotent_and_keeps_staff_edits(self):
        call_command("seed_reference", verbosity=0)
        call_command("import_regional", verbosity=0)
        h = Hospital.objects.get(slug="anadolu-medical-center")
        h.description_uz = "Xodim tahriri"
        h.is_verified = True
        h.save()
        call_command("import_regional", verbosity=0)
        h.refresh_from_db()
        self.assertEqual(h.description_uz, "Xodim tahriri")
        self.assertTrue(h.is_verified)
        self.assertEqual(Hospital.objects.filter(slug="anadolu-medical-center").count(), 1)
        for slug, at_least in (("india", 10), ("turkey", 10), ("azerbaijan", 10), ("uzbekistan", 8)):
            self.assertGreaterEqual(Hospital.objects.filter(city__country__slug=slug, is_active=True).count(), at_least, slug)
        uz = Country.objects.get(slug="uzbekistan")
        self.assertTrue(uz.is_destination and uz.is_source_market)
        self.assertTrue(Country.objects.get(slug="azerbaijan").is_destination)
        self.assertFalse(Hospital.objects.filter(slug="akfa-medline-tashkent", is_verified=True).exists())

    def test_seed_content_is_idempotent_and_keeps_staff_edits(self):
        from blog.models import Post
        from catalog.models import FAQ
        call_command("seed_reference", verbosity=0)
        call_command("import_regional", verbosity=0)
        call_command("seed_content", verbosity=0)
        india = Country.objects.get(slug="india")
        india.intro_uz = "Xodim matni"
        india.save()
        call_command("seed_content", verbosity=0)
        india.refresh_from_db()
        self.assertEqual(india.intro_uz, "Xodim matni")
        self.assertTrue(india.visa_info_ru and india.visa_info_source.startswith("https://"))
        self.assertEqual(FAQ.objects.filter(scope="general").count(), 10)
        self.assertEqual(Post.objects.filter(status="published").count(), 8)
        p = TreatmentPrice.objects.get(treatment__slug="knee-replacement", country__slug="turkey", hospital=None)
        self.assertIn("not a quotation", p.source)
        for slug in ("germany", "south-korea", "uae", "thailand"):
            self.assertGreaterEqual(Hospital.objects.filter(city__country__slug=slug).count(), 8, slug)

    def test_admin_catalog_bulk_and_filters(self):
        staff = self.client_for(self.user("super_admin"))
        url = "/api/v2/admin/hospitals/"
        # bulk verify both hospitals; only allowed boolean fields, only staff with write permission
        r = staff.post(f"{url}bulk/", {"ids": [self.h1.id, self.h2.id], "field": "is_verified", "value": True}, format="json")
        self.assertEqual((r.status_code, r.data["updated"]), (200, 2))
        self.h2.refresh_from_db()
        self.assertTrue(self.h2.is_verified)
        self.assertEqual(staff.post(f"{url}bulk/", {"ids": [self.h1.id], "field": "name", "value": True}, format="json").status_code, 400)
        cm = self.client_for(self.user("sales_manager"))
        self.assertEqual(cm.post(f"{url}bulk/", {"ids": [self.h1.id], "field": "is_active", "value": False}, format="json").status_code, 403)
        # filters: no photo, missing translation, country
        self.assertEqual(staff.get(f"{url}?has_image=false").data["count"], 2)
        self.assertEqual(staff.get(f"{url}?has_image=true").data["count"], 0)
        self.assertEqual(staff.get(f"{url}?missing_tr=ru").data["count"], 2)  # test hospitals have no Russian texts
        self.assertEqual(staff.get(f"{url}?city__country={self.india.id}").data["count"], 1)
        row = staff.get(f"{url}?search=Alpha").data["results"][0]
        self.assertIn("ru", row["missing_tr"])

    def test_crm_hides_demo_leads_and_summary(self):
        from django.utils import timezone
        staff = self.client_for(self.user("super_admin"))
        Lead.objects.create(full_name="[DEMO] Lead 1", phone="1")
        Lead.objects.create(full_name="Real Patient", phone="2", next_follow_up=timezone.now() - timezone.timedelta(hours=2))
        names = [x["full_name"] for x in staff.get("/api/v2/admin/leads/").data["results"]]
        self.assertEqual(names, ["Real Patient"])
        self.assertEqual(staff.get("/api/v2/admin/leads/?demo=1").data["count"], 2)
        board = staff.get("/api/v2/admin/leads/board/").data
        self.assertEqual(sum(c["count"] for c in board), 1)
        s = staff.get("/api/v2/admin/leads/summary/").data
        self.assertEqual((s["fresh"], s["overdue"], s["unassigned"], s["demo"]), (1, 1, 1, 1))
        self.assertEqual(staff.get("/api/v2/admin/leads/?overdue=1").data["count"], 1)
        self.assertEqual(self.client_for(self.user("patient")).get("/api/v2/admin/leads/summary/").status_code, 403)

    def test_hospital_photos_attach_once_and_keep_staff_uploads(self):
        from clinics.models import Hospital as H
        call_command("import_regional", verbosity=0)
        call_command("import_hospital_photos", verbosity=0)
        h = H.objects.get(slug="charite-berlin")
        self.assertTrue(h.image and "Wikimedia Commons" in h.image_credit and h.image_source.startswith("https://commons.wikimedia.org/"))
        h.image_credit = "Staff photo"
        h.save()
        call_command("import_hospital_photos", verbosity=0)
        h.refresh_from_db()
        self.assertEqual(h.image_credit, "Staff photo")
        card = APIClient().get("/api/v2/public/hospitals/charite-berlin/").data
        self.assertEqual(card["image_credit"], "Staff photo")

    def test_session_refresh_not_limited_by_login_throttle(self):
        """Opening many pages must not log a patient out; different visitors behind the proxy have separate limits."""
        self.user("patient", email="p@t.local")
        c = APIClient(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="10.0.0.1")
        r = c.post("/api/v2/auth/login/", {"login": "p@t.local", "password": "Str0ng-pass!", "portal": "dashboard"}, format="json")
        self.assertEqual(r.status_code, 200)
        for _ in range(15):  # more than the 10/min login limit
            self.assertEqual(c.post("/api/v2/auth/refresh/", {}, format="json").status_code, 200)
        # a burst of failed logins from one visitor does not lock out another visitor
        bad = APIClient(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="10.0.0.2")
        for _ in range(12):
            bad.post("/api/v2/auth/login/", {"login": "p@t.local", "password": "wrong-pass", "portal": "dashboard"}, format="json")
        other = APIClient(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="10.0.0.3")
        r = other.post("/api/v2/auth/login/", {"login": "p@t.local", "password": "Str0ng-pass!", "portal": "dashboard"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_sequential_reference_shared_by_request_and_case(self):
        p = Patient.objects.create(full_name="Seq", phone="+998900000777")
        lead = Lead.objects.create(patient=p, full_name="Seq", phone=p.phone)
        self.assertRegex(lead.reference, r"^MM-\d{4}$")
        n = int(lead.reference[3:])
        case = MedicalCase.objects.create(patient=p, lead=lead, case_type="treatment", title="A")
        self.assertEqual(case.reference, lead.reference)  # the case keeps the number the patient already has
        case2 = MedicalCase.objects.create(patient=p, lead=lead, case_type="treatment", title="B")
        self.assertEqual(case2.reference, f"MM-{n + 1:04d}")

    def test_legal_pages_and_country_photo_credit_seeded(self):
        r = APIClient().get("/api/v2/public/pages/public-offer/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Ommaviy oferta", r.data["title"])
        self.assertIn("<h2>", r.data["body"])
        c = Country.objects.get(slug="china")
        self.assertTrue(c.hero_image)
        self.assertIn("CC BY-SA", c.hero_image_credit)


class PatientCabinetV3Tests(Base):
    def test_support_chat_flow_and_isolation(self):
        u1 = self.user("patient", email="p1@t.local")
        u2 = self.user("patient", email="p2@t.local")
        staff = self.user("sales_manager", email="s@t.local")
        c1, c2, cs = self.client_for(u1), self.client_for(u2), self.client_for(staff)
        self.assertEqual(c1.post("/api/v2/me/chat/", {"text": "  "}, format="json").status_code, 400)
        r = c1.post("/api/v2/me/chat/", {"text": "Salom, savolim bor"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(c2.get("/api/v2/me/chat/").data, [])  # other patients never see it
        self.assertEqual(c1.get("/api/v2/admin/chats/").status_code, 403)  # patients cannot open the staff inbox
        rows = cs.get("/api/v2/admin/chats/").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["unread"], 1)
        pid = rows[0]["patient"]
        self.assertEqual(cs.post(f"/api/v2/admin/chats/{pid}/", {"text": "Assalomu alaykum!"}, format="json").status_code, 201)
        self.assertEqual(cs.get("/api/v2/admin/chats/").data[0]["unread"], 0)  # opening the thread marks it read
        self.assertEqual(c1.get("/api/v2/me/chat/unread/").data["count"], 1)
        self.assertTrue(Notification.objects.filter(user=u1, type="chat").exists())
        msgs = c1.get("/api/v2/me/chat/").data
        self.assertEqual([m["from_staff"] for m in msgs], [False, True])
        self.assertEqual(c1.get("/api/v2/me/chat/unread/").data["count"], 0)

    def test_history_events_are_keys_not_english_text(self):
        u = self.user("patient", email="h@t.local")
        c = self.client_for(u)
        r = c.post("/api/v2/me/cases/", {"case_type": "treatment", "title": "Knee", "description": "pain"}, format="json")
        self.assertIn(r.status_code, (200, 201), r.data)
        case = MedicalCase.objects.get(patient__user=u)
        d = c.get(f"/api/v2/me/cases/{case.pk}/").data
        self.assertEqual(d["history"][0]["event"], "request_received")
        self.assertEqual(d["history"][0]["note"], "")

    def test_track_by_passport_or_reference_requires_phone(self):
        r = APIClient().post("/api/v2/forms/consultation/", {
            "full_name": "Ali Valiyev", "phone": "+998 90 123 45 67", "passport_number": "ae 3500767", "consent": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        p = Patient.objects.get(full_name="Ali Valiyev")
        self.assertEqual(p.passport_number, "AE3500767")
        def track(ref, phone):
            return APIClient().post("/api/v2/forms/track/", {"reference": ref, "phone": phone}, format="json")
        self.assertEqual(track("AE3500767", "+998901234567").status_code, 200)  # request without a case yet
        self.assertEqual(track("AE3500767", "+998909999999").status_code, 404)  # wrong phone
        self.assertEqual(track("AE3500767", "").status_code, 404)
        case = MedicalCase.objects.create(patient=p, case_type="treatment", title="Test")
        res = track("ae3500767", "998901234567")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["reference"], case.reference)
        self.assertEqual(track(case.reference.lower(), "+998 90 123 45 67").data["reference"], case.reference)
        staff = self.client_for(self.user("admin", email="a@t.local"))
        self.assertEqual(staff.get("/api/v2/admin/patients/?search=AE3500767").data["count"], 1)


@override_settings(SMS_PROVIDER="console", SMS_LOGIN_ENABLED=True, GOOGLE_CLIENT_ID="test-client.apps.googleusercontent.com")
class PasswordlessLoginTests(Base):
    def sms_code(self, c, phone):
        from unittest import mock
        sent = {}
        with mock.patch("accounts.social.send_sms", side_effect=lambda ph, text: sent.update(text=text) or True):
            r = c.post("/api/v2/auth/sms/request/", {"phone": phone}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        return r, sent["text"].split("kodi ")[1][:6]

    def test_sms_new_patient_then_existing_login(self):
        c = APIClient()
        r, code = self.sms_code(c, "+998 90 555 44 33")
        self.assertTrue(r.data["new_user"])
        self.assertNotIn("dev_code", r.data)  # DEBUG is off in tests
        self.assertEqual(c.post("/api/v2/auth/sms/verify/", {"phone": "998905554433", "code": "000000"}, format="json").data["code"], "wrong_code")
        r = c.post("/api/v2/auth/sms/verify/", {"phone": "998905554433", "code": code}, format="json")
        self.assertTrue(r.data["need_profile"])
        r = c.post("/api/v2/auth/sms/verify/", {"phone": "998905554433", "code": code, "full_name": "Ali Valiyev", "consent": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["user"]["portal"], "dashboard")
        self.assertIn("mm_refresh", r.cookies)
        # the code is single-use
        self.assertEqual(c.post("/api/v2/auth/sms/verify/", {"phone": "998905554433", "code": code}, format="json").status_code, 400)
        # second sign-in finds the same account (phone typed differently)
        from accounts.models import OtpCode
        OtpCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))  # past the resend pause
        c2 = APIClient()
        r, code = self.sms_code(c2, "90 555-44-33")
        self.assertFalse(r.data["new_user"])
        r = c2.post("/api/v2/auth/sms/verify/", {"phone": "+998905554433", "code": code}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(User.objects.filter(account__phone="+998905554433").count(), 1)

    def test_sms_limits_and_staff_refused(self):
        c = APIClient()
        self.sms_code(c, "+998901112233")
        self.assertEqual(c.post("/api/v2/auth/sms/request/", {"phone": "+998901112233"}, format="json").status_code, 429)  # resend pause
        from accounts.models import OtpCode
        for _ in range(5):
            c.post("/api/v2/auth/sms/verify/", {"phone": "+998901112233", "code": "999999"}, format="json")
        otp = OtpCode.objects.get(phone="998901112233")
        self.assertEqual(otp.attempts, 5)
        self.assertEqual(c.post("/api/v2/auth/sms/verify/", {"phone": "+998901112233", "code": "123456"}, format="json").data["code"], "expired")
        staff = self.user("admin", email="adm@t.local")
        staff.account.phone = "+998907778899"
        staff.account.save()
        self.assertEqual(c.post("/api/v2/auth/sms/request/", {"phone": "998907778899"}, format="json").status_code, 403)

    def test_google_login_creates_patient_and_refuses_staff(self):
        from unittest import mock
        claims = {"aud": "test-client.apps.googleusercontent.com", "iss": "https://accounts.google.com",
                  "email": "Nodira@Gmail.com", "email_verified": "true", "name": "Nodira Karimova"}
        with mock.patch("accounts.social.verify_google_token", return_value=claims):
            r = APIClient().post("/api/v2/auth/google/", {"credential": "x"}, format="json")
            self.assertEqual(r.status_code, 201, r.data)
            self.assertEqual(r.data["user"]["full_name"], "Nodira Karimova")
            self.assertEqual(APIClient().post("/api/v2/auth/google/", {"credential": "x"}, format="json").status_code, 200)
            self.assertEqual(User.objects.filter(email="nodira@gmail.com").count(), 1)
            self.user("sales_manager", email="boss@gmail.com")
        with mock.patch("accounts.social.verify_google_token", return_value={**claims, "email": "boss@gmail.com"}):
            self.assertEqual(APIClient().post("/api/v2/auth/google/", {"credential": "x"}, format="json").status_code, 403)
        with mock.patch("accounts.social.verify_google_token", return_value=None):
            self.assertEqual(APIClient().post("/api/v2/auth/google/", {"credential": "bad"}, format="json").status_code, 400)
        self.assertEqual(APIClient().get("/api/v2/auth/methods/").data["google_client_id"], "test-client.apps.googleusercontent.com")

    def test_google_token_checks_audience(self):
        import io
        import json as _json
        from unittest import mock

        from accounts.social import verify_google_token
        bad = {"aud": "someone-else", "iss": "accounts.google.com", "email": "a@b.c", "email_verified": "true"}
        with mock.patch("urllib.request.urlopen", return_value=io.BytesIO(_json.dumps(bad).encode())):
            self.assertIsNone(verify_google_token("t"))


class AdminDashboardTests(Base):
    def test_today_block_excludes_demo_and_login_noise(self):
        from crm.models import SupportMessage
        admin = self.user("admin", email="boss@t.local")
        c = self.client_for(admin)
        Lead.objects.create(full_name="[DEMO] Lead", phone="+998900000001")
        Lead.objects.create(full_name="Real Person", phone="+998900000002")
        p = Patient.objects.create(full_name="Chat Patient", phone="+998900000003")
        SupportMessage.objects.create(patient=p, text="Salom")
        MedicalCase.objects.create(patient=p, case_type="treatment", title="No coordinator")
        r = c.get("/api/v2/admin/dashboard/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["kpis"]["total_leads"], 1)  # demo lead hidden
        today = r.data["today"]
        self.assertEqual(today["fresh_leads"], 1)
        self.assertEqual(today["unread_chats"], 1)
        self.assertEqual(today["unassigned_cases"], 1)
        self.assertIn("pending_partners", today)
        self.assertTrue(all(a["action"].split(".")[0] != "auth" for a in r.data["recent_activity"]))
        self.assertTrue(all("key" in f for f in r.data["charts"]["funnel"]))
        self.assertEqual(c.get("/api/v2/admin/cases/?unassigned=1").data["count"], 1)

    def test_login_records_last_login(self):
        u = self.user("sales_manager", email="s2@t.local")
        self.assertIsNone(u.last_login)
        r = APIClient().post("/api/v2/auth/login/", {"login": "s2@t.local", "password": "Str0ng-pass!"}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertIsNotNone(u.last_login)


class TranslatableTextTests(Base):
    def test_system_activity_has_translation_key_and_clean_titles(self):
        from crm.models import LeadActivity
        r = APIClient().post("/api/v2/forms/second-opinion/", {"full_name": "Aziz", "phone": "+998901230000", "consent": True,
                                                             "specialty": self.cardio.pk}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        case = MedicalCase.objects.get(reference=r.data["reference"])
        self.assertFalse(case.title.startswith("Second opinion"))
        act = LeadActivity.objects.filter(type="created").latest("created_at")
        self.assertEqual(act.meta["key"], "lead_created")
        self.assertEqual(act.meta["source"], "second_opinion")
        admin = self.client_for(self.user("admin", email="adm2@t.local"))
        prof = admin.get(f"/api/v2/admin/patients/{case.patient_id}/profile/").data
        self.assertEqual(prof["chat"], {"total": 0, "unread": 0})


class NotificationLanguageTests(Base):
    def test_titles_follow_reader_language(self):
        staff = self.user("sales_manager", email="n1@t.local")
        APIClient().post("/api/v2/forms/consultation/", {"full_name": "Olim", "phone": "+998901119999", "consent": True}, format="json")
        n = Notification.objects.filter(user=staff, key="lead_new").first()
        self.assertIsNotNone(n)
        self.assertEqual(n.title, "Yangi so‘rov: Olim")
        c = self.client_for(staff)
        ru = c.get("/api/v2/notifications/", HTTP_ACCEPT_LANGUAGE="ru").data["results"][0]["title"]
        en = c.get("/api/v2/notifications/", HTTP_ACCEPT_LANGUAGE="en").data["results"][0]["title"]
        self.assertEqual(ru, "Новая заявка: Олим".replace("Олим", "Olim"))
        self.assertEqual(en, "New lead: Olim")

    def test_status_codes_are_translated(self):
        from notifications.texts import render
        self.assertEqual(render("case_status", {"ref": "MM-0001", "status": "in_treatment"}, "uz"), "MM-0001: Davolanish jarayonida")
        self.assertEqual(render("payment_status", {"uid": "T1", "status": "confirmed"}, "ru"), "Платёж T1: Подтверждён")
        self.assertEqual(render("quotation_decision", {"ref": "MM-0002", "decision": "accepted"}, "en"), "Patient accepted quotation MM-0002")


class PartnerProfileTests(Base):
    def test_partner_edits_per_language_and_uploads_checked_images(self):
        import io

        from PIL import Image
        partner = self.user("hospital_partner", email="hp@t.local", hospital=self.h1)
        c = self.client_for(partner)
        r = c.patch("/api/v2/partner/profile/", {"lang": "ru", "description": "Описание", "phone": "+90 212"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.h1.refresh_from_db()
        self.assertEqual(self.h1.description_ru, "Описание")
        self.assertEqual(self.h1.phone, "+90 212")
        data = c.get("/api/v2/partner/profile/").data
        self.assertEqual(data["translations"]["ru"]["description"], "Описание")
        self.assertIn("new", data["stats"])
        bad = SimpleUploadedFile("x.png", b"not an image", content_type="image/png")
        self.assertEqual(c.patch("/api/v2/partner/profile/", {"image": bad}, format="multipart").status_code, 400)
        buf = io.BytesIO()
        Image.new("RGB", (40, 30), "teal").save(buf, "PNG")
        good = SimpleUploadedFile("photo.png", buf.getvalue(), content_type="image/png")
        self.assertEqual(c.patch("/api/v2/partner/profile/", {"image": good}, format="multipart").status_code, 200)
        self.h1.refresh_from_db()
        self.assertTrue(self.h1.image)
        self.assertEqual(c.patch("/api/v2/partner/profile/", {"image_clear": True}, format="json").status_code, 200)
        self.h1.refresh_from_db()
        self.assertFalse(self.h1.image)


class PerformanceTests(Base):
    def test_public_cache_hits_and_is_invalidated_by_edits(self):
        c = APIClient()
        url = "/api/v2/public/hospitals/?page_size=5"
        self.assertEqual(c.get(url)["X-Cache"], "MISS")
        self.assertEqual(c.get(url)["X-Cache"], "HIT")
        self.h1.name = "Alpha Heart Renamed"
        self.h1.save()  # any catalog edit makes cached public responses stale
        r = c.get(url)
        self.assertEqual(r["X-Cache"], "MISS")
        self.assertIn("Alpha Heart Renamed", r.content.decode())
        # signed-in requests are never served from the shared cache
        c.force_authenticate(self.user("admin", email="perf@t.local"))
        self.assertNotIn("X-Cache", c.get(url, HTTP_AUTHORIZATION="Bearer x"))

    def test_admin_crud_lists_do_not_query_per_row(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        for i in range(8):
            h = Hospital.objects.create(name=f"H{i}", slug=f"h-{i}", city=self.ist)
            h.specialties.add(self.cardio)
            h.treatments.add(self.cabg)
        c = self.client_for(self.user("admin", email="perf2@t.local"))
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(c.get("/api/v2/admin/hospitals/?page_size=25").status_code, 200)
        self.assertLess(len(ctx.captured_queries), 15)


class BadgesAndChatFilesTests(Base):
    def test_counters_depend_on_role(self):
        from crm.models import SupportMessage
        p_user = self.user("patient", email="cp@t.local")
        c = self.client_for(p_user)
        c.post("/api/v2/me/chat/", {"text": "Salom"}, format="json")
        staff = self.client_for(self.user("sales_manager", email="cs@t.local"))
        data = staff.get("/api/v2/me/counters/").data
        self.assertEqual(data["chats"], 1)
        self.assertIn("notifications", data)
        self.assertNotIn("cases", data)  # sales managers do not see medical cases
        pid = SupportMessage.objects.first().patient_id
        staff.post(f"/api/v2/admin/chats/{pid}/", {"text": "Javob"}, format="json")
        self.assertEqual(c.get("/api/v2/me/counters/").data["chat"], 1)
        content = self.client_for(self.user("content_manager", email="cc@t.local"))
        self.assertIn("reviews", content.get("/api/v2/me/counters/").data)
        self.assertEqual(content.get("/api/v2/admin/content-overview/").status_code, 200)
        self.assertEqual(staff.get("/api/v2/admin/content-overview/").status_code, 200)  # catalog.view
        self.assertEqual(c.get("/api/v2/admin/content-overview/").status_code, 403)

    def test_chat_file_upload_and_signed_download(self):
        p_user = self.user("patient", email="cf@t.local")
        c = self.client_for(p_user)
        r = c.post("/api/v2/me/chat/", {"text": "", "file": pdf("analiz.pdf")}, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        att = r.data["attachment"]
        self.assertEqual(att["name"], "analiz.pdf")
        self.assertFalse(att["is_image"])
        self.assertEqual(APIClient().get(att["url"]).status_code, 200)  # signed link works without a session
        bad = SimpleUploadedFile("x.exe", b"MZ....", content_type="application/octet-stream")
        self.assertEqual(c.post("/api/v2/me/chat/", {"file": bad}, format="multipart").status_code, 400)
        other = self.client_for(self.user("patient", email="cf2@t.local"))
        self.assertEqual(other.get("/api/v2/me/chat/").data, [])
        staff = self.client_for(self.user("sales_manager", email="cf3@t.local"))
        rows = staff.get("/api/v2/admin/chats/").data
        self.assertTrue(rows[0]["last_text"].startswith("📎"))

    def test_dashboard_tiles_follow_permissions(self):
        fin = self.client_for(self.user("finance_manager", email="fm@t.local"))
        today = fin.get("/api/v2/admin/dashboard/").data["today"]
        self.assertNotIn("unassigned_cases", today)
        self.assertIn("payments_pending", today)
