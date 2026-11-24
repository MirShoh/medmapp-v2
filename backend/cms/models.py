from django.db import models


class PageSection(models.Model):
    """CMS-managed homepage/landing section. 'key' is the section identifier the frontend renders."""

    PAGES = [("home", "Homepage"), ("about", "About"), ("how_it_works", "How it works"),
             ("second_opinion", "Second opinion"), ("contact", "Contact")]
    page = models.CharField(max_length=30, choices=PAGES, default="home", db_index=True)
    key = models.SlugField(max_length=60)
    eyebrow = models.CharField(max_length=120, blank=True)
    title = models.CharField(max_length=255, blank=True)
    subtitle = models.TextField(blank=True)
    body = models.TextField(blank=True)
    cta_label = models.CharField(max_length=80, blank=True)
    cta_url = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to="cms/", blank=True, null=True)
    items = models.JSONField(default=list, blank=True, help_text="Optional list of {title, text, icon}")
    is_enabled = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("page", "key")
        ordering = ["page", "order"]

    def __str__(self):
        return f"{self.page}:{self.key}"


class Page(models.Model):
    """Free CMS pages: regional gateways, legal pages, guides."""

    KINDS = [("page", "Page"), ("gateway", "Regional gateway"), ("legal", "Legal"), ("guide", "Guide")]
    slug = models.SlugField(max_length=120, unique=True)
    kind = models.CharField(max_length=12, choices=KINDS, default="page", db_index=True)
    title = models.CharField(max_length=255)
    subtitle = models.TextField(blank=True)
    body = models.TextField(blank=True, help_text="Markdown/HTML")
    hero_image = models.ImageField(upload_to="cms/pages/", blank=True, null=True)
    source_note = models.CharField(max_length=500, blank=True, help_text="Source of changing information")
    source_updated = models.DateField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["kind", "title"]

    def __str__(self):
        return self.title


class NavItem(models.Model):
    LOCATIONS = [("header", "Header"), ("footer", "Footer")]
    location = models.CharField(max_length=10, choices=LOCATIONS, default="header")
    group = models.CharField(max_length=60, blank=True, help_text="Footer column name")
    label = models.CharField(max_length=120)
    url = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["location", "group", "order"]


class Banner(models.Model):
    title = models.CharField(max_length=255)
    text = models.CharField(max_length=500, blank=True)
    url = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to="cms/banners/", blank=True, null=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
