from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasPerm, user_has_perm
from audit.service import client_ip
from audit.service import log as audit
from config.crud import AuditedModelViewSet
from crm.services import activity
from notifications.service import notify

from .access import can_access_document, make_token, read_token
from .models import (
    Appointment,
    CaseReferral,
    CaseStatus,
    CaseStatusHistory,
    ConsentRecord,
    HospitalQuotation,
    MedicalCase,
    MedicalDocument,
    MedicalOpinion,
    TravelPlan,
)
from .validators import validate_upload

User = get_user_model()


def uname(u):
    return (u.get_full_name() or u.username) if u else None


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    case_reference = serializers.CharField(source="case.reference", default=None, read_only=True)

    class Meta:
        model = MedicalDocument
        exclude = ("file", "sha256", "is_deleted")
        read_only_fields = ("original_name", "content_type", "size", "uploaded_by", "uploaded_at", "patient")

    def get_uploaded_by_name(self, o):
        return uname(o.uploaded_by)


def save_document(request, patient, f, case=None, category="other", title="", description="", document_date=None):
    ext, ctype = validate_upload(f)
    doc = MedicalDocument(patient=patient, case=case, category=category or "other", title=(title or f.name)[:255],
                          description=description or "", document_date=document_date or None,
                          original_name=f.name[:255], content_type=ctype, size=f.size, uploaded_by=request.user)
    doc.file.save(f.name, f, save=False)
    doc.sha256 = doc.compute_hash()
    doc.save()
    audit(request, "document.uploaded", doc, summary=f"{doc.title} ({doc.get_category_display()}) patient={patient.pk}")
    activity(patient=patient, actor=request.user, type="document", message=f"Document uploaded: {doc.title}",
             meta={"key": "document_uploaded", "title": doc.title})
    return doc


class HistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = CaseStatusHistory
        fields = ("id", "from_status", "to_status", "note", "event", "event_arg", "visible_to_patient", "actor_name", "created_at")

    def get_actor_name(self, o):
        return uname(o.actor)


class OpinionSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = MedicalOpinion
        exclude = ("file",)
        read_only_fields = ("submitted_by", "released_at", "created_at")

    def get_has_file(self, o):
        return bool(o.file)


class QuotationSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    case_reference = serializers.CharField(source="case.reference", read_only=True)
    patient_name = serializers.CharField(source="case.patient.full_name", read_only=True)
    quote_type_label = serializers.CharField(source="get_quote_type_display", read_only=True)

    class Meta:
        model = HospitalQuotation
        fields = "__all__"
        read_only_fields = ("submitted_by", "created_at", "updated_at")


class TravelSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPlan
        fields = "__all__"


class AppointmentSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", default=None, read_only=True)

    class Meta:
        model = Appointment
        fields = "__all__"


class ReferralSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    shared_documents = DocumentSerializer(many=True, read_only=True)
    messages = serializers.SerializerMethodField()

    class Meta:
        model = CaseReferral
        fields = "__all__"

    def get_messages(self, o):
        return [{"id": m.id, "author": uname(m.author), "text": m.text, "created_at": m.created_at,
                 "from_partner": bool(m.author and getattr(getattr(m.author, "account", None), "role", "") == "hospital_partner")}
                for m in o.messages.select_related("author", "author__account")]


class CaseListSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    specialty_name = serializers.CharField(source="specialty.title", default=None, read_only=True)
    treatment_name = serializers.CharField(source="treatment.name", default=None, read_only=True)
    destination_name = serializers.CharField(source="preferred_destination.name", default=None, read_only=True)
    hospital_name = serializers.CharField(source="selected_hospital.name", default=None, read_only=True)
    journey_index = serializers.IntegerField(read_only=True)

    class Meta:
        model = MedicalCase
        fields = "__all__"
        read_only_fields = ("reference", "created_at", "updated_at")

    def get_coordinator_name(self, o):
        return uname(o.coordinator)


