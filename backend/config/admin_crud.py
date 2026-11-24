"""Admin CRUD resources for catalog, CMS and reference data (staff only, permission-checked, audited)."""
from django.db.models import Q
from rest_framework import serializers

from audit.models import AuditLog
from blog.models import BlogCategory, Post
from catalog.models import FAQ, Accreditation, MedicalService, Review, Testimonial, Treatment, TreatmentPackage, TreatmentPrice
from clinics.models import Hospital, HospitalGalleryImage
from cms.models import Banner, NavItem, Page, PageSection
from core.models import City, Country, SiteSettings, Specialty
from crm.models import LeadSource
from doctors.models import Doctor

from .crud import crud, model_serializer

LANGS = ("uz", "ru", "en")


def missing_langs(obj, *fields):
    """Languages in which any of the given translated fields is still empty."""
    return [lang for lang in LANGS if any(not getattr(obj, f"{f}_{lang}", "") for f in fields)]


def missing_tr_filter(*fields):
    """?missing_tr=ru → rows where any of the fields is empty in Russian (or "any" language)."""
    def apply(qs, lang):
        langs = LANGS if lang == "any" else (lang,) if lang in LANGS else ()
        cond = Q()
        for lg in langs:
            for f in fields:
                cond |= Q(**{f"{f}_{lg}": ""}) | Q(**{f"{f}_{lg}__isnull": True})
        return qs.filter(cond) if langs else qs
    return apply


def has_file_filter(field):
    def apply(qs, value):
        empty = Q(**{field: ""}) | Q(**{f"{field}__isnull": True})
        return qs.exclude(empty) if value == "true" else qs.filter(empty)
    return apply


HospitalSerializer = model_serializer(Hospital, extra={
    "city_name": serializers.CharField(source="city.name", read_only=True),
    "country_name": serializers.CharField(source="city.country.name", read_only=True),
    "country_flag": serializers.CharField(source="city.country.flag", read_only=True),
    "missing_tr": serializers.SerializerMethodField(),
    "get_missing_tr": lambda self, o: missing_langs(o, "name", "short_description", "description")})
DoctorSerializer = model_serializer(Doctor, extra={
    "missing_tr": serializers.SerializerMethodField(),
    "get_missing_tr": lambda self, o: missing_langs(o, "full_name", "specialty_title", "biography"),
    "hospital_names": serializers.SerializerMethodField(),
    "get_hospital_names": lambda self, o: ", ".join(h.name for h in o.hospitals.all()[:2])})
TreatmentSerializer = model_serializer(Treatment, extra={
    "specialty_name": serializers.CharField(source="specialty.title", read_only=True)})
PackageSerializer = model_serializer(TreatmentPackage, extra={
    "hospital_name": serializers.CharField(source="hospital.name", read_only=True),
    "treatment_name": serializers.CharField(source="treatment.name", read_only=True)})
PriceSerializer = model_serializer(TreatmentPrice, extra={
    "treatment_name": serializers.CharField(source="treatment.name", read_only=True),
    "country_name": serializers.CharField(source="country.name", read_only=True)})
CitySerializer = model_serializer(City, extra={"country_name": serializers.CharField(source="country.name", read_only=True)})


class AuditSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = "__all__"

    def get_actor_name(self, o):
        return (o.actor.get_full_name() or o.actor.username) if o.actor else "system"


RESOURCES = {
    "countries": crud(Country, search=("name",), filters=("is_destination", "is_active"), ordering=("order", "name")),
    "cities": crud(City, search=("name",), filters=("country",), serializer=CitySerializer,
                   queryset=City.objects.select_related("country")),
    "specialties": crud(Specialty, search=("title",), filters=("is_active",)),
    "accreditations": crud(Accreditation, search=("code", "name")),
    "treatments": crud(Treatment, search=("name",), filters=("specialty", "is_active", "is_advanced", "is_featured"),
                       serializer=TreatmentSerializer, queryset=Treatment.objects.select_related("specialty")),
    "treatment-prices": crud(TreatmentPrice, search=("treatment__name", "source"), filters=("treatment", "country", "hospital", "currency"), serializer=PriceSerializer,
                             queryset=TreatmentPrice.objects.select_related("treatment", "country")),
    "hospitals": crud(Hospital, search=("name", "name_uz", "name_ru", "name_en", "city__name"),
                      filters=("city", "city__country", "is_active", "is_verified", "is_popular", "hospital_type"),
                      serializer=HospitalSerializer, queryset=Hospital.objects.select_related("city__country").order_by("name"),
                      bulk=("is_verified", "is_active", "is_popular"),
                      extra_filters={"has_image": has_file_filter("image"),
                                     "missing_tr": missing_tr_filter("name", "short_description", "description")}),
    "hospital-gallery": crud(HospitalGalleryImage, filters=("hospital",)),
    "doctors": crud(Doctor, search=("full_name", "specialty_title"), filters=("specialty", "is_active", "is_popular",
                                                                             "hospitals", "hospitals__city__country"),
                    serializer=DoctorSerializer, queryset=Doctor.objects.prefetch_related("hospitals").order_by("full_name").distinct(),
                    bulk=("is_active", "is_popular"),
                    extra_filters={"has_photo": has_file_filter("photo"),
                                   "missing_tr": missing_tr_filter("full_name", "specialty_title", "biography")}),
    "packages": crud(TreatmentPackage, search=("name", "hospital__name"), filters=("hospital", "treatment", "is_active",
                                                                                   "price_type"),
                     serializer=PackageSerializer, queryset=TreatmentPackage.objects.select_related("hospital", "treatment")),
    "services": crud(MedicalService, read="catalog.view", write="cms.edit", search=("title",)),
    "faqs": crud(FAQ, read="catalog.view", write="cms.edit", search=("question",), filters=("scope", "treatment",
                                                                                          "country", "service")),
    "reviews": crud(Review, read="catalog.view", write="cms.edit", filters=("hospital", "doctor", "is_published")),
    "testimonials": crud(Testimonial, read="catalog.view", write="cms.edit", search=("patient_name",),
                         filters=("is_featured",)),
    "sections": crud(PageSection, read="cms.edit", write="cms.edit", filters=("is_enabled",),
                     # "page" is the pagination parameter, so the section page filter has its own name
                     extra_filters={"section_page": lambda qs, v: qs.filter(page=v)}),
    "pages": crud(Page, read="cms.edit", write="cms.edit", search=("title", "slug"), filters=("kind", "is_published")),
    "nav": crud(NavItem, read="cms.edit", write="cms.edit", filters=("location",)),
    "banners": crud(Banner, read="cms.edit", write="cms.edit"),
    "blog-posts": crud(Post, read="blog.edit", write="blog.edit", search=("title",), filters=("status", "category")),
    "blog-categories": crud(BlogCategory, read="blog.edit", write="blog.edit"),
    "lead-sources": crud(LeadSource, read="crm.view", write="settings.edit"),
    "site-settings": crud(SiteSettings, read="cms.edit", write="cms.edit"),
}

_audit_vs = crud(AuditLog, read="audit.view", write="__never__", serializer=AuditSerializer,
                 search=("summary", "action", "object_id"), filters=("action", "object_type", "actor"),
                 queryset=AuditLog.objects.select_related("actor"))
_audit_vs.http_method_names = ["get"]
RESOURCES["audit-logs"] = _audit_vs
