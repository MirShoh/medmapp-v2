# doctors/urls.py
from django.urls import path

from .views import DoctorDetailView, DoctorListView

urlpatterns = [
    path("", DoctorListView.as_view(), name="doctors-list"),
    path("<slug:slug>/", DoctorDetailView.as_view(), name="doctors-detail"),
]
