from rest_framework.permissions import BasePermission

from .models import Usuario

ROLE_RANK = {
    Usuario.Rol.LECTOR: 1,
    Usuario.Rol.AUTOR: 2,
    Usuario.Rol.EDITOR: 3,
    Usuario.Rol.SUPERVISOR: 4,
    Usuario.Rol.ADMIN: 5,
}


class MinimumRolePermission(BasePermission):
    """Permite la acción si el usuario autenticado tiene al menos el rol indicado."""

    minimum_role = None
    message = "No tienes permiso para realizar esta acción."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        user_rank = ROLE_RANK.get(getattr(user, "rol", None), 0)
        return user_rank >= ROLE_RANK[self.minimum_role]


class IsLector(MinimumRolePermission):
    """Cualquier usuario autenticado."""

    minimum_role = Usuario.Rol.LECTOR


class IsAutor(MinimumRolePermission):
    """AUTOR, EDITOR, SUPERVISOR o ADMIN."""

    minimum_role = Usuario.Rol.AUTOR


class IsEditor(MinimumRolePermission):
    """EDITOR, SUPERVISOR o ADMIN."""

    minimum_role = Usuario.Rol.EDITOR


class IsAdmin(MinimumRolePermission):
    """Solo ADMIN."""

    minimum_role = Usuario.Rol.ADMIN
