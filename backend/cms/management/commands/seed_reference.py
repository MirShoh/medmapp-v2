"""Reference/structural data only — no hospitals, prices, reviews or statistics are invented.

Idempotent: safe to run on every deploy.
"""
import json
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Accreditation, MedicalService, Treatment
from cms.models import Page, PageSection
from core.models import Country, Specialty
from crm.models import LeadSource
from finance.models import Currency

from ._seed_texts import ACCREDITATION_NAMES, SECTION_SUBTITLES, SERVICE_TEXTS, fill
from ._seed_texts import STEPS as STEPS_3
from ._seed_texts import WHY_ITEMS as WHY_3

COUNTRIES = [  # slug, iso, flag, en, ru, uz, destination, source
    ("india", "IN", "🇮🇳", "India", "Индия", "Hindiston", True, False),
    ("turkey", "TR", "🇹🇷", "Turkey", "Турция", "Turkiya", True, False),
    ("china", "CN", "🇨🇳", "China", "Китай", "Xitoy", True, False),
    ("germany", "DE", "🇩🇪", "Germany", "Германия", "Germaniya", True, False),
    ("south-korea", "KR", "🇰🇷", "South Korea", "Южная Корея", "Janubiy Koreya", True, False),
    ("uae", "AE", "🇦🇪", "UAE", "ОАЭ", "BAA", True, False),
    ("thailand", "TH", "🇹🇭", "Thailand", "Таиланд", "Tailand", True, False),
    ("azerbaijan", "AZ", "🇦🇿", "Azerbaijan", "Азербайджан", "Ozarbayjon", True, True),
    # Uzbekistan is both: patients from Uzbekistan go abroad, and international patients come here for treatment.
    ("uzbekistan", "UZ", "🇺🇿", "Uzbekistan", "Узбекистан", "O‘zbekiston", True, True),
    ("kazakhstan", "KZ", "🇰🇿", "Kazakhstan", "Казахстан", "Qozog‘iston", False, True),
    ("tajikistan", "TJ", "🇹🇯", "Tajikistan", "Таджикистан", "Tojikiston", False, True),
    ("kyrgyzstan", "KG", "🇰🇬", "Kyrgyzstan", "Кыргызстан", "Qirg‘iziston", False, True),
    ("turkmenistan", "TM", "🇹🇲", "Turkmenistan", "Туркменистан", "Turkmaniston", False, True),
]
CURRENCY = {"IN": "INR", "TR": "TRY", "CN": "CNY", "DE": "EUR", "KR": "KRW", "AE": "AED", "TH": "THB", "UZ": "UZS",
            "KZ": "KZT", "AZ": "AZN"}

SPECIALTIES = [  # slug, icon, en, ru, uz
    ("oncology", "ribbon", "Oncology", "Онкология", "Onkologiya"),
    ("cardiology", "heart-pulse", "Cardiology", "Кардиология", "Kardiologiya"),
    ("neurosurgery", "brain", "Neurosurgery", "Нейрохирургия", "Neyroxirurgiya"),
    ("orthopedics", "bone", "Orthopedics", "Ортопедия", "Ortopediya"),
    ("spine-surgery", "activity", "Spine Surgery", "Хирургия позвоночника", "Umurtqa jarrohligi"),
    ("transplantation", "repeat", "Organ Transplantation", "Трансплантация органов", "A’zo transplantatsiyasi"),
    ("ivf", "baby", "IVF & Fertility", "ЭКО", "EKO (IVF)"),
    ("gynecology", "flower-2", "Gynecology", "Гинекология", "Ginekologiya"),
    ("bariatric-surgery", "scale", "Bariatric Surgery", "Бариатрическая хирургия", "Bariatrik jarrohlik"),
    ("cosmetic-surgery", "sparkles", "Cosmetic Surgery", "Пластическая хирургия", "Plastik jarrohlik"),
    ("hair-transplant", "scissors", "Hair Transplant", "Пересадка волос", "Soch ko‘chirish"),
    ("dentistry", "smile", "Dentistry", "Стоматология", "Stomatologiya"),
    ("diagnostics", "scan-line", "Diagnostics & Check-up", "Диагностика", "Diagnostika"),
    ("pediatrics", "baby", "Pediatrics", "Педиатрия", "Pediatriya"),
]

