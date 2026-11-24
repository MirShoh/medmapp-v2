from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import STAFF_ROLES
from accounts.permissions import HasPerm, user_has_perm
from audit.models import AuditLog
from cases.models import CaseReferral, HospitalQuotation, MedicalCase
from crm.admin_api import DEMO_PREFIX
from crm.models import Lead, LeadStage, Patient, SupportMessage, Task
from finance.models import Commission, Payment

User = get_user_model()
FUNNEL = [LeadStage.NEW, LeadStage.CONTACTED, LeadStage.QUALIFICATION, LeadStage.MEDICAL_REVIEW,
          LeadStage.QUOTATION_SENT, LeadStage.CONFIRMED, LeadStage.IN_TREATMENT, LeadStage.COMPLETED]
ORDER = list(LeadStage.values)


class DashboardView(APIView):
    permission_classes = [HasPerm.of("dashboard.view")]

    def get(self, request):
        now = timezone.now()
        days = int(request.GET.get("days", 30))
        since = now - timedelta(days=days)
        demo = request.GET.get("demo") == "1"
        leads = Lead.objects.all() if demo else Lead.objects.exclude(full_name__startswith=DEMO_PREFIX)
        patients = Patient.objects.all() if demo else Patient.objects.exclude(full_name__startswith=DEMO_PREFIX)
        stage_counts = dict(leads.order_by().values_list("stage").annotate(n=Count("id")))
        total_leads = leads.count()
        won = sum(stage_counts.get(s, 0) for s in ORDER[ORDER.index(LeadStage.CONFIRMED):ORDER.index(LeadStage.LOST)])
        closed = won + stage_counts.get(LeadStage.LOST, 0)
        kpis = {
            "total_patients": patients.count(),
            "total_leads": total_leads,
            "new_leads": stage_counts.get(LeadStage.NEW, 0),
            "new_leads_period": leads.filter(created_at__gte=since).count(),
            "active_cases": MedicalCase.objects.exclude(status__in=["closed", "cancelled"]).count(),
            "pending_medical_reviews": MedicalCase.objects.filter(status__in=["documents_review", "hospital_consultation"]).count(),
            "quotations_sent": HospitalQuotation.objects.filter(status__in=["sent", "accepted", "rejected"]).count(),
            "confirmed_treatments": stage_counts.get(LeadStage.CONFIRMED, 0) + stage_counts.get(LeadStage.TRAVEL_PREPARATION, 0),
            "patients_in_treatment": stage_counts.get(LeadStage.IN_TREATMENT, 0),
            "completed_cases": stage_counts.get(LeadStage.COMPLETED, 0),
            "cancelled_leads": stage_counts.get(LeadStage.LOST, 0),
            "conversion_rate": round(won / closed * 100, 1) if closed else None,
            "overdue_follow_ups": leads.filter(next_follow_up__lt=now).exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST]).count(),
            "open_tasks": Task.objects.filter(status__in=["open", "in_progress"]).count(),
        }
        open_leads = leads.exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST])
        active_cases = MedicalCase.objects.exclude(status__in=["closed", "cancelled"])
        today = {
            "fresh_leads": leads.filter(created_at__gte=now - timedelta(hours=24)).count(),
            "due_today": open_leads.filter(next_follow_up__date=timezone.localdate()).count(),
            "overdue": open_leads.filter(next_follow_up__lt=now).count(),
            "unassigned_leads": open_leads.filter(assigned_to__isnull=True).count(),
            "unread_chats": SupportMessage.objects.filter(from_staff=False, read_at__isnull=True)
                                                  .values("patient").distinct().count(),
            "unassigned_cases": active_cases.filter(coordinator__isnull=True).count(),
            "reviews": active_cases.filter(status__in=["documents_review", "hospital_consultation"]).count(),
            "my_tasks": Task.objects.filter(assignee=request.user, status__in=["open", "in_progress"]).count(),
            "my_tasks_overdue": Task.objects.filter(assignee=request.user, status__in=["open", "in_progress"],
                                                    due_at__lt=now).count(),
        }
        if user_has_perm(request.user, "users.view"):
            today["pending_partners"] = User.objects.filter(account__role="hospital_partner", account__is_approved=False,
                                                            is_active=True).count()
        if user_has_perm(request.user, "finance.view"):
            conf = Payment.objects.filter(status="confirmed", direction="incoming")
            fees = conf.filter(kind="service_fee").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
            comm = Commission.objects.filter(status="received").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
            kpis["total_revenue"] = fees + comm
            kpis["outstanding_payments"] = Payment.objects.filter(status="pending", direction="incoming") \
                .aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
            revenue = (conf.filter(paid_at__isnull=False).order_by().annotate(m=TruncMonth("paid_at")).values("m")
                       .annotate(total=Sum("amount_usd")).order_by("m"))
            revenue_series = [{"label": r["m"].strftime("%Y-%m"), "value": float(r["total"] or 0)} for r in revenue]
        else:
            revenue_series = None

        daily = {r["d"]: r["n"] for r in leads.filter(created_at__gte=since).order_by().annotate(d=TruncDate("created_at"))
                 .values("d").annotate(n=Count("id"))}
        daily_series = [{"label": (since + timedelta(days=i + 1)).date().isoformat(),
                         "value": daily.get((since + timedelta(days=i + 1)).date(), 0)} for i in range(days)]
        monthly = (leads.filter(created_at__gte=now - timedelta(days=365)).order_by().annotate(m=TruncMonth("created_at"))
                   .values("m").annotate(n=Count("id")).order_by("m"))

        def dist(field, label_field, key_field=None):
            fields = [label_field] + ([key_field] if key_field else [])
            rows = leads.exclude(**{f"{field}__isnull": True}).order_by().values(*fields).annotate(n=Count("id")).order_by("-n")[:10]
            return [{"label": r[label_field] or "—", "value": r["n"], **({"key": r[key_field]} if key_field else {})} for r in rows]

        cumulative = []
        for s in FUNNEL:
            reached = sum(stage_counts.get(x, 0) for x in ORDER[ORDER.index(s):ORDER.index(LeadStage.LOST)])
            cumulative.append({"label": LeadStage(s).label, "value": reached, "key": s})

        managers = (User.objects.filter(account__role__in=list(STAFF_ROLES), is_active=True)
                    .annotate(total=Count("assigned_leads"),
                              won=Count("assigned_leads", filter=Q(assigned_leads__stage__in=ORDER[7:11])),
                              lost=Count("assigned_leads", filter=Q(assigned_leads__stage=LeadStage.LOST)))
                    .filter(total__gt=0).order_by("-won"))
        hospitals = (CaseReferral.objects.order_by().values("hospital__name")
                     .annotate(referrals=Count("id"), quoted=Count("id", filter=Q(status__in=["quoted", "accepted"])),
                               accepted=Count("id", filter=Q(status="accepted"))).order_by("-referrals")[:10])
        return Response({
            "kpis": kpis,
            "today": today,
            "charts": {
                "daily_leads": daily_series,
                "monthly_leads": [{"label": r["m"].strftime("%Y-%m"), "value": r["n"]} for r in monthly],
                "country_distribution": dist("destination", "destination__name"),
                "resident_distribution": dist("resident_country", "resident_country__name"),
                "treatment_distribution": dist("specialty", "specialty__title"),
                "source_distribution": dist("source", "source__name", "source__code"),
                "funnel": cumulative,
                "stages": [{"label": LeadStage(s).label, "value": stage_counts.get(s, 0), "key": s} for s in ORDER],
                "revenue": revenue_series,
                "managers": [{"name": m.get_full_name() or m.username, "total": m.total, "won": m.won, "lost": m.lost,
                              "rate": round(m.won / m.total * 100, 1) if m.total else 0} for m in managers],
                "hospitals": [{"name": h["hospital__name"], "referrals": h["referrals"], "quoted": h["quoted"],
                               "accepted": h["accepted"]} for h in hospitals],
            },
            # sign-ins are noise here; they stay in the audit log
            "recent_activity": [{"action": a.action, "summary": a.summary, "actor": (a.actor.get_full_name() or a.actor.username) if a.actor else None,
                                 "object_type": a.object_type, "object_id": a.object_id, "created_at": a.created_at}
                                for a in AuditLog.objects.select_related("actor").exclude(action__startswith="auth.")[:12]]
            if user_has_perm(request.user, "audit.view") else [],
            "generated_at": now,
        })
