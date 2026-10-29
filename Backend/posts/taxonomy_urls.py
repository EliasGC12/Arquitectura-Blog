from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, TagViewSet

category_router = DefaultRouter()
category_router.register("", CategoryViewSet, basename="category")

tag_router = DefaultRouter()
tag_router.register("", TagViewSet, basename="tag")

category_urlpatterns = category_router.urls
tag_urlpatterns = tag_router.urls