TREATMENTS = [  # slug, specialty, advanced, en, ru, uz
    ("robotic-surgery", "oncology", True, "Robotic Surgery", "Роботизированная хирургия", "Robotlashtirilgan jarrohlik"),
    ("advanced-cancer-treatment", "oncology", True, "Advanced Cancer Treatment", "Передовое лечение рака", "Saratonni zamonaviy davolash"),
    ("radiation-oncology", "oncology", True, "Radiation Oncology", "Лучевая терапия", "Nur terapiyasi"),
    ("bone-marrow-transplant", "transplantation", True, "Bone Marrow Transplant", "Трансплантация костного мозга", "Suyak iligi transplantatsiyasi"),
    ("brain-surgery", "neurosurgery", True, "Brain Surgery", "Операции на головном мозге", "Bosh miya jarrohligi"),
    ("cardiovascular-surgery", "cardiology", True, "Cardiovascular Surgery", "Сердечно-сосудистая хирургия", "Yurak-qon tomir jarrohligi"),
    ("cabg", "cardiology", False, "Coronary Bypass (CABG)", "Аортокоронарное шунтирование", "Koronar shuntlash"),
    ("heart-valve-replacement", "cardiology", False, "Heart Valve Replacement", "Замена сердечного клапана", "Yurak klapanini almashtirish"),
    ("joint-replacement", "orthopedics", True, "Joint Replacement", "Эндопротезирование суставов", "Bo‘g‘imni almashtirish"),
    ("knee-replacement", "orthopedics", False, "Knee Replacement", "Замена коленного сустава", "Tizza bo‘g‘imini almashtirish"),
    ("hip-replacement", "orthopedics", False, "Hip Replacement", "Замена тазобедренного сустава", "Son bo‘g‘imini almashtirish"),
    ("spinal-fusion", "spine-surgery", False, "Spinal Fusion", "Спондилодез", "Umurtqa fiksatsiyasi"),
    ("kidney-transplant", "transplantation", False, "Kidney Transplant", "Трансплантация почки", "Buyrak transplantatsiyasi"),
    ("liver-transplant", "transplantation", False, "Liver Transplant", "Трансплантация печени", "Jigar transplantatsiyasi"),
    ("ivf-cycle", "ivf", False, "IVF Cycle", "Цикл ЭКО", "EKO sikli"),
    ("hysterectomy", "gynecology", False, "Hysterectomy", "Гистерэктомия", "Gisterektomiya"),
    ("gastric-sleeve", "bariatric-surgery", False, "Gastric Sleeve", "Рукавная гастрэктомия", "Oshqozonni qisqartirish"),
    ("rhinoplasty", "cosmetic-surgery", False, "Rhinoplasty", "Ринопластика", "Rinoplastika"),
    ("fue-hair-transplant", "hair-transplant", False, "FUE Hair Transplant", "Пересадка волос FUE", "FUE soch ko‘chirish"),
    ("dental-implants", "dentistry", False, "Dental Implants", "Зубные импланты", "Tish implantlari"),
    ("full-body-checkup", "diagnostics", False, "Full Body Check-up", "Полный чек-ап", "To‘liq tibbiy ko‘rik"),
    ("pediatric-cardiac-surgery", "pediatrics", False, "Pediatric Cardiac Surgery", "Детская кардиохирургия", "Bolalar kardiojarrohligi"),
]

SERVICES = [  # slug, icon, free, en, ru, uz, en_desc
    ("free-consultation", "message-circle", True, "Free Initial Consultation", "Бесплатная консультация", "Bepul konsultatsiya",
     "Talk to a MedMapp coordinator about your situation, options and next steps — at no cost."),
    ("document-review", "file-search", True, "Medical Document Review", "Изучение медицинских документов", "Tibbiy hujjatlarni ko‘rib chiqish",
     "We organise your reports and scans and check what partner hospitals need for an assessment."),
    ("second-opinion", "stethoscope", False, "Second Medical Opinion", "Второе мнение", "Ikkinchi tibbiy fikr",
     "Your case is reviewed by qualified specialists at partner hospitals who give a written opinion."),
    ("hospital-matching", "building-2", True, "Hospital Matching", "Подбор клиники", "Klinika tanlash",
     "We shortlist hospitals with relevant expertise, verified accreditation and published prices."),
    ("doctor-matching", "user-round-check", True, "Doctor Matching", "Подбор врача", "Shifokor tanlash",
     "Find specialists by experience, language and sub-specialty."),
    ("treatment-coordination", "route", False, "Treatment Coordination", "Координация лечения", "Davolanishni muvofiqlashtirish",
     "One coordinator manages appointments, quotations and communication with the hospital."),
    ("visa-assistance", "stamp", False, "Visa Assistance", "Визовая поддержка", "Viza yordami",
     "Hospital invitation letters and guidance through the medical visa process."),
    ("flight-assistance", "plane", False, "Flight Assistance", "Помощь с авиабилетами", "Aviachipta yordami",
     "Help choosing flights that fit the treatment schedule."),
    ("hotel-booking", "hotel", False, "Hotel Booking Assistance", "Бронирование гостиницы", "Mehmonxona bron qilish",
     "Accommodation near the hospital for you and your companions."),
    ("airport-transfer", "car", False, "Airport Transfer", "Трансфер из аэропорта", "Aeroport transferi",
     "Pickup on arrival and transfers between hotel and hospital."),
    ("medical-interpreter", "languages", False, "Medical Interpreter", "Медицинский переводчик", "Tibbiy tarjimon",
     "Interpreters in Uzbek and Russian during consultations and procedures."),
    ("patient-concierge", "concierge-bell", False, "Patient Concierge", "Консьерж-сервис", "Konsyerj xizmati",
     "SIM card, local support and help with everyday needs during your stay."),
    ("follow-up", "calendar-check", True, "Post-Treatment Follow-up", "Наблюдение после лечения", "Davolanishdan keyingi kuzatuv",
     "Online follow-up with your doctor and translated discharge documents after you return home."),
]

