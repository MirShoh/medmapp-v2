"""Shrink newly uploaded public images before they are saved.

Partners and staff upload phone photos of 5-10 MB. Served as-is they make hospital and blog pages slow on mobile,
so every new upload to a public ImageField is resized to at most MAX_SIDE px and re-encoded as WebP.
Logos (transparent PNG/SVG-like art) keep their alpha channel; WebP supports it.

Cards show photos at ~400 px, so every public image also gets a small copy next to it ("x.webp" -> "x.thumb.webp",
THUMB_SIDE px). Lists use it (`thumb_url`); detail pages use the full image. `manage.py make_thumbnails` fills in
copies for images uploaded before this existed.
"""
import io
import logging
from pathlib import Path

from django.core.files.base import ContentFile
from django.db.models import ImageField
from django.db.models.signals import post_save, pre_save

log = logging.getLogger(__name__)

MAX_SIDE = 1920
QUALITY = 80
THUMB_SIDE = 640
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


def thumb_name(name: str) -> str:
    p = Path(name)
    return str(p.with_name(f"{p.stem}.thumb.webp")).replace("\\", "/")


def make_thumb(field_file, force=False) -> bool:
    """Write the small card copy of a stored image. Returns True when a copy was written."""
    from PIL import Image

    if not field_file or not field_file.name or field_file.name.lower().endswith((".svg", ".gif")):
        return False
    storage, target = field_file.storage, thumb_name(field_file.name)
    if storage.exists(target) and not force:
        return False
    try:
        with storage.open(field_file.name, "rb") as fh:
            im = Image.open(fh)
            im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() or im.mode == "P" else "RGB")
        im.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=76, method=6)
    except Exception:
        log.warning("Could not make a thumbnail for %s", field_file.name, exc_info=True)
        return False
    if storage.exists(target):
        storage.delete(target)
    storage.save(target, ContentFile(buf.getvalue()))
    return True


def thumb_url(field_file):
    """URL of the card-size copy, or of the image itself when there is no copy yet."""
    if not field_file:
        return None
    target = thumb_name(field_file.name)
    try:
        return field_file.storage.url(target) if field_file.storage.exists(target) else field_file.url
    except Exception:
        return None


def _thumbs(sender, instance, **kwargs):
    fresh = getattr(instance, "_fresh_images", set())
    for f in sender._meta.fields:
        if isinstance(f, ImageField):
            make_thumb(getattr(instance, f.attname), force=f.attname in fresh)
    instance._fresh_images = set()


def _optimise(sender, instance, **kwargs):
    for f in sender._meta.fields:
        if isinstance(f, ImageField):
            ff = getattr(instance, f.attname)
            uploaded = bool(ff) and not getattr(ff, "_committed", True)
            shrink(ff)
            if uploaded:  # a new picture: its card copy must be rewritten after the save
                instance._fresh_images = getattr(instance, "_fresh_images", set()) | {f.attname}


def connect():
    from django.apps import apps

    for model in apps.get_models():
        if model._meta.app_label in PUBLIC_APPS and any(isinstance(f, ImageField) for f in model._meta.fields):
            pre_save.connect(_optimise, sender=model, dispatch_uid=f"shrink-images-{model._meta.label}")
            post_save.connect(_thumbs, sender=model, dispatch_uid=f"thumb-images-{model._meta.label}")
