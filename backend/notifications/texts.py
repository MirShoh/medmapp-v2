"""Notification titles in uz / ru / en.

Notifications are stored with a `key` + `args`; the title is rendered in the reader's language when listed
(Accept-Language) and in the recipient's preferred language for e-mail. Arguments that are codes (case status,
lead stage, payment status, referral status, quotation decision) are translated too.
"""
TITLES = {
    "partner_registered": {"uz": "Yangi hamkor klinika ro‘yxatdan o‘tdi", "ru": "Новая клиника-партнёр зарегистрировалась", "en": "New hospital partner registration"},
    "case_status": {"uz": "{ref}: {status}", "ru": "{ref}: {status}", "en": "{ref}: {status}"},
    "case_coordinator": {"uz": "Siz {ref} holatining koordinatorisiz", "ru": "Вы координатор дела {ref}", "en": "You coordinate case {ref}"},
    "referral_new": {"uz": "Yangi yo‘llanma: {ref}", "ru": "Новое направление: {ref}", "en": "New referral {ref}"},
    "opinion_available": {"uz": "{ref} bo‘yicha tibbiy xulosa tayyor", "ru": "Готово медицинское заключение по {ref}", "en": "Medical opinion available for {ref}"},
    "document_new": {"uz": "{name} uchun yangi hujjat", "ru": "Новый документ: {name}", "en": "New document for {name}"},
    "quotation_new": {"uz": "{ref} bo‘yicha yangi narx taklifi", "ru": "Новое ценовое предложение по {ref}", "en": "New quotation for {ref}"},
    "quotation_decision": {"uz": "Bemor {ref} taklifini {decision}", "ru": "Пациент {decision} предложение {ref}", "en": "Patient {decision} quotation {ref}"},
    "patient_uploaded": {"uz": "{name} {n} ta hujjat yukladi", "ru": "{name} загрузил(а) документы: {n}", "en": "{name} uploaded {n} document(s)"},
    "referral_status": {"uz": "{hospital}: {ref} — {status}", "ru": "{hospital}: {ref} — {status}", "en": "{hospital}: {ref} — {status}"},
    "opinion_received": {"uz": "Klinikadan xulosa keldi: {ref}", "ru": "Получено заключение: {ref}", "en": "Opinion received: {ref}"},
    "quotation_from": {"uz": "{hospital} taklif yubordi: {ref}", "ru": "Предложение от {hospital}: {ref}", "en": "Quotation from {hospital}: {ref}"},
    "partner_message": {"uz": "{hospital}dan xabar ({ref})", "ru": "Сообщение от {hospital} ({ref})", "en": "Message from {hospital} ({ref})"},
    "medmapp_message": {"uz": "MedMapp’dan xabar: {ref}", "ru": "Сообщение MedMapp по {ref}", "en": "MedMapp message on {ref}"},
    "task_new": {"uz": "Yangi vazifa: {title}", "ru": "Новая задача: {title}", "en": "New task: {title}"},
    "task_reminder": {"uz": "Eslatma: {title}", "ru": "Напоминание: {title}", "en": "Reminder: {title}"},
    "lead_follow_up": {"uz": "Bog‘lanish vaqti: {name}", "ru": "Пора связаться: {name}", "en": "Follow up: {name}"},
    "lead_new": {"uz": "Yangi so‘rov: {name}", "ru": "Новая заявка: {name}", "en": "New lead: {name}"},
    "lead_stage": {"uz": "{name}: {stage}", "ru": "{name}: {stage}", "en": "{name}: {stage}"},
    "lead_assigned": {"uz": "Sizga so‘rov biriktirildi: {name}", "ru": "Вам назначена заявка: {name}", "en": "Lead assigned: {name}"},
    "payment_status": {"uz": "To‘lov {uid}: {status}", "ru": "Платёж {uid}: {status}", "en": "Payment {uid}: {status}"},
    "chat_from_patient": {"uz": "{name}: yangi xabar", "ru": "{name}: новое сообщение", "en": "{name}: new message"},
    "chat_from_visitor": {"uz": "Saytdan yangi xabar: {name}", "ru": "Новое сообщение с сайта: {name}", "en": "New site message: {name}"},
    "chat_reply": {"uz": "MedMapp operatori javob berdi", "ru": "Оператор MedMapp ответил", "en": "A MedMapp operator replied"},
}

