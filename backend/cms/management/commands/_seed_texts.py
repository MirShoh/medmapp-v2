"""Trilingual seed texts (EN, RU, UZ) for reference data.

`fill()` writes a translation only when the field is empty or still holds the original English seed text
(older seeds wrote English into every language). Text that staff edited is never overwritten.
"""

STEPS = (
    "Contact MedMapp\nCoordinator reviews your request\nDocuments shared with partner hospitals (with your consent)\nYou receive options and quotations\nWe arrange travel and support you throughout",
    "Свяжитесь с MedMapp\nКоординатор изучает ваш запрос\nДокументы передаются клиникам-партнёрам (с вашего согласия)\nВы получаете варианты и предложения\nМы организуем поездку и сопровождаем вас на всех этапах",
    "MedMapp bilan bog‘laning\nKoordinator so‘rovingizni ko‘rib chiqadi\nHujjatlar hamkor klinikalarga yuboriladi (roziligingiz bilan)\nVariantlar va takliflarni olasiz\nSafarni tashkil qilamiz va har bosqichda yoningizdamiz",
)

SERVICE_TEXTS = {
    "free-consultation": (
        "Talk to a MedMapp coordinator about your situation, options and next steps — at no cost.",
        "Обсудите с координатором MedMapp вашу ситуацию, варианты и следующие шаги — бесплатно.",
        "MedMapp koordinatori bilan vaziyatingiz, variantlar va keyingi qadamlarni bepul muhokama qiling.",
    ),
    "document-review": (
        "We organise your reports and scans and check what partner hospitals need for an assessment.",
        "Мы систематизируем ваши заключения и снимки и проверяем, что нужно клиникам для оценки.",
        "Xulosa va tasvirlaringizni tartibga solamiz va klinikalar baholashi uchun nima kerakligini tekshiramiz.",
    ),
    "second-opinion": (
        "Your case is reviewed by qualified specialists at partner hospitals who give a written opinion.",
        "Ваш случай изучают квалифицированные специалисты клиник-партнёров и дают письменное заключение.",
        "Holatingizni hamkor klinikalarning malakali mutaxassislari ko‘rib chiqib, yozma xulosa beradi.",
    ),
    "hospital-matching": (
        "We shortlist hospitals with relevant expertise, verified accreditation and published prices.",
        "Мы подбираем клиники с нужной экспертизой, подтверждённой аккредитацией и опубликованными ценами.",
        "Kerakli tajribaga, tasdiqlangan akkreditatsiyaga va e’lon qilingan narxlarga ega klinikalarni tanlaymiz.",
    ),
    "doctor-matching": (
        "Find specialists by experience, language and sub-specialty.",
        "Подбор специалистов по опыту, языку и узкой специализации.",
        "Mutaxassislarni tajriba, til va tor yo‘nalish bo‘yicha tanlash.",
    ),
    "treatment-coordination": (
        "One coordinator manages appointments, quotations and communication with the hospital.",
        "Один координатор ведёт записи, предложения и общение с клиникой.",
        "Bitta koordinator qabullar, takliflar va klinika bilan aloqani boshqaradi.",
    ),
    "visa-assistance": (
        "Hospital invitation letters and guidance through the medical visa process.",
        "Приглашения от клиник и помощь в оформлении медицинской визы.",
        "Klinika taklifnomalari va tibbiy viza olishda yordam.",
    ),
    "flight-assistance": (
        "Help choosing flights that fit the treatment schedule.",
        "Помощь в выборе рейсов под график лечения.",
        "Davolanish jadvaliga mos reyslarni tanlashda yordam.",
    ),
    "hotel-booking": (
        "Accommodation near the hospital for you and your companions.",
        "Проживание рядом с клиникой для вас и сопровождающих.",
        "Siz va hamrohlaringiz uchun klinika yaqinida turar joy.",
    ),
    "airport-transfer": (
        "Pickup on arrival and transfers between hotel and hospital.",
        "Встреча в аэропорту и трансферы между отелем и клиникой.",
        "Aeroportda kutib olish va mehmonxona bilan klinika orasida transfer.",
    ),
    "medical-interpreter": (
        "Interpreters in Uzbek and Russian during consultations and procedures.",
        "Переводчики на узбекский и русский во время консультаций и процедур.",
        "Konsultatsiya va muolajalar vaqtida o‘zbek va rus tilidagi tarjimonlar.",
    ),
    "patient-concierge": (
        "SIM card, local support and help with everyday needs during your stay.",
        "SIM-карта, местная поддержка и помощь в бытовых вопросах во время поездки.",
        "SIM-karta, joyida yordam va safar davomida kundalik masalalarda ko‘mak.",
    ),
    "follow-up": (
        "Online follow-up with your doctor and translated discharge documents after you return home.",
        "Онлайн-наблюдение у врача и переведённые выписки после возвращения домой.",
        "Uyga qaytganingizdan keyin shifokor bilan onlayn kuzatuv va tarjima qilingan ko‘chirmalar.",
    ),
}

