from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import SAFE_METHODS, AllowAny, IsAuthenticated
from rest_framework.response import Response

from usuarios.models import Usuario

from .models import Category, Comment, CommentLike, Notification, Post, Tag
from .notify import push_notification
from .permissions import (
    CONTENT_ROLES,
    CanModerate,
    CommentPermission,
    PostPermission,
    TaxonomyPermission,
    is_moderator,
)
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    NotificationSerializer,
    OwnedCommentSerializer,
    PostSerializer,
    TagSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [TaxonomyPermission()]


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [TaxonomyPermission()]


class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [PostPermission]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [PostPermission()]

    def get_queryset(self):
        queryset = Post.objects.select_related("autor", "category").prefetch_related(
            "tags",
            "comments__author",
            "comments__parent__author",
            "comments__likes",
        )
        user = self.request.user
        if self.action == "list" and self._mine_requested():
            if not user.is_authenticated:
                raise PermissionDenied("Inicia sesión para ver tus publicaciones.")
            return queryset.filter(autor=user)

        status = (self.request.query_params.get("status") or "").strip()
        if self.action == "list" and status:
            if not is_moderator(user):
                raise PermissionDenied(
                    "Solo un supervisor, editor o administrador puede filtrar publicaciones por estado."
                )
            if status not in Post.Estado.values:
                raise ValidationError({"status": "Estado no válido."})
            return queryset.filter(estado=status)

        if self.action == "list":
            return queryset.filter(estado=Post.Estado.PUBLICADO)

        if is_moderator(user):
            return queryset
        if user.is_authenticated:
            return queryset.filter(Q(estado=Post.Estado.PUBLICADO) | Q(autor=user))
        return queryset.filter(estado=Post.Estado.PUBLICADO)

    def paginate_queryset(self, queryset):
        if self.action == "list" and self._mine_requested():
            return None
        return super().paginate_queryset(queryset)

    def _mine_requested(self):
        value = (self.request.query_params.get("mine") or "").strip().lower()
        return value in {"1", "true", "yes"}

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        post = self.get_object()
        post.estado = Post.Estado.PUBLICADO
        post.save(update_fields=["estado", "fecha_actualizacion"])
        push_notification(
            recipient=post.autor,
            sender=request.user,
            notification_type=Notification.Type.POST_APPROVED,
            message=f"Tu publicación «{post.titulo}» fue aceptada.",
            related_post=post,
        )
        return Response(self.get_serializer(post).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        message = self._feedback(request)
        post = self.get_object()
        post.estado = Post.Estado.ARCHIVADO
        post.save(update_fields=["estado", "fecha_actualizacion"])
        push_notification(
            recipient=post.autor,
            sender=request.user,
            notification_type=Notification.Type.POST_REJECTED,
            message=message,
            related_post=post,
        )
        return Response(self.get_serializer(post).data)

    def _feedback(self, request):
        message = request.data.get("message", "")
        if not isinstance(message, str):
            message = ""
        message = message.strip()
        if not message:
            raise ValidationError({"message": "Escribe el motivo del rechazo."})
        return message


class AuthorCommentListView(generics.ListAPIView):
    serializer_class = OwnedCommentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated or user.rol not in CONTENT_ROLES:
            return Comment.objects.none()
        return (
            Comment.objects.filter(post__autor=user)
            .select_related("author", "post", "parent__author")
            .prefetch_related("likes")
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated or user.rol not in CONTENT_ROLES:
            raise PermissionDenied(
                "Solo quien publica puede ver los comentarios de sus propias publicaciones."
            )
        return super().list(request, *args, **kwargs)


class CommentInboxView(generics.ListAPIView):
    serializer_class = OwnedCommentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        base = Comment.objects.select_related("author", "post", "parent__author")
        if getattr(user, "rol", None) == Usuario.Rol.LECTOR:
            return base.filter(author=user).prefetch_related("likes").order_by("-created_at")
        return (
            base.filter(post__autor=user)
            .exclude(author=user)
            .prefetch_related("likes")
            .order_by("-created_at")
        )


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    queryset = Comment.objects.select_related("author", "parent__author").prefetch_related("likes")
    http_method_names = ["get", "post", "head", "options"]

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [AllowAny()]
        return [CommentPermission()]

    def get_queryset(self):
        queryset = super().get_queryset().filter(post=self.get_post())
        user = self.request.user
        if is_moderator(user):
            return queryset
        return queryset.filter(is_approved=True)

    def perform_create(self, serializer):
        user = self.request.user
        post = self.get_post()
        parent = serializer.validated_data.get("parent")
        if parent is not None and parent.post_id != post.id:
            raise ValidationError(
                {"parent": "La respuesta debe pertenecer a la misma publicación."}
            )
        comment = serializer.save(
            author=user,
            post=post,
            is_approved=True,
        )
        self._notify_new_comment(user, post, comment)

    def get_post(self):
        if not hasattr(self, "_post"):
            post = get_object_or_404(Post, pk=self.kwargs["post_id"])
            if not self._can_view_post(post):
                raise Http404
            self._post = post
        return self._post

    def _can_view_post(self, post):
        if post.estado == Post.Estado.PUBLICADO:
            return True

        user = self.request.user
        if not user.is_authenticated:
            return False

        return post.autor_id == user.id or is_moderator(user)

    def _notify_new_comment(self, user, post, comment):
        parent = comment.parent
        if parent is not None:
            push_notification(
                recipient=parent.author,
                sender=user,
                notification_type=Notification.Type.COMMENT_REPLY,
                message=f"{user.username} respondió tu comentario en «{post.titulo}».",
                related_post=post,
            )
            if post.autor_id not in {user.id, parent.author_id}:
                push_notification(
                    recipient=post.autor,
                    sender=user,
                    notification_type=Notification.Type.NEW_COMMENT,
                    message=f"{user.username} comentó en «{post.titulo}».",
                    related_post=post,
                )
            return

        push_notification(
            recipient=post.autor,
            sender=user,
            notification_type=Notification.Type.NEW_COMMENT,
            message=f"{user.username} comentó en «{post.titulo}».",
            related_post=post,
        )


class PendingCommentListView(generics.ListAPIView):
    serializer_class = OwnedCommentSerializer
    permission_classes = [CanModerate]
    pagination_class = None

    def get_queryset(self):
        return (
            Comment.objects.filter(is_approved=False)
            .select_related("author", "post", "parent__author")
            .prefetch_related("likes")
            .order_by("-created_at")
        )


class CommentModerationViewSet(viewsets.GenericViewSet):
    queryset = Comment.objects.select_related("author", "post")
    serializer_class = CommentSerializer
    permission_classes = [CanModerate]
    http_method_names = ["patch", "post", "options"]

    @action(detail=True, methods=["patch"], url_path="approve")
    def approve(self, request, pk=None):
        comment = self.get_object()
        comment.is_approved = self._as_bool(request.data.get("is_approved", True))
        comment.save(update_fields=["is_approved"])
        return Response(self.get_serializer(comment).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        message = request.data.get("message", "")
        if not isinstance(message, str):
            message = ""
        message = message.strip()
        if not message:
            raise ValidationError({"message": "Escribe el motivo del rechazo."})
        comment = self.get_object()
        push_notification(
            recipient=comment.author,
            sender=request.user,
            notification_type=Notification.Type.COMMENT_REJECTED,
            message=message,
            related_post=comment.post,
        )
        comment.delete()
        return Response(status=204)

    def _as_bool(self, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() not in {"false", "0", "no", "rechazado"}
        return bool(value)


class CommentLikeView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        comment = get_object_or_404(Comment.objects.select_related("post"), pk=pk)
        like = CommentLike.objects.filter(comment=comment, user=request.user).first()
        if like is None:
            CommentLike.objects.create(comment=comment, user=request.user)
            liked = True
        else:
            like.delete()
            liked = False
        return Response(
            {
                "id": comment.id,
                "liked": liked,
                "likes_count": comment.likes.count(),
            }
        )


class NotificationListView(generics.GenericAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = (
            Notification.objects.filter(recipient=request.user)
            .select_related("sender", "related_post")
            .order_by("-created_at")
        )
        unread_count = queryset.filter(is_read=False).count()
        results = self.get_serializer(queryset[:40], many=True).data
        return Response({"unread_count": unread_count, "results": results})


class NotificationReadView(generics.GenericAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        notice = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notice.is_read = True
        notice.save(update_fields=["is_read"])
        return Response(self.get_serializer(notice).data)
