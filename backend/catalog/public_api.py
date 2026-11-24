from django.db.models import Avg, Count, Min, Q
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from blog.models import Post
from cases.models import MedicalCase
from catalog.models import Testimonial
from clinics.models import Hospital
from cms.models import Banner, NavItem, Page, PageSection
from config.html import SanitizeHTMLMixin, clean_html
from core.models import City, Country, SiteSettings, Specialty
from doctors.models import Doctor

from . import serializers as S
from .models import FAQ, Accreditation, MedicalService, Treatment, TreatmentPackage


def by_ref(value):
    """Filter helper: numeric id or slug."""
    return ("id", int(value)) if str(value).isdigit() else ("slug", value)


# ---------------------------------------------------------------- querysets
def hospital_qs():
    return (Hospital.objects.filter(is_active=True)
            .select_related("city", "city__country")
            .prefetch_related("specialties", "accreditations")
            .annotate(min_price_usd=Min("packages__price", filter=Q(packages__currency="USD", packages__is_active=True)),
                      rating=Avg("reviews__rating", filter=Q(reviews__is_published=True)),
                      reviews_count=Count("reviews", filter=Q(reviews__is_published=True), distinct=True),
                      doctors_count=Count("doctors", filter=Q(doctors__is_active=True), distinct=True)))


def home_hospitals(limit=12):
    """A mix from every destination country (round-robin in country order, popular/verified first)."""
    per_country = {}
    for h in hospital_qs().order_by("city__country__order", "-is_popular", "-is_verified", "name"):
        per_country.setdefault(h.city.country_id, []).append(h)
    picked, queues = [], list(per_country.values())
    while len(picked) < limit and any(queues):
        for q in queues:
            if q and len(picked) < limit:
                picked.append(q.pop(0))
    return picked


def doctor_qs():
    return (Doctor.objects.filter(is_active=True).select_related("specialty")
            .prefetch_related("hospitals__city__country"))


def package_qs():
    return (TreatmentPackage.objects.filter(is_active=True, hospital__is_active=True)
            .select_related("hospital__city__country", "treatment__specialty"))


def country_qs():
    return Country.objects.filter(is_active=True).annotate(
        hospitals_count=Count("cities__hospitals", filter=Q(cities__hospitals__is_active=True), distinct=True),
        doctors_count=Count("cities__hospitals__doctors", filter=Q(cities__hospitals__doctors__is_active=True),
                            distinct=True))


# ---------------------------------------------------------------- reference data
class FiltersView(APIView):
    def get(self, request):
        return Response({
            "countries": S.CountryMini(Country.objects.filter(is_active=True, is_destination=True), many=True).data,
            "cities": S.CityMini(City.objects.filter(hospitals__is_active=True).select_related("country").distinct(),
                                 many=True).data,
            "specialties": S.SpecialtyMini(Specialty.objects.filter(is_active=True), many=True).data,
            "treatments": [{"id": t.id, "name": t.name, "slug": t.slug, "specialty": t.specialty_id}
                           for t in Treatment.objects.filter(is_active=True)],
            "accreditations": S.AccreditationSerializer(Accreditation.objects.all(), many=True).data,
            "hospital_types": [{"value": v, "label": label} for v, label in Hospital.TYPE_CHOICES],
            "languages": sorted({x for h in Hospital.objects.filter(is_active=True).values_list("languages", flat=True)
                                 for x in S.csv(h)}),
        })


class CountryList(generics.ListAPIView):
    serializer_class = S.CountryCard
    pagination_class = None

    def get_queryset(self):
        qs = country_qs()
        g = self.request.GET
        if g.get("all") != "1":
            qs = qs.filter(is_destination=True)
        # Filters for the countries page: which countries offer this treatment / specialty, name search.
        if g.get("treatment"):
            qs = qs.filter(cities__hospitals__is_active=True, cities__hospitals__treatments__slug=g["treatment"])
        if g.get("specialty"):
            qs = qs.filter(cities__hospitals__is_active=True, cities__hospitals__specialties__slug=g["specialty"])
        if g.get("search"):
            s = g["search"].strip()
            qs = qs.filter(Q(name__icontains=s) | Q(name_uz__icontains=s) | Q(name_ru__icontains=s) | Q(name_en__icontains=s))
        return qs.distinct().order_by("order", "name")


