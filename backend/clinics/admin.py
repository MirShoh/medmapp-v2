from adminsortable2.admin import SortableAdminMixin
from django.contrib import admin
from modeltranslation.admin import TabbedTranslationAdmin

from .models import Hospital, HospitalGalleryImage, HospitalTreatmentPrice, PriceCategory


class HospitalGalleryImageInline(admin.TabularInline):
    model = HospitalGalleryImage
    extra = 1


class HospitalTreatmentPriceInline(admin.TabularInline):
    model = HospitalTreatmentPrice
    extra = 1


@admin.register(Hospital)
class HospitalAdmin(TabbedTranslationAdmin):
    list_display = ("name", "city", "is_popular")
    search_fields = ("translations__name", "city__translations__name")
    list_filter = ("city", "specialties", "is_popular")
    filter_horizontal = ("specialties",)
    prepopulated_fields = {"slug": ("name",)}  # slug avtomatik

    inlines = [HospitalGalleryImageInline, HospitalTreatmentPriceInline]


@admin.register(PriceCategory)
class PriceCategoryAdmin(SortableAdminMixin, TabbedTranslationAdmin):
    list_display = ("name", "order")
    list_editable = ("order",)


@admin.register(HospitalTreatmentPrice)
class HospitalTreatmentPriceAdmin(TabbedTranslationAdmin):
    list_display = ("hospital", "category", "procedure_name", "price")
    list_filter = ("category", "hospital")
    search_fields = ("translations__procedure_name",)
