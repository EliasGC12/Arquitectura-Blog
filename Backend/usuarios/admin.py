from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Perfil", {"fields": ("rol", "estado_cuenta", "bio", "profile_picture", "cover_color", "cover_image")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Perfil", {"fields": ("rol", "estado_cuenta", "bio", "profile_picture", "cover_color", "cover_image")}),
    )
    list_display = ("username", "email", "rol", "estado_cuenta", "is_staff")
    list_filter = UserAdmin.list_filter + ("rol", "estado_cuenta")
