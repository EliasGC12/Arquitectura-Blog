from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CommentViewSet, PostViewSet

router = DefaultRouter()
router.register("", PostViewSet, basename="post")

urlpatterns = [
    path(
        "<int:post_id>/comments/",
        CommentViewSet.as_view({"get": "list", "post": "create"}),
        name="post-comments",
    ),
    *router.urls,
]
