import re

from django.db import IntegrityError, transaction
from django.utils.text import slugify
from rest_framework import serializers

from blog_core.media_urls import PublicImageField, absolute_media_url
from usuarios.models import Usuario

from .models import Category, Comment, Notification, Post, Tag

TITLE_FONTS = {
    "Arial",
    "Times New Roman",
    "Courier New",
    "Georgia",
    "Verdana",
    "Trebuchet MS",
    "Comic Sans MS",
    "Impact",
    "Roboto",
    "Open Sans",
}
from .permissions import AUTHOR_STATES, is_moderator


def unique_slug(model, base, max_length):
    base = (base or "item")[:max_length]
    candidate = base
    index = 2
    while model.objects.filter(slug=candidate).exists():
        suffix = f"-{index}"
        candidate = f"{base[: max_length - len(suffix)]}{suffix}"
        index += 1
    return candidate


def media_url(file_field, request):
    return absolute_media_url(file_field, request)


def user_summary(user, request):
    return {
        "id": user.id,
        "username": user.username,
        "rol": getattr(user, "rol", ""),
        "profile_picture": media_url(getattr(user, "profile_picture", None), request),
    }


def get_or_create_by_name(model, nombre, max_length):
    nombre = " ".join((nombre or "").split())
    if not nombre:
        raise serializers.ValidationError("Escribe un nombre.")
    if len(nombre) > max_length:
        raise serializers.ValidationError(
            f"El nombre no puede superar {max_length} caracteres."
        )

    existing = model.objects.filter(nombre__iexact=nombre).first()
    if existing:
        return existing

    slug = unique_slug(model, slugify(nombre), max_length)
    try:
        with transaction.atomic():
            return model.objects.create(nombre=nombre, slug=slug)
    except IntegrityError:
        existing = model.objects.filter(nombre__iexact=nombre).first()
        if existing:
            return existing
        raise


class CategorySerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = ("id", "nombre", "slug")

    def validate(self, attrs):
        if "nombre" in attrs:
            attrs["nombre"] = " ".join(attrs["nombre"].split())
        if not attrs.get("slug"):
            nombre = attrs.get("nombre") or getattr(self.instance, "nombre", "")
            attrs["slug"] = slugify(nombre) or "categoria"
        return attrs

    def create(self, validated_data):
        return get_or_create_by_name(Category, validated_data.get("nombre", ""), 80)


class TagSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = Tag
        fields = ("id", "nombre", "slug")

    def validate(self, attrs):
        if "nombre" in attrs:
            attrs["nombre"] = " ".join(attrs["nombre"].split())
        if not attrs.get("slug"):
            nombre = attrs.get("nombre") or getattr(self.instance, "nombre", "")
            attrs["slug"] = slugify(nombre) or "etiqueta"
        return attrs

    def create(self, validated_data):
        return get_or_create_by_name(Tag, validated_data.get("nombre", ""), 40)


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Comment
        fields = (
            "id",
            "post",
            "author",
            "content",
            "is_approved",
            "created_at",
            "parent",
            "reply_to",
            "likes_count",
            "liked_by_me",
        )
        read_only_fields = (
            "post",
            "author",
            "created_at",
            "is_approved",
            "reply_to",
            "likes_count",
            "liked_by_me",
        )
        extra_kwargs = {
            "content": {"error_messages": {"blank": "El comentario no puede estar vacío."}},
        }

    def get_author(self, obj):
        request = self.context.get("request") if self.context else None
        return user_summary(obj.author, request)

    def get_reply_to(self, obj):
        parent = obj.parent
        if parent is None:
            return None
        return parent.author.username

    def get_likes_count(self, obj):
        return len(obj.likes.all())

    def get_liked_by_me(self, obj):
        request = self.context.get("request") if self.context else None
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return any(like.user_id == user.id for like in obj.likes.all())

    def validate_content(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El comentario no puede estar vacío.")
        return value


class NotificationSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    related_post = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "message",
            "is_read",
            "created_at",
            "related_post",
            "sender",
        )

    def get_sender(self, obj):
        if obj.sender_id is None:
            return None
        return obj.sender.username


