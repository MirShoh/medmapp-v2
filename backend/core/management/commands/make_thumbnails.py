"""Create the card-size copies ("x.thumb.webp") for public images uploaded before thumbnails existed."""
from django.apps import apps
from django.core.management.base import BaseCommand
from django.db.models import ImageField

from config.images import PUBLIC_APPS, make_thumb


class Command(BaseCommand):
    help = "Create missing card-size copies of public catalogue images (use --force to rebuild all)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="rewrite copies that already exist")

    def handle(self, *args, force=False, **options):
        made = 0
        for model in apps.get_models():
            fields = [f.attname for f in model._meta.fields if isinstance(f, ImageField)]
            if model._meta.app_label not in PUBLIC_APPS or not fields:
                continue
            for obj in model._default_manager.all().only("pk", *fields):
                for name in fields:
                    made += make_thumb(getattr(obj, name), force=force)
        self.stdout.write(self.style.SUCCESS(f"{made} thumbnails written"))
