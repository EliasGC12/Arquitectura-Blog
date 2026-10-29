from rest_framework.permissions import SAFE_METHODS, BasePermission

from usuarios.models import Usuario

from .models import Post

MODERATOR_ROLES = {
    Usuario.Rol.EDITOR,
    Usuario.Rol.SUPERVISOR,
    Usuario.Rol.ADMIN,
}

AUTHOR_STATES = {
    Post.Estado.BORRADOR,
    Post.Estado.PENDIENTE_REVISION,
}

CONTENT_ROLES = {
    Usuario.Rol.AUTOR,
    Usuario.Rol.EDITOR,
    Usuario.Rol.SUPERVISOR,
    Usuario.Rol.ADMIN,
}


def is_moderator(user):
    return bool(user and user.is_authenticated and user.rol in MODERATOR_ROLES)


class CommentPermission(BasePermission):
    message = "No tienes permiso para realizar esta acción."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        return bool(user and user.is_authenticated)


class CanModerate(BasePermission):
    message = "No tienes permiso para moderar comentarios."

    def has_permission(self, request, view):
        return is_moderator(request.user)


class TaxonomyPermission(BasePermission):
    message = "No tienes permiso para administrar categorías o etiquetas."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method == "POST":
            return user.rol in CONTENT_ROLES

        return is_moderator(user)


class PostPermission(BasePermission):
    message = "Solo el autor puede editar esta publicación."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method == "POST":
            return user.rol in {
                Usuario.Rol.AUTOR,
                Usuario.Rol.EDITOR,
                Usuario.Rol.SUPERVISOR,
                Usuario.Rol.ADMIN,
            }

        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return obj.estado == Post.Estado.PUBLICADO or self._can_see_unpublished(request.user, obj)

        action = getattr(view, "action", None)
        if action in {"approve", "reject"}:
            return is_moderator(request.user)

        if request.method in {"PUT", "PATCH"}:
            return self._is_owner(request.user, obj)

        if request.method == "DELETE":
            return self._is_owner(request.user, obj) or is_moderator(request.user)

        return False

    def _can_see_unpublished(self, user, obj):
        if not user or not user.is_authenticated:
            return False
        return self._is_owner(user, obj) or is_moderator(user)

    def _is_owner(self, user, obj):
        return user.is_authenticated and obj.autor_id == user.id