STEPS = "Contact MedMapp\nCoordinator reviews your request\nDocuments shared with partner hospitals (with your consent)\nYou receive options and quotations\nWe arrange travel and support you throughout"

ACCREDITATIONS = [
    ("JCI", "Joint Commission International", "https://www.jointcommissioninternational.org/"),
    ("NABH", "National Accreditation Board for Hospitals & Healthcare Providers (India)", "https://nabh.co/"),
    ("ISO 9001", "ISO 9001 Quality Management", "https://www.iso.org/"),
    ("TEMOS", "TEMOS International Quality in Medical Tourism", "https://www.temos-worldwide.com/"),
    ("KAHF", "Korea Institute for Healthcare Accreditation", "https://www.koiha.or.kr/"),
    ("DKG", "German Cancer Society certification", "https://www.krebsgesellschaft.de/"),
]

HOME_SECTIONS = [  # key, en title, ru title, uz title, en subtitle
    ("hero", "World-Class Healthcare, Within Your Reach.", "Медицина мирового уровня — ближе, чем кажется.",
     "Jahon darajasidagi tibbiyot — sizga yaqin.",
     "Discover trusted hospitals, leading specialists and personalized treatment opportunities across the world with MedMapp."),
    ("why", "Why MedMapp", "Почему MedMapp", "Nega MedMapp",
     "One coordinator, verified partners and transparent information from first question to follow-up."),
    ("treatments", "Popular treatments", "Популярные направления", "Ommabop yo‘nalishlar", ""),
    ("destinations", "Treatment destinations", "Страны лечения", "Davolanish mamlakatlari", ""),
    ("hospitals", "Featured hospitals", "Избранные клиники", "Tanlangan klinikalar", ""),
    ("doctors", "Leading specialists", "Ведущие специалисты", "Yetakchi mutaxassislar", ""),
    ("packages", "Treatment packages", "Пакеты лечения", "Davolanish paketlari", ""),
    ("how", "How MedMapp works", "Как работает MedMapp", "MedMapp qanday ishlaydi", ""),
    ("second_opinion", "Get a second medical opinion", "Получите второе мнение", "Ikkinchi tibbiy fikr oling",
     "Upload your reports. Qualified specialists at partner hospitals review your case."),
    ("services", "Patient support services", "Сервис для пациентов", "Bemorlar uchun xizmatlar", ""),
    ("partners", "Partner hospitals", "Клиники-партнёры", "Hamkor klinikalar", ""),
    ("testimonials", "Patient stories", "Истории пациентов", "Bemorlar hikoyalari", ""),
    ("stats", "MedMapp in numbers", "MedMapp в цифрах", "MedMapp raqamlarda", ""),
    ("blog", "Guides & articles", "Статьи и гайды", "Maqolalar", ""),
    ("faq", "Frequently asked questions", "Частые вопросы", "Ko‘p so‘raladigan savollar", ""),
    ("cta", "Start with a free consultation", "Начните с бесплатной консультации", "Bepul konsultatsiyadan boshlang",
     "Tell us what you need. A coordinator will contact you."),
]

