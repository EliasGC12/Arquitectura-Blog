from django.contrib import admin

from .models import Category, Comment, Notification, Post, Tag


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug")
    search_fields = ("nombre", "slug")
    prepopulated_fields = {"slug": ("nombre",)}


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug")
    search_fields = ("nombre", "slug")
    prepopulated_fields = {"slug": ("nombre",)}


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("titulo", "autor", "category", "estado", "fecha_creacion")
    fields = (
        "titulo",
        "contenido",
        "autor",
        "category",
        "tags",
        "image",
        "video_url",
        "estado",
        "fecha_creacion",
        "fecha_actualizacion",
    )
    list_filter = ("estado", "category", "tags")
    search_fields = ("titulo", "contenido", "autor__username")
    readonly_fields = ("fecha_creacion", "fecha_actualizacion")
    filter_horizontal = ("tags",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "notification_type", "is_read", "created_at")
    list_filter = ("notification_type", "is_read")
    search_fields = ("message", "recipient__username")
    readonly_fields = ("created_at",)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("post", "author", "is_approved", "created_at")
    list_filter = ("is_approved",)
    search_fields = ("content", "author__username", "post__titulo")
    readonly_fields = ("created_at",)
