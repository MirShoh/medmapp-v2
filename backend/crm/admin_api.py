import csv
import io
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasPerm, user_has_perm
from audit.service import log as audit
from config.crud import AuditedModelViewSet

from .models import Communication, InternalNote, Lead, LeadActivity, LeadSource, LeadStage, Patient, Task
from .services import activity, assign_lead, get_or_create_patient, move_lead, next_position

User = get_user_model()


def user_mini(u):
    return {"id": u.pk, "name": u.get_full_name() or u.username} if u else None


class LeadSerializer(serializers.ModelSerializer):
    assigned = serializers.SerializerMethodField()
    country_name = serializers.CharField(source="resident_country.name", default=None, read_only=True)
    destination_name = serializers.CharField(source="destination.name", default=None, read_only=True)
    treatment_name = serializers.CharField(source="treatment.name", default=None, read_only=True)
    specialty_name = serializers.CharField(source="specialty.title", default=None, read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    source_name = serializers.CharField(source="source.name", default=None, read_only=True)
    stage_label = serializers.CharField(source="get_stage_display", read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = "__all__"
        read_only_fields = ("created_by", "stage_changed_at", "created_at", "updated_at", "follow_up_notified_at")

    def get_assigned(self, o):
        return user_mini(o.assigned_to)

    def get_is_overdue(self, o):
        return bool(o.next_follow_up and o.next_follow_up < timezone.now()
                    and o.stage not in (LeadStage.COMPLETED, LeadStage.LOST))


class ActivitySerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = LeadActivity
        fields = ("id", "lead", "patient", "actor", "type", "message", "from_stage", "to_stage", "meta", "created_at")

    def get_actor(self, o):
        return user_mini(o.actor)


DEMO_PREFIX = "[DEMO]"


def lead_queryset(request):
    qs = Lead.objects.select_related("assigned_to", "resident_country", "destination", "treatment", "specialty",
                                     "hospital", "source", "patient")
    g = request.GET
    # Seeded test leads ("[DEMO] …") are hidden unless asked for, so they never mix with real requests.
    if g.get("demo") != "1":
        qs = qs.exclude(full_name__startswith=DEMO_PREFIX)
    if g.get("mine") == "1":
        qs = qs.filter(assigned_to=request.user)
    for p in ("stage", "priority", "destination", "treatment", "specialty", "assigned_to", "source", "hospital"):
        if g.get(p):
            qs = qs.filter(**{f"{p}__in" if "," in g[p] else p: g[p].split(",") if "," in g[p] else g[p]})
    if g.get("unassigned") == "1":
        qs = qs.filter(assigned_to__isnull=True)
    if g.get("overdue") == "1":
        qs = qs.filter(next_follow_up__lt=timezone.now()).exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST])
    if g.get("due_today") == "1":
        qs = qs.filter(next_follow_up__date=timezone.localdate()).exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST])
    if g.get("fresh") == "1":
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(hours=24))
    if g.get("created_from"):
        qs = qs.filter(created_at__date__gte=g["created_from"])
    if g.get("created_to"):
        qs = qs.filter(created_at__date__lte=g["created_to"])
    if g.get("q"):
        q = g["q"]
        qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q) | Q(message__icontains=q))
    return qs


