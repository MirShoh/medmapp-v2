"""Factory for permission-checked, audited admin CRUD viewsets."""
from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasPerm
from audit.service import log as audit


def model_serializer(model, fields="__all__", exclude=None, extra=None, read_only=()):
    meta_attrs = {"model": model, "read_only_fields": tuple(read_only)}
    if exclude:
        meta_attrs["exclude"] = exclude
    else:
        meta_attrs["fields"] = fields
    attrs = {"Meta": type("Meta", (), meta_attrs)}
    attrs.update(extra or {})
    return type(f"{model.__name__}AdminSerializer", (serializers.ModelSerializer,), attrs)


def optimize_relations(qs):
    """select_related for forward foreign keys / one-to-one, prefetch_related for many-to-many fields."""
    fks, m2m = [], []
    for f in qs.model._meta.get_fields():
        if not f.is_relation or f.auto_created or not f.concrete and not f.many_to_many:
            continue
        if f.many_to_many:
            m2m.append(f.name)
        elif f.many_to_one or f.one_to_one:
            fks.append(f.name)
    if fks:
        qs = qs.select_related(*fks)
    if m2m:
        qs = qs.prefetch_related(*m2m)
    return qs


class AuditedModelViewSet(viewsets.ModelViewSet):
    audit_name = None
    # Boolean fields staff may switch for many rows at once (POST <resource>/bulk/).
    bulk_fields = ()
    # Extra query-string filters: {"param": callable(queryset, value) -> queryset}
    extra_filters = {}
    # Generated CRUD viewsets load related rows up front (no query per row for FKs / many-to-many fields).
    auto_optimize = False

    def get_queryset(self):
        qs = super().get_queryset()
        if self.auto_optimize:
            qs = optimize_relations(qs)
        for param, fn in self.extra_filters.items():
            value = self.request.query_params.get(param)
            if value not in (None, ""):
                qs = fn(qs, value)
        return qs

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """Set one allowed boolean field on several rows: {"ids": [1, 2], "field": "is_verified", "value": true}."""
        ids, field, value = request.data.get("ids") or [], request.data.get("field"), request.data.get("value")
        if field not in self.bulk_fields or not isinstance(value, bool) or not isinstance(ids, list) or not ids:
            return Response({"detail": "Invalid bulk update."}, status=400)
        if len(ids) > 500:
            return Response({"detail": "Too many rows (max 500)."}, status=400)
        with transaction.atomic():
            rows = list(self.get_queryset().filter(pk__in=ids))
            for obj in rows:
                setattr(obj, field, value)
                obj.save(update_fields=[field])
                audit(request, f"{self._name()}.updated", obj, summary=str(obj)[:200], changes={field: str(value)})
        return Response({"updated": len(rows)})

    def _name(self):
        return self.audit_name or self.get_queryset().model.__name__.lower()

    def perform_create(self, serializer):
        obj = serializer.save()
        audit(self.request, f"{self._name()}.created", obj, summary=str(obj)[:200])

    def perform_update(self, serializer):
        obj = serializer.save()
        changed = {k: str(v)[:200] for k, v in self.request.data.items() if not hasattr(v, "read")}
        audit(self.request, f"{self._name()}.updated", obj, summary=str(obj)[:200], changes=changed)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        label = str(obj)[:200]
        try:
            obj.delete()
        except ProtectedError:
            return Response({"detail": "This item is referenced by other records and cannot be deleted. "
                                       "Deactivate it instead."}, status=409)
        audit(request, f"{self._name()}.deleted", None, summary=label)
        return Response(status=204)


def crud(model, read="catalog.view", write="catalog.edit", search=(), filters=(), ordering=None,
         serializer=None, queryset=None, read_only=(), bulk=(), extra_filters=None):
    attrs = {
        "queryset": queryset if queryset is not None else model.objects.all(),
        "serializer_class": serializer or model_serializer(model, read_only=read_only),
        "permission_classes": [HasPerm.of(read, write=write)],
        "search_fields": tuple(search),
        "filterset_fields": tuple(filters),
        "bulk_fields": tuple(bulk),
        "extra_filters": extra_filters or {},
        "auto_optimize": True,
    }
    if ordering:
        attrs["ordering"] = ordering
    return type(f"{model.__name__}AdminViewSet", (AuditedModelViewSet,), attrs)