class CountryDetail(APIView):
    def get(self, request, slug):
        c = generics.get_object_or_404(country_qs(), **dict([by_ref(slug)]))
        ctx = {"request": request}
        hospitals = hospital_qs().filter(city__country=c)
        treatments = (Treatment.objects.filter(is_active=True, prices__country=c)
                      .annotate(price_from_usd=Min("prices__price_from", filter=Q(prices__country=c, prices__currency="USD")))
                      .select_related("specialty").distinct())
        return Response({
            **S.CountryDetail(c, context=ctx).data,
            "hospitals": S.HospitalCard(hospitals[:12], many=True, context=ctx).data,
            "doctors": S.DoctorCard(doctor_qs().filter(hospitals__city__country=c).distinct()[:12], many=True,
                                    context=ctx).data,
            "treatments": S.TreatmentListSerializer(treatments[:24], many=True, context=ctx).data,
            "prices": S.TreatmentPriceSerializer(c.treatment_prices.select_related("treatment", "hospital")[:50],
                                                 many=True).data,
            "packages": S.PackageCard(package_qs().filter(hospital__city__country=c)[:9], many=True, context=ctx).data,
            "faqs": S.FAQSerializer(FAQ.objects.filter(country=c, is_active=True), many=True).data,
            "cities": [{"id": x.id, "name": x.name} for x in c.cities.all()],
        })


class SpecialtyList(generics.ListAPIView):
    serializer_class = S.SpecialtySerializer
    pagination_class = None

    def get_queryset(self):
        return Specialty.objects.filter(is_active=True).annotate(
            treatments_count=Count("treatments", filter=Q(treatments__is_active=True), distinct=True),
            hospitals_count=Count("hospitals", filter=Q(hospitals__is_active=True), distinct=True))


def treatment_qs():
    return (Treatment.objects.filter(is_active=True).select_related("specialty")
            .annotate(price_from_usd=Min("prices__price_from", filter=Q(prices__currency="USD")),
                      hospitals_count=Count("hospitals", filter=Q(hospitals__is_active=True), distinct=True)))


class TreatmentList(generics.ListAPIView):
    serializer_class = S.TreatmentListSerializer
    search_fields = ("name", "short_description", "specialty__title")

    def get_queryset(self):
        qs = treatment_qs()
        g = self.request.GET
        if g.get("specialty"):
            k, v = by_ref(g["specialty"])
            qs = qs.filter(**{f"specialty__{k}": v})
        if g.get("advanced") == "1":
            qs = qs.filter(is_advanced=True)
        if g.get("featured") == "1":
            qs = qs.filter(is_featured=True)
        if g.get("country"):
            k, v = by_ref(g["country"])
            qs = qs.filter(**{f"prices__country__{k}": v}).distinct()
        return qs.order_by("order", "name")


class TreatmentDetail(APIView):
    def get(self, request, slug):
        t = generics.get_object_or_404(treatment_qs(), slug=slug)
        ctx = {"request": request}
        prices = t.prices.select_related("country", "hospital")
        return Response({
            **S.TreatmentListSerializer(t, context=ctx).data,
            "overview": clean_html(t.overview), "treatment_info": clean_html(t.treatment_info),
            "preparation": clean_html(t.preparation), "recovery_info": clean_html(t.recovery_info), "meta_title": t.meta_title, "meta_description": t.meta_description,
            "hospitals": S.HospitalCard(hospital_qs().filter(treatments=t)[:12], many=True, context=ctx).data,
            "doctors": S.DoctorCard(doctor_qs().filter(treatments=t)[:12], many=True, context=ctx).data,
            "packages": S.PackageCard(package_qs().filter(treatment=t)[:12], many=True, context=ctx).data,
            "prices": S.TreatmentPriceSerializer(prices, many=True).data,
            "countries": S.CountryMini(Country.objects.filter(treatment_prices__treatment=t).distinct(), many=True).data,
            "faqs": S.FAQSerializer(t.faqs.filter(is_active=True), many=True).data,
            "related": S.TreatmentMini(Treatment.objects.filter(specialty=t.specialty, is_active=True)
                                       .exclude(pk=t.pk)[:6], many=True, context=ctx).data,
        })


