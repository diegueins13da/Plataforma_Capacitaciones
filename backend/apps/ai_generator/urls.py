from django.urls import path

from .views import DocumentUploadView, GenerateQuestionsView, TaskStatusView

urlpatterns = [
    path("ai/upload/", DocumentUploadView.as_view(), name="ai-upload"),
    path("ai/tasks/<str:task_id>/", TaskStatusView.as_view(), name="ai-task-status"),
    path("ai/generate-questions/", GenerateQuestionsView.as_view(), name="ai-generate-questions"),
]
