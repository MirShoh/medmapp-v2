"""MedMapp AI travel assistant (Anthropic Claude).

If ANTHROPIC_API_KEY is not set, the endpoint returns 503 with a clear configuration message —
it never pretends to be connected. The assistant never diagnoses, prescribes or guarantees outcomes.
"""
import logging
import uuid

from django.conf import settings
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from catalog.models import MedicalService, Treatment
from core.models import Country

from .models import AssistantConversation, AssistantMessage

log = logging.getLogger(__name__)

LANG_NAMES = {"uz": "Uzbek (Latin script)", "ru": "Russian", "en": "English"}

SYSTEM_PROMPT = """You are the MedMapp Medical Travel Assistant on medmapp.uz, a medical tourism platform that \
connects patients from Uzbekistan and Central Asia with partner hospitals abroad (India, Turkey, China, Germany, \
South Korea, UAE, Thailand and others) and coordinates the whole journey: free consultation, medical document \
review, second opinions, hospital and doctor matching, quotations, visa, flights, hotel, airport transfer, \
interpreters and follow-up.

What you do:
- Explain MedMapp services and how the patient journey works.
- Answer general questions about medical tourism, travel, documents to prepare and what to expect.
- Help people find relevant treatments, destinations and hospitals using the catalog below, and point them to the \
right pages (/treatments, /hospitals, /doctors, /destinations, /packages, /second-opinion, /tools, /dashboard).
- Collect a preliminary request: when someone wants help, ask for their name, phone, the condition or treatment \
in their own words, and preferred country, then tell them to submit it with the consultation form or the \
"Free consultation" button so a coordinator contacts them.
- Explain how to upload documents to the Health Suitcase (/dashboard/documents) or the second opinion form.

Hard limits:
- You are not a doctor. Never diagnose, interpret test results, recommend a specific treatment, medication or \
dose, or guarantee results, prices or timelines. For anything clinical, say that MedMapp coordinators share the \
case with qualified specialists who give the medical opinion.
- Prices you mention must come from the catalog below and must be described as estimates; the final cost is \
confirmed only in a hospital quotation. If no price is listed, say so.
- For visa rules, say requirements change and must be confirmed with the embassy or a MedMapp coordinator.
- In an emergency or with severe symptoms, tell the person to call local emergency services (103 in Uzbekistan) \
or go to the nearest hospital now.
- Never ask for passwords, card numbers or passport numbers in chat.

Style: reply in {language}. Be warm, concise and practical: short paragraphs or a short list, at most about \
150 words unless the person asks for detail.

Catalog (live data from the MedMapp database):
{catalog}
"""


def catalog_context():
    countries = ", ".join(Country.objects.filter(is_destination=True, is_active=True).values_list("name", flat=True))
    services = ", ".join(MedicalService.objects.filter(is_active=True).values_list("title", flat=True))
    lines = []
    for t in Treatment.objects.filter(is_active=True).select_related("specialty").prefetch_related("prices__country")[:60]:
        prices = "; ".join(f"{p.country.name} from {p.price_from:.0f} {p.currency}" for p in t.prices.all()[:4])
        lines.append(f"- {t.name} ({t.specialty.title}) /treatments/{t.slug}" + (f" — estimates: {prices}" if prices else ""))
    return (f"Destinations: {countries or 'none listed yet'}\nServices: {services or 'none listed yet'}\n"
            f"Treatments:\n" + ("\n".join(lines) or "none listed yet"))


class AssistantThrottle(ScopedRateThrottle):
    pass


class AssistantStatusView(APIView):
    def get(self, request):
        return Response({"configured": bool(settings.INTEGRATIONS["ai_api_key"]),
                         "model": settings.INTEGRATIONS["ai_model"] if settings.INTEGRATIONS["ai_api_key"] else None})


class AssistantChatView(APIView):
    throttle_classes = [AssistantThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        api_key = settings.INTEGRATIONS["ai_api_key"]
        if not api_key:
            return Response({"configured": False,
                             "detail": "The AI assistant is not configured. An administrator must set "
                                       "ANTHROPIC_API_KEY on the server. Meanwhile, please use the free "
                                       "consultation form and a coordinator will help you."}, status=503)
        text = (request.data.get("message") or "").strip()[:2000]
        if not text:
            return Response({"message": "Message is empty."}, status=400)
        lang = request.data.get("language") if request.data.get("language") in LANG_NAMES else "uz"
        session_key = (request.data.get("session") or "")[:64] or uuid.uuid4().hex
        convo, _ = AssistantConversation.objects.get_or_create(
            session_key=session_key,
            defaults={"language": lang, "user": request.user if request.user.is_authenticated else None})
        history = list(convo.messages.order_by("-created_at")[:16])[::-1]
        messages = [{"role": m.role, "content": m.content} for m in history] + [{"role": "user", "content": text}]

        import anthropic

        client = anthropic.Anthropic(api_key=api_key, timeout=60.0)
        try:
            response = client.beta.messages.create(
                model=settings.INTEGRATIONS["ai_model"],
                max_tokens=2048,
                system=SYSTEM_PROMPT.format(language=LANG_NAMES[lang], catalog=catalog_context()),
                messages=messages,
                output_config={"effort": "low"},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except anthropic.RateLimitError:
            return Response({"detail": "The assistant is busy. Please try again in a minute."}, status=429)
        except anthropic.APIStatusError as exc:
            log.warning("Assistant API error %s: %s", exc.status_code, exc.message)
            return Response({"detail": "The assistant is temporarily unavailable."}, status=502)
        except anthropic.APIConnectionError:
            return Response({"detail": "The assistant could not reach the AI service."}, status=502)

        if response.stop_reason == "refusal":
            reply = {"uz": "Kechirasiz, bu savolga javob bera olmayman. Iltimos, koordinatorimiz bilan bog‘laning.",
                     "ru": "Извините, я не могу ответить на этот вопрос. Пожалуйста, свяжитесь с нашим координатором.",
                     "en": "Sorry, I can't help with that. Please contact a MedMapp coordinator."}[lang]
        else:
            reply = "".join(b.text for b in response.content if b.type == "text").strip()
        AssistantMessage.objects.create(conversation=convo, role="user", content=text)
        AssistantMessage.objects.create(conversation=convo, role="assistant", content=reply)
        return Response({"session": session_key, "reply": reply, "configured": True})
