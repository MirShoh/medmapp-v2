from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasPerm

from .models import DeliveryLog, Notification
from .service import integration_status


class NotificationSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ("id", "type", "title", "body", "link", "read_at", "created_at")

    def get_title(self, o):
        """In the reader's language (Accept-Language), for notifications stored with a key."""
        if not o.key:
            return o.title
        from django.utils.translation import get_language

        from .texts import render
        return render(o.key, o.args, get_language()) or o.title


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        if not self.request.user.is_authenticated:  # e.g. API schema generation
            return Notification.objects.none()
        qs = self.request.user.notifications.all()
        if self.request.GET.get("unread") == "1":
            qs = qs.filter(read_at__isnull=True)
        return qs

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        n = self.get_object()
        n.read_at = n.read_at or timezone.now()
        n.save()
        return Response({"ok": True})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"ok": True})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": request.user.notifications.filter(read_at__isnull=True).count()})


class IntegrationsView(APIView):
    permission_classes = [HasPerm.of("integrations.view")]

    def get(self, request):
        return Response({"integrations": integration_status(),
                         "recent_deliveries": [{"channel": d.channel, "event": d.event, "success": d.success,
                                                "detail": d.detail[:200], "created_at": d.created_at}
                                               for d in DeliveryLog.objects.all()[:30]]})


class TestIntegrationView(APIView):
    permission_classes = [HasPerm.of("integrations.edit")]

    def post(self, request, key):
        from .service import send_email, send_telegram

        if key == "telegram":
            res = send_telegram("MedMapp integration test ✅", event="test")
        elif key == "email":
            res = send_email(request.user.email, "MedMapp integration test", "Email delivery works.", event="test") \
                if request.user.email else False
        else:
            return Response({"detail": "Test not available for this integration."}, status=400)
        if res is None:
            return Response({"ok": False, "detail": "Not configured."}, status=400)
        return Response({"ok": bool(res), "detail": "Delivered." if res else "Delivery failed — see delivery log."})


class CountersView(APIView):
    """Numbers for the red badges in the header and the side menu, depending on who asks.

    Everyone: unread notifications. Patients: operator replies, quotations awaiting an answer. Partners: new
    referrals. Staff (by permission): unanswered chats, new requests, own open tasks, cases without a coordinator,
    partners awaiting approval, reviews awaiting moderation.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        from accounts.models import Role, get_account
        from accounts.permissions import user_has_perm

        u = request.user
        acc = get_account(u)
        data = {"notifications": u.notifications.filter(read_at__isnull=True).count()}
        role = acc.role if acc else None
        if role == Role.PATIENT:
            from cases.models import HospitalQuotation
            from crm.models import SupportMessage

            data["chat"] = SupportMessage.objects.filter(patient__user=u, from_staff=True, read_at__isnull=True).count()
            data["quotations"] = HospitalQuotation.objects.filter(case__patient__user=u, status="sent").count()
            return Response(data)
        if role == Role.HOSPITAL_PARTNER:
            from cases.models import CaseReferral

            data["referrals"] = CaseReferral.objects.filter(hospital_id=acc.hospital_id, status="sent").count() if acc.hospital_id else 0
            return Response(data)
        can = lambda code: user_has_perm(u, code)  # noqa: E731
        if can("crm.view"):
            from crm.admin_api import DEMO_PREFIX
            from crm.models import Lead, SupportMessage

            data["chats"] = (SupportMessage.objects.filter(from_staff=False, read_at__isnull=True)
                             .values("patient").distinct().count())
            data["leads"] = Lead.objects.filter(stage="new").exclude(full_name__startswith=DEMO_PREFIX).count()
        if can("tasks.view"):
            from django.utils import timezone

            from crm.models import Task

            data["tasks"] = Task.objects.filter(assignee=u, status__in=["open", "in_progress"]).filter(
                Q(due_at__isnull=True) | Q(due_at__lte=timezone.now() + timezone.timedelta(days=1))).count()
        if can("medical.view"):
            from cases.models import MedicalCase

            data["cases"] = (MedicalCase.objects.filter(coordinator__isnull=True)
                             .exclude(status__in=["closed", "cancelled"]).count())
        if can("users.view"):
            from django.contrib.auth import get_user_model

            data["users"] = get_user_model().objects.filter(account__role="hospital_partner", account__is_approved=False,
                                                            is_active=True).count()
        if can("cms.edit"):
            from catalog.models import Review

            data["reviews"] = Review.objects.filter(is_published=False).count()
        return Response(data)
