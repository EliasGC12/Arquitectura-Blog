from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True, blank=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nombre) or "categoria"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre


class Tag(models.Model):
    nombre = models.CharField(max_length=40, unique=True)
    slug = models.SlugField(max_length=40, unique=True, blank=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "etiqueta"
        verbose_name_plural = "etiquetas"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nombre) or "etiqueta"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre


class Post(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        PENDIENTE_REVISION = "PENDIENTE_REVISION", "Pendiente de revisión"
        PUBLICADO = "PUBLICADO", "Publicado"
        ARCHIVADO = "ARCHIVADO", "Archivado"

    titulo = models.CharField(max_length=255)
    titulo_font = models.CharField(max_length=40, blank=True, default="")
    titulo_color = models.CharField(max_length=7, blank=True, default="")
    titulo_bold = models.BooleanField(default=False)
    titulo_italic = models.BooleanField(default=False)
    contenido = models.TextField(
        help_text="HTML con estilos inline (font-family, color, font-weight, font-style) o Markdown.",
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        related_name="posts",
        null=True,
        blank=True,
    )
    tags = models.ManyToManyField(Tag, related_name="posts", blank=True)
    image = models.ImageField(upload_to="posts/images/", blank=True, null=True)
    video_url = models.URLField(blank=True, null=True)
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.BORRADOR,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return self.titulo


class Comment(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    content = models.TextField()
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="replies",
        null=True,
        blank=True,
    )
    is_approved = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.content[:50]


class CommentLike(models.Model):
    comment = models.ForeignKey(
        Comment,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comment_likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["comment", "user"], name="unique_comment_like"),
        ]

    def __str__(self):
        return f"{self.user} → {self.comment_id}"


class Notification(models.Model):
    class Type(models.TextChoices):
        POST_APPROVED = "POST_APPROVED", "Publicación aceptada"
        POST_REJECTED = "POST_REJECTED", "Publicación rechazada"
        COMMENT_REJECTED = "COMMENT_REJECTED", "Comentario rechazado"
        NEW_COMMENT = "NEW_COMMENT", "Nuevo comentario"
        COMMENT_REPLY = "COMMENT_REPLY", "Respuesta a un comentario"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="sent_notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(max_length=32, choices=Type.choices)
    message = models.TextField()
    related_post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.notification_type} → {self.recipient}"