class HospitalList(generics.ListAPIView):
    serializer_class = S.HospitalCard
    search_fields = ("name", "short_description", "city__name", "specialties__title")
    ordering_fields = ("name", "min_price_usd", "rating", "founded_year", "bed_count")

    def get_queryset(self):
        qs, g = hospital_qs(), self.request.GET
        for param, path in (("country", "city__country"), ("city", "city"), ("specialty", "specialties"),
                            ("treatment", "treatments")):
            if g.get(param):
                k, v = by_ref(g[param])
                qs = qs.filter(**{f"{path}__{k}": v})
        if g.get("type"):
            qs = qs.filter(hospital_type=g["type"])
        if g.get("accreditation"):
            qs = qs.filter(accreditations__code__iexact=g["accreditation"])
        if g.get("language"):
            qs = qs.filter(languages__icontains=g["language"])
        if g.get("service"):
            qs = qs.filter(services_available__icontains=g["service"])
        if g.get("verified") == "1":
            qs = qs.filter(is_verified=True)
        if g.get("popular") == "1":
            qs = qs.filter(is_popular=True)
        if g.get("price_max"):
            qs = qs.filter(min_price_usd__lte=g["price_max"])
        if g.get("price_min"):
            qs = qs.filter(min_price_usd__gte=g["price_min"])
        return qs.distinct().order_by("-is_popular", "-is_verified", "name")


class HospitalDetail(generics.RetrieveAPIView):
    serializer_class = S.HospitalDetail
    lookup_field = "slug"

    def get_queryset(self):
        return hospital_qs().prefetch_related("gallery", "treatments__specialty")


class HospitalCompare(APIView):
    """Side-by-side comparison. Only stored, published data; unverified hospitals are flagged."""

    def get(self, request):
        ids = [int(x) for x in request.GET.get("ids", "").split(",") if x.strip().isdigit()][:4]
        hs = hospital_qs().filter(pk__in=ids).prefetch_related("treatments", "treatment_prices__treatment")
        out = []
        for h in hs:
            d = S.HospitalDetail(h, context={"request": request}).data
            out.append({k: d[k] for k in (
                "id", "name", "slug", "image", "city", "hospital_type", "is_verified", "specialties",
                "accreditations_full", "treatments", "languages_list", "facilities_list", "services_list",
                "founded_year", "bed_count", "icu_bed_count", "operating_rooms_count", "rating", "reviews_count",
                "doctors_count", "min_price_usd", "prices", "packages")})
        return Response(sorted(out, key=lambda x: ids.index(x["id"])))


class DoctorList(generics.ListAPIView):
    serializer_class = S.DoctorCard
    search_fields = ("full_name", "specialty_title", "expertise")
    ordering_fields = ("experience_years", "full_name")

    def get_queryset(self):
        qs, g = doctor_qs(), self.request.GET
        if g.get("country"):
            k, v = by_ref(g["country"])
            qs = qs.filter(**{f"hospitals__city__country__{k}": v})
        if g.get("hospital"):
            k, v = by_ref(g["hospital"])
            qs = qs.filter(**{f"hospitals__{k}": v})
        if g.get("specialty"):
            k, v = by_ref(g["specialty"])
            qs = qs.filter(**{f"specialty__{k}": v})
        if g.get("treatment"):
            k, v = by_ref(g["treatment"])
            qs = qs.filter(**{f"treatments__{k}": v})
        if g.get("language"):
            qs = qs.filter(languages__icontains=g["language"])
        if g.get("experience_min", "").isdigit():
            qs = qs.filter(experience_years__gte=int(g["experience_min"]))
        if g.get("popular") == "1":
            qs = qs.filter(is_popular=True)
        return qs.distinct().order_by("-is_popular", "-experience_years", "full_name")


class DoctorDetail(generics.RetrieveAPIView):
    serializer_class = S.DoctorDetail
    lookup_field = "slug"

    def get_queryset(self):
        return doctor_qs().prefetch_related("treatments__specialty")


class PackageList(generics.ListAPIView):
    serializer_class = S.PackageCard
    search_fields = ("name", "treatment__name", "hospital__name")
    ordering_fields = ("price", "duration_days")

    def get_queryset(self):
        qs, g = package_qs(), self.request.GET
        if g.get("country"):
            k, v = by_ref(g["country"])
            qs = qs.filter(**{f"hospital__city__country__{k}": v})
        if g.get("treatment"):
            k, v = by_ref(g["treatment"])
            qs = qs.filter(**{f"treatment__{k}": v})
        if g.get("specialty"):
            k, v = by_ref(g["specialty"])
            qs = qs.filter(**{f"treatment__specialty__{k}": v})
        if g.get("hospital"):
            k, v = by_ref(g["hospital"])
            qs = qs.filter(**{f"hospital__{k}": v})
        if g.get("price_max"):
            qs = qs.filter(price__lte=g["price_max"])
        if g.get("featured") == "1":
            qs = qs.filter(is_featured=True)
        return qs


