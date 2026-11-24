from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from audit.service import log as audit
from notifications.service import notify, notify_staff

from .models import Lead, LeadActivity, LeadSource, LeadStage, Patient


def activity(lead=None, patient=None, actor=None, type="note", message="", **kw):
    return LeadActivity.objects.create(lead=lead, patient=patient or (lead.patient if lead else None), actor=actor,
                                       type=type, message=message, **kw)


def next_position(stage):
    top = Lead.objects.filter(stage=stage).aggregate(m=Max("position"))["m"]
    return (top or 0) + 1000


def get_or_create_patient(full_name, phone, email="", user=None, country=None, created_by=None):
    """Find or create the CRM patient record.

    SECURITY: a logged-in user is only ever matched to the record linked to *their* account. Matching an
    account to an existing record by phone number would let anyone who registers with another person's
    phone read that person's medical records. Staff merge duplicates manually after verifying identity.
    Anonymous submissions (no account) are de-duplicated by phone among records without an account.
    """
    if user is not None:
        patient = Patient.objects.filter(user=user).first()
        if patient is None:
            patient = Patient.objects.create(full_name=full_name or phone, phone=phone, email=email or "",
                                             user=user, country=country, created_by=created_by)
        return patient
    patient = None
    if phone:
        patient = Patient.objects.filter(phone=phone, user__isnull=True).order_by("created_at").first()
    if patient is None:
        patient = Patient.objects.create(full_name=full_name or phone, phone=phone, email=email or "",
                                         country=country, created_by=created_by)
    return patient


@transaction.atomic
def create_lead(request, source_code="website", **data):
    source, _ = LeadSource.objects.get_or_create(code=source_code, defaults={"name": source_code.replace("_", " ").title()})
    user = request.user if request and request.user.is_authenticated else None
    patient = get_or_create_patient(data.get("full_name", ""), data.get("phone", ""), data.get("email", ""),
                                    user=user, country=data.get("resident_country"))
    lead = Lead.objects.create(patient=patient, source=source, position=next_position(LeadStage.NEW),
                               created_by=user, **data)
    activity(lead, actor=user, type="created", message=f"Lead created from {source.name}",
             meta={"key": "lead_created", "source": source.code})
    audit(request, "lead.created", lead, summary=lead.full_name, changes={"source": source.code})
    notify_staff("new_lead", key="lead_new", args={"name": lead.full_name},
                 body=f"{lead.phone} · {lead.treatment or lead.specialty or lead.message[:80]}",
                 link=f"/admin/crm?lead={lead.pk}")
    return lead


@transaction.atomic
def move_lead(request, lead, stage, position=None, lost_reason=""):
    old = lead.stage
    lead.stage = stage
    lead.position = position if position is not None else next_position(stage)
    if stage == LeadStage.LOST and lost_reason:
        lead.lost_reason = lost_reason
    fields = ["stage", "position", "lost_reason", "updated_at"]
    if old != stage:
        lead.stage_changed_at = timezone.now()
        fields.append("stage_changed_at")
    lead.save(update_fields=fields)
    if old != stage:
        activity(lead, actor=request.user, type="stage_changed", from_stage=old, to_stage=stage,
                 message=f"{LeadStage(old).label} → {LeadStage(stage).label}")
        audit(request, "lead.stage_changed", lead, changes={"from": old, "to": stage})
        if lead.assigned_to_id and lead.assigned_to_id != request.user.pk:
            notify([lead.assigned_to], "status_change", key="lead_stage", args={"name": lead.full_name, "stage": stage},
                   link=f"/admin/crm?lead={lead.pk}")
    return lead


def assign_lead(request, lead, user):
    old = lead.assigned_to
    lead.assigned_to = user
    lead.save(update_fields=["assigned_to", "updated_at"])
    activity(lead, actor=request.user, type="assigned",
             message=f"Assigned to {user.get_full_name() or user.username}" if user else "Unassigned",
             meta={"key": "assigned", "name": user.get_full_name() or user.username} if user else {"key": "unassigned"})
    audit(request, "lead.assigned", lead, changes={"from": getattr(old, "pk", None), "to": getattr(user, "pk", None)})
    if user and user != request.user:
        notify([user], "new_task", key="lead_assigned", args={"name": lead.full_name}, link=f"/admin/crm?lead={lead.pk}")
