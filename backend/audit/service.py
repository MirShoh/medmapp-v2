from .models import AuditLog


def client_ip(request):
    if request is None:
        return None
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return (fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")) or None


def log(request, action, obj=None, summary="", changes=None, actor=None):
    user = actor or (request.user if request is not None and request.user.is_authenticated else None)
    return AuditLog.objects.create(
        actor=user,
        action=action,
        object_type=obj.__class__.__name__ if obj is not None else "",
        object_id=str(getattr(obj, "pk", "") or ""),
        summary=summary[:500],
        changes=changes or {},
        ip_address=client_ip(request),
    )