class PackageDetail(generics.RetrieveAPIView):
    serializer_class = S.PackageDetail
    lookup_field = "slug"

    def get_queryset(self):
        return package_qs()


class PackageCompare(APIView):
    def get(self, request):
        ids = [int(x) for x in request.GET.get("ids", "").split(",") if x.strip().isdigit()][:4]
        return Response(S.PackageDetail(package_qs().filter(pk__in=ids), many=True, context={"request": request}).data)


class ServiceList(generics.ListAPIView):
    serializer_class = S.ServiceSerializer
    pagination_class = None
    queryset = MedicalService.objects.filter(is_active=True)


class ServiceDetail(APIView):
    def get(self, request, slug):
        s = generics.get_object_or_404(MedicalService, slug=slug, is_active=True)
        return Response({**S.ServiceSerializer(s).data,
                         "faqs": S.FAQSerializer(s.faqs.filter(is_active=True), many=True).data})


class FAQList(generics.ListAPIView):
    serializer_class = S.FAQSerializer
    pagination_class = None

    def get_queryset(self):
        return FAQ.objects.filter(is_active=True, scope=self.request.GET.get("scope", "general"))


class TestimonialList(generics.ListAPIView):
    serializer_class = S.TestimonialSerializer

    def get_queryset(self):
        qs = Testimonial.objects.select_related("country")
        if self.request.GET.get("featured") == "1":
            qs = qs.filter(is_featured=True)
        return qs


class PostList(generics.ListAPIView):
    serializer_class = S.PostCard
    search_fields = ("title", "summary")

    def get_queryset(self):
        qs = Post.objects.filter(status="published").select_related("category")
        if self.request.GET.get("category"):
            qs = qs.filter(category__slug=self.request.GET["category"])
        return qs


class PostDetail(generics.RetrieveAPIView):
    serializer_class = S.PostDetail
    lookup_field = "slug"
    queryset = Post.objects.filter(status="published").select_related("category", "author")


class SectionSerializer(SanitizeHTMLMixin, serializers.ModelSerializer):
    html_fields = ("body",)

    class Meta:
        model = PageSection
        fields = ("key", "eyebrow", "title", "subtitle", "body", "cta_label", "cta_url", "image", "items", "order")


class PageSerializer(SanitizeHTMLMixin, serializers.ModelSerializer):
    html_fields = ("body",)

    class Meta:
        model = Page
        fields = ("slug", "kind", "title", "subtitle", "body", "hero_image", "source_note", "source_updated",
                  "meta_title", "meta_description", "updated_at")


def real_stats():
    """Only real database counts. The frontend hides a counter when its value is 0."""
    return {
        "hospitals": Hospital.objects.filter(is_active=True).count(),
        "doctors": Doctor.objects.filter(is_active=True).count(),
        "destinations": Country.objects.filter(is_active=True, is_destination=True).count(),
        "treatments": Treatment.objects.filter(is_active=True).count(),
        "patients_helped": MedicalCase.objects.filter(status__in=["follow_up", "closed"]).values("patient").distinct().count(),
    }


