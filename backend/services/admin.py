from adminsortable2.admin import SortableAdminMixin, SortableInlineAdminMixin
from django.contrib import admin
from modeltranslation.admin import TabbedTranslationAdmin, TranslationTabularInline

from .models import JourneyStep, JourneyStepItem, ServiceIntro


@admin.register(ServiceIntro)
class ServiceIntroAdmin(TabbedTranslationAdmin):
    fieldsets = (
        ("Hero", {"fields": ("title", "subtitle", "button_text")}),
        ("SEO", {"fields": ("meta_title", "meta_description", "meta_keywords")}),
    )


class JourneyStepItemInline(SortableInlineAdminMixin, TranslationTabularInline):
    model = JourneyStepItem
    extra = 1
    fields = ("text", "order")


@admin.register(JourneyStep)
class JourneyStepAdmin(SortableAdminMixin, TabbedTranslationAdmin, admin.ModelAdmin):
    list_display = ("order", "step_number", "title")
    ordering = ("order", "step_number")
    inlines = [JourneyStepItemInline]