class OwnedCommentSerializer(CommentSerializer):
    post_titulo = serializers.CharField(source="post.titulo", read_only=True)

    class Meta(CommentSerializer.Meta):
        fields = (*CommentSerializer.Meta.fields, "post_titulo")


class PostSerializer(serializers.ModelSerializer):
    image = PublicImageField(required=False, allow_null=True)
    autor = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source="category",
        write_only=True,
        allow_null=True,
        required=False,
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        source="tags",
        many=True,
        write_only=True,
        required=False,
    )
    category_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tag_names = serializers.ListField(
        child=serializers.CharField(allow_blank=True),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Post
        fields = (
            "id",
            "titulo",
            "titulo_font",
            "titulo_color",
            "titulo_bold",
            "titulo_italic",
            "contenido",
            "autor",
            "category",
            "category_id",
            "category_name",
            "tags",
            "tag_ids",
            "tag_names",
            "image",
            "video_url",
            "estado",
            "fecha_creacion",
            "fecha_actualizacion",
            "comments",
        )
        read_only_fields = ("fecha_creacion", "fecha_actualizacion")
        extra_kwargs = {
            "video_url": {"required": False, "allow_blank": True, "allow_null": True},
            "image": {"required": False, "allow_null": True},
        }

    def get_autor(self, obj):
        request = self.context.get("request")
        return user_summary(obj.autor, request)

    def get_comments(self, obj):
        comments = list(obj.comments.all())
        user = self.context["request"].user
        if not is_moderator(user):
            comments = [comment for comment in comments if comment.is_approved]
        return CommentSerializer(comments, many=True, context=self.context).data

    def validate_titulo_font(self, value):
        value = (value or "").strip()
        if value and value not in TITLE_FONTS:
            raise serializers.ValidationError("Esa fuente no está disponible.")
        return value

    def validate_titulo_color(self, value):
        value = (value or "").strip().lower()
        if not value:
            return ""
        if not re.fullmatch(r"#[0-9a-f]{6}", value):
            raise serializers.ValidationError("Usa un color hexadecimal de 6 dígitos.")
        return value

    def validate_video_url(self, value):
        if value is None:
            return None
        value = value.strip()
        return value or None

    def validate_estado(self, value):
        user = self.context["request"].user
        if is_moderator(user):
            return value
        if getattr(user, "rol", None) == Usuario.Rol.AUTOR and value in AUTHOR_STATES:
            return value
        if self.instance is not None and self.instance.estado == value:
            return value
        if self.instance is None:
            return Post.Estado.PENDIENTE_REVISION
        raise serializers.ValidationError(
            "Solo puedes usar BORRADOR o PENDIENTE_REVISION. Publicar o archivar corresponde a un supervisor, editor o administrador."
        )

    def validate_contenido(self, value):
        return value or ""

    def create(self, validated_data):
        validated_data = self._resolve_taxonomy(validated_data)
        user = self.context["request"].user
        validated_data["autor"] = user
        if not is_moderator(user):
            estado = validated_data.get("estado", Post.Estado.PENDIENTE_REVISION)
            if estado not in AUTHOR_STATES:
                estado = Post.Estado.PENDIENTE_REVISION
            validated_data["estado"] = estado
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._resolve_taxonomy(validated_data)
        return super().update(instance, validated_data)

    def _resolve_taxonomy(self, validated_data):
        category_name = validated_data.pop("category_name", None)
        tag_names = validated_data.pop("tag_names", None)
        if isinstance(category_name, str) and category_name.strip():
            validated_data["category"] = get_or_create_by_name(Category, category_name, 80)

        if tag_names:
            tags = list(validated_data.get("tags", []))
            for name in tag_names:
                if isinstance(name, str) and name.strip():
                    tags.append(get_or_create_by_name(Tag, name, 40))
            unique = []
            seen = set()
            for tag in tags:
                if tag.pk in seen:
                    continue
                seen.add(tag.pk)
                unique.append(tag)
            validated_data["tags"] = unique

        return validated_data