SECTION_SUBTITLES = {
    "hero": (
        "Discover trusted hospitals, leading specialists and personalized treatment opportunities across the world with MedMapp.",
        "Надёжные клиники, ведущие специалисты и персональные варианты лечения по всему миру — вместе с MedMapp.",
        "MedMapp bilan dunyo bo‘ylab ishonchli klinikalar, yetakchi mutaxassislar va sizga mos davolanish imkoniyatlarini toping.",
    ),
    "why": (
        "One coordinator, verified partners and transparent information from first question to follow-up.",
        "Один координатор, проверенные партнёры и прозрачная информация — от первого вопроса до наблюдения после лечения.",
        "Bitta koordinator, tasdiqlangan hamkorlar va birinchi savoldan davolanishdan keyingi kuzatuvgacha shaffof ma’lumot.",
    ),
    "second_opinion": (
        "Upload your reports. Qualified specialists at partner hospitals review your case.",
        "Загрузите заключения. Квалифицированные специалисты клиник-партнёров изучат ваш случай.",
        "Xulosalaringizni yuklang. Hamkor klinikalarning malakali mutaxassislari holatingizni ko‘rib chiqadi.",
    ),
    "cta": (
        "Tell us what you need. A coordinator will contact you.",
        "Расскажите, что вам нужно. Координатор свяжется с вами.",
        "Nima kerakligini yozing. Koordinator siz bilan bog‘lanadi.",
    ),
}

WHY_ITEMS = (
    [
        {"icon": "shield-check", "title": "Verified partners", "text": "Hospital data and accreditations are checked before they are marked as verified."},
        {"icon": "user-round", "title": "One personal coordinator", "text": "One person follows your case from the first message to follow-up."},
        {"icon": "lock", "title": "Private medical records", "text": "Documents are stored privately and shared only with hospitals you approve."},
        {"icon": "receipt", "title": "Transparent quotations", "text": "Estimates and hospital-confirmed quotations are always clearly separated."},
    ],
    [
        {"icon": "shield-check", "title": "Проверенные партнёры", "text": "Данные клиник и аккредитации проверяются, прежде чем клиника получает отметку «проверено»."},
        {"icon": "user-round", "title": "Личный координатор", "text": "Один человек ведёт ваш случай от первого сообщения до наблюдения после лечения."},
        {"icon": "lock", "title": "Конфиденциальные документы", "text": "Документы хранятся закрыто и передаются только клиникам, которые вы одобрили."},
        {"icon": "receipt", "title": "Прозрачные предложения", "text": "Ориентировочные цены и цены, подтверждённые клиникой, всегда чётко разделены."},
    ],
    [
        {"icon": "shield-check", "title": "Tasdiqlangan hamkorlar", "text": "Klinika ma’lumotlari va akkreditatsiyalari tekshirilgandan keyingina «tasdiqlangan» belgisi beriladi."},
        {"icon": "user-round", "title": "Shaxsiy koordinator", "text": "Birinchi xabardan davolanishdan keyingi kuzatuvgacha holatingizni bitta mutaxassis olib boradi."},
        {"icon": "lock", "title": "Maxfiy tibbiy hujjatlar", "text": "Hujjatlar maxfiy saqlanadi va faqat siz rozilik bergan klinikalarga ko‘rsatiladi."},
        {"icon": "receipt", "title": "Shaffof takliflar", "text": "Taxminiy narxlar va klinika tasdiqlagan narxlar har doim aniq ajratib ko‘rsatiladi."},
    ],
)

ACCREDITATION_NAMES = {
    "JCI": ("Joint Commission International", "Joint Commission International (JCI)", "Joint Commission International (JCI)"),
    "NABH": ("National Accreditation Board for Hospitals & Healthcare Providers (India)",
             "Национальный совет по аккредитации больниц (Индия)", "Kasalxonalarni akkreditatsiya qilish milliy kengashi (Hindiston)"),
    "ISO 9001": ("ISO 9001 Quality Management", "Система менеджмента качества ISO 9001", "ISO 9001 sifat menejmenti tizimi"),
    "TEMOS": ("TEMOS International Quality in Medical Tourism", "TEMOS — международное качество в медицинском туризме",
              "TEMOS — tibbiy turizmda xalqaro sifat"),
    "KAHF": ("Korea Institute for Healthcare Accreditation", "Корейский институт аккредитации здравоохранения",
             "Koreya sog‘liqni saqlash akkreditatsiyasi instituti"),
    "DKG": ("German Cancer Society certification", "Сертификация Немецкого онкологического общества",
            "Germaniya onkologiya jamiyati sertifikati"),
}

LANGS = ("en", "ru", "uz")


def fill(obj, field, values, seed_en=None):
    """values: (en, ru, uz). Overwrite a language only if empty or still equal to the English seed."""
    en_seed = seed_en if seed_en is not None else values[0]
    changed = False
    for lang, val in zip(LANGS, values, strict=False):
        attr = f"{field}_{lang}"
        current = getattr(obj, attr)
        if not current or current == en_seed:
            if current != val:
                setattr(obj, attr, val)
                changed = True
    base = getattr(obj, f"{field}_uz") or getattr(obj, f"{field}_en")
    if getattr(obj, field) != base:
        setattr(obj, field, base)
        changed = True
    return changed
