from rest_framework.routers import DefaultRouter

from .views import CommentModerationViewSet

router = DefaultRouter()
router.register("", CommentModerationViewSet, basename="comment")

urlpatterns = router.urls
