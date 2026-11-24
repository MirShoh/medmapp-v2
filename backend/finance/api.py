from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasPerm
from audit.service import log as audit
from config.crud import AuditedModelViewSet
from crm.services import activity
from notifications.service import notify
from tools.rates import to_usd

from .models import Commission, Expense, Payment


class PaymentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", default=None, read_only=True)
    case_reference = serializers.CharField(source="case.reference", default=None, read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ("uid", "created_by", "created_at", "updated_at", "amount_usd")

    def validate(self, attrs):
        status = attrs.get("status", getattr(self.instance, "status", "pending"))
        ref = attrs.get("provider_reference", getattr(self.instance, "provider_reference", ""))
        if status == "confirmed" and not ref:
            raise serializers.ValidationError(
                {"provider_reference": "A confirmed payment needs the bank/provider reference that confirms it."})
        return attrs


class _FinanceVS(AuditedModelViewSet):
    permission_classes = [HasPerm.of("finance.view", write="finance.edit")]

    def _usd(self, obj):
        usd = to_usd(obj.amount, obj.currency)
        if usd is not None:
            obj.amount_usd = usd
            obj.save(update_fields=["amount_usd"])

    def perform_create(self, serializer):
        obj = serializer.save(**({"created_by": self.request.user} if hasattr(serializer.Meta.model, "created_by") else {}))
        self._usd(obj)
        audit(self.request, f"{self.audit_name}.created", obj, summary=f"{obj.amount} {obj.currency}")

    def perform_update(self, serializer):
        old = getattr(serializer.instance, "status", None)
        obj = serializer.save()
        self._usd(obj)
        audit(self.request, f"{self.audit_name}.updated", obj,
              changes={k: str(v) for k, v in self.request.data.items()})
        return old, obj


class PaymentViewSet(_FinanceVS):
    serializer_class = PaymentSerializer
    filterset_fields = ("status", "direction", "kind", "currency", "patient", "case", "hospital", "method")
    search_fields = ("uid", "patient__full_name", "provider_reference", "notes")
    ordering_fields = ("created_at", "amount", "due_date")
    audit_name = "payment"

    def get_queryset(self):
        return Payment.objects.select_related("patient", "case", "hospital")

    def perform_update(self, serializer):
        old, p = super().perform_update(serializer)
        if old != p.status:
            if p.case and p.case.lead_id:
                activity(lead=p.case.lead, actor=self.request.user, type="payment",
                         message=f"{p.uid}: {old} → {p.status} ({p.amount} {p.currency})",
                         meta={"key": "payment_status", "uid": p.uid, "from": old, "to": p.status, "amount": f"{p.amount} {p.currency}"})
            if p.patient and p.patient.user_id:
                notify([p.patient.user], "payment_update", key="payment_status", args={"uid": p.uid, "status": p.status},
                       link="/dashboard")

    @action(detail=False, methods=["get"])
    def summary(self, request):
        conf = Payment.objects.filter(status="confirmed")
        income = conf.filter(direction="incoming").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        paid_out = conf.filter(direction="outgoing").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        fees = conf.filter(direction="incoming", kind="service_fee").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        outstanding = Payment.objects.filter(status="pending", direction="incoming").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        comm = Commission.objects.filter(status="received").aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        comm_expected = Commission.objects.filter(status__in=["expected", "invoiced"]).aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        expenses = Expense.objects.aggregate(s=Sum("amount_usd"))["s"] or Decimal(0)
        monthly = (conf.filter(direction="incoming").order_by().annotate(m=TruncMonth("paid_at")).values("m")
                   .annotate(total=Sum("amount_usd"), n=Count("id")).order_by("m"))
        unconverted = Payment.objects.filter(amount_usd__isnull=True).count()
        return Response({
            "currency": "USD", "income": income, "paid_to_hospitals": paid_out, "service_fees": fees,
            "outstanding": outstanding, "commission_received": comm, "commission_expected": comm_expected,
            "expenses": expenses, "revenue": fees + comm, "net": fees + comm - expenses,
            "monthly": [{"month": r["m"].strftime("%Y-%m") if r["m"] else None, "total": r["total"], "count": r["n"]}
                        for r in monthly],
            "by_currency": list(Payment.objects.order_by().values("currency", "status").annotate(total=Sum("amount"), n=Count("id"))),
            "unconverted_count": unconverted,
            "note": "USD totals use stored exchange rates; payments without a known rate are excluded from USD totals."
            if unconverted else "",
        })


class ExpenseViewSet(_FinanceVS):
    serializer_class = type("ExpenseSerializer", (serializers.ModelSerializer,), {
        "case_reference": serializers.CharField(source="case.reference", default=None, read_only=True),
        "Meta": type("Meta", (), {"model": Expense, "fields": "__all__",
                                  "read_only_fields": ("created_by", "created_at", "amount_usd")})})
    filterset_fields = ("category", "currency", "case")
    search_fields = ("description",)
    audit_name = "expense"
    queryset = Expense.objects.select_related("case")


class CommissionViewSet(_FinanceVS):
    serializer_class = type("CommissionSerializer", (serializers.ModelSerializer,), {
        "case_reference": serializers.CharField(source="case.reference", read_only=True),
        "hospital_name": serializers.CharField(source="hospital.name", read_only=True),
        "Meta": type("Meta", (), {"model": Commission, "fields": "__all__",
                                  "read_only_fields": ("created_at", "amount_usd")})})
    filterset_fields = ("status", "hospital", "case")
    audit_name = "commission"
    queryset = Commission.objects.select_related("case", "hospital")
