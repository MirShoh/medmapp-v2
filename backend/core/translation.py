from modeltranslation.translator import TranslationOptions, register

from .models import City, Country, ServiceCard, SiteSettings, Specialty, Statistic, WorkStep


@register(SiteSettings)
class SiteSettingsTR(TranslationOptions):
    fields = ("hero_title", "hero_subtitle", "meta_title", "meta_description", "meta_keywords")


@register(Specialty)
class SpecialtyTR(TranslationOptions):
    fields = ("title", "description")


@register(Statistic)
class StatisticTR(TranslationOptions):
    fields = ("title",)


@register(WorkStep)
class WorkStepTR(TranslationOptions):
    fields = ("title", "description")


@register(ServiceCard)
class ServiceCardTR(TranslationOptions):
    fields = ("title", "description")


@register(Country)
class CountryTR(TranslationOptions):
    fields = ("name", "tagline", "intro", "medical_overview", "travel_info", "visa_info",
              "accommodation_info", "patient_journey", "meta_title", "meta_description")


@register(City)
class CityTR(TranslationOptions):
    fields = ("name",)
