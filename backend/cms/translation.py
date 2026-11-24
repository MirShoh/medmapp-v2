from modeltranslation.translator import TranslationOptions, register

from .models import Banner, NavItem, Page, PageSection


@register(PageSection)
class PageSectionTR(TranslationOptions):
    fields = ("eyebrow", "title", "subtitle", "body", "cta_label", "items")


@register(Page)
class PageTR(TranslationOptions):
    fields = ("title", "subtitle", "body", "meta_title", "meta_description")


@register(NavItem)
class NavItemTR(TranslationOptions):
    fields = ("label", "group")


@register(Banner)
class BannerTR(TranslationOptions):
    fields = ("title", "text")