WHY_ITEMS = [
    {"icon": "shield-check", "title": "Verified partners", "text": "Hospital data and accreditations are checked before they are marked as verified."},
    {"icon": "user-round", "title": "One personal coordinator", "text": "One person follows your case from the first message to follow-up."},
    {"icon": "lock", "title": "Private medical records", "text": "Documents are stored privately and shared only with hospitals you approve."},
    {"icon": "receipt", "title": "Transparent quotations", "text": "Estimates and hospital-confirmed quotations are always clearly separated."},
]

GATEWAYS = [
    ("uzbekistan-gateway", "Uzbekistan Patient Gateway", "Шлюз для пациентов из Узбекистана", "O‘zbekiston bemorlari uchun"),
    ("central-asia-gateway", "Central Asia Patient Gateway", "Шлюз для пациентов Центральной Азии", "Markaziy Osiyo bemorlari uchun"),
    ("international-gateway", "International Patient Gateway", "Международные пациенты", "Xalqaro bemorlar"),
]


def tr(obj, field, en, ru, uz):
    setattr(obj, f"{field}_en", en)
    setattr(obj, f"{field}_ru", ru)
    setattr(obj, f"{field}_uz", uz)
    setattr(obj, field, uz)


PHOTO_DIR = Path(__file__).resolve().parents[2] / "seed_media" / "countries"


def attach_country_photo(c):
    """Freely licensed destination photo (Wikimedia Commons, credited). Never replaces an image staff uploaded."""
    src = PHOTO_DIR / f"{c.slug}.webp"
    if not src.exists():
        return
    credits = json.loads((PHOTO_DIR / "credits.json").read_text(encoding="utf-8"))
    meta = credits.get(c.slug, {})
    seeded_before = c.hero_image_source.startswith("https://commons.wikimedia.org/")
    if c.hero_image and (not seeded_before or c.hero_image_source == meta.get("source")):
        return  # staff upload, or the current seeded photo
    if c.hero_image:
        c.hero_image.delete(save=False)  # replacing our own earlier seeded photo
    with src.open("rb") as f:
        c.hero_image.save(f"{c.slug}.webp", File(f), save=False)
    c.hero_image_credit = meta.get("credit", "")[:255]
    c.hero_image_source = meta.get("source", "")


LEGAL_TITLES = {  # slug: (en, ru) - the Uzbek title comes from the document itself
    "privacy-policy": ("Privacy policy", "Политика конфиденциальности"),
    "terms-of-use": ("User agreement", "Пользовательское соглашение"),
    "public-offer": ("Public offer", "Публичная оферта"),
}
LEGAL_NOTE = ("The official text of this document is published in Uzbek.",
              "Официальный текст документа опубликован на узбекском языке.", "«MEDMAPP» MCHJ rasmiy hujjati.")


# Official MedMapp contacts as published on medmapp.uz (footer, 2026-11-23). Filled only where empty.
CONTACTS = {"phone_number": "+998 77 535 66 55", "email": "info@medmapp.uz", "address": "Sirdaryo viloyati, O‘zbekiston",
            "facebook_url": "https://www.facebook.com/medmapp_uz", "instagram_url": "https://www.instagram.com/medmapp_uz",
            "telegram_url": "https://t.me/medmapp_uz", "youtube_url": "https://www.youtube.com/medmapp_uz"}


def seed_contacts():
    from core.models import SiteSettings
    s = SiteSettings.get_solo()
    for field, value in CONTACTS.items():
        if not getattr(s, field, ""):
            setattr(s, field, value)
    if not s.hero_title:
        s.hero_title = "MedMapp"
    s.save()


def seed_legal_pages():
    """MedMapp's own legal documents (from medmapp.uz). Only fills empty pages, so staff edits are kept."""
    docs = json.loads((Path(__file__).resolve().parents[2] / "seed_media" / "legal" / "legal_uz.json").read_text(encoding="utf-8"))
    for slug, doc in docs.items():
        p, _ = Page.objects.get_or_create(slug=slug, defaults={"kind": "legal"})
        p.kind = "legal"
        if not p.subtitle_uz:
            p.subtitle_uz = LEGAL_NOTE[2]
        if not p.body_uz:
            en, ru = LEGAL_TITLES[slug]
            title_uz = doc["title"][:1] + doc["title"][1:].lower() if doc["title"].isupper() else doc["title"]
            p.title_uz, p.title_en, p.title_ru, p.title = title_uz, en, ru, title_uz
            p.body_uz = p.body = doc["body"]
            p.subtitle_en, p.subtitle_ru = LEGAL_NOTE[0], LEGAL_NOTE[1]
        p.save()


