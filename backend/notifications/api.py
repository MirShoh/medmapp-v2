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
