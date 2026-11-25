"""Patient ↔ staff chat ("Support").

Patient side: /api/v2/me/chat/ (own conversation only). Staff side: /api/v2/admin/chats/ (crm.view to read,
crm.edit to reply). Delivery is by polling; every message also raises an in-app notification for the other side.
"""
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasPerm
from audit.service import log as audit
from notifications.service import notify, notify_staff

from .models import Patient, SupportMessage

MAX_TEXT = 4000


IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")


class MessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ("id", "text", "from_staff", "author_name", "created_at", "read_at", "attachment")

    def get_attachment(self, o):
        """File info + a signed link for the reader (valid SIGNED_URL_TTL_SECONDS; chats poll, so it is refreshed)."""
        if not o.attachment:
            return None
        from cases.access import make_token

        request = self.context.get("request")
        url = f"/api/v2/files/{make_token('chat', o.pk, request.user)}/" if request else None
        return {"name": o.attachment_name, "size": o.attachment_size, "type": o.attachment_type,
                "is_image": o.attachment_type in IMAGE_TYPES, "url": url}

    def get_author_name(self, o):
        if not o.from_staff:
            return None
        u = o.author
        return (u.first_name or "MedMapp") if u else "MedMapp"


def message_input(request):
    """Text and/or one attached file (checked like medical documents: type, size, real content)."""
    from cases.validators import validate_upload

    text = str(request.data.get("text", "")).strip()
    f = request.FILES.get("file")
    if not text and not f:
        raise serializers.ValidationError({"text": "Empty message."})
    if len(text) > MAX_TEXT:
        raise serializers.ValidationError({"text": f"At most {MAX_TEXT} characters."})
    extra = {}
    if f:
        _ext, content_type = validate_upload(f)
        extra = {"attachment": f, "attachment_name": f.name[:255], "attachment_size": f.size, "attachment_type": content_type}
    return text, extra


def preview(m):
    return m.text[:200] if m.text else f"📎 {m.attachment_name}"


class MyChatView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        from cases.portal_api import my_patient
        p = my_patient(request)
        msgs = p.support_messages.select_related("author").order_by("-created_at")[:200]
        p.support_messages.filter(from_staff=True, read_at__isnull=True).update(read_at=timezone.now())
        return Response(MessageSerializer(reversed(list(msgs)), many=True, context={'request': request}).data)

    def post(self, request):
        from cases.portal_api import my_patient
        p = my_patient(request)
        text, extra = message_input(request)
        m = SupportMessage.objects.create(patient=p, author=request.user, from_staff=False, text=text, **extra)
        link = f"/admin/chats?patient={p.pk}"
        args = {"name": p.full_name}
        if p.assigned_manager_id:
            notify([p.assigned_manager], "chat", key="chat_from_patient", args=args, body=preview(m), link=link)
        else:
            notify_staff("chat", key="chat_from_patient", args=args, body=preview(m), link=link)
        return Response(MessageSerializer(m, context={'request': request}).data, status=201)


class MyChatUnreadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from cases.portal_api import my_patient
        p = my_patient(request)
        return Response({"count": p.support_messages.filter(from_staff=True, read_at__isnull=True).count()})


class ChatListView(APIView):
    """Conversations, newest first, with the number of unanswered patient messages."""

    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]

    def get(self, request):
        qs = (Patient.objects.filter(support_messages__isnull=False)
              .annotate(last_at=Max("support_messages__created_at"),
                        unread=Count("support_messages", filter=Q(support_messages__from_staff=False,
                                                                  support_messages__read_at__isnull=True)))
              .order_by("-last_at"))
        if request.GET.get("q"):
            q = request.GET["q"]
            qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q))
        rows = []
        for p in qs[:200]:
            last = p.support_messages.order_by("-created_at").first()
            rows.append({"patient": p.pk, "name": p.full_name, "phone": p.phone, "last_at": p.last_at, "unread": p.unread,
                         "last_text": preview(last)[:140] if last else "", "last_from_staff": bool(last and last.from_staff)})
        return Response(rows)


class ChatThreadView(APIView):
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, patient_id):
        p = get_object_or_404(Patient, pk=patient_id)
        msgs = p.support_messages.select_related("author").order_by("-created_at")[:300]
        p.support_messages.filter(from_staff=False, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"patient": {"id": p.pk, "name": p.full_name, "phone": p.phone, "email": p.email},
                         "messages": MessageSerializer(reversed(list(msgs)), many=True, context={'request': request}).data})

    def post(self, request, patient_id):
        p = get_object_or_404(Patient, pk=patient_id)
        text, extra = message_input(request)
        m = SupportMessage.objects.create(patient=p, author=request.user, from_staff=True, text=text, **extra)
        # replying means the operator has read the conversation
        p.support_messages.filter(from_staff=False, read_at__isnull=True).update(read_at=timezone.now())
        audit(request, "chat.replied", p, summary=preview(m))
        if p.user_id:
            notify([p.user], "chat", key="chat_reply", body=preview(m), link="/dashboard/support")
        return Response(MessageSerializer(m, context={'request': request}).data, status=201)