# code -> label, used for {status} / {stage} / {decision} arguments
LABELS = {
    "case": {
        "request_received": ("So‘rov qabul qilindi", "Заявка получена", "Request received"),
        "coordinator_assigned": ("Koordinator tayinlandi", "Назначен координатор", "Coordinator assigned"),
        "documents_review": ("Hujjatlar ko‘rib chiqilmoqda", "Документы на рассмотрении", "Medical documents review"),
        "hospital_consultation": ("Klinika konsultatsiyasi", "Консультация клиники", "Hospital consultation"),
        "opinion_received": ("Tibbiy xulosa olindi", "Получено заключение", "Medical opinion received"),
        "quotation_available": ("Taklif tayyor", "Предложение готово", "Quotation available"),
        "treatment_confirmed": ("Davolash tasdiqlandi", "Лечение подтверждено", "Treatment confirmed"),
        "travel_preparation": ("Safarga tayyorgarlik", "Подготовка к поездке", "Travel preparation"),
        "in_treatment": ("Davolanish jarayonida", "Идёт лечение", "Treatment in progress"),
        "follow_up": ("Kuzatuv", "Наблюдение", "Follow-up"),
        "closed": ("Yopilgan", "Закрыто", "Closed"),
        "cancelled": ("Bekor qilingan", "Отменено", "Cancelled"),
    },
    "stage": {
        "new": ("Yangi", "Новая", "New"), "contacted": ("Bog‘lanildi", "Связались", "Contacted"),
        "qualification": ("Saralash", "Квалификация", "Qualification"), "documents_pending": ("Hujjatlar kutilmoqda", "Ждём документы", "Documents pending"),
        "medical_review": ("Tibbiy baho", "Медицинская оценка", "Medical review"), "quotation_sent": ("Taklif yuborildi", "Предложение отправлено", "Quotation sent"),
        "negotiation": ("Muzokara", "Переговоры", "Negotiation"), "confirmed": ("Tasdiqlandi", "Подтверждено", "Confirmed"),
        "travel_preparation": ("Safarga tayyorgarlik", "Подготовка к поездке", "Travel preparation"), "in_treatment": ("Davolanmoqda", "На лечении", "In treatment"),
        "completed": ("Yakunlandi", "Завершено", "Completed"), "lost": ("Yo‘qotilgan / Bekor", "Потеряно / Отмена", "Lost / Cancelled"),
    },
    "payment": {
        "pending": ("Kutilmoqda", "Ожидается", "Pending"), "confirmed": ("Tasdiqlangan", "Подтверждён", "Confirmed"),
        "failed": ("Muvaffaqiyatsiz", "Ошибка", "Failed"), "refunded": ("Qaytarilgan", "Возвращён", "Refunded"),
        "cancelled": ("Bekor qilingan", "Отменён", "Cancelled"),
    },
    "referral": {
        "pending": ("kutilmoqda", "ожидает", "pending"), "sent": ("yuborildi", "отправлено", "sent"),
        "reviewing": ("ko‘rib chiqilmoqda", "на рассмотрении", "reviewing"), "opinion_submitted": ("xulosa berildi", "заключение дано", "opinion submitted"),
        "quoted": ("taklif berildi", "предложение дано", "quoted"), "accepted": ("qabul qilindi", "принято", "accepted"),
        "declined": ("rad etildi", "отклонено", "declined"),
    },
    "decision": {"accepted": ("qabul qildi", "принял(а)", "accepted"), "rejected": ("rad etdi", "отклонил(а)", "rejected")},
}
# which label table each argument name uses (per key when it differs)
ARG_TABLE = {"status": "case", "stage": "stage", "decision": "decision"}
KEY_ARG_TABLE = {("payment_status", "status"): "payment", ("referral_status", "status"): "referral"}
LANGS = ("uz", "ru", "en")


def render(key, args=None, lang="uz"):
    lang = (lang or "uz")[:2]
    if lang not in LANGS:
        lang = "uz"
    tpl = TITLES.get(key, {}).get(lang)
    if not tpl:
        return ""
    values = {}
    for k, v in (args or {}).items():
        table = KEY_ARG_TABLE.get((key, k)) or ARG_TABLE.get(k)
        label = LABELS.get(table, {}).get(v) if table else None
        values[k] = label[LANGS.index(lang)] if label else v
    try:
        return tpl.format(**values)
    except (KeyError, IndexError):
        return tpl
