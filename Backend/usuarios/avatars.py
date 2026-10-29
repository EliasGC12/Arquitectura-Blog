import re
from io import BytesIO
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.core.files.base import ContentFile
from PIL import Image
from rest_framework import serializers

AVATAR_STYLES = {"avataaars", "bottts", "lorelei", "fun-emoji"}
SEED_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def dicebear_file(style, seed):
    style = (style or "avataaars").strip()
    seed = (seed or "").strip()
    if style not in AVATAR_STYLES:
        raise serializers.ValidationError({"avatar_style": "Ese estilo de avatar no está disponible."})
    if not SEED_PATTERN.fullmatch(seed):
        raise serializers.ValidationError({"avatar_seed": "Elige un avatar de la galería."})

    url = f"https://api.dicebear.com/9.x/{style}/png?seed={quote(seed)}&size=256"
    request = Request(url, headers={"User-Agent": "BlogFCC/1.0"})
    try:
        with urlopen(request, timeout=12) as response:
            raw = response.read(2_000_000)
    except OSError as error:
        raise serializers.ValidationError(
            {"avatar_seed": "No se pudo descargar el avatar. Inténtalo de nuevo."}
        ) from error

    try:
        image = Image.open(BytesIO(raw)).convert("RGBA")
    except OSError as error:
        raise serializers.ValidationError(
            {"avatar_seed": "El avatar recibido no es una imagen válida."}
        ) from error

    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return ContentFile(buffer.getvalue(), name=f"{style}-{seed}.png")
