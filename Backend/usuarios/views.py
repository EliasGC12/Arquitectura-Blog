from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Usuario
from .permissions import IsAdmin
from .serializers import (
    BlogTokenObtainPairSerializer,
    PendingUserSerializer,
    UserRegistrationSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]


class BlogTokenObtainPairView(TokenObtainPairView):
    serializer_class = BlogTokenObtainPairSerializer


class UserDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PendingUserListView(generics.ListAPIView):
    serializer_class = PendingUserSerializer
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]
    pagination_class = None

    def get_queryset(self):
        return Usuario.objects.filter(estado_cuenta=Usuario.EstadoCuenta.PENDIENTE).order_by(
            "date_joined"
        )


class ApproveUserView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(Usuario, pk=pk, estado_cuenta=Usuario.EstadoCuenta.PENDIENTE)
        rol = request.data.get("rol") or Usuario.Rol.LECTOR
        if rol not in Usuario.Rol.values:
            raise ValidationError({"rol": "Elige un rol válido."})
        user.rol = rol
        user.estado_cuenta = Usuario.EstadoCuenta.APROBADO
        user.is_active = True
        user.is_staff = rol == Usuario.Rol.ADMIN
        user.save(update_fields=["rol", "estado_cuenta", "is_active", "is_staff"])
        return Response(PendingUserSerializer(user, context={"request": request}).data)


class RejectUserView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(Usuario, pk=pk, estado_cuenta=Usuario.EstadoCuenta.PENDIENTE)
        if user.pk == request.user.pk:
            raise ValidationError({"detail": "No puedes rechazar tu propia cuenta."})
        if user.profile_picture:
            user.profile_picture.delete(save=False)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