class SiteView(APIView):
    """Global site data: settings, navigation, banners."""

    def get(self, request):
        s = SiteSettings.get_solo()
        from django.utils import timezone

        now = timezone.now()
        banners = Banner.objects.filter(is_active=True).filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now)).filter(
            Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        return Response({
            "settings": {"phone": s.phone_number, "email": s.email, "address": s.address,
                         "socials": {"facebook": s.facebook_url, "instagram": s.instagram_url,
                                     "telegram": s.telegram_url, "youtube": s.youtube_url},
                         "meta_title": s.meta_title, "meta_description": s.meta_description},
            "nav": [{"location": n.location, "group": n.group, "label": n.label, "url": n.url}
                    for n in NavItem.objects.filter(is_active=True)],
            "banners": [{"title": b.title, "text": b.text, "url": b.url} for b in banners],
        })


class HomeView(APIView):
    def get(self, request):
        ctx = {"request": request}
        return Response({
            "sections": SectionSerializer(PageSection.objects.filter(page="home", is_enabled=True), many=True,
                                          context=ctx).data,
            "stats": real_stats(),
            "specialties": S.SpecialtySerializer(Specialty.objects.filter(is_active=True)[:16], many=True,
                                                 context=ctx).data,
            "treatments": S.TreatmentListSerializer(treatment_qs().filter(is_featured=True)[:8], many=True,
                                                    context=ctx).data,
            "advanced": S.TreatmentListSerializer(treatment_qs().filter(is_advanced=True)[:6], many=True,
                                                  context=ctx).data,
            "destinations": S.CountryCard(country_qs().filter(is_destination=True).order_by("order")[:9], many=True,
                                          context=ctx).data,
            "hospitals": S.HospitalCard(home_hospitals(12), many=True, context=ctx).data,
            "doctors": S.DoctorCard(doctor_qs().filter(is_popular=True)[:8], many=True, context=ctx).data,
            "packages": S.PackageCard(package_qs().filter(is_featured=True)[:6], many=True, context=ctx).data,
            "services": S.ServiceSerializer(MedicalService.objects.filter(is_active=True)[:13], many=True).data,
            "testimonials": S.TestimonialSerializer(Testimonial.objects.filter(is_featured=True)[:6], many=True,
                                                    context=ctx).data,
            "posts": S.PostCard(Post.objects.filter(status="published")[:3], many=True, context=ctx).data,
            "faqs": S.FAQSerializer(FAQ.objects.filter(is_active=True, scope="general")[:10], many=True).data,
            "partners": [{"name": h.name, "slug": h.slug, "logo": request.build_absolute_uri(h.logo.url) if h.logo else None}
                         for h in Hospital.objects.filter(is_active=True, is_verified=True)[:16]],
        })


class PageView(APIView):
    def get(self, request, slug):
        p = generics.get_object_or_404(Page, slug=slug, is_published=True)
        sections = PageSection.objects.filter(page=slug, is_enabled=True) if slug in dict(PageSection.PAGES) else []
        return Response({**PageSerializer(p, context={"request": request}).data,
                         "sections": SectionSerializer(sections, many=True, context={"request": request}).data})


class SectionsView(APIView):
    def get(self, request, page):
        return Response(SectionSerializer(PageSection.objects.filter(page=page, is_enabled=True), many=True,
                                          context={"request": request}).data)


class SearchView(APIView):
    def get(self, request):
        q = request.GET.get("q", "").strip()
        if len(q) < 2:
            return Response({"treatments": [], "hospitals": [], "doctors": [], "destinations": []})
        return Response({
            "treatments": [{"name": t.name, "slug": t.slug} for t in
                           Treatment.objects.filter(is_active=True).filter(Q(name__icontains=q) | Q(specialty__title__icontains=q))[:6]],
            "hospitals": [{"name": h.name, "slug": h.slug, "city": h.city.name} for h in
                          Hospital.objects.filter(is_active=True, name__icontains=q).select_related("city")[:6]],
            "doctors": [{"name": d.full_name, "slug": d.slug, "specialty": d.specialty_title} for d in
                        Doctor.objects.filter(is_active=True).filter(Q(full_name__icontains=q) | Q(specialty_title__icontains=q))[:6]],
            "destinations": [{"name": c.name, "slug": c.slug, "flag": c.flag} for c in
                             Country.objects.filter(is_active=True, is_destination=True, name__icontains=q)[:4]],
        })


class SitemapView(APIView):
    """Every public, indexable URL slug with its last change (used by the site's sitemap.xml)."""

    def get(self, request):
        def rows(qs, date_field=None):
            out = []
            for o in qs:
                d = getattr(o, date_field, None) if date_field else None
                out.append({"slug": o.slug, "updated": d.isoformat() if d else None})
            return out

        return Response({
            "hospitals": rows(Hospital.objects.filter(is_active=True).only("slug", "updated_at"), "updated_at"),
            "doctors": rows(Doctor.objects.filter(is_active=True).only("slug")),
            "treatments": rows(Treatment.objects.filter(is_active=True).only("slug", "updated_at"), "updated_at"),
            "destinations": rows(Country.objects.filter(is_active=True, is_destination=True).exclude(slug=None).only("slug")),
            "packages": rows(TreatmentPackage.objects.filter(is_active=True).only("slug", "updated_at"), "updated_at"),
            "services": rows(MedicalService.objects.filter(is_active=True).only("slug")),
            "posts": rows(Post.objects.filter(status="published").only("slug", "updated_at"), "updated_at"),
            "pages": rows(Page.objects.filter(is_published=True).only("slug", "updated_at"), "updated_at"),
        })
