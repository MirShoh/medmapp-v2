from django.apps import apps
from django.contrib import admin
from modeltranslation.admin import TabbedTranslationAdmin
from modeltranslation.translator import translator

for model in apps.get_app_config("crm").get_models():
    if admin.site.is_registered(model):
        continue
    base = TabbedTranslationAdmin if model in translator.get_registered_models() else admin.ModelAdmin
    fields = [f.name for f in model._meta.fields if f.name not in ("id",)][:6]
    admin.site.register(model, type(f"{model.__name__}Admin", (base,), {"list_display": ["__str__"] + [
        f for f in fields if model._meta.get_field(f).get_internal_type() not in ("TextField", "JSONField")][:4]}))
