"""Forgiving search: the way people actually type on a phone.

- Accents and special letters are ignored: "acibadem" finds "Acıbadem", "sisli" finds "Şişli", "munchen" finds "München".
- Every apostrophe spelling is the same: o'z = o‘z = o`z = oʻz = oz.
- Translated fields are searched in all languages, so an English name also works on the Uzbek site.
- Every word must match somewhere (AND), in any of the fields (OR).

Matching runs in Python over the few columns being searched. The public catalogue is small (hundreds of rows), so
this is fast and works the same on SQLite and PostgreSQL. `FoldingSearchFilter` is the default DRF search backend.
"""
import re
import unicodedata

from rest_framework.filters import SearchFilter

_SPECIAL = str.maketrans({"ı": "i", "İ": "i", "ł": "l", "ø": "o", "æ": "ae", "ß": "ss", "đ": "d"})
_DROP = re.compile(r"['`ʻʼ‘’]")


def fold(text) -> str:
    """Lower-case, strip accents and apostrophes: 'Acıbadem Şişli O‘zbekiston' -> 'acibadem sisli ozbekiston'."""
    s = _DROP.sub("", str(text or "").translate(_SPECIAL).lower())
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def _expand(model, path: str) -> list[str]:
    """'specialties__title' -> ['specialties__title_uz', 'specialties__title_ru', ...] for translated fields."""
    try:
        from modeltranslation.translator import NotRegistered, translator
    except ImportError:  # pragma: no cover
        return [path]
    parts, m = path.split("__"), model
    for p in parts[:-1]:
        m = m._meta.get_field(p).related_model
    try:
        opts = translator.get_options_for_model(m)
    except NotRegistered:
        return [path]
    if parts[-1] not in opts.fields:
        return [path]
    from django.conf import settings

    return [f"{path}_{code}" for code, _ in settings.LANGUAGES]


def _build(queryset, cols) -> dict:
    text: dict = {}
    for row in queryset.order_by().values_list("pk", *cols):
        text[row[0]] = text.get(row[0], "") + " " + " ".join(fold(v) for v in row[1:] if v)
    return text


# Public catalogue search index, kept in each worker's memory: {(model, cols): (catalog_version, built_at, {pk: text})}.
# Live search sends a request per keystroke; rebuilding the folded text from the database every time cost
# 150-250 ms per request. The index is rebuilt when the catalogue changes (public cache version) or after INDEX_TTL.
_INDEX: dict = {}
INDEX_TTL = 300


def _catalog_index(model, cols) -> dict:
    import time

    from config.public_cache import _version

    key = (model._meta.label, tuple(cols))
    version = _version()
    hit = _INDEX.get(key)
    if hit and hit[0] == version and time.monotonic() - hit[1] < INDEX_TTL:
        return hit[2]
    text = _build(model._default_manager.all(), cols)
    _INDEX[key] = (version, time.monotonic(), text)
    return text


def matching_ids(queryset, fields, query: str) -> list:
    """Primary keys of rows where every word of `query` appears in at least one of `fields`.

    For public catalogue models the ids come from the cached index over the whole table; callers always apply
    them as `queryset.filter(pk__in=…)`, so their own filters (active, country…) still hold."""
    from config.public_cache import CATALOG_APPS

    words = [fold(w) for w in query.split() if fold(w)]
    if not words:
        return list(queryset.values_list("pk", flat=True))
    cols = [c for f in fields for c in _expand(queryset.model, f.lstrip("^=@$"))]
    if queryset.model._meta.app_label in CATALOG_APPS:
        text = _catalog_index(queryset.model, cols)
    else:
        text = _build(queryset, cols)
    return [pk for pk, t in text.items() if all(w in t for w in words)]


PYTHON_LIMIT = 5000  # above this many rows fall back to the database's own icontains search


class FoldingSearchFilter(SearchFilter):
    def filter_queryset(self, request, queryset, view):
        fields = getattr(view, "search_fields", None)
        query = " ".join(self.get_search_terms(request))
        if not fields or not query:
            return queryset
        if queryset.order_by().count() > PYTHON_LIMIT:
            return super().filter_queryset(request, queryset, view)
        return queryset.filter(pk__in=matching_ids(queryset, fields, query))
