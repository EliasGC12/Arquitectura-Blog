"""
URL configuration for blog_core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from usuarios.views import BlogTokenObtainPairView

from posts.taxonomy_urls import category_urlpatterns, tag_urlpatterns
from posts.views import (
    AuthorCommentListView,
    CommentInboxView,
    CommentLikeView,
    NotificationListView,
    NotificationReadView,
    PendingCommentListView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', BlogTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/usuarios/', include('usuarios.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/categories/', include(category_urlpatterns)),
    path('api/tags/', include(tag_urlpatterns)),
    path('api/notifications/', NotificationListView.as_view(), name='notifications'),
    path('api/notifications/<int:pk>/read/', NotificationReadView.as_view(), name='notification-read'),
    path('api/comments/<int:pk>/like/', CommentLikeView.as_view(), name='comment-like'),
    path('api/comments/mine/', AuthorCommentListView.as_view(), name='my-comments'),
    path('api/comments/inbox/', CommentInboxView.as_view(), name='comment-inbox'),
    path('api/comments/pending/', PendingCommentListView.as_view(), name='comment-pending'),
    path('api/comments/', include('posts.moderation_urls')),
]

if settings.SERVE_MEDIA:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
