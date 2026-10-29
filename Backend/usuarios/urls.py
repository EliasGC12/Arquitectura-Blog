from django.urls import path

from .views import ApproveUserView, PendingUserListView, RegisterView, RejectUserView, UserDetailView

urlpatterns = [
    path("registro/", RegisterView.as_view(), name="registro"),
    path("perfil/", UserDetailView.as_view(), name="perfil"),
    path("pendientes/", PendingUserListView.as_view(), name="usuarios-pendientes"),
    path("<int:pk>/aprobar/", ApproveUserView.as_view(), name="usuario-aprobar"),
    path("<int:pk>/rechazar/", RejectUserView.as_view(), name="usuario-rechazar"),
]