class LeadViewSet(AuditedModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]
    ordering_fields = ("created_at", "next_follow_up", "priority", "budget", "full_name", "stage")
    audit_name = "lead"

    def get_queryset(self):
        return lead_queryset(self.request)

    def perform_create(self, serializer):
        d = serializer.validated_data
        patient = d.get("patient") or get_or_create_patient(d["full_name"], d["phone"], d.get("email", ""),
                                                            country=d.get("resident_country"),
                                                            created_by=self.request.user)
        source = d.get("source") or LeadSource.objects.get_or_create(code="manual", defaults={"name": "Manual entry"})[0]
        lead = serializer.save(created_by=self.request.user, patient=patient, source=source,
                               position=next_position(d.get("stage", LeadStage.NEW)))
        activity(lead, actor=self.request.user, type="created", message="Lead created manually", meta={"key": "lead_created_manual"})
        audit(self.request, "lead.created", lead, summary=lead.full_name)

    def perform_update(self, serializer):
        before = {f: getattr(serializer.instance, f) for f in ("stage", "assigned_to_id", "priority", "next_follow_up")}
        new_stage = serializer.validated_data.pop("stage", None)
        new_assignee = serializer.validated_data.pop("assigned_to", "__same__")
        lead = serializer.save()
        if lead.next_follow_up != before["next_follow_up"] and lead.follow_up_notified_at:
            lead.follow_up_notified_at = None
            lead.save(update_fields=["follow_up_notified_at"])
        if new_stage and new_stage != before["stage"]:
            move_lead(self.request, lead, new_stage)
        if new_assignee != "__same__" and getattr(new_assignee, "pk", None) != before["assigned_to_id"]:
            if not user_has_perm(self.request.user, "crm.assign") and new_assignee != self.request.user:
                raise serializers.ValidationError({"assigned_to": "You can only assign leads to yourself."})
            assign_lead(self.request, lead, new_assignee)
        changed = {k: str(v) for k, v in serializer.validated_data.items()}
        if changed:
            activity(lead, actor=self.request.user, type="updated", message=", ".join(changed.keys()), meta=changed)
            audit(self.request, "lead.updated", lead, changes=changed)

    def destroy(self, request, *args, **kwargs):
        if not user_has_perm(request.user, "crm.delete"):
            return Response({"detail": "You do not have permission to delete leads."}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def board(self, request):
        """Kanban: all 12 columns with cards and counts (respects the same filters as the list)."""
        qs = lead_queryset(request).order_by("position", "-created_at")
        limit = min(int(request.GET.get("per_column", 100)), 300)
        counts = dict(qs.order_by().values_list("stage").annotate(n=Count("id")))
        cols = []
        for stage in LeadStage:
            items = qs.filter(stage=stage)[:limit]
            cols.append({"stage": stage.value, "label": stage.label, "count": counts.get(stage.value, 0),
                         "leads": LeadSerializer(items, many=True).data})
        return Response(cols)

    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        """Drag & drop persistence: {stage, before_id?, after_id?} → computes a fractional position."""
        lead = self.get_object()
        stage = request.data.get("stage")
        if stage not in LeadStage.values:
            return Response({"stage": "Invalid stage."}, status=400)
        before = Lead.objects.filter(pk=request.data.get("before_id"), stage=stage).first()
        after = Lead.objects.filter(pk=request.data.get("after_id"), stage=stage).first()
        if before and after:
            pos = (before.position + after.position) / 2
        elif before:
            pos = before.position + 1000
        elif after:
            pos = after.position - 1000
        else:
            pos = None
        move_lead(request, lead, stage, position=pos, lost_reason=request.data.get("lost_reason", ""))
        return Response(LeadSerializer(lead).data)

    @action(detail=True, methods=["get"])
    def activities(self, request, pk=None):
        return Response(ActivitySerializer(self.get_object().activities.select_related("actor")[:200], many=True).data)

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        ids = request.data.get("ids") or []
        op = request.data.get("action")
        leads = list(lead_queryset(request).filter(pk__in=ids))
        if op == "move" and request.data.get("stage") in LeadStage.values:
            for lead in leads:
                move_lead(request, lead, request.data["stage"])
        elif op == "assign":
            if not user_has_perm(request.user, "crm.assign"):
                return Response({"detail": "Missing crm.assign permission."}, status=403)
            user = User.objects.filter(pk=request.data.get("user")).first()
            for lead in leads:
                assign_lead(request, lead, user)
        elif op == "priority" and request.data.get("priority"):
            Lead.objects.filter(pk__in=[x.pk for x in leads]).update(priority=request.data["priority"])
            audit(request, "lead.bulk_priority", summary=f"{len(leads)} leads → {request.data['priority']}")
        elif op == "delete":
            if not user_has_perm(request.user, "crm.delete"):
                return Response({"detail": "Missing crm.delete permission."}, status=403)
            Lead.objects.filter(pk__in=[x.pk for x in leads]).delete()
            audit(request, "lead.bulk_delete", summary=f"{len(leads)} leads: {ids}")
        else:
            return Response({"detail": "Unknown bulk action."}, status=400)
        return Response({"updated": len(leads)})

    @action(detail=False, methods=["get"])
    def export(self, request):
        if not user_has_perm(request.user, "crm.export"):
            return Response({"detail": "Missing crm.export permission."}, status=403)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["ID", "Created", "Name", "Phone", "Email", "Stage", "Priority", "Source", "Country", "Destination",
                    "Specialty", "Treatment", "Budget", "Currency", "Manager", "Next follow-up"])
        for lead in lead_queryset(request).iterator():
            w.writerow([lead.pk, lead.created_at.strftime("%Y-%m-%d %H:%M"), lead.full_name, lead.phone, lead.email,
                        lead.get_stage_display(), lead.priority, lead.source.name if lead.source else "",
                        lead.resident_country.name if lead.resident_country else lead.resident_region,
                        lead.destination.name if lead.destination else "", lead.specialty.title if lead.specialty else "",
                        lead.treatment.name if lead.treatment else "", lead.budget or "", lead.budget_currency,
                        (lead.assigned_to.get_full_name() or lead.assigned_to.username) if lead.assigned_to else "",
                        lead.next_follow_up.strftime("%Y-%m-%d %H:%M") if lead.next_follow_up else ""])
        audit(request, "lead.exported", summary=f"CSV export ({request.GET.urlencode()})")
        resp = HttpResponse("﻿" + buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="medmapp-leads-{timezone.now():%Y%m%d}.csv"'
        return resp

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """Quick counters for the CRM header (open leads only; demo leads excluded)."""
        base = Lead.objects.exclude(full_name__startswith=DEMO_PREFIX)
        open_ = base.exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST])
        now = timezone.now()
        return Response({
            "fresh": base.filter(created_at__gte=now - timedelta(hours=24)).count(),
            "due_today": open_.filter(next_follow_up__date=timezone.localdate()).count(),
            "overdue": open_.filter(next_follow_up__lt=now).count(),
            "unassigned": open_.filter(assigned_to__isnull=True).count(),
            "open": open_.count(),
            "demo": Lead.objects.filter(full_name__startswith=DEMO_PREFIX).count(),
        })

    @action(detail=False, methods=["get"])
    def meta(self, request):
        return Response({
            "stages": [{"value": s.value, "label": s.label} for s in LeadStage],
            "priorities": [{"value": v, "label": label} for v, label in Lead._meta.get_field("priority").choices],
            "sources": [{"id": s.id, "code": s.code, "name": s.name} for s in LeadSource.objects.all()],
        })


class PatientSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source="country.name", default=None, read_only=True)
    manager = serializers.SerializerMethodField()
    cases_count = serializers.IntegerField(read_only=True, default=0)
    leads_count = serializers.IntegerField(read_only=True, default=0)
    has_account = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        exclude = ("user",)
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_manager(self, o):
        return user_mini(o.assigned_manager)

    def get_has_account(self, o):
        return o.user_id is not None


class PatientViewSet(AuditedModelViewSet):
    serializer_class = PatientSerializer
    permission_classes = [HasPerm.of("patients.view", write="patients.edit")]
    search_fields = ("full_name", "phone", "email", "passport_number")
    filterset_fields = ("country", "assigned_manager", "gender")
    audit_name = "patient"

    def get_queryset(self):
        qs = Patient.objects.select_related("country", "assigned_manager").annotate(
            cases_count=Count("cases", distinct=True), leads_count=Count("leads", distinct=True)).order_by("-created_at")
        if self.action == "list" and self.request.GET.get("demo") != "1":
            qs = qs.exclude(full_name__startswith=DEMO_PREFIX)
        return qs

    def perform_create(self, serializer):
        p = serializer.save(created_by=self.request.user)
        activity(patient=p, actor=self.request.user, type="created", message="Patient record created", meta={"key": "patient_created"})
        audit(self.request, "patient.created", p, summary=p.full_name)

    def destroy(self, request, *args, **kwargs):
        if not user_has_perm(request.user, "patients.delete"):
            return Response({"detail": "Missing patients.delete permission."}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["get"])
    def profile(self, request, pk=None):
        """Patient 360°: everything in one payload, filtered by the caller's permissions."""
        from cases.admin_api import CaseListSerializer, DocumentSerializer, QuotationSerializer, TravelSerializer
        from cases.models import HospitalQuotation
        from finance.api import PaymentSerializer

        p = self.get_object()
        u = request.user
        data = {
            "patient": PatientSerializer(p).data,
            "leads": LeadSerializer(p.leads.select_related("assigned_to", "treatment", "destination", "source"),
                                    many=True).data,
            "notes": NoteSerializer(p.notes.select_related("author"), many=True).data,
            "communications": CommunicationSerializer(p.communications.select_related("author"), many=True).data,
            "tasks": TaskSerializer(p.tasks.select_related("assignee"), many=True).data,
            "timeline": ActivitySerializer(LeadActivity.objects.filter(Q(patient=p) | Q(lead__patient=p))
                                           .select_related("actor").distinct()[:300], many=True).data,
            "consents": [{"id": c.id, "scope": c.scope, "scope_label": c.get_scope_display(),
                          "hospital": c.hospital.name if c.hospital_id else None, "granted": c.granted,
                          "granted_at": c.granted_at, "revoked_at": c.revoked_at} for c in p.consents.select_related("hospital")],
            "chat": {"total": p.support_messages.count(),
                     "unread": p.support_messages.filter(from_staff=False, read_at__isnull=True).count()},
        }
        if user_has_perm(u, "medical.view") or user_has_perm(u, "patients.view"):
            cases = p.cases.select_related("coordinator", "specialty", "treatment", "preferred_destination", "selected_hospital")
            data["cases"] = CaseListSerializer(cases, many=True).data
            data["quotations"] = QuotationSerializer(
                HospitalQuotation.objects.filter(case__patient=p).select_related("hospital"), many=True).data
            data["travel"] = [TravelSerializer(c.travel_plan).data for c in cases if hasattr(c, "travel_plan")]
        if user_has_perm(u, "documents.view"):
            data["documents"] = DocumentSerializer(p.documents.filter(is_deleted=False).select_related("uploaded_by"),
                                                   many=True).data
        if user_has_perm(u, "finance.view"):
            data["payments"] = PaymentSerializer(p.payments.all(), many=True).data
        audit(request, "patient.viewed", p)
        return Response(data)


class NoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = InternalNote
        fields = "__all__"
        read_only_fields = ("author", "created_at")

    def get_author_name(self, o):
        return user_mini(o.author)["name"] if o.author else None


class CommunicationSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Communication
        fields = "__all__"
        read_only_fields = ("author",)

    def get_author_name(self, o):
        return user_mini(o.author)["name"] if o.author else None


class TaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()
    lead_name = serializers.CharField(source="lead.full_name", default=None, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", default=None, read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "completed_at", "reminder_sent")

    def update(self, instance, validated):
        if "due_at" in validated or "remind_at" in validated:
            instance.reminder_sent = False
        return super().update(instance, validated)

    def get_assignee_name(self, o):
        return user_mini(o.assignee)["name"] if o.assignee else None

    def get_is_overdue(self, o):
        return bool(o.due_at and o.due_at < timezone.now() and o.status in ("open", "in_progress"))


class _LoggedChildViewSet(viewsets.ModelViewSet):
    """Notes / communications: record author + activity on the lead/patient timeline."""

    activity_type = "note"
    author_field = "author"

    def perform_create(self, serializer):
        obj = serializer.save(**{self.author_field: self.request.user})
        text = getattr(obj, "text", None) or getattr(obj, "summary", None) or getattr(obj, "title", "")
        activity(lead=getattr(obj, "lead", None), patient=getattr(obj, "patient", None), actor=self.request.user,
                 type=self.activity_type, message=text[:500])
        audit(self.request, f"{self.activity_type}.created", obj, summary=text[:200])


class NoteViewSet(_LoggedChildViewSet):
    serializer_class = NoteSerializer
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]
    filterset_fields = ("lead", "patient")
    queryset = InternalNote.objects.select_related("author")


class CommunicationViewSet(_LoggedChildViewSet):
    serializer_class = CommunicationSerializer
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]
    filterset_fields = ("lead", "patient", "channel")
    queryset = Communication.objects.select_related("author")
    activity_type = "call"


class TaskViewSet(_LoggedChildViewSet):
    serializer_class = TaskSerializer
    permission_classes = [HasPerm.of("tasks.view", write="tasks.edit")]
    filterset_fields = ("lead", "patient", "case", "assignee", "status", "priority")
    search_fields = ("title", "description")
    ordering_fields = ("due_at", "created_at", "priority")
    activity_type = "task"
    author_field = "created_by"

    def get_queryset(self):
        qs = Task.objects.select_related("assignee", "lead", "patient")
        if self.request.GET.get("mine") == "1":
            qs = qs.filter(assignee=self.request.user)
        if self.request.GET.get("overdue") == "1":
            qs = qs.filter(due_at__lt=timezone.now(), status__in=["open", "in_progress"])
        return qs

    def perform_create(self, serializer):
        super().perform_create(serializer)
        t = serializer.instance
        if t.assignee and t.assignee != self.request.user:
            from notifications.service import notify

            notify([t.assignee], "new_task", key="task_new", args={"title": t.title}, link="/admin/tasks")

    def perform_update(self, serializer):
        t = serializer.save()
        if t.status == "done" and not t.completed_at:
            t.completed_at = timezone.now()
            t.save(update_fields=["completed_at"])
        audit(self.request, "task.updated", t, changes={k: str(v) for k, v in self.request.data.items()})
