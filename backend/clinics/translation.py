from modeltranslation.translator import TranslationOptions, register

from .models import Hospital, HospitalTreatmentPrice, PriceCategory


@register(Hospital)
class HospitalTR(TranslationOptions):
    fields = ("name", "description", "infrastructure_details", "guest_house_details",
              "meta_title", "meta_description", "meta_keywords",
              "short_description", "address", "facilities", "equipment", "services_available")

@register(PriceCategory)
class PriceCategoryTR(TranslationOptions):
    fields = ("name",)

@register(HospitalTreatmentPrice)
class HospitalTreatmentPriceTR(TranslationOptions):
    fields = ("procedure_name",)
