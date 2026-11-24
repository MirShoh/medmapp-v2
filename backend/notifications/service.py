"""Notification dispatch. In-app notifications always; external channels only when configured.

External delivery results are recorded in DeliveryLog with the real outcome - never assumed.
"""
import logging

import requests as http
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from accounts.models import Account, Role

from .models import DeliveryLog, Notification

log = logging.getLogger(__name__)
CFG = settings.INTEGRATIONS


def staff_users(*roles):
    User = get_user_model()
    qs = User.objects.filter(is_active=True)
    if roles:
        qs = qs.filter(account__role__in=roles) | qs.filter(is_superuser=True)
    return qs.distinct()


def notify(users, type, title="", body="", link="", email=False, key="", args=None):
    """`key` + `args` (notifications/texts.py) make the title translatable; `title` is only for free text."""
    from .texts import render

    args = {k: str(v) for k, v in (args or {}).items()}
    stored = (render(key, args, "uz") if key else title)[:255]
    created = []
    for u in users:
        if u is None:
            continue
        created.append(Notification.objects.create(user=u, type=type, title=stored, key=key, args=args, body=body, link=link))
        if email and u.email:
            lang = getattr(getattr(u, "account", None), "preferred_language", "uz")
            send_email(u.email, render(key, args, lang) if key else title, body, event=type)
    return created


def notify_staff(type, title="", body="", link="", roles=(Role.SUPER_ADMIN, Role.ADMIN, Role.SALES_MANAGER), key="", args=None):
    from .texts import render

    notify(staff_users(*roles), type, title, body, link, key=key, args=args)
    send_telegram(f"<b>{render(key, args or {}, 'uz') if key else title}</b>\n{body}", event=type)


def send_email(to, subject, body, event="system"):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
        DeliveryLog.objects.create(channel="email", target=to, event=event, success=True)
        return True
    except Exception as exc:  # noqa: BLE001
        DeliveryLog.objects.create(channel="email", target=to, event=event, success=False, detail=str(exc)[:500])
        return False


def send_telegram(text, event="system", chat_id=None):
    token, chat = CFG["telegram_bot_token"], chat_id or CFG["telegram_chat_id"]
    if not token or not chat:
        return None  # not configured: nothing is claimed
    try:
        r = http.post(f"https://api.telegram.org/bot{token}/sendMessage",
                      json={"chat_id": chat, "text": text[:4000], "parse_mode": "HTML"}, timeout=8)
        ok = r.ok and r.json().get("ok", False)
        DeliveryLog.objects.create(channel="telegram", target=str(chat), event=event, success=ok,
                                   detail="" if ok else r.text[:500])
        return ok
    except Exception as exc:  # noqa: BLE001
        DeliveryLog.objects.create(channel="telegram", target=str(chat), event=event, success=False,
                                   detail=str(exc)[:500])
        return False


def send_whatsapp(phone, text, event="system"):
    token, phone_id = CFG["whatsapp_token"], CFG["whatsapp_phone_id"]
    if not token or not phone_id:
        return None
    try:
        r = http.post(f"https://graph.facebook.com/v19.0/{phone_id}/messages",
                      headers={"Authorization": f"Bearer {token}"},
                      json={"messaging_product": "whatsapp", "to": phone, "type": "text", "text": {"body": text}},
                      timeout=8)
        DeliveryLog.objects.create(channel="whatsapp", target=phone, event=event, success=r.ok,
                                   detail="" if r.ok else r.text[:500])
        return r.ok
    except Exception as exc:  # noqa: BLE001
        DeliveryLog.objects.create(channel="whatsapp", target=phone, event=event, success=False, detail=str(exc)[:500])
        return False


def integration_status():
    email_configured = "console" not in settings.EMAIL_BACKEND and "locmem" not in settings.EMAIL_BACKEND
    return [
        {"key": "email", "name": "Email (SMTP)", "configured": email_configured,
         "env": ["EMAIL_BACKEND", "EMAIL_HOST", "EMAIL_HOST_USER", "EMAIL_HOST_PASSWORD"]},
        {"key": "telegram", "name": "Telegram Bot", "configured": bool(CFG["telegram_bot_token"] and CFG["telegram_chat_id"]),
         "env": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]},
        {"key": "whatsapp", "name": "WhatsApp Business API", "configured": bool(CFG["whatsapp_token"] and CFG["whatsapp_phone_id"]),
         "env": ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"]},
        {"key": "maps", "name": "Google Maps", "configured": bool(CFG["google_maps_key"]),
         "env": ["GOOGLE_MAPS_API_KEY"], "note": "Without a key, hospital maps use an OpenStreetMap embed."},
        {"key": "currency", "name": "Currency rates API", "configured": bool(CFG["currency_api_url"]),
         "env": ["CURRENCY_API_URL", "CURRENCY_API_KEY"]},
        {"key": "ai", "name": "AI assistant (Anthropic Claude)", "configured": bool(CFG["ai_api_key"]),
         "env": ["ANTHROPIC_API_KEY", "AI_MODEL"]},
        {"key": "payments", "name": "Payment provider", "configured": bool(CFG["payment_provider"]),
         "env": ["PAYMENT_PROVIDER"], "note": "No provider is integrated yet; payments are recorded manually by finance staff."},
    ]


def user_label(user):
    if not user:
        return ""
    return user.get_full_name() or user.get_username()


__all__ = ["notify", "notify_staff", "send_email", "send_telegram", "send_whatsapp", "integration_status",
           "Account"]
