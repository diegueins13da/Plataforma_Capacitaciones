from django.urls import path

from .views import MarkReadView, NotificationListView

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/mark-read/", MarkReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/mark-read/<int:pk>/", MarkReadView.as_view(), name="notification-mark-read"),
]
