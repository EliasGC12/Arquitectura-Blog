import re

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from blog_core.media_urls import PublicImageField

from .avatars import dicebear_file
from .models import Usuario


class UserRegistrationSerializer(serializers.ModelSerializer):
    profile_picture = PublicImageField(required=False, allow_null=True)
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Usuario
        fields = (
            "username",
            "email",
            "password",
            "password_confirm",
            "bio",
            "profile_picture",
            "rol",
            "estado_cuenta",
        )
        read_only_fields = ("rol", "estado_cuenta")
        extra_kwargs = {
            "email": {"required": True},
            "bio": {"required": False, "allow_blank": True},
            "profile_picture": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Las contraseñas no coinciden."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        validated_data["rol"] = Usuario.Rol.LECTOR
        validated_data["estado_cuenta"] = Usuario.EstadoCuenta.PENDIENTE
        validated_data["is_active"] = True
        request = self.context.get("request")
        seed = "" if request is None else request.data.get("avatar_seed", "")
        style = "" if request is None else request.data.get("avatar_style", "avataaars")
        with transaction.atomic():
            user = Usuario.objects.create_user(password=password, **validated_data)
            if seed and not user.profile_picture:
                avatar = dicebear_file(style, seed)
                user.profile_picture.save(avatar.name, avatar, save=True)
        return user


class UserSerializer(serializers.ModelSerializer):
    profile_picture = PublicImageField(required=False, allow_null=True)
    cover_image = PublicImageField(required=False, allow_null=True)

    class Meta:
        model = Usuario
        fields = (
            "username",
            "email",
            "rol",
            "bio",
            "profile_picture",
            "cover_color",
            "cover_image",
        )
        read_only_fields = ("email", "rol")

    def validate_cover_color(self, value):
        value = (value or "").strip()
        if not value:
            return "#1b4f9c"
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", value):
            raise serializers.ValidationError("Usa un color hexadecimal, por ejemplo #1b4f9c.")
        return value.lower()

    def update(self, instance, validated_data):
        request = self.context.get("request")
        raw = "" if request is None else request.data.get("clear_cover", "")
        clear = str(raw).lower() in {"1", "true", "on"}
        if clear and "cover_image" not in validated_data and instance.cover_image:
            instance.cover_image.delete(save=False)
            instance.cover_image = None

        previous_picture = instance.profile_picture.name if instance.profile_picture else ""
        seed = "" if request is None else request.data.get("avatar_seed", "")
        if seed and "profile_picture" not in validated_data:
            style = "" if request is None else request.data.get("avatar_style", "avataaars")
            avatar = dicebear_file(style, seed)
            if previous_picture:
                instance.profile_picture.delete(save=False)
            instance.profile_picture.save(avatar.name, avatar, save=False)

        updated = super().update(instance, validated_data)
        current_picture = updated.profile_picture.name if updated.profile_picture else ""
        if previous_picture and previous_picture != current_picture:
            updated.profile_picture.storage.delete(previous_picture)
        return updated


class PendingUserSerializer(serializers.ModelSerializer):
    profile_picture = PublicImageField(read_only=True)

    class Meta:
        model = Usuario
        fields = (
            "id",
            "username",
            "email",
            "bio",
            "profile_picture",
            "rol",
            "estado_cuenta",
            "date_joined",
        )
        read_only_fields = fields


class BlogTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        "no_active_account": "Usuario o contraseña incorrectos.",
        "pending": "Tu cuenta está en revisión. Un administrador debe aprobarla antes de iniciar sesión.",
        "rejected": "Tu registro fue rechazado. No puedes iniciar sesión.",
    }

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        password = attrs.get("password")
        user = Usuario.objects.filter(**{self.username_field: username}).first()
        if user is not None and user.check_password(password):
            if user.estado_cuenta == Usuario.EstadoCuenta.PENDIENTE:
                raise AuthenticationFailed(self.error_messages["pending"], "pending")
            if user.estado_cuenta == Usuario.EstadoCuenta.RECHAZADO or not user.is_active:
                raise AuthenticationFailed(self.error_messages["rejected"], "rejected")
        return super().validate(attrs)
