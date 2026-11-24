from modeltranslation.translator import TranslationOptions, register

from .models import FAQ, Accreditation, MedicalService, Treatment, TreatmentPackage


@register(Accreditation)
class AccreditationTR(TranslationOptions):
    fields = ("name", "description")


@register(Treatment)
class TreatmentTR(TranslationOptions):
    fields = ("name", "short_description", "overview", "treatment_info", "preparation", "recovery_info",
              "meta_title", "meta_description")


@register(TreatmentPackage)
class TreatmentPackageTR(TranslationOptions):
    fields = ("name", "description", "included_services", "excluded_services", "accommodation", "transfer",
              "additional_services", "additional_expenses_note", "meta_title", "meta_description")


@register(MedicalService)
class MedicalServiceTR(TranslationOptions):
    fields = ("title", "short_description", "description", "process_steps", "meta_title", "meta_description")


@register(FAQ)
class FAQTR(TranslationOptions):
    fields = ("question", "answer")


from .models import Testimonial  # noqa: E402


@register(Testimonial)
class TestimonialTR(TranslationOptions):
    fields = ("patient_name", "treatment_received", "review_text")
