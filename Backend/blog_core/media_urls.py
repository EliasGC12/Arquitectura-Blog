from urllib.parse import urlsplit, urlunsplit

from django.conf import settings
from rest_framework import serializers


def absolute_media_url(file_field, request=None):
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None

    base = (getattr(settings, "PUBLIC_BASE_URL", "") or "").rstrip("/")
    if url.startswith(("http://", "https://")):
        parts = urlsplit(url)
        host = parts.hostname or ""
        local = host in {"localhost", "127.0.0.1"}
        if base and (local or parts.scheme == "http"):
            return urlunsplit(("https" if base.startswith("https://") else parts.scheme, urlsplit(base).netloc, parts.path, parts.query, ""))
        if request is not None and local:
            return request.build_absolute_uri(parts.path)
        return url

    path = url if url.startswith("/") else f"/{url}"
    if base:
        return f"{base}{path}"
    if request is not None:
        return request.build_absolute_uri(path)
    return path


class PublicImageField(serializers.ImageField):
    def to_representation(self, value):
        return absolute_media_url(value, self.context.get("request"))