class Command(BaseCommand):
    help = "Seed MedMapp reference data (idempotent, no fabricated business data)."

    @transaction.atomic
    def handle(self, *args, **opts):
        for i, (slug, iso, flag, en, ru, uz, dest, src) in enumerate(COUNTRIES):
            c = Country.objects.filter(slug=slug).first() or Country.objects.filter(name__in=[en, ru, uz]).first() or Country(slug=slug)
            c.slug, c.iso_code, c.flag, c.is_destination, c.is_source_market = slug, iso, flag, dest, src
            c.currency_code = CURRENCY.get(iso, c.currency_code)
            c.order = i
            tr(c, "name", en, ru, uz)
            attach_country_photo(c)
            c.save()
        for i, (slug, icon, en, ru, uz) in enumerate(SPECIALTIES):
            s = Specialty.objects.filter(slug=slug).first() or Specialty.objects.filter(title=uz).first() or Specialty(slug=slug)
            s.slug, s.icon, s.order = slug, icon, i
            tr(s, "title", en, ru, uz)
            s.save()
        for i, (slug, spec, adv, en, ru, uz) in enumerate(TREATMENTS):
            t = Treatment.objects.filter(slug=slug).first() or Treatment(slug=slug)
            t.specialty = Specialty.objects.get(slug=spec)
            t.is_advanced, t.order = adv, i
            t.is_featured = t.is_featured or i < 8 and not adv
            tr(t, "name", en, ru, uz)
            t.save()
        for i, (slug, icon, free, en, ru, uz, _desc) in enumerate(SERVICES):
            s = MedicalService.objects.filter(slug=slug).first() or MedicalService(slug=slug)
            s.icon, s.is_free, s.order = icon, free, i
            tr(s, "title", en, ru, uz)
            fill(s, "short_description", SERVICE_TEXTS[slug])
            fill(s, "process_steps", STEPS_3)
            s.save()
        for code, name, url in ACCREDITATIONS:
            a, _ = Accreditation.objects.get_or_create(code=code, defaults={"name": name, "verify_url": url})
            if not a.verify_url:
                a.verify_url = url
            fill(a, "name", ACCREDITATION_NAMES[code])
            a.save()
        for i, (key, en, ru, uz, _sub) in enumerate(HOME_SECTIONS):
            sec, created = PageSection.objects.get_or_create(page="home", key=key, defaults={"order": i})
            # Translations are filled on every run, but only where empty or still the original English seed.
            if key in SECTION_SUBTITLES:
                fill(sec, "subtitle", SECTION_SUBTITLES[key])
            if key == "why":
                for lang, items in zip(("en", "ru", "uz"), WHY_3, strict=False):
                    cur = getattr(sec, f"items_{lang}")
                    if not cur or cur == WHY_3[0]:
                        setattr(sec, f"items_{lang}", items)
                sec.items = sec.items_uz
            if not created:
                sec.save()
            if created:
                tr(sec, "title", en, ru, uz)
                if key == "hero":
                    sec.cta_label_en, sec.cta_label_ru, sec.cta_label_uz = "Get free consultation", "Бесплатная консультация", "Bepul konsultatsiya"
                    sec.cta_label = sec.cta_label_uz
                    sec.cta_url = "/contact"
                sec.save()
        seed_legal_pages()
        seed_contacts()
        for slug, en, ru, uz in GATEWAYS:
            p, created = Page.objects.get_or_create(slug=slug, defaults={"kind": "gateway"})
            if created:
                tr(p, "title", en, ru, uz)
                p.save()
        for code, name in (("website", "Website"), ("second_opinion", "Second opinion form"), ("patient_portal", "Patient portal"),
                           ("manual", "Manual entry"), ("telegram", "Telegram"), ("instagram", "Instagram"),
                           ("phone", "Phone call"), ("referral", "Referral"), ("assistant", "AI assistant"),
                           ("legacy_form", "Legacy site form")):
            LeadSource.objects.get_or_create(code=code, defaults={"name": name})
        for code, name, sym in (("USD", "US Dollar", "$"), ("UZS", "Uzbek Som", "so‘m"), ("EUR", "Euro", "€"),
                                ("INR", "Indian Rupee", "₹"), ("TRY", "Turkish Lira", "₺"), ("CNY", "Chinese Yuan", "¥")):
            Currency.objects.get_or_create(code=code, defaults={"name": name, "symbol": sym})
        self.stdout.write(self.style.SUCCESS("Reference data seeded."))
