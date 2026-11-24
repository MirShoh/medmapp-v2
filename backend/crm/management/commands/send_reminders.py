"""Send due reminders. Run every few minutes (docker-compose `scheduler` service or cron):

    python manage.py send_reminders

- Tasks: when remind_at (or due_at if no remind_at) has passed, notify the assignee once.
- Leads: when next_follow_up has passed, notify the assigned manager once per follow-up date.
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from crm.models import Lead, LeadStage, Task
from notifications.service import notify


class Command(BaseCommand):
    help = "Send task and follow-up reminders that are due."

    def handle(self, *args, **opts):
        now = timezone.now()
        tasks = (Task.objects.filter(status__in=["open", "in_progress"], reminder_sent=False, assignee__isnull=False)
                 .filter(Q(remind_at__lte=now) | Q(remind_at__isnull=True, due_at__lte=now)).select_related("assignee", "lead"))
        sent_t = 0
        for t in tasks:
            notify([t.assignee], "follow_up", key="task_reminder", args={"title": t.title},
                   body=f"{t.due_at:%d.%m.%Y %H:%M}" if t.due_at else "", link="/admin/tasks", email=True)
            t.reminder_sent = True
            t.save(update_fields=["reminder_sent"])
            sent_t += 1
        leads = (Lead.objects.filter(next_follow_up__lte=now, follow_up_notified_at__isnull=True, assigned_to__isnull=False)
                 .exclude(stage__in=[LeadStage.COMPLETED, LeadStage.LOST]).select_related("assigned_to"))
        sent_l = 0
        for lead in leads:
            notify([lead.assigned_to], "follow_up", key="lead_follow_up", args={"name": lead.full_name}, body=lead.phone,
                   link=f"/admin/crm?lead={lead.pk}", email=True)
            lead.follow_up_notified_at = now
            lead.save(update_fields=["follow_up_notified_at"])
            sent_l += 1
        self.stdout.write(f"reminders sent: tasks={sent_t} leads={sent_l}")
