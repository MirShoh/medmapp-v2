from modeltranslation.translator import TranslationOptions, register

from .models import JourneyStep, JourneyStepItem, ServiceIntro


@register(ServiceIntro)
class ServiceIntroTR(TranslationOptions):
    fields = ("title", "subtitle", "button_text", "meta_title", "meta_description", "meta_keywords")

@register(JourneyStep)
class JourneyStepTR(TranslationOptions):
    fields = ("title", "description")

@register(JourneyStepItem)
class JourneyStepItemTR(TranslationOptions):
    fields = ("text",)
