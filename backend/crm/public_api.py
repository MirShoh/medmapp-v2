"""Public website forms. Every submission is persisted to the CRM - no frontend-only storage."""
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from audit.service import client_ip
from cases.models import CaseStatusHistory, ConsentRecord, MedicalCase, MedicalDocument
from cases.validators import validate_upload
from catalog.models import MedicalService, Treatment, TreatmentPackage
from clinics.models import Hospital
from core.models import Country, Specialty
from doctors.models import Doctor

from .models import LeadSource, LeadStage
from .services import create_lead


class FormThrottle(ScopedRateThrottle):
    pass


def remember_passport(patient, value):
    """Store the passport number on the patient record if it has none yet (never overwrite a stored one)."""
    from .models import normalize_passport
    value = normalize_passport(value)
    if patient and value and not patient.passport_number:
        patient.passport_number = value
        patient.save(update_fields=["passport_number"])


class LeadFormSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    phone = serializers.RegexField(r"^\+?[0-9 ()\-]{7,20}$", max_length=32)
    email = serializers.EmailField(required=False, allow_blank=True)
    passport_number = serializers.RegexField(r"^[A-Za-z0-9 ]{5,20}$", required=False, allow_blank=True)
    resident_country = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    resident_region = serializers.CharField(max_length=120, required=False, allow_blank=True)
    destination = serializers.PrimaryKeyRelatedField(queryset=Country.objects.all(), required=False, allow_null=True)
    specialty = serializers.PrimaryKeyRelatedField(queryset=Specialty.objects.all(), required=False, allow_null=True)
    treatment = serializers.PrimaryKeyRelatedField(queryset=Treatment.objects.all(), required=False, allow_null=True)
    hospital = serializers.PrimaryKeyRelatedField(queryset=Hospital.objects.all(), required=False, allow_null=True)
    doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.all(), required=False, allow_null=True)
    package = serializers.PrimaryKeyRelatedField(queryset=TreatmentPackage.objects.all(), required=False, allow_null=True)
    service = serializers.SlugRelatedField(slug_field="slug", queryset=MedicalService.objects.all(), required=False,
                                           allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    budget = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    budget_currency = serializers.CharField(max_length=3, required=False, default="USD")
    source = serializers.CharField(max_length=40, required=False, default="website")
    source_detail = serializers.CharField(max_length=255, required=False, allow_blank=True)
    consent = serializers.BooleanField()
    website = serializers.CharField(required=False, allow_blank=True)  # honeypot

    def validate_consent(self, v):
        if not v:
            raise serializers.ValidationError("Consent to personal data processing is required.")
        return v


class ConsultationView(APIView):
    """Free consultation / contact / service / hospital / doctor / package inquiry → CRM lead."""

    throttle_classes = [FormThrottle]
    throttle_scope = "public_form"

    def post(self, request):
        s = LeadFormSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        if d.pop("website", ""):
            return Response({"detail": "ok"}, status=201)  # bot: silently dropped
        d.pop("consent")
        passport = d.pop("passport_number", "")
        source = d.pop("source", "website") or "website"
        if not LeadSource.objects.filter(code=source, is_active=True).exists():
            d["source_detail"] = (d.get("source_detail") or source)[:255]
            source = "website"
        lead = create_lead(request, source_code=source, consent_given=True, **d)
        remember_passport(lead.patient, passport)
        ConsentRecord.objects.create(patient=lead.patient, scope="data_processing", ip_address=client_ip(request))
        ConsentRecord.objects.create(patient=lead.patient, scope="contact", ip_address=client_ip(request))
        return Response({"id": lead.pk, "reference": lead.reference,
                         "detail": "Request received. A MedMapp coordinator will contact you."},
                        status=status.HTTP_201_CREATED)


class SecondOpinionView(APIView):
    """Second opinion request: creates lead + patient + medical case + private documents.

    Returns a unique case reference the patient can track (logged-in patients see it in /dashboard).
    """

    throttle_classes = [FormThrottle]
    throttle_scope = "public_form"
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        s = LeadFormSerializer(data={**request.data.dict()} if hasattr(request.data, "dict") else request.data)
        s.is_valid(raise_exception=True)
        d = dict(s.validated_data)
        if d.pop("website", ""):
            return Response({"detail": "ok"}, status=201)
        d.pop("consent")
        d.pop("source", None)
        passport = d.pop("passport_number", "")
        files = request.FILES.getlist("files")
        if len(files) > 15:
            return Response({"files": ["Up to 15 files per request."]}, status=400)
        checked = [(f, *validate_upload(f)) for f in files]
        service = MedicalService.objects.filter(slug="second-opinion").first()
        lead = create_lead(request, source_code="second_opinion", consent_given=True,
                           service=d.pop("service", None) or service, **d)
        remember_passport(lead.patient, passport)
        lead.stage = LeadStage.DOCUMENTS_PENDING if not files else LeadStage.MEDICAL_REVIEW
        lead.save(update_fields=["stage"])
        ip = client_ip(request)
        ConsentRecord.objects.create(patient=lead.patient, scope="data_processing", ip_address=ip)
        case = MedicalCase.objects.create(
            patient=lead.patient, lead=lead, case_type="second_opinion",
            title=str(lead.specialty or lead.treatment or "")[:255] or (lead.message or "")[:80] or lead.full_name,
            specialty=lead.specialty, treatment=lead.treatment, preferred_destination=lead.destination,
            description=lead.message)
        CaseStatusHistory.objects.create(case=case, to_status=case.status, event="request_received")
        for f, _ext, ctype in checked:
            doc = MedicalDocument(patient=lead.patient, case=case, category=request.data.get("category", "report"),
                                  title=f.name[:255], original_name=f.name[:255], content_type=ctype, size=f.size,
                                  uploaded_by=request.user if request.user.is_authenticated else None)
            doc.file.save(f.name, f, save=False)
            doc.sha256 = doc.compute_hash()
            doc.save()
        return Response({"reference": case.reference, "case_id": case.pk, "documents": len(checked),
                         "detail": "Your second opinion request was received. Track it with your reference."},
                        status=201)


class TrackView(APIView):
    """Public status lookup by case ID *or* passport number, plus the phone on file (no medical details exposed).
    The phone stays a second factor: a passport number alone is known to hotels, airlines and visa agents."""

    throttle_classes = [FormThrottle]
    throttle_scope = "public_form"

    def post(self, request):
        from .models import normalize_passport
        code = normalize_passport(request.data.get("reference"))
        phone = (request.data.get("phone") or "").strip()
        digits = "".join(ch for ch in phone if ch.isdigit())
        if not code or len(digits) < 7:
            return Response({"detail": "No request found for this reference and phone."}, status=404)
        import re
        m = re.fullmatch(r"([A-Z]{2})(\d{1,8})", code)
        ref = f"{m[1]}-{int(m[2]):04d}" if m else None  # "mm1", "MM-0001" and "mm 0001" all mean MM-0001
        q = Q(patient__passport_number=code) | (Q(reference=ref) if ref else Q(pk__in=[]))
        case = None
        for c in MedicalCase.objects.filter(q).select_related("patient").order_by("-updated_at"):
            if "".join(ch for ch in c.patient.phone if ch.isdigit())[-9:] == digits[-9:]:
                case = c
                break
        if not case:
            # A consultation request without a case yet: its number (MM-0012) or the passport number.
            lq = Q(patient__passport_number=code)
            if ref:
                lq |= Q(reference=ref)
            from .models import Lead
            for lead in Lead.objects.filter(lq).order_by("-created_at"):
                if "".join(ch for ch in lead.phone if ch.isdigit())[-9:] == digits[-9:]:
                    return Response({"reference": lead.reference, "status": "request_received",
                                     "status_label": "Request received", "journey_index": 0,
                                     "updated_at": lead.updated_at, "note": ""})
            return Response({"detail": "No request found for this reference and phone."}, status=404)
        return Response({"reference": case.reference, "status": case.status, "status_label": case.get_status_display(),
                         "journey_index": case.journey_index, "updated_at": case.updated_at,
                         "note": case.patient_visible_note})
