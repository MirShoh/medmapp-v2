"""Patient portal (/api/v2/me/...) and hospital partner portal (/api/v2/partner/...).

Every queryset is scoped to the caller: a patient only sees their own records, a partner only sees
referrals sent to their own hospital and documents explicitly shared under active consent.
"""
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import get_account
from accounts.permissions import IsApprovedPartner
from audit.service import client_ip
from audit.service import log as audit
from clinics.models import Hospital
from crm.models import Patient
from crm.services import create_lead, get_or_create_patient
from notifications.service import notify, notify_staff

from .access import make_token, partner_can_access
from .admin_api import (
    AppointmentSerializer,
    DocumentSerializer,
    OpinionSerializer,
    QuotationSerializer,
    TravelSerializer,
    save_document,
)
from .models import (
    JOURNEY,
    CaseReferral,
    CaseStatus,
    CaseStatusHistory,
    ConsentRecord,
    HospitalQuotation,
    MedicalCase,
    MedicalOpinion,
    ReferralMessage,
)


def my_patient(request):
    acc = get_account(request.user) if request.user.is_authenticated else None
    if acc is None or acc.role != "patient":
        raise PermissionDenied("Patient portal is for patient accounts.")
    return get_or_create_patient(request.user.get_full_name(), acc.phone, request.user.email, user=request.user)


def journey(case):
    idx = case.journey_index
    return [{"key": k, "label": CaseStatus(k).label, "done": idx >= i, "current": idx == i}
            for i, k in enumerate(JOURNEY)]


class PatientCaseSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    specialty_name = serializers.CharField(source="specialty.title", default=None, read_only=True)
    destination_name = serializers.CharField(source="preferred_destination.name", default=None, read_only=True)
    hospital_name = serializers.CharField(source="selected_hospital.name", default=None, read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    journey = serializers.SerializerMethodField()

    class Meta:
        model = MedicalCase
        fields = ("id", "reference", "case_type", "title", "status", "status_label", "specialty_name",
                  "destination_name", "hospital_name", "coordinator_name", "description", "patient_visible_note",
                  "journey", "created_at", "updated_at")

    def get_coordinator_name(self, o):
        return (o.coordinator.get_full_name() or o.coordinator.username) if o.coordinator else None

    def get_journey(self, o):
        return journey(o)


class PatientProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ("id", "full_name", "phone", "email", "passport_number", "date_of_birth", "gender", "country", "city", "address",
                  "preferred_language", "blood_type", "allergies", "chronic_conditions", "current_medications",
                  "emergency_contact")
        read_only_fields = ("id",)


class MeOverview(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = my_patient(request)
        cases = p.cases.select_related("specialty", "preferred_destination", "selected_hospital", "coordinator")
        return Response({
            "patient": PatientProfileSerializer(p).data,
            "cases": PatientCaseSerializer(cases, many=True).data,
            "counts": {
                "documents": p.documents.filter(is_deleted=False).count(),
                "quotations": HospitalQuotation.objects.filter(case__patient=p, status__in=["sent", "accepted"]).count(),
                "requests": p.leads.count(),
                "unread_notifications": request.user.notifications.filter(read_at__isnull=True).count(),
            },
        })


class MeProfile(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(PatientProfileSerializer(my_patient(request)).data)

    def patch(self, request):
        p = my_patient(request)
        s = PatientProfileSerializer(p, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        audit(request, "patient.self_updated", p)
        return Response(s.data)


class MeCases(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PatientCaseSerializer
    pagination_class = None

    def get_queryset(self):
        return my_patient(self.request).cases.select_related("specialty", "preferred_destination",
                                                              "selected_hospital", "coordinator")

    def retrieve(self, request, *args, **kwargs):
        c = self.get_object()
        data = PatientCaseSerializer(c).data
        data.update({
            "history": [{"status": h.to_status, "label": CaseStatus(h.to_status).label, "note": h.note, "event": h.event, "event_arg": h.event_arg,
                         "date": h.created_at} for h in c.history.filter(visible_to_patient=True)],
            "documents": DocumentSerializer(c.documents.filter(is_deleted=False), many=True).data,
            "opinions": OpinionSerializer(c.opinions.filter(released_to_patient=True).select_related("hospital"),
                                          many=True).data,
            "quotations": QuotationSerializer(c.quotations.filter(status__in=["sent", "accepted", "rejected"])
                                              .select_related("hospital", "case__patient"), many=True).data,
            "appointments": AppointmentSerializer(c.appointments.select_related("hospital", "doctor"), many=True).data,
            "travel_plan": TravelSerializer(c.travel_plan).data if hasattr(c, "travel_plan") else None,
        })
        return Response(data)

    def create(self, request, *args, **kwargs):
        """Patient creates a new request from the portal (also lands in CRM as a lead)."""
        p = my_patient(request)
        lead = create_lead(request, source_code="patient_portal", full_name=p.full_name, phone=p.phone,
                           email=p.email, message=request.data.get("description", "")[:4000],
                           specialty_id=request.data.get("specialty") or None,
                           destination_id=request.data.get("destination") or None,
                           treatment_id=request.data.get("treatment") or None, consent_given=True)
        c = MedicalCase.objects.create(patient=p, lead=lead, case_type=request.data.get("case_type", "treatment"),
                                       title=request.data.get("title") or "Treatment request",
                                       description=request.data.get("description", ""),
                                       specialty_id=request.data.get("specialty") or None,
                                       preferred_destination_id=request.data.get("destination") or None,
                                       treatment_id=request.data.get("treatment") or None)
        CaseStatusHistory.objects.create(case=c, to_status=c.status, actor=request.user, event="request_received")
        return Response(PatientCaseSerializer(c).data, status=201)

    @action(detail=True, methods=["post"], url_path=r"quotations/(?P<q_id>\d+)/respond")
    def respond_quotation(self, request, pk=None, q_id=None):
        c = self.get_object()
        q = c.quotations.filter(pk=q_id, status="sent").first()
        if not q:
            raise NotFound()
        q.status = "accepted" if request.data.get("accept") in (True, "true", "1") else "rejected"
        q.save()
        audit(request, f"quotation.{q.status}_by_patient", q, summary=c.reference)
        notify_staff("new_quotation", key="quotation_decision", args={"ref": c.reference, "decision": q.status}, body=q.hospital.name,
                     link=f"/admin/cases/{c.pk}")
        return Response(QuotationSerializer(q).data)


class MeDocuments(viewsets.ModelViewSet):
    """Health Suitcase."""

    permission_classes = [IsAuthenticated]
    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        qs = my_patient(self.request).documents.filter(is_deleted=False).select_related("case", "uploaded_by")
        if self.request.GET.get("category"):
            qs = qs.filter(category=self.request.GET["category"])
        return qs

    def create(self, request, *args, **kwargs):
        p = my_patient(request)
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return Response({"files": ["Attach at least one file."]}, status=400)
        if len(files) > 15:
            return Response({"files": ["Up to 15 files at once."]}, status=400)
        case = p.cases.filter(pk=request.data.get("case") or 0).first()
        docs = [save_document(request, p, f, case, request.data.get("category"),
                              request.data.get("title") if len(files) == 1 else "",
                              request.data.get("description", ""), request.data.get("document_date") or None)
                for f in files]
        targets = [x for x in [p.assigned_manager, case.coordinator if case else None] if x]
        notify(targets, "new_document", key="patient_uploaded", args={"name": p.full_name, "n": len(docs)},
               link=f"/admin/patients/{p.pk}")
        return Response(DocumentSerializer(docs, many=True).data, status=201)

    def perform_update(self, serializer):
        d = serializer.validated_data
        for k in list(d):
            if k not in ("title", "description", "category", "document_date", "case"):
                d.pop(k)
        case = d.get("case")
        if case is not None and case.patient_id != serializer.instance.patient_id:
            raise PermissionDenied("This case does not belong to you.")
        serializer.save()
        audit(self.request, "document.self_updated", serializer.instance)

    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()
        doc.is_deleted = True
        doc.save(update_fields=["is_deleted"])
        audit(request, "document.self_deleted", doc)
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        from django.conf import settings

        doc = self.get_object()
        return Response({"url": f"/api/v2/files/{make_token('doc', doc.pk, request.user)}/",
                         "expires_in": settings.SIGNED_URL_TTL_SECONDS})

    @action(detail=False, methods=["get"])
    def timeline(self, request):
        docs = self.get_queryset()
        out = {}
        for d in docs:
            key = (d.document_date or d.uploaded_at.date()).strftime("%Y-%m")
            out.setdefault(key, []).append(DocumentSerializer(d).data)
        return Response([{"month": k, "documents": v} for k, v in sorted(out.items(), reverse=True)])


class MeOpinionFile(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        p = my_patient(request)
        op = MedicalOpinion.objects.filter(pk=pk, case__patient=p, released_to_patient=True).first()
        if not op or not op.file:
            raise NotFound()
        return Response({"url": f"/api/v2/files/{make_token('opinion', op.pk, request.user)}/"})


class MeConsents(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = my_patient(request)
        return Response([{"id": c.id, "scope": c.scope, "scope_label": c.get_scope_display(),
                          "hospital": c.hospital_id, "hospital_name": c.hospital.name if c.hospital_id else None,
                          "granted_at": c.granted_at, "revoked_at": c.revoked_at, "active": c.is_active}
                         for c in p.consents.select_related("hospital")])

    def post(self, request):
        p = my_patient(request)
        scope = request.data.get("scope")
        if scope not in dict(ConsentRecord.SCOPES):
            return Response({"scope": "Invalid scope."}, status=400)
        hospital = Hospital.objects.filter(pk=request.data.get("hospital") or 0).first()
        if scope == "share_with_hospital" and not hospital:
            return Response({"hospital": "Choose the hospital you allow to see your documents."}, status=400)
        rec = ConsentRecord.objects.create(patient=p, scope=scope, hospital=hospital, ip_address=client_ip(request),
                                           recorded_by=request.user, text_version="v1-portal")
        audit(request, "consent.granted", rec, summary=f"{scope} {hospital or ''}")
        return Response({"id": rec.pk}, status=201)


class MeConsentRevoke(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        p = my_patient(request)
        rec = p.consents.filter(pk=pk, revoked_at__isnull=True).first()
        if not rec:
            raise NotFound()
        rec.revoked_at = timezone.now()
        rec.save()
        audit(request, "consent.revoked", rec)
        return Response({"revoked": True})


class MeRequests(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = my_patient(request)
        return Response([{"id": lead.id, "reference": lead.reference, "created_at": lead.created_at,
                          "treatment": lead.treatment.name if lead.treatment else None,
                          "specialty": lead.specialty.title if lead.specialty else None,
                          "destination": lead.destination.name if lead.destination else None,
                          "service": lead.service.title if lead.service else None,
                          "status": "closed" if lead.stage in ("completed", "lost") else "active",
                          "message": lead.message} for lead in p.leads.select_related("treatment", "specialty", "destination", "service")])


class MeQuotations(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        p = my_patient(request)
        qs = HospitalQuotation.objects.filter(case__patient=p, status__in=["sent", "accepted", "rejected"]) \
            .select_related("hospital", "case__patient")
        return Response(QuotationSerializer(qs, many=True).data)


# ======================================================================= Partner portal
class PartnerQuotationSerializer(QuotationSerializer):
    """Quotation as seen by a hospital: no patient identity fields."""

    class Meta(QuotationSerializer.Meta):
        fields = None
        exclude = ("submitted_by",)

    def get_fields(self):
        fields = super().get_fields()
        fields.pop("patient_name", None)
        return fields


def partner_hospital(request):
    acc = get_account(request.user) if request.user.is_authenticated else None
    if acc is None or acc.role != "hospital_partner" or not acc.hospital_id:
        raise PermissionDenied("Partner portal is for approved hospital partner accounts.")
    return acc.hospital


class PartnerReferralSerializer(serializers.ModelSerializer):
    case_reference = serializers.CharField(source="case.reference", read_only=True)
    case_title = serializers.CharField(source="case.title", read_only=True)
    case_type = serializers.CharField(source="case.case_type", read_only=True)
    description = serializers.CharField(source="case.description", read_only=True)
    specialty = serializers.CharField(source="case.specialty.title", default=None, read_only=True)
    patient = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = CaseReferral
        fields = ("id", "status", "case_reference", "case_title", "case_type", "description", "specialty",
                  "patient", "documents", "message_to_hospital", "created_at", "updated_at")

    def get_patient(self, o):
        """Minimum necessary data: no phone/email/address for hospitals."""
        p = o.case.patient
        age = None
        if p.date_of_birth:
            today = timezone.now().date()
            age = today.year - p.date_of_birth.year - ((today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day))
        return {"display_name": f"{p.full_name.split(' ')[0]} {p.full_name.split(' ')[-1][:1]}." if p.full_name else "",
                "age": age, "gender": p.gender, "country": p.country.name if p.country_id else None,
                "allergies": p.allergies, "chronic_conditions": p.chronic_conditions}

    def get_documents(self, o):
        user = self.context["request"].user
        return [DocumentSerializer(d).data for d in o.shared_documents.filter(is_deleted=False)
                if partner_can_access(user, d)]


class PartnerReferrals(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, IsApprovedPartner]
    serializer_class = PartnerReferralSerializer

    def get_queryset(self):
        qs = CaseReferral.objects.filter(hospital=partner_hospital(self.request)) \
            .select_related("case__patient__country", "case__specialty").prefetch_related("shared_documents")
        if self.request.GET.get("status"):
            qs = qs.filter(status=self.request.GET["status"])
        return qs

    def retrieve(self, request, *args, **kwargs):
        ref = self.get_object()
        if ref.status == "sent":
            ref.status = "reviewing"
            ref.save(update_fields=["status"])
        audit(request, "partner.referral_viewed", ref)
        data = self.get_serializer(ref).data
        data["messages"] = [{"id": m.id, "text": m.text, "created_at": m.created_at,
                             "author": m.author.get_full_name() or m.author.username if m.author else None,
                             "mine": m.author_id == request.user.pk} for m in ref.messages.select_related("author")]
        data["opinions"] = OpinionSerializer(ref.case.opinions.filter(hospital=ref.hospital), many=True).data
        data["quotations"] = PartnerQuotationSerializer(ref.case.quotations.filter(hospital=ref.hospital)
                                                 .select_related("hospital", "case__patient"), many=True).data
        return Response(data)

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        ref = self.get_object()
        new = request.data.get("status")
        if new not in ("reviewing", "accepted", "declined"):
            return Response({"status": "Partners may set reviewing, accepted or declined."}, status=400)
        ref.status = new
        ref.save()
        audit(request, "partner.referral_status", ref, changes={"status": new})
        notify_staff("hospital_response", key="referral_status", args={"hospital": ref.hospital.name, "ref": ref.case.reference, "status": new},
                     link=f"/admin/cases/{ref.case_id}", roles=("super_admin", "admin", "medical_coordinator"))
        return Response({"status": ref.status})

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def opinion(self, request, pk=None):
        from .validators import validate_upload

        ref = self.get_object()
        summary = (request.data.get("summary") or "").strip()
        if not summary or not (request.data.get("doctor_name") or "").strip():
            return Response({"detail": "Summary and the name of the reviewing doctor are required."}, status=400)
        op = MedicalOpinion(case=ref.case, hospital=ref.hospital, doctor_name=request.data["doctor_name"][:255],
                            summary=summary, recommended_treatment=request.data.get("recommended_treatment", ""),
                            submitted_by=request.user)
        if request.FILES.get("file"):
            validate_upload(request.FILES["file"])
            op.file = request.FILES["file"]
        op.save()
        ref.status = "opinion_submitted"
        ref.save(update_fields=["status"])
        audit(request, "partner.opinion_submitted", op, summary=ref.case.reference)
        notify_staff("hospital_response", key="opinion_received", args={"ref": ref.case.reference}, body=ref.hospital.name,
                     link=f"/admin/cases/{ref.case_id}", roles=("super_admin", "admin", "medical_coordinator"))
        return Response(OpinionSerializer(op).data, status=201)

    @action(detail=True, methods=["post"])
    def quotation(self, request, pk=None):
        ref = self.get_object()
        data = {**request.data, "case": ref.case_id, "hospital": ref.hospital_id, "status": "submitted"}
        s = PartnerQuotationSerializer(data=data)
        s.is_valid(raise_exception=True)
        q = s.save(submitted_by=request.user)
        ref.status = "quoted"
        ref.save(update_fields=["status"])
        audit(request, "partner.quotation_submitted", q, summary=f"{ref.case.reference} {q.amount_min} {q.currency}")
        notify_staff("new_quotation", key="quotation_from", args={"hospital": ref.hospital.name, "ref": ref.case.reference},
                     link=f"/admin/cases/{ref.case_id}", roles=("super_admin", "admin", "medical_coordinator"))
        return Response(PartnerQuotationSerializer(q).data, status=201)

    @action(detail=True, methods=["post"])
    def message(self, request, pk=None):
        ref = self.get_object()
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"text": "Message is empty."}, status=400)
        m = ReferralMessage.objects.create(referral=ref, author=request.user, text=text[:5000])
        notify_staff("hospital_response", key="partner_message", args={"hospital": ref.hospital.name, "ref": ref.case.reference}, body=text[:200],
                     link=f"/admin/cases/{ref.case_id}", roles=("super_admin", "admin", "medical_coordinator"))
        return Response({"id": m.id, "text": m.text, "created_at": m.created_at, "mine": True}, status=201)

    @action(detail=True, methods=["post"], url_path=r"documents/(?P<doc_id>\d+)/link")
    def document_link(self, request, pk=None, doc_id=None):
        ref = self.get_object()
        doc = ref.shared_documents.filter(pk=doc_id, is_deleted=False).first()
        if not doc or not partner_can_access(request.user, doc):
            raise NotFound()
        audit(request, "partner.document_link", doc, summary=ref.case.reference)
        return Response({"url": f"/api/v2/files/{make_token('doc', doc.pk, request.user)}/"})


class PartnerMessageStaff(APIView):
    """Staff reply to a referral thread (used from the admin case page)."""

    def post(self, request, pk):
        from accounts.permissions import user_has_perm

        if not user_has_perm(request.user, "medical.edit"):
            raise PermissionDenied()
        ref = CaseReferral.objects.get(pk=pk)
        m = ReferralMessage.objects.create(referral=ref, author=request.user, text=request.data.get("text", "")[:5000])
        from accounts.models import Account

        notify([a.user for a in Account.objects.filter(hospital=ref.hospital, role="hospital_partner").select_related("user")],
               "hospital_response", key="medmapp_message", args={"ref": ref.case.reference}, link=f"/partner/referrals/{ref.pk}")
        audit(request, "referral.message", ref)
        return Response({"id": m.id}, status=201)


class PartnerProfile(APIView):
    """The partner's own hospital page. Text fields are edited per language (uz / ru / en); contacts are shared.
    Photo and logo uploads are checked (type, size, real image) before they replace the current files."""

    permission_classes = [IsAuthenticated, IsApprovedPartner]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    TRANSLATED = ("short_description", "description", "address", "facilities", "equipment", "services_available")
    SHARED = ("phone", "email", "website", "languages")
    LANGS = ("uz", "ru", "en")
    IMAGES = ("image", "logo")
    MAX_IMAGE_MB = 5

    def get(self, request):
        from catalog.public_api import hospital_qs
        from catalog.serializers import HospitalDetail

        h = hospital_qs().get(pk=partner_hospital(request).pk)
        data = HospitalDetail(h, context={"request": request}).data
        data["editable"] = {f: getattr(h, f) for f in self.TRANSLATED + self.SHARED}
        data["translations"] = {lang: {f: getattr(h, f"{f}_{lang}") or "" for f in self.TRANSLATED} for lang in self.LANGS}
        data["shared"] = {f: getattr(h, f) or "" for f in self.SHARED}
        data["media"] = {f: request.build_absolute_uri(getattr(h, f).url) if getattr(h, f) else None for f in self.IMAGES}
        refs = CaseReferral.objects.filter(hospital=h)
        data["stats"] = {"referrals": refs.count(), "open": refs.exclude(status__in=["accepted", "declined"]).count(),
                         "new": refs.filter(status="sent").count(),
                         "quotations": HospitalQuotation.objects.filter(hospital=h).count(),
                         "opinions": MedicalOpinion.objects.filter(hospital=h).count()}
        return Response(data)

    def _image(self, f):
        import os

        from PIL import Image

        ext = os.path.splitext(f.name)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            raise serializers.ValidationError("Only JPG, PNG or WebP images.")
        if f.size > self.MAX_IMAGE_MB * 1024 * 1024:
            raise serializers.ValidationError(f"Image is larger than {self.MAX_IMAGE_MB} MB.")
        try:
            Image.open(f).verify()
        except Exception:
            raise serializers.ValidationError("The file is not a valid image.")
        f.seek(0)
        return f

    def patch(self, request):
        h = partner_hospital(request)
        changes = {}
        lang = request.data.get("lang")
        lang = lang if lang in self.LANGS else None
        for f in self.TRANSLATED:
            if f in request.data:
                field = f"{f}_{lang}" if lang else f
                setattr(h, field, str(request.data[f])[:5000])
                changes[field] = str(request.data[f])[:200]
        for f in self.SHARED:
            if f in request.data:
                setattr(h, f, str(request.data[f])[:500])
                changes[f] = str(request.data[f])[:200]
        for f in self.IMAGES:
            if str(request.data.get(f"{f}_clear", "")).lower() in ("true", "1") and getattr(h, f):
                getattr(h, f).delete(save=False)
                setattr(h, f, None)
                changes[f] = "removed"
            if f in request.FILES:
                img = self._image(request.FILES[f])
                getattr(h, f).save(img.name, img, save=False)
                changes[f] = img.name
        h.save()
        audit(request, "partner.profile_updated", h, changes=changes)
        return Response({"updated": list(changes)})
