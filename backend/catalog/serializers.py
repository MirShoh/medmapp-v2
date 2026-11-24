from rest_framework import serializers

from blog.models import Post
from catalog.models import Testimonial
from clinics.models import Hospital, HospitalGalleryImage
from config.html import SanitizeHTMLMixin
from core.models import City, Country, Specialty
from doctors.models import Doctor

from .models import FAQ, Accreditation, MedicalService, Review, Treatment, TreatmentPackage, TreatmentPrice


def lines(text):
    return [x.strip(" -•\t") for x in (text or "").splitlines() if x.strip(" -•\t")]


def csv(text):
    return [x.strip() for x in (text or "").split(",") if x.strip()]


class CountryMini(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ("id", "name", "slug", "flag", "iso_code")


class CityMini(serializers.ModelSerializer):
    country = CountryMini(read_only=True)

    class Meta:
        model = City
        fields = ("id", "name", "country")


class SpecialtyMini(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ("id", "title", "slug", "icon")


class SpecialtySerializer(serializers.ModelSerializer):
    treatments_count = serializers.IntegerField(read_only=True, default=0)
    hospitals_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Specialty
        fields = ("id", "title", "slug", "description", "icon", "icon_svg", "image", "order",
                  "treatments_count", "hospitals_count")


class AccreditationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Accreditation
        fields = ("id", "code", "name", "description", "verify_url", "logo")


class TreatmentMini(serializers.ModelSerializer):
    specialty = SpecialtyMini(read_only=True)

    class Meta:
        model = Treatment
        fields = ("id", "name", "slug", "short_description", "is_advanced", "specialty", "image")


class TreatmentPriceSerializer(serializers.ModelSerializer):
    country = CountryMini(read_only=True)
    hospital_name = serializers.CharField(source="hospital.name", default=None, read_only=True)
    treatment_name = serializers.CharField(source="treatment.name", read_only=True)
    treatment_slug = serializers.CharField(source="treatment.slug", read_only=True)

    class Meta:
        model = TreatmentPrice
        fields = ("id", "treatment_name", "treatment_slug", "country", "hospital", "hospital_name", "price_from",
                  "price_to", "currency", "source", "updated_on")


class TreatmentListSerializer(TreatmentMini):
    price_from_usd = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=None)
    hospitals_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(TreatmentMini.Meta):
        fields = TreatmentMini.Meta.fields + ("duration_days", "is_featured", "price_from_usd", "hospitals_count")


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ("id", "scope", "question", "answer")


class HospitalCard(serializers.ModelSerializer):
    city = CityMini(read_only=True)
    specialties = SpecialtyMini(many=True, read_only=True)
    accreditations = serializers.SlugRelatedField(many=True, read_only=True, slug_field="code")
    min_price_usd = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=None)
    rating = serializers.FloatField(read_only=True, default=None)
    reviews_count = serializers.IntegerField(read_only=True, default=0)
    doctors_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Hospital
        fields = ("id", "name", "slug", "image", "logo", "short_description", "hospital_type", "city",
                  "specialties", "accreditations", "is_popular", "is_verified", "founded_year", "bed_count",
                  "min_price_usd", "rating", "reviews_count", "doctors_count", "languages", "image_credit")


class GallerySerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalGalleryImage
        fields = ("id", "image")


class DoctorCard(serializers.ModelSerializer):
    hospitals = serializers.SerializerMethodField()
    specialty = SpecialtyMini(read_only=True)
    languages_list = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = ("id", "full_name", "slug", "photo", "specialty", "specialty_title", "position",
                  "experience_years", "is_popular", "hospitals", "languages_list")

    def get_hospitals(self, obj):
        return [{"id": h.id, "name": h.name, "slug": h.slug,
                 "country": h.city.country.name if h.city_id else None,
                 "city": h.city.name if h.city_id else None} for h in obj.hospitals.all()]

    def get_languages_list(self, obj):
        return csv(obj.languages)


class DoctorDetail(SanitizeHTMLMixin, DoctorCard):
    html_fields = ("biography",)
    education_list = serializers.SerializerMethodField()
    qualifications_list = serializers.SerializerMethodField()
    expertise_list = serializers.SerializerMethodField()
    treatments = TreatmentMini(many=True, read_only=True)

    class Meta(DoctorCard.Meta):
        fields = DoctorCard.Meta.fields + ("biography", "education_list", "qualifications_list", "expertise_list",
                                           "surgeries_count", "treatments", "meta_title", "meta_description")

    def get_education_list(self, o):
        return lines(o.education)

    def get_qualifications_list(self, o):
        return lines(o.qualifications)

    def get_expertise_list(self, o):
        return lines(o.expertise)


class PackageCard(serializers.ModelSerializer):
    hospital = serializers.SerializerMethodField()
    treatment = TreatmentMini(read_only=True)
    included = serializers.SerializerMethodField()

    class Meta:
        model = TreatmentPackage
        fields = ("id", "name", "slug", "hospital", "treatment", "price", "currency", "price_type",
                  "duration_days", "hospital_stay_days", "included", "valid_until", "is_featured")

    def get_hospital(self, o):
        h = o.hospital
        return {"id": h.id, "name": h.name, "slug": h.slug, "is_verified": h.is_verified,
                "city": h.city.name if h.city_id else None,
                "country": CountryMini(h.city.country).data if h.city_id else None}

    def get_included(self, o):
        return lines(o.included_services)


