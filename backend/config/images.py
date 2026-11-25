"""Shrink newly uploaded public images before they are saved.

Partners and staff upload phone photos of 5-10 MB. Served as-is they make hospital and blog pages slow on mobile,
so every new upload to a public ImageField is resized to at most MAX_SIDE px and re-encoded as WebP.
Logos (transparent PNG/SVG-like art) keep their alpha channel; WebP supports it.
"""
import io
import logging
from pathlib import Path

from django.core.files.base import ContentFile
from django.db.models import ImageField
from django.db.models.signals import pre_save

log = logging.getLogger(__name__)

MAX_SIDE = 1920
QUALITY = 80
# Apps whose images are shown on the public site.
PUBLIC_APPS = {"clinics", "core", "doctors", "blog", "catalog", "cms"}


def shrink(field_file, max_side: int = MAX_SIDE) -> bool:
    """Replace an uncommitted upload with a resized WebP. Returns True when the file was replaced."""
    from PIL import Image, ImageOps

    if not field_file or getattr(field_file, "_committed", True):
        return False
    name = Path(field_file.name).name
    if name.lower().endswith((".svg", ".gif")):
        return False
    try:
        field_file.seek(0)
        im = Image.open(field_file)
        im = ImageOps.exif_transpose(im)  # phone photos store rotation in EXIF
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=QUALITY, method=6)
    except Exception:  # not an image Pillow can read: leave it to the field validators
        log.warning("Could not optimise upload %s", name, exc_info=True)
        return False
    field_file.save(f"{Path(name).stem}.webp", ContentFile(buf.getvalue()), save=False)
    return True


def _optimise(sender, instance, **kwargs):
    for f in sender._meta.fields:
        if isinstance(f, ImageField):
            shrink(getattr(instance, f.attname))


def connect():
    from django.apps import apps

    for model in apps.get_models():
        if model._meta.app_label in PUBLIC_APPS and any(isinstance(f, ImageField) for f in model._meta.fields):
            pre_save.connect(_optimise, sender=model, dispatch_uid=f"shrink-images-{model._meta.label}")
