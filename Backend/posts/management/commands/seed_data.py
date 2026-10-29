from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from PIL import Image, ImageDraw

from posts.models import Category, Comment, CommentLike, Post, Tag
from usuarios.avatars import dicebear_file

Usuario = get_user_model()

DEFAULT_PASSWORD = "SeedPass123!"

USERS = [
    {
        "username": "seed_admin",
        "email": "seed_admin@blogfcc.test",
        "rol": Usuario.Rol.ADMIN,
        "bio": "Administra la comunidad y publica avisos del campus.",
        "style": "avataaars",
        "seed": "Admin",
        "color": "#1b4f9c",
        "staff": True,
        "superuser": True,
    },
    {
        "username": "seed_supervisor",
        "email": "seed_supervisor@blogfcc.test",
        "rol": Usuario.Rol.SUPERVISOR,
        "bio": "Revisa publicaciones y cuida el tono de la conversación.",
        "style": "lorelei",
        "seed": "Supervisor",
        "color": "#5b21b6",
        "staff": True,
        "superuser": False,
    },
    {
        "username": "seed_autor_ana",
        "email": "seed_autor_ana@blogfcc.test",
        "rol": Usuario.Rol.AUTOR,
        "bio": "Escribe sobre patios, luz y recorridos del campus.",
        "style": "avataaars",
        "seed": "Ana",
        "color": "#9f1239",
        "staff": False,
        "superuser": False,
    },
    {
        "username": "seed_autor_leo",
        "email": "seed_autor_leo@blogfcc.test",
        "rol": Usuario.Rol.AUTOR,
        "bio": "Documenta talleres, maquetas y detalles constructivos.",
        "style": "bottts",
        "seed": "Leo",
        "color": "#0f766e",
        "staff": False,
        "superuser": False,
    },
    {
        "username": "seed_lector_mia",
        "email": "seed_lector_mia@blogfcc.test",
        "rol": Usuario.Rol.LECTOR,
        "bio": "Lee el muro y comenta los recorridos que le gustan.",
        "style": "fun-emoji",
        "seed": "Mia",
        "color": "#b45309",
        "staff": False,
        "superuser": False,
    },
    {
        "username": "seed_lector_teo",
        "email": "seed_lector_teo@blogfcc.test",
        "rol": Usuario.Rol.LECTOR,
        "bio": "Sigue las publicaciones de arquitectura y diseño.",
        "style": "lorelei",
        "seed": "Teo",
        "color": "#1d4ed8",
        "staff": False,
        "superuser": False,
    },
]

CATEGORIES = ["Arquitectura", "Campus", "Comunidad"]
TAGS = ["Fachada", "Aula", "Boceto", "Taller"]

