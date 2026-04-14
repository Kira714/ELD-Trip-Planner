from django.urls import path
from .views import CalculateTripView, LocationSuggestView, HealthCheckView

urlpatterns = [
    path('healthz/', HealthCheckView.as_view(), name='healthz'),
    path('location-suggest/', LocationSuggestView.as_view(), name='location-suggest'),
    path('calculate-trip/', CalculateTripView.as_view(), name='calculate-trip'),
]
