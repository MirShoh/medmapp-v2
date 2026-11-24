from django.apps import apps
from django.contrib import admin
from modeltranslation.admin import TabbedTranslationAdmin
from modeltranslation.translator import translator

for model in apps.get_app_config("cases").get_models():
    if admin.site.is_registered(model):
        continue
    base = TabbedTranslationAdmin if model in translator.get_registered_models() else admin.ModelAdmin
    private = [f.name for f in model._meta.fields if getattr(f, "storage", None).__class__.__name__ == "PrivateStorage"]
    fields = [f.name for f in model._meta.fields if f.name not in ("id",)][:6]
    admin.site.register(model, type(f"{model.__name__}Admin", (base,), {"exclude": private, "list_display": ["__str__"] + [
        f for f in fields if model._meta.get_field(f).get_internal_type() not in ("TextField", "JSONField")][:4]}))