POSTS = [
    {
        "titulo": "El patio que ordena el campus",
        "titulo_font": "Georgia",
        "titulo_color": "#1b4f9c",
        "titulo_bold": True,
        "titulo_italic": False,
        "autor": "seed_autor_ana",
        "category": "Arquitectura",
        "tags": ["Fachada", "Aula"],
        "estado": Post.Estado.PUBLICADO,
        "paragraphs": [
            ("Georgia", "#1b4f9c", True, False, "El patio central organiza las llegadas y las aulas."),
            ("Georgia", "#1c1e21", False, True, "Al mediodía la sombra del alero dibuja el recorrido."),
        ],
        "comments": [
            ("seed_lector_mia", "La luz del mediodía cambia por completo el patio.", None),
            ("seed_autor_leo", "El alero es justo lo que define esa sombra.", 0),
            ("seed_supervisor", "Buen registro para la revista del taller.", None),
        ],
        "likes": [(0, "seed_lector_teo"), (0, "seed_autor_leo")],
    },
    {
        "titulo": "Notas de un taller de maquetas",
        "titulo_font": "Courier New",
        "titulo_color": "#9f1239",
        "titulo_bold": False,
        "titulo_italic": True,
        "autor": "seed_autor_leo",
        "category": "Campus",
        "tags": ["Boceto", "Taller"],
        "estado": Post.Estado.PUBLICADO,
        "paragraphs": [
            ("Courier New", "#9f1239", False, True, "Hoy cortamos cartón y probamos tres alturas de muro."),
            ("Roboto", "#1c1e21", True, False, "La maqueta pequeña explicó mejor la entrada de luz."),
        ],
        "comments": [
            ("seed_lector_teo", "¿La maqueta pequeña es la del patio hundido?", None),
            ("seed_autor_ana", "Sí, y se entiende mejor que el plano.", 0),
        ],
        "likes": [(1, "seed_lector_mia")],
    },
    {
        "titulo": "Una fachada que respira",
        "titulo_font": "Verdana",
        "titulo_color": "#0f766e",
        "titulo_bold": True,
        "titulo_italic": False,
        "autor": "seed_supervisor",
        "category": "Arquitectura",
        "tags": ["Fachada"],
        "estado": Post.Estado.PUBLICADO,
        "paragraphs": [
            ("Verdana", "#0f766e", True, False, "La celosía deja pasar el aire sin perder privacidad."),
            ("Open Sans", "#1c1e21", False, False, "En la tarde el patio se siente fresco y quieto."),
        ],
        "comments": [
            ("seed_admin", "Publicado. Sirve como referencia para el siguiente taller.", None),
            ("seed_lector_mia", "Me gusta cómo se ve la sombra sobre el piso.", None),
        ],
        "likes": [(1, "seed_autor_ana")],
    },
    {
        "titulo": "Bitácora del aula norte",
        "titulo_font": "Trebuchet MS",
        "titulo_color": "#6d28d9",
        "titulo_bold": False,
        "titulo_italic": False,
        "autor": "seed_autor_ana",
        "category": "Campus",
        "tags": ["Aula", "Taller"],
        "estado": Post.Estado.PUBLICADO,
        "paragraphs": [
            ("Trebuchet MS", "#6d28d9", False, False, "El aula norte abre la vista hacia los árboles."),
            ("Trebuchet MS", "#1c1e21", True, True, "Las mesas largas invitan a trabajar en grupo."),
        ],
        "comments": [
            ("seed_lector_teo", "Esa aula es mi lugar favorito para leer.", None),
        ],
        "likes": [],
    },
    {
        "titulo": "Comunidad en el corredor",
        "titulo_font": "Roboto",
        "titulo_color": "#1c1e21",
        "titulo_bold": True,
        "titulo_italic": False,
        "autor": "seed_admin",
        "category": "Comunidad",
        "tags": ["Taller"],
        "estado": Post.Estado.PUBLICADO,
        "paragraphs": [
            ("Roboto", "#1c1e21", True, False, "El corredor ya funciona como sala de estar del campus."),
            ("Arial", "#1b4f9c", False, False, "Esta semana hay exposición de bocetos al final del pasillo."),
        ],
        "comments": [
            ("seed_lector_mia", "Paso a ver la exposición después de clase.", None),
            ("seed_autor_leo", "Dejo dos láminas del taller de la mañana.", 0),
        ],
        "likes": [(0, "seed_supervisor")],
    },
    {
        "titulo": "Boceto pendiente de revisión",
        "titulo_font": "Times New Roman",
        "titulo_color": "#9f1239",
        "titulo_bold": False,
        "titulo_italic": True,
        "autor": "seed_autor_leo",
        "category": "Arquitectura",
        "tags": ["Boceto"],
        "estado": Post.Estado.PENDIENTE_REVISION,
        "paragraphs": [
            ("Times New Roman", "#9f1239", False, True, "Este texto espera la revisión del supervisor."),
            ("Times New Roman", "#1c1e21", False, False, "Propone un umbral más bajo para la entrada oeste."),
        ],
        "comments": [
            ("seed_autor_ana", "Cuando lo aprueben, comento el detalle del umbral.", None),
        ],
        "likes": [],
    },
    {
        "titulo": "Borrador del jardín interior",
        "titulo_font": "Comic Sans MS",
        "titulo_color": "#0f766e",
        "titulo_bold": False,
        "titulo_italic": False,
        "autor": "seed_autor_ana",
        "category": "Comunidad",
        "tags": ["Aula"],
        "estado": Post.Estado.BORRADOR,
        "paragraphs": [
            ("Comic Sans MS", "#0f766e", False, False, "Todavía estoy armando las notas del jardín."),
        ],
        "comments": [],
        "likes": [],
    },
]


def styled_html(paragraphs):
    blocks = []
    for font, color, bold, italic, text in paragraphs:
        weight = "700" if bold else "400"
        slant = "italic" if italic else "normal"
        inner = f"<strong>{text}</strong>" if bold else text
        if italic:
            inner = f"<em>{inner}</em>"
        blocks.append(
            "<span style=\"font-family: '"
            + font
            + "'; color: "
            + color
            + "; font-weight: "
            + weight
            + "; font-style: "
            + slant
            + ';">'
            + inner
            + "</span>"
        )
    return "<br>".join(blocks)


