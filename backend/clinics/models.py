from django.db import models

from core.models import City, Specialty


class Hospital(models.Model):
    # Asosiy
    name = models.CharField("Nom", max_length=255)
    slug = models.SlugField("Slug", max_length=255, unique=True)
    city = models.ForeignKey(City, on_delete=models.PROTECT, related_name="hospitals", verbose_name="Shahar")

    image = models.ImageField("Bosh rasm", upload_to="hospitals/", blank=True, null=True)
    hero_image = models.ImageField("Hero rasm", upload_to="hospitals/hero/", blank=True, null=True)

    # Tavsif (CKEditor)
    description = models.TextField("Tavsif", blank=True)

    # Statistika
    founded_year = models.PositiveIntegerField("Asos solingan yil", blank=True, null=True)
    bed_count = models.PositiveIntegerField("Umumiy o‘rinlar", default=0)
    icu_bed_count = models.PositiveIntegerField("Reanimatsiya o‘rinlari", default=0)
    operating_rooms_count = models.PositiveIntegerField("Operatsion xonalar", default=0)

    # Bog‘liqlik
    specialties = models.ManyToManyField(Specialty, related_name="hospitals", verbose_name="Yo‘nalishlar", blank=True)

    # Boshqaruv
    is_popular = models.BooleanField("Ommabop", default=False)
    is_verified = models.BooleanField("Tasdiqlangan", default=False,
                                      help_text="Only verified data is shown in comparisons as verified.")
    is_active = models.BooleanField(default=True, db_index=True)

    # MedMapp 2.0 profile
    TYPE_CHOICES = [("private", "Private"), ("public", "Public"), ("university", "University / Teaching"),
                    ("specialty", "Specialty center"), ("clinic", "Clinic")]
    hospital_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="private", db_index=True)
    logo = models.ImageField(upload_to="hospitals/logos/", blank=True, null=True)
    image_credit = models.CharField(max_length=255, blank=True, help_text="Photo author and licence, shown with the photo")
    image_source = models.URLField(blank=True, help_text="Link to the original photo / licence page")
    short_description = models.CharField(max_length=300, blank=True)
    address = models.CharField(max_length=300, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    website = models.URLField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    email = models.EmailField(blank=True)
    languages = models.CharField(max_length=255, blank=True, help_text="Comma separated, e.g. English, Russian")
    facilities = models.TextField(blank=True, help_text="One per line")
    equipment = models.TextField(blank=True, help_text="One per line")
    services_available = models.TextField(blank=True, help_text="One per line: interpreter, transfer...")
    accreditations = models.ManyToManyField("catalog.Accreditation", blank=True, related_name="hospitals")
    treatments = models.ManyToManyField("catalog.Treatment", blank=True, related_name="hospitals")
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    # Batafsil (CKEditor)
    infrastructure_details = models.TextField("Infratuzilma", blank=True)
    guest_house_details = models.TextField("Mehmonxona/Guest house", blank=True)

    # SEO (ko‘p tilli bo‘ladi — translation.py da)
    meta_title = models.CharField("Meta sarlavha", max_length=255, blank=True)
    meta_description = models.TextField("Meta tavsif", blank=True)
    meta_keywords = models.CharField("Meta kalit so‘zlar", max_length=500, blank=True)

    class Meta:
        verbose_name = "Shifoxona"
        verbose_name_plural = "Shifoxonalar"
        ordering = ["name"]

    def __str__(self):
        return self.name


class HospitalGalleryImage(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="gallery", verbose_name="Shifoxona")
    image = models.ImageField("Rasm", upload_to="hospitals/gallery/")

    class Meta:
        verbose_name = "Galereya rasmi"
        verbose_name_plural = "Galereya rasmlari"

    def __str__(self):
        return f"{self.hospital.name} - image #{self.pk}"


class PriceCategory(models.Model):
    name = models.CharField("Kategoriya nomi", max_length=120)
    order = models.PositiveIntegerField("Tartib", default=0)

    class Meta:
        verbose_name = "Narx kategoriyasi"
        verbose_name_plural = "Narx kategoriyalari"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class HospitalTreatmentPrice(models.Model):
    hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="prices", verbose_name="Shifoxona")
    category = models.ForeignKey(PriceCategory, on_delete=models.PROTECT, related_name="hospital_prices", verbose_name="Kategoriya")
    procedure_name = models.CharField("Muolaja nomi", max_length=255)
    price = models.DecimalField("Narx (USD)", max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Shifoxona narxi"
        verbose_name_plural = "Shifoxona narxlari"

    def __str__(self):
        return f"{self.hospital.name} · {self.procedure_name} – ${self.price}"
