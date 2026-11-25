from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts import api as acc
from accounts import social
from analytics.api import ContentOverviewView, DashboardView
from assistant.api import AssistantChatView, AssistantStatusView
from cases import admin_api as cases
from cases import portal_api as portal
from catalog import public_api as pub
from crm import admin_api as crm
from crm import chat_api as chat
from crm import live_chat_api as live
from crm import public_api as forms
from finance import api as fin
from notifications import api as notif
from tools import api as tools

from .admin_crud import RESOURCES

admin = DefaultRouter()
admin.register("leads", crm.LeadViewSet, basename="lead")
admin.register("patients", crm.PatientViewSet, basename="patient")
admin.register("notes", crm.NoteViewSet, basename="note")
admin.register("communications", crm.CommunicationViewSet, basename="communication")
admin.register("tasks", crm.TaskViewSet, basename="task")
admin.register("cases", cases.CaseViewSet, basename="case")
admin.register("documents", cases.DocumentViewSet, basename="document")
admin.register("quotations", cases.QuotationViewSet, basename="quotation")
admin.register("appointments", cases.AppointmentViewSet, basename="appointment")
admin.register("travel", cases.TravelViewSet, basename="travel")
admin.register("payments", fin.PaymentViewSet, basename="payment")
admin.register("expenses", fin.ExpenseViewSet, basename="expense")
admin.register("commissions", fin.CommissionViewSet, basename="commission")
admin.register("users", acc.StaffUserViewSet, basename="user")
for prefix, vs in RESOURCES.items():
    admin.register(prefix, vs, basename=prefix)

me = DefaultRouter()
me.register("cases", portal.MeCases, basename="me-case")
me.register("documents", portal.MeDocuments, basename="me-document")

partner = DefaultRouter()
partner.register("referrals", portal.PartnerReferrals, basename="partner-referral")

common = DefaultRouter()
common.register("notifications", notif.NotificationViewSet, basename="notification")

urlpatterns = [
    # auth
    path("auth/register/", acc.RegisterView.as_view()),
    path("auth/partner-register/", acc.PartnerRegisterView.as_view()),
    path("auth/login/", acc.LoginView.as_view()),
    path("auth/methods/", social.AuthMethodsView.as_view()),
    path("auth/sms/request/", social.SmsRequestView.as_view()),
    path("auth/sms/verify/", social.SmsVerifyView.as_view()),
    path("auth/google/", social.GoogleLoginView.as_view()),
    path("auth/refresh/", acc.CookieTokenRefreshView.as_view()),
    path("auth/logout/", acc.LogoutView.as_view()),
    path("auth/me/", acc.MeView.as_view()),
    path("auth/change-password/", acc.ChangePasswordView.as_view()),
    # public catalog
    path("public/site/", pub.SiteView.as_view()),
    path("public/home/", pub.HomeView.as_view()),
    path("public/filters/", pub.FiltersView.as_view()),
    path("public/search/", pub.SearchView.as_view()),
    path("public/sitemap/", pub.SitemapView.as_view()),
    path("public/destinations/", pub.CountryList.as_view()),
    path("public/destinations/<str:slug>/", pub.CountryDetail.as_view()),
    path("public/specialties/", pub.SpecialtyList.as_view()),
    path("public/treatments/", pub.TreatmentList.as_view()),
    path("public/treatments/<slug:slug>/", pub.TreatmentDetail.as_view()),
    path("public/hospitals/", pub.HospitalList.as_view()),
    path("public/hospitals/compare/", pub.HospitalCompare.as_view()),
    path("public/hospitals/<slug:slug>/", pub.HospitalDetail.as_view()),
    path("public/doctors/", pub.DoctorList.as_view()),
    path("public/doctors/<slug:slug>/", pub.DoctorDetail.as_view()),
    path("public/packages/", pub.PackageList.as_view()),
    path("public/packages/compare/", pub.PackageCompare.as_view()),
    path("public/packages/<slug:slug>/", pub.PackageDetail.as_view()),
    path("public/services/", pub.ServiceList.as_view()),
    path("public/services/<slug:slug>/", pub.ServiceDetail.as_view()),
    path("public/faqs/", pub.FAQList.as_view()),
    path("public/testimonials/", pub.TestimonialList.as_view()),
    path("public/posts/", pub.PostList.as_view()),
    path("public/posts/<slug:slug>/", pub.PostDetail.as_view()),
    path("public/pages/<slug:slug>/", pub.PageView.as_view()),
    path("public/sections/<slug:page>/", pub.SectionsView.as_view()),
    # public forms
    path("forms/consultation/", forms.ConsultationView.as_view()),
    path("forms/second-opinion/", forms.SecondOpinionView.as_view()),
    path("forms/track/", forms.TrackView.as_view()),
    # tools
    path("tools/rates/", tools.RatesView.as_view()),
    path("tools/convert/", tools.ConvertView.as_view()),
    path("tools/match/", tools.MatchView.as_view()),
    path("tools/destination-finder/", tools.DestinationFinderView.as_view()),
    path("tools/cost-compare/", tools.CostCompareView.as_view()),
    path("assistant/status/", AssistantStatusView.as_view()),
    path("assistant/chat/", AssistantChatView.as_view()),
    # private files (signed, expiring)
    path("files/<str:token>/", cases.FileDownloadView.as_view()),
    # patient portal
    path("me/overview/", portal.MeOverview.as_view()),
    path("me/counters/", notif.CountersView.as_view()),
    path("me/chat/", chat.MyChatView.as_view()),
    path("live-chat/", live.LiveChatView.as_view()),
    path("live-chat/contact/", live.LiveChatContactView.as_view()),
    path("live-chat/files/<int:message_id>/", live.LiveChatFileView.as_view()),
    path("me/chat/unread/", chat.MyChatUnreadView.as_view()),
    path("me/profile/", portal.MeProfile.as_view()),
    path("me/consents/", portal.MeConsents.as_view()),
    path("me/consents/<int:pk>/revoke/", portal.MeConsentRevoke.as_view()),
    path("me/requests/", portal.MeRequests.as_view()),
    path("me/quotations/", portal.MeQuotations.as_view()),
    path("me/opinions/<int:pk>/link/", portal.MeOpinionFile.as_view()),
    path("me/", include(me.urls)),
    # partner portal
    path("partner/profile/", portal.PartnerProfile.as_view()),
    path("partner/", include(partner.urls)),
    # staff
    path("admin/dashboard/", DashboardView.as_view()),
    path("admin/content-overview/", ContentOverviewView.as_view()),
    path("admin/chats/", chat.ChatListView.as_view()),
    path("admin/chats/<int:patient_id>/", chat.ChatThreadView.as_view()),
    path("admin/visitor-chats/", live.VisitorChatListView.as_view()),
    path("admin/visitor-chats/<int:chat_id>/", live.VisitorChatThreadView.as_view()),
    path("admin/staff/", acc.StaffDirectoryView.as_view()),
    path("admin/integrations/", notif.IntegrationsView.as_view()),
    path("admin/integrations/<str:key>/test/", notif.TestIntegrationView.as_view()),
    path("admin/rates/refresh/", tools.RefreshRatesView.as_view()),
    path("admin/referrals/<int:pk>/message/", portal.PartnerMessageStaff.as_view()),
    path("admin/", include(admin.urls)),
    path("", include(common.urls)),
]
