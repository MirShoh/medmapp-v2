import mimetypes
import os

from django.conf import settings
from rest_framework.exceptions import ValidationError

# magic bytes for the most common medical file types
SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".png": [b"\x89PNG"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".webp": [b"RIFF"],
    ".zip": [b"PK"],
    ".docx": [b"PK"],
}


def validate_upload(f):
    ext = os.path.splitext(f.name)[1].lower()
    if ext.lstrip(".") not in settings.ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValidationError(f"File type {ext or '?'} is not allowed.")
    if f.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise ValidationError(f"File is larger than {settings.MAX_UPLOAD_MB} MB.")
    if f.size == 0:
        raise ValidationError("File is empty.")
    sigs = SIGNATURES.get(ext)
    if sigs:
        head = f.read(8)
        f.seek(0)
        if not any(head.startswith(s) for s in sigs):
            raise ValidationError("File content does not match its extension.")
    return ext, (mimetypes.guess_type(f.name)[0] or "application/octet-stream")
