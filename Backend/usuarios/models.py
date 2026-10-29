from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        SUPERVISOR = "SUPERVISOR", "Supervisor"
        EDITOR = "EDITOR", "Editor"
        AUTOR = "AUTOR", "Autor"
        LECTOR = "LECTOR", "Lector"

    class EstadoCuenta(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADO = "APROBADO", "Aprobado"
        RECHAZADO = "RECHAZADO", "Rechazado"

    rol = models.CharField(
        max_length=12,
        choices=Rol.choices,
        default=Rol.LECTOR,
    )
    estado_cuenta = models.CharField(
        max_length=12,
        choices=EstadoCuenta.choices,
        default=EstadoCuenta.PENDIENTE,
    )
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to="perfiles/", blank=True, null=True)
    cover_color = models.CharField(max_length=7, default="#1b4f9c")
    cover_image = models.ImageField(upload_to="portadas/", blank=True, null=True)