class PackageDetail(SanitizeHTMLMixin, PackageCard):
    html_fields = ("description", "accommodation", "transfer", "additional_expenses_note")
    excluded = serializers.SerializerMethodField()
    additional = serializers.SerializerMethodField()

    class Meta(PackageCard.Meta):
        fields = PackageCard.Meta.fields + ("description", "excluded", "accommodation", "transfer", "additional",
                                            "additional_expenses_note", "meta_title", "meta_description")

    def get_excluded(self, o):
        return lines(o.excluded_services)

    def get_additional(self, o):
        return lines(o.additional_services)


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ("id", "author_name", "rating", "text", "is_verified", "created_at")


class HospitalDetail(SanitizeHTMLMixin, HospitalCard):
    html_fields = ("description", "infrastructure_details", "guest_house_details")
    gallery = GallerySerializer(many=True, read_only=True)
    accreditations_full = AccreditationSerializer(source="accreditations", many=True, read_only=True)
    treatments = TreatmentMini(many=True, read_only=True)
    facilities_list = serializers.SerializerMethodField()
    equipment_list = serializers.SerializerMethodField()
    services_list = serializers.SerializerMethodField()
    languages_list = serializers.SerializerMethodField()
    doctors = serializers.SerializerMethodField()
    packages = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    prices = serializers.SerializerMethodField()

    class Meta(HospitalCard.Meta):
        fields = HospitalCard.Meta.fields + (
            "hero_image", "description", "address", "latitude", "longitude", "website", "phone", "email",
            "icu_bed_count", "operating_rooms_count", "infrastructure_details", "guest_house_details",
            "gallery", "accreditations_full", "treatments", "facilities_list", "equipment_list", "services_list",
            "languages_list", "doctors", "packages", "reviews", "prices", "meta_title", "meta_description", "image_source")

    def get_facilities_list(self, o):
        return lines(o.facilities)

    def get_equipment_list(self, o):
        return lines(o.equipment)

    def get_services_list(self, o):
        return lines(o.services_available)

    def get_languages_list(self, o):
        return csv(o.languages)

    def get_doctors(self, o):
        qs = o.doctors.filter(is_active=True).select_related("specialty").prefetch_related("hospitals__city__country")
        return DoctorCard(qs, many=True, context=self.context).data

    def get_packages(self, o):
        qs = o.packages.filter(is_active=True).select_related("treatment__specialty", "hospital__city__country")
        return PackageCard(qs, many=True, context=self.context).data

    def get_reviews(self, o):
        return ReviewSerializer(o.reviews.filter(is_published=True)[:20], many=True).data

    def get_prices(self, o):
        legacy = [{"category": str(p.category), "procedure_name": p.procedure_name, "price": p.price,
                   "currency": "USD"} for p in o.prices.select_related("category").all()]
        published = TreatmentPriceSerializer(o.treatment_prices.select_related("treatment", "country"), many=True).data
        return {"legacy": legacy, "published": published}


class CountryCard(serializers.ModelSerializer):
    hospitals_count = serializers.IntegerField(read_only=True, default=0)
    doctors_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Country
        fields = ("id", "name", "slug", "flag", "iso_code", "tagline", "hero_image", "hero_image_credit", "hero_image_source", "is_destination",
                  "hospitals_count", "doctors_count", "languages")


class CountryDetail(SanitizeHTMLMixin, CountryCard):
    html_fields = ("intro", "medical_overview", "travel_info", "visa_info", "accommodation_info", "patient_journey")
    class Meta(CountryCard.Meta):
        fields = CountryCard.Meta.fields + (
            "intro", "medical_overview", "travel_info", "visa_info", "visa_info_source", "visa_info_updated",
            "accommodation_info", "patient_journey", "currency_code", "meta_title", "meta_description")


class ServiceSerializer(SanitizeHTMLMixin, serializers.ModelSerializer):
    html_fields = ("description",)
    steps = serializers.SerializerMethodField()

    class Meta:
        model = MedicalService
        fields = ("id", "slug", "title", "icon", "short_description", "description", "steps", "is_free",
                  "meta_title", "meta_description")

    def get_steps(self, o):
        return lines(o.process_steps)


class TestimonialSerializer(serializers.ModelSerializer):
    country = CountryMini(read_only=True)

    class Meta:
        model = Testimonial
        fields = ("id", "patient_name", "country", "treatment_received", "photo", "review_text", "video_url",
                  "is_featured", "created_at")


class PostCard(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", default=None)
    category_slug = serializers.CharField(source="category.slug", default=None)

    class Meta:
        model = Post
        fields = ("id", "title", "slug", "image", "summary", "category", "category_slug", "published_date")


class PostDetail(SanitizeHTMLMixin, PostCard):
    html_fields = ("content",)
    author = serializers.SerializerMethodField()

    class Meta(PostCard.Meta):
        fields = PostCard.Meta.fields + ("content", "author", "meta_title", "meta_description")

    def get_author(self, o):
        return (o.author.get_full_name() or o.author.username) if o.author else None
