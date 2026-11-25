"""Live chat from the site widget for visitors who are not signed in.

Visitor side (no account): /api/v2/live-chat/ — the browser keeps the chat token and sends it with every call.
Staff side: /api/v2/admin/visitor-chats/ (crm.view to read, crm.edit to reply).
Delivery is by short polling (the widget polls every few seconds while open). Nothing here creates a lead:
leads come only from the free-consultation form.
"""
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.permissions import HasPerm
from audit.service import log as audit
from notifications.service import notify_staff

from .chat_api import IMAGE_TYPES, message_input, preview
from .models import VisitorChat, VisitorMessage

LANGS = ("uz", "ru", "en")


class LiveChatThrottle(ScopedRateThrottle):
    scope = "live_chat"


class VisitorMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = VisitorMessage
        fields = ("id", "text", "from_staff", "author_name", "created_at", "read_at", "attachment")

    def get_author_name(self, o):
        if not o.from_staff:
            return None
        return (o.author.first_name if o.author and o.author.first_name else "MedMapp")

    def get_attachment(self, o):
        if not o.attachment:
            return None
        request = self.context.get("request")
        if self.context.get("staff") and request:
            from cases.access import make_token

            url = f"/api/v2/files/{make_token('vchat', o.pk, request.user)}/"
        else:
            url = f"/api/v2/live-chat/files/{o.pk}/?token={o.chat.token}"
        return {"name": o.attachment_name, "size": o.attachment_size, "type": o.attachment_type,
                "is_image": o.attachment_type in IMAGE_TYPES, "url": url}


def chat_info(c: VisitorChat):
    return {"id": c.pk, "name": c.name, "phone": c.phone, "display_name": c.display_name, "page": c.page,
            "language": c.language, "created_at": c.created_at}


def clean_contact(data):
    name = " ".join(str(data.get("name", "")).split())[:120]
    phone = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit() or ch == "+")[:20]
    if phone and len(phone.lstrip("+")) < 7:
        raise serializers.ValidationError({"phone": "Phone number is too short."})
    return name, phone


def visitor_chat(request, required=True):
    source = request.GET if request.method == "GET" else request.data
    token = str(source.get("token") or "").strip()[:64]
    c = VisitorChat.objects.filter(token=token).first() if token else None
    if required and not c:
        raise Http404("Chat not found")
    return c


class LiveChatView(APIView):
    """GET ?token=…[&peek=1]  — the conversation (marks operator replies as read unless peek=1).
    POST {token?, text, file?, name?, phone?, page?, language?} — send; starts a new chat when there is no token."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [LiveChatThrottle]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        c = visitor_chat(request)
        msgs = list(c.messages.select_related("author", "chat").order_by("-created_at")[:200])[::-1]
        if request.GET.get("peek") != "1":  # the closed widget only peeks for the unread badge
            c.messages.filter(from_staff=True, read_at__isnull=True).update(read_at=timezone.now())
        ctx = {"request": request}
        return Response({"chat": chat_info(c), "messages": VisitorMessageSerializer(msgs, many=True, context=ctx).data})

    def post(self, request):
        text, extra = message_input(request)
        c = visitor_chat(request, required=False)
        name, phone = clean_contact(request.data)
        if not c:
            lang = request.data.get("language") if request.data.get("language") in LANGS else "uz"
            c = VisitorChat.objects.create(name=name, phone=phone, language=lang)
        else:
            if name:
                c.name = name
            if phone:
                c.phone = phone
        c.page = str(request.data.get("page", ""))[:300] or c.page
        c.last_message_at = timezone.now()
        c.save()
        m = VisitorMessage.objects.create(chat=c, from_staff=False, text=text, **extra)
        notify_staff("chat", key="chat_from_visitor", args={"name": c.display_name}, body=preview(m),
                     link=f"/admin/chats?visitor={c.pk}")
        return Response({"token": c.token, "chat": chat_info(c),
                         "message": VisitorMessageSerializer(m, context={"request": request}).data}, status=201)


class LiveChatContactView(APIView):
    """POST {token, name, phone} — the visitor leaves contact details (optional; not a lead)."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [LiveChatThrottle]

    def post(self, request):
        c = visitor_chat(request)
        name, phone = clean_contact(request.data)
        if not name and not phone:
            raise serializers.ValidationError({"phone": "Enter a name or a phone number."})
        c.name, c.phone = name or c.name, phone or c.phone
        c.save(update_fields=["name", "phone"])
        return Response(chat_info(c))


class LiveChatFileView(APIView):
    """A visitor downloads a file from their own chat (the chat token proves ownership)."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, message_id):
        m = VisitorMessage.objects.filter(pk=message_id).select_related("chat").first()
        if not m or not m.attachment or m.chat.token != request.GET.get("token", ""):
            raise Http404()
        resp = FileResponse(m.attachment.open("rb"), as_attachment=request.GET.get("inline") != "1",
                            filename=m.attachment_name or "file")
        resp["Cache-Control"] = "private, no-store"
        resp["X-Content-Type-Options"] = "nosniff"
        return resp


class VisitorChatListView(APIView):
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]

    def get(self, request):
        from django.db.models import Count, Q

        qs = (VisitorChat.objects.filter(last_message_at__isnull=False)
              .annotate(unread=Count("messages", filter=Q(messages__from_staff=False, messages__read_at__isnull=True)))
              .order_by("-last_message_at"))
        if request.GET.get("q"):
            q = request.GET["q"]
            qs = qs.filter(Q(name__icontains=q) | Q(phone__icontains=q) | Q(messages__text__icontains=q)).distinct()
        rows = []
        for c in qs[:200]:
            last = c.messages.order_by("-created_at").first()
            rows.append({"visitor": c.pk, "name": c.display_name, "phone": c.phone, "last_at": c.last_message_at,
                         "unread": c.unread, "last_text": preview(last)[:140] if last else "",
                         "last_from_staff": bool(last and last.from_staff)})
        return Response(rows)


class VisitorChatThreadView(APIView):
    permission_classes = [HasPerm.of("crm.view", write="crm.edit")]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, chat_id):
        c = get_object_or_404(VisitorChat, pk=chat_id)
        msgs = list(c.messages.select_related("author", "chat").order_by("-created_at")[:300])[::-1]
        c.messages.filter(from_staff=False, read_at__isnull=True).update(read_at=timezone.now())
        ctx = {"request": request, "staff": True}
        return Response({"visitor": chat_info(c), "messages": VisitorMessageSerializer(msgs, many=True, context=ctx).data})

    def post(self, request, chat_id):
        c = get_object_or_404(VisitorChat, pk=chat_id)
        text, extra = message_input(request)
        m = VisitorMessage.objects.create(chat=c, author=request.user, from_staff=True, text=text, **extra)
        c.messages.filter(from_staff=False, read_at__isnull=True).update(read_at=timezone.now())
        c.last_message_at = timezone.now()
        c.save(update_fields=["last_message_at"])
        audit(request, "chat.replied", c, summary=preview(m))
        return Response(VisitorMessageSerializer(m, context={"request": request, "staff": True}).data, status=201)