def fallback_avatar(seed, color):
    image = Image.new("RGBA", (256, 256), color)
    draw = ImageDraw.Draw(image)
    draw.ellipse((28, 28, 228, 228), fill="#ffffff")
    letter = (seed[:1] or "?").upper()
    draw.text((108, 100), letter, fill=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return ContentFile(buffer.getvalue(), name=f"fallback-{seed}.png")


class Command(BaseCommand):
    help = "Crea usuarios, publicaciones y comentarios de prueba. Se puede ejecutar varias veces."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=DEFAULT_PASSWORD,
            help=f"Contraseña de las cuentas seed_. Por defecto: {DEFAULT_PASSWORD}",
        )

    def handle(self, *args, **options):
        password = options["password"]

        with transaction.atomic():
            users = self._users(password)
            categories = {
                name: Category.objects.get_or_create(nombre=name)[0] for name in CATEGORIES
            }
            tags = {name: Tag.objects.get_or_create(nombre=name)[0] for name in TAGS}
            created_posts = 0
            created_comments = 0
            for spec in POSTS:
                post, was_created = self._post(spec, users, categories, tags)
                created_posts += int(was_created)
                created_comments += self._comments(post, spec, users)

        self.stdout.write(self.style.SUCCESS("Datos de prueba listos."))
        self.stdout.write(f"Contraseña de las cuentas seed_: {password}")
        self.stdout.write("Usuarios: " + ", ".join(item["username"] for item in USERS))
        self.stdout.write(
            f"Publicaciones nuevas en esta ejecución: {created_posts}. "
            f"Comentarios nuevos: {created_comments}."
        )
        self.stdout.write(
            "En el muro público aparecen las publicaciones con estado PUBLICADO. "
            "seed_autor_leo tiene una pendiente de revisión y seed_autor_ana un borrador."
        )

    def _avatar(self, spec):
        try:
            return dicebear_file(spec["style"], spec["seed"])
        except Exception:
            self.stdout.write(
                f"Avatar local para {spec['username']} (no se pudo descargar DiceBear)."
            )
            return fallback_avatar(spec["seed"], spec["color"])

    def _users(self, password):
        users = {}
        for spec in USERS:
            user, created = Usuario.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "email": spec["email"],
                    "rol": spec["rol"],
                    "bio": spec["bio"],
                    "cover_color": spec["color"],
                },
            )
            user.email = spec["email"]
            user.rol = spec["rol"]
            user.bio = spec["bio"]
            user.cover_color = spec["color"]
            user.is_staff = spec["staff"]
            user.is_superuser = spec["superuser"]
            user.is_active = True
            user.estado_cuenta = Usuario.EstadoCuenta.APROBADO
            user.set_password(password)
            if created or not user.profile_picture:
                avatar = self._avatar(spec)
                user.profile_picture.save(avatar.name, avatar, save=False)
            user.save()
            users[spec["username"]] = user
            action = "creado" if created else "actualizado"
            self.stdout.write(f"  {spec['username']} ({spec['rol']}) {action}")
        return users

    def _post(self, spec, users, categories, tags):
        defaults = {
            "autor": users[spec["autor"]],
            "titulo_font": spec["titulo_font"],
            "titulo_color": spec["titulo_color"],
            "titulo_bold": spec["titulo_bold"],
            "titulo_italic": spec["titulo_italic"],
            "contenido": styled_html(spec["paragraphs"]),
            "category": categories[spec["category"]],
            "estado": spec["estado"],
        }
        post, created = Post.objects.get_or_create(titulo=spec["titulo"], defaults=defaults)
        if not created:
            for field, value in defaults.items():
                setattr(post, field, value)
            post.save()
        post.tags.set([tags[name] for name in spec["tags"]])
        return post, created

    def _comments(self, post, spec, users):
        saved = []
        created_count = 0
        for author_name, content, _parent in spec["comments"]:
            comment, created = Comment.objects.get_or_create(
                post=post,
                author=users[author_name],
                content=content,
                defaults={"is_approved": True},
            )
            if not comment.is_approved:
                comment.is_approved = True
                comment.save(update_fields=["is_approved"])
            saved.append(comment)
            created_count += int(created)

        for index, (_author_name, _content, parent_index) in enumerate(spec["comments"]):
            parent = None if parent_index is None else saved[parent_index]
            if saved[index].parent_id != (None if parent is None else parent.id):
                saved[index].parent = parent
                saved[index].save(update_fields=["parent"])

        for comment_index, username in spec["likes"]:
            CommentLike.objects.get_or_create(comment=saved[comment_index], user=users[username])
        return created_count
