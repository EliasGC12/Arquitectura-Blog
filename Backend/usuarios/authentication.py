def account_can_authenticate(user):
    if user is None or not getattr(user, "is_active", False):
        return False
    return getattr(user, "estado_cuenta", "APROBADO") == "APROBADO"
