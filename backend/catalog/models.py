from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

CURRENCIES = [("USD", "USD"), ("UZS", "UZS"), ("EUR", "EUR"), ("INR", "INR"), ("TRY", "TRY"), ("CNY", "CNY"),
              ("KRW", "KRW"), ("AED", "AED"), ("THB", "THB"), ("KZT", "KZT"), ("GBP", "GBP")]


class SEOFields(models.Model):
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    og_image = models.ImageField(upload_to="seo/", blank=True, null=True)

    class Meta:
        abstract = True


class Accreditation(models.Model):
    code = models.CharField(max_length=32, unique=True)  # JCI, NABH, ISO 9001 ...
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    verify_url = models.URLField(blank=True)
    logo = models.ImageField(upload_to="accreditations/", blank=True, null=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code


class Treatment(SEOFields):
    specialty = models.ForeignKey("core.Specialty", on_delete=models.PROTECT, related_name="treatments")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    short_description = models.CharField(max_length=300, blank=True)
    overview = models.TextField(blank=True)
    treatment_info = models.TextField(blank=True)
    preparation = models.TextField(blank=True)
    recovery_info = models.TextField(blank=True)
    duration_days = models.PositiveIntegerField(null=True, blank=True, help_text="Typical stay in country, days")
    image = models.ImageField(upload_to="treatments/", blank=True, null=True)
    is_advanced = models.BooleanField(default=False, help_text="Robotic surgery, advanced cancer care...")
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class TreatmentPrice(models.Model):
    """Published *estimated* price range for a treatment in a country (optionally a hospital)."""

    treatment = models.ForeignKey(Treatment, on_delete=models.CASCADE, related_name="prices")
    country = models.ForeignKey("core.Country", on_delete=models.CASCADE, related_name="treatment_prices")
    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.CASCADE,
                                 related_name="treatment_prices")
    price_from = models.DecimalField(max_digits=12, decimal_places=2)
    price_to = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    source = models.CharField(max_length=255, blank=True, help_text="Where this estimate comes from")
    updated_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["price_from"]
        indexes = [models.Index(fields=["treatment", "country"])]

    def __str__(self):
        return f"{self.treatment} @ {self.country}: {self.price_from} {self.currency}"


class TreatmentPackage(SEOFields):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    hospital = models.ForeignKey("clinics.Hospital", on_delete=models.CASCADE, related_name="packages")
    treatment = models.ForeignKey(Treatment, on_delete=models.PROTECT, related_name="packages")
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCIES, default="USD")
    PRICE_TYPES = [("estimate", "Estimated price"), ("confirmed", "Hospital-confirmed price")]
    price_type = models.CharField(max_length=12, choices=PRICE_TYPES, default="estimate")
    duration_days = models.PositiveIntegerField(null=True, blank=True)
    hospital_stay_days = models.PositiveIntegerField(null=True, blank=True)
    included_services = models.TextField(blank=True, help_text="One per line")
    excluded_services = models.TextField(blank=True, help_text="One per line")
    accommodation = models.TextField(blank=True)
    transfer = models.TextField(blank=True)
    additional_services = models.TextField(blank=True)
    additional_expenses_note = models.TextField(blank=True)
    valid_until = models.DateField(null=True, blank=True)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_featured", "price"]

    def __str__(self):
        return self.name


class MedicalService(SEOFields):
    """Free consultation, second opinion, visa assistance, interpreter..."""

    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=200)
    icon = models.CharField(max_length=60, blank=True, help_text="lucide icon name")
    short_description = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)
    process_steps = models.TextField(blank=True, help_text="One step per line")
    is_free = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "title"]

    def __str__(self):
        return self.title


class FAQ(models.Model):
    SCOPES = [("general", "General"), ("treatment", "Treatment"), ("country", "Country"),
              ("service", "Service"), ("hospital", "Hospital")]
    scope = models.CharField(max_length=20, choices=SCOPES, default="general", db_index=True)
    question = models.CharField(max_length=500)
    answer = models.TextField()
    treatment = models.ForeignKey(Treatment, null=True, blank=True, on_delete=models.CASCADE, related_name="faqs")
    country = models.ForeignKey("core.Country", null=True, blank=True, on_delete=models.CASCADE, related_name="faqs")
    service = models.ForeignKey(MedicalService, null=True, blank=True, on_delete=models.CASCADE,
                                related_name="faqs")
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "FAQ"
        verbose_name_plural = "FAQ"

    def __str__(self):
        return self.question[:80]


class Review(models.Model):
    """Patient review of a hospital/doctor. Published only after moderation (verified)."""

    hospital = models.ForeignKey("clinics.Hospital", null=True, blank=True, on_delete=models.CASCADE,
                                 related_name="reviews")
    doctor = models.ForeignKey("doctors.Doctor", null=True, blank=True, on_delete=models.CASCADE,
                               related_name="reviews")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    author_name = models.CharField(max_length=120)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    text = models.TextField()
    is_verified = models.BooleanField(default=False, help_text="Verified MedMapp patient")
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.author_name}: {self.rating}★"


class Testimonial(models.Model):
    """Patient review shown on the site. Moved from the old `patients` app; the table name is kept."""

    patient_name = models.CharField("Bemor ismi", max_length=255)
    country = models.ForeignKey("core.Country", verbose_name="Mamlakat", on_delete=models.SET_NULL, null=True, blank=True)
    photo = models.ImageField("Rasm", upload_to="testimonials/", blank=True, null=True)
    treatment_received = models.CharField("Olingan davolanish", max_length=255, blank=True)
    review_text = models.TextField("Sharh matni")
    video_url = models.URLField("Video URL", blank=True)
    is_featured = models.BooleanField("Tanlangan (featured)", default=False)
    created_at = models.DateTimeField("Yaratildi", auto_now_add=True)

    class Meta:
        db_table = "patients_testimonial"
        verbose_name = "Sharh"
        verbose_name_plural = "Sharhlar"
        ordering = ["-is_featured", "-created_at"]

    def __str__(self):
        return self.patient_name