class CaseViewSet(AuditedModelViewSet):
    serializer_class = CaseListSerializer
    permission_classes = [HasPerm.of("medical.view", write="medical.edit")]
    search_fields = ("reference", "title", "patient__full_name", "patient__phone", "patient__passport_number")
    filterset_fields = ("status", "case_type", "coordinator", "specialty", "preferred_destination", "patient",
                        "selected_hospital")
    ordering_fields = ("created_at", "updated_at", "status")
    audit_name = "case"

    def get_queryset(self):
        qs = MedicalCase.objects.select_related("patient", "coordinator", "specialty", "treatment",
                                                "preferred_destination", "selected_hospital")
        if self.request.GET.get("mine") == "1":
            qs = qs.filter(coordinator=self.request.user)
        if self.request.GET.get("unassigned") == "1":
            qs = qs.filter(coordinator__isnull=True).exclude(status__in=["closed", "cancelled"])
        return qs

    def perform_create(self, serializer):
        case = serializer.save()
        CaseStatusHistory.objects.create(case=case, to_status=case.status, actor=self.request.user, event="case_opened")
        activity(patient=case.patient, lead=case.lead, actor=self.request.user, type="case",
                 message=f"Medical case {case.reference} opened", meta={"key": "case_opened", "ref": case.reference})
        audit(self.request, "case.created", case, summary=case.reference)

    def retrieve(self, request, *args, **kwargs):
        c = self.get_object()
        data = CaseListSerializer(c).data
        data.update({
            "history": HistorySerializer(c.history.select_related("actor"), many=True).data,
            "documents": DocumentSerializer(c.documents.filter(is_deleted=False), many=True).data,
            "patient_documents": DocumentSerializer(c.patient.documents.filter(is_deleted=False, case__isnull=True),
                                                    many=True).data,
            "referrals": ReferralSerializer(c.referrals.select_related("hospital").prefetch_related("shared_documents"),
                                            many=True).data,
            "opinions": OpinionSerializer(c.opinions.select_related("hospital"), many=True).data,
            "quotations": QuotationSerializer(c.quotations.select_related("hospital", "case__patient"), many=True).data,
            "appointments": AppointmentSerializer(c.appointments.select_related("hospital", "doctor"), many=True).data,
            "travel_plan": TravelSerializer(c.travel_plan).data if hasattr(c, "travel_plan") else None,
            "consents": [{"id": x.id, "scope": x.scope, "hospital": x.hospital_id,
                          "hospital_name": x.hospital.name if x.hospital_id else None, "active": x.is_active,
                          "granted_at": x.granted_at} for x in c.patient.consents.select_related("hospital")],
            "statuses": [{"value": s.value, "label": s.label} for s in CaseStatus],
        })
        return Response(data)

    @action(detail=True, methods=["post"])
    def status(self, request, pk=None):
        c = self.get_object()
        new = request.data.get("status")
        if new not in CaseStatus.values:
            return Response({"status": "Invalid status."}, status=400)
        old = c.status
        c.status = new
        if "patient_note" in request.data:
            c.patient_visible_note = request.data["patient_note"]
        c.save()
        CaseStatusHistory.objects.create(case=c, from_status=old, to_status=new, actor=request.user,
                                         note=request.data.get("note", ""),
                                         visible_to_patient=request.data.get("visible_to_patient", True) in (True, "true", "1"))
        activity(patient=c.patient, lead=c.lead, actor=request.user, type="case",
                 message=f"{c.reference}: {CaseStatus(old).label} → {CaseStatus(new).label}",
                 meta={"key": "case_status", "ref": c.reference, "from": old, "to": new})
        audit(request, "case.status_changed", c, changes={"from": old, "to": new})
        if c.patient.user_id:
            notify([c.patient.user], "status_change", key="case_status", args={"ref": c.reference, "status": new},
                   body=c.patient_visible_note, link=f"/dashboard/cases/{c.pk}", email=True)
        return Response(CaseListSerializer(c).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        c = self.get_object()
        user = User.objects.filter(pk=request.data.get("coordinator")).first()
        c.coordinator = user
        if user and c.status == CaseStatus.REQUEST_RECEIVED:
            c.status = CaseStatus.COORDINATOR_ASSIGNED
            CaseStatusHistory.objects.create(case=c, from_status=CaseStatus.REQUEST_RECEIVED,
                                             to_status=c.status, actor=request.user, event="coordinator_assigned")
        c.save()
        audit(request, "case.coordinator_assigned", c, changes={"coordinator": getattr(user, "pk", None)})
        if user:
            notify([user], "new_task", key="case_coordinator", args={"ref": c.reference}, link=f"/admin/cases/{c.pk}")
        return Response(CaseListSerializer(c).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def refer(self, request, pk=None):
        """Send the case to a partner hospital. Documents are shared only with active patient consent."""
        c = self.get_object()
        hospital_id = request.data.get("hospital")
        doc_ids = request.data.get("documents") or []
        if doc_ids and not user_has_perm(request.user, "documents.share"):
            return Response({"detail": "Missing documents.share permission."}, status=403)
        if doc_ids and not ConsentRecord.objects.filter(patient=c.patient, scope="share_with_hospital", granted=True,
                                                         revoked_at__isnull=True, hospital_id=hospital_id).exists():
            return Response({"detail": "The patient has not consented to sharing documents with this hospital. "
                                       "Record the patient's consent first.", "consent_required": True}, status=409)
        ref, created = CaseReferral.objects.get_or_create(case=c, hospital_id=hospital_id,
                                                          defaults={"created_by": request.user})
        ref.message_to_hospital = request.data.get("message", ref.message_to_hospital)
        ref.status = "sent"
        ref.save()
        docs = MedicalDocument.objects.filter(pk__in=doc_ids, patient=c.patient, is_deleted=False)
        ref.shared_documents.add(*docs)
        if c.status in (CaseStatus.REQUEST_RECEIVED, CaseStatus.COORDINATOR_ASSIGNED, CaseStatus.DOCUMENTS_REVIEW):
            old, c.status = c.status, CaseStatus.HOSPITAL_CONSULTATION
            c.save()
            CaseStatusHistory.objects.create(case=c, from_status=old, to_status=c.status, actor=request.user,
                                             event="sent_to_hospital", event_arg=ref.hospital.name)
        audit(request, "case.referred", c, summary=f"to {ref.hospital.name}",
              changes={"hospital": ref.hospital_id, "documents": [d.pk for d in docs]})
        from accounts.models import Account

        partners = [a.user for a in Account.objects.filter(hospital_id=hospital_id, role="hospital_partner",
                                                           is_approved=True).select_related("user")]
        notify(partners, "hospital_response", key="referral_new", args={"ref": c.reference}, body=c.title, link=f"/partner/referrals/{ref.pk}")
        return Response(ReferralSerializer(ref).data, status=201 if created else 200)

    @action(detail=True, methods=["post"], url_path="consent")
    def record_consent(self, request, pk=None):
        """Record consent the patient gave (signed form / call recording). Stored with the staff member."""
        c = self.get_object()
        rec = ConsentRecord.objects.create(patient=c.patient, case=c, scope=request.data.get("scope", "share_with_hospital"),
                                           hospital_id=request.data.get("hospital") or None, recorded_by=request.user,
                                           ip_address=client_ip(request),
                                           text_version=request.data.get("text_version", "v1-staff-recorded"))
        audit(request, "consent.recorded", rec, summary=f"patient={c.patient_id} scope={rec.scope} hospital={rec.hospital_id}")
        return Response({"id": rec.pk}, status=201)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def opinion(self, request, pk=None):
        """Record a medical opinion received from a qualified professional."""
        c = self.get_object()
        s = OpinionSerializer(data={**request.data.dict(), "case": c.pk} if hasattr(request.data, "dict") else
                              {**request.data, "case": c.pk})
        s.is_valid(raise_exception=True)
        op = s.save(submitted_by=request.user)
        if request.FILES.get("file"):
            validate_upload(request.FILES["file"])
            op.file = request.FILES["file"]
            op.save()
        audit(request, "opinion.recorded", op, summary=c.reference)
        return Response(OpinionSerializer(op).data, status=201)

    @action(detail=True, methods=["post"], url_path=r"opinions/(?P<op_id>\d+)/release")
    def release_opinion(self, request, pk=None, op_id=None):
        c = self.get_object()
        op = c.opinions.get(pk=op_id)
        op.released_to_patient = True
        op.released_at = timezone.now()
        op.save()
        audit(request, "opinion.released", op, summary=c.reference)
        if c.patient.user_id:
            notify([c.patient.user], "hospital_response", key="opinion_available", args={"ref": c.reference},
                   link=f"/dashboard/cases/{c.pk}", email=True)
        return Response(OpinionSerializer(op).data)

    @action(detail=True, methods=["post", "patch"], url_path="travel")
    def travel(self, request, pk=None):
        c = self.get_object()
        if not user_has_perm(request.user, "travel.edit"):
            return Response({"detail": "Missing travel.edit permission."}, status=403)
        plan, _ = TravelPlan.objects.get_or_create(case=c)
        s = TravelSerializer(plan, data={**request.data, "case": c.pk}, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        audit(request, "travel.updated", plan, summary=c.reference, changes={k: str(v) for k, v in request.data.items()})
        return Response(s.data)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [HasPerm.of("documents.view", write="documents.upload")]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ("patient", "case", "category")
    search_fields = ("title", "description", "original_name", "patient__full_name")
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return MedicalDocument.objects.filter(is_deleted=False).select_related("uploaded_by", "case", "patient")

    def create(self, request, *args, **kwargs):
        from crm.models import Patient

        patient = Patient.objects.get(pk=request.data.get("patient"))
        case = MedicalCase.objects.filter(pk=request.data.get("case") or 0, patient=patient).first()
        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return Response({"files": ["Attach at least one file."]}, status=400)
        docs = [save_document(request, patient, f, case, request.data.get("category"), request.data.get("title") if len(files) == 1 else "",
                              request.data.get("description", ""), request.data.get("document_date") or None) for f in files]
        users = [patient.assigned_manager] if patient.assigned_manager_id else []
        if case and case.coordinator_id:
            users.append(case.coordinator)
        notify([u for u in users if u != request.user], "new_document", key="document_new", args={"name": patient.full_name},
               link=f"/admin/patients/{patient.pk}")
        return Response(DocumentSerializer(docs, many=True).data, status=201)

    def perform_update(self, serializer):
        case = serializer.validated_data.get("case")
        if case is not None and case.patient_id != serializer.instance.patient_id:
            raise serializers.ValidationError({"case": "The case belongs to a different patient."})
        doc = serializer.save()
        audit(self.request, "document.updated", doc, changes={k: str(v) for k, v in serializer.validated_data.items()})

    def destroy(self, request, *args, **kwargs):
        if not user_has_perm(request.user, "documents.delete"):
            return Response({"detail": "Missing documents.delete permission."}, status=403)
        doc = self.get_object()
        doc.is_deleted = True  # soft delete; file retained per retention policy
        doc.save(update_fields=["is_deleted"])
        audit(request, "document.deleted", doc, summary=doc.title)
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        doc = self.get_object()
        audit(request, "document.link_issued", doc)
        return Response({"url": f"/api/v2/files/{make_token('doc', doc.pk, request.user)}/",
                         "expires_in": settings.SIGNED_URL_TTL_SECONDS})


class QuotationViewSet(AuditedModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [HasPerm.of("quotations.view", write="quotations.edit")]
    filterset_fields = ("case", "hospital", "status", "quote_type")
    search_fields = ("case__reference", "case__patient__full_name", "hospital__name")
    audit_name = "quotation"

    def get_queryset(self):
        return HospitalQuotation.objects.select_related("hospital", "case__patient")

    def perform_create(self, serializer):
        q = serializer.save(submitted_by=self.request.user)
        audit(self.request, "quotation.created", q, summary=f"{q.case.reference} {q.amount_min} {q.currency}")

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """Send quotation to patient (visible in portal) and move case to 'quotation available'."""
        q = self.get_object()
        q.status = "sent"
        q.save()
        c = q.case
        if c.journey_index < CaseStatus.values.index(CaseStatus.QUOTATION_AVAILABLE):
            old, c.status = c.status, CaseStatus.QUOTATION_AVAILABLE
            c.save()
            CaseStatusHistory.objects.create(case=c, from_status=old, to_status=c.status, actor=request.user,
                                             event="quotation_from", event_arg=q.hospital.name)
        if c.lead_id:
            activity(lead=c.lead, actor=request.user, type="quotation", message=f"Quotation sent: {q.hospital.name}",
                     meta={"key": "quotation_sent", "hospital": q.hospital.name})
        audit(request, "quotation.sent", q, summary=c.reference)
        if c.patient.user_id:
            notify([c.patient.user], "new_quotation", key="quotation_new", args={"ref": c.reference}, link="/dashboard/quotations", email=True)
        return Response(QuotationSerializer(q).data)


class AppointmentViewSet(AuditedModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [HasPerm.of("medical.view", write="medical.edit")]
    filterset_fields = ("case", "hospital", "status")
    queryset = Appointment.objects.select_related("hospital", "doctor")


class TravelViewSet(AuditedModelViewSet):
    serializer_class = TravelSerializer
    permission_classes = [HasPerm.of("travel.view", write="travel.edit")]
    filterset_fields = ("visa_status",)

    def get_queryset(self):
        return TravelPlan.objects.select_related("case__patient").order_by("arrival_date")

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        return Response([{**TravelSerializer(p).data, "case_reference": p.case.reference,
                          "patient_name": p.case.patient.full_name} for p in qs[:500]])


class FileDownloadView(APIView):
    """Signed, expiring download. Re-checks the token owner's access at download time."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, token):
        try:
            data = read_token(token)
        except signing.SignatureExpired:
            raise Http404("Link expired")
        except signing.BadSignature:
            raise Http404()
        user = User.objects.filter(pk=data["u"], is_active=True).first()
        if not user:
            raise Http404()
        if data["k"] == "doc":
            doc = MedicalDocument.objects.filter(pk=data["i"]).select_related("patient").first()
            if not doc or not can_access_document(user, doc):
                raise Http404()
            f, name = doc.file, doc.original_name
            obj = doc
        elif data["k"] == "opinion":
            op = MedicalOpinion.objects.filter(pk=data["i"]).select_related("case__patient").first()
            ok = op and op.file and (user_has_perm(user, "medical.view") or
                                     (op.released_to_patient and op.case.patient.user_id == user.pk))
            if not ok:
                raise Http404()
            f, name, obj = op.file, f"opinion-{op.case.reference}.pdf", op
        elif data["k"] == "chat":
            from crm.models import SupportMessage

            m = SupportMessage.objects.filter(pk=data["i"]).select_related("patient").first()
            ok = m and m.attachment and (user_has_perm(user, "crm.view") or m.patient.user_id == user.pk)
            if not ok:
                raise Http404()
            f, name, obj = m.attachment, m.attachment_name or "file", m
        else:
            raise Http404()
        audit(request, "file.downloaded", obj, actor=user, summary=name)
        resp = FileResponse(f.open("rb"), as_attachment=request.GET.get("inline") != "1", filename=name)
        resp["Cache-Control"] = "private, no-store"
        resp["X-Content-Type-Options"] = "nosniff"
        return resp
