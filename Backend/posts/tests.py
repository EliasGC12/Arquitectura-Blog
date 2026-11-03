from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from posts.models import Category, Comment, Post, Tag

User = get_user_model()


class PostCmsTests(APITestCase):
    def setUp(self):
        self.lector = self._user("lector", User.Rol.LECTOR)
        self.autor = self._user("autor", User.Rol.AUTOR)
        self.editor = self._user("editor", User.Rol.EDITOR)
        self.arquitectura = Category.objects.create(nombre="Arquitectura")
        self.campus = Category.objects.create(nombre="Campus")
        self.fachada = Tag.objects.create(nombre="Fachada")
        self.taller = Tag.objects.create(nombre="Taller")
        self.publicado = self._post(
            "Fachada norte",
            self.arquitectura,
            [self.fachada],
            Post.Estado.PUBLICADO,
        )
        self.otro = self._post(
            "Patio",
            self.campus,
            [self.taller, self.fachada],
            Post.Estado.PUBLICADO,
        )
        self.borrador = self._post(
            "Borrador",
            self.arquitectura,
            [self.fachada],
            Post.Estado.BORRADOR,
        )

    def test_la_lista_publica_ignora_borradores(self):
        response = self.client.get("/api/posts/")

        self.assertEqual(response.status_code, 200)
        titles = [item["titulo"] for item in response.data["results"]]
        self.assertEqual(titles, ["Patio", "Fachada norte"])

    def test_filtra_por_categoria_y_etiqueta(self):
        by_slug = self.client.get("/api/posts/?category=arquitectura")
        by_id = self.client.get(f"/api/posts/?category={self.campus.id}")
        by_tags = self.client.get("/api/posts/?tag=fachada&tag=taller")
        missing = self.client.get("/api/posts/?category=no-existe")

        self.assertEqual([item["titulo"] for item in by_slug.data["results"]], ["Fachada norte"])
        self.assertEqual([item["titulo"] for item in by_id.data["results"]], ["Patio"])
        self.assertEqual([item["titulo"] for item in by_tags.data["results"]], ["Patio"])
        self.assertEqual(missing.status_code, 200)
        self.assertEqual(missing.data["results"], [])

    def test_mine_no_aplica_el_filtro_publico(self):
        self.client.force_authenticate(self.autor)

        response = self.client.get("/api/posts/?mine=1&category=campus")

        self.assertEqual(response.status_code, 200)
        titles = {item["titulo"] for item in response.data}
        self.assertEqual(titles, {"Fachada norte", "Patio", "Borrador"})

    def test_el_filtro_por_estado_sigue_siendo_de_moderadores(self):
        self.client.force_authenticate(self.lector)
        denied = self.client.get("/api/posts/?status=BORRADOR")

        self.client.force_authenticate(self.editor)
        allowed = self.client.get("/api/posts/?status=BORRADOR&category=no-existe")

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual([item["titulo"] for item in allowed.data["results"]], ["Borrador"])

    def test_un_lector_no_publica_y_un_autor_no_publica_directo(self):
        self.client.force_authenticate(self.lector)
        denied = self.client.post(
            "/api/posts/",
            {"titulo": "Desde lector", "contenido": "No", "estado": "PUBLICADO"},
            format="json",
        )

        self.client.force_authenticate(self.autor)
        created = self.client.post(
            "/api/posts/",
            {"titulo": "En revision", "contenido": "Plano", "estado": "PUBLICADO"},
            format="json",
        )

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["estado"], Post.Estado.PENDIENTE_REVISION)

    def test_el_comentario_de_un_lector_espera_aprobacion(self):
        self.client.force_authenticate(self.lector)
        created = self.client.post(
            f"/api/posts/{self.publicado.id}/comments/",
            {"content": "Quiero ver la lámina"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertFalse(created.data["is_approved"])

        self.client.force_authenticate(user=None)
        public = self.client.get(f"/api/posts/{self.publicado.id}/")
        self.assertEqual(public.data["comments"], [])

        self.client.force_authenticate(self.lector)
        own = self.client.get(f"/api/posts/{self.publicado.id}/")
        self.assertEqual(len(own.data["comments"]), 1)
        self.assertEqual(own.data["comments"][0]["content"], "Quiero ver la lámina")

        self.client.force_authenticate(self.autor)
        hidden = self.client.get(f"/api/posts/{self.publicado.id}/")
        self.assertEqual(hidden.data["comments"], [])

        self.client.force_authenticate(self.editor)
        editor_comment = self.client.post(
            f"/api/posts/{self.publicado.id}/comments/",
            {"content": "Nota editorial"},
            format="json",
        )
        pending = self.client.get("/api/comments/pending/")
        approved = self.client.patch(
            f"/api/comments/{created.data['id']}/approve/",
            {"is_approved": True},
            format="json",
        )

        self.client.force_authenticate(user=None)
        visible = self.client.get(f"/api/posts/{self.publicado.id}/")
        contents = [item["content"] for item in visible.data["comments"]]

        self.assertTrue(editor_comment.data["is_approved"])
        self.assertEqual(pending.status_code, 200)
        self.assertTrue(any(item["content"] == "Quiero ver la lámina" for item in pending.data))
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(contents, ["Quiero ver la lámina", "Nota editorial"])

    def test_la_bandeja_oculta_comentarios_sin_aprobar_al_autor(self):
        Comment.objects.create(
            post=self.publicado,
            author=self.lector,
            content="Aún no",
            is_approved=False,
        )
        Comment.objects.create(
            post=self.publicado,
            author=self.editor,
            content="Ya visible",
            is_approved=True,
        )
        editorial = Post.objects.create(
            titulo="Del editor",
            contenido="Texto del artículo",
            autor=self.editor,
            estado=Post.Estado.PUBLICADO,
        )
        Comment.objects.create(
            post=editorial,
            author=self.lector,
            content="Pendiente del editor",
            is_approved=False,
        )

        self.client.force_authenticate(self.autor)
        inbox = self.client.get("/api/comments/inbox/")
        self.client.force_authenticate(self.lector)
        own = self.client.get("/api/comments/inbox/")
        self.client.force_authenticate(self.editor)
        moderated = self.client.get("/api/comments/inbox/")

        self.assertEqual(inbox.status_code, 200)
        self.assertEqual([item["content"] for item in inbox.data], ["Ya visible"])
        self.assertCountEqual(
            [item["content"] for item in own.data],
            ["Aún no", "Pendiente del editor"],
        )
        self.assertIn("Pendiente del editor", [item["content"] for item in moderated.data])

    def test_un_editor_archiva_un_publicado_sin_poder_editarlo(self):
        self.client.force_authenticate(self.autor)
        denied = self.client.post(f"/api/posts/{self.publicado.id}/archive/", {}, format="json")
        untouched = self.client.patch(
            f"/api/posts/{self.otro.id}/",
            {"estado": Post.Estado.ARCHIVADO},
            format="json",
        )

        self.client.force_authenticate(self.editor)
        blocked = self.client.patch(
            f"/api/posts/{self.publicado.id}/",
            {"titulo": "Cambio ajeno"},
            format="json",
        )
        archived = self.client.post(f"/api/posts/{self.publicado.id}/archive/", {}, format="json")
        public = self.client.get("/api/posts/")

        self.otro.refresh_from_db()
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(untouched.status_code, 400)
        self.assertEqual(self.otro.estado, Post.Estado.PUBLICADO)
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(archived.data["estado"], Post.Estado.ARCHIVADO)
        self.assertNotIn("Fachada norte", [item["titulo"] for item in public.data["results"]])

    def _user(self, username, rol):
        return User.objects.create_user(
            username=username,
            password="SeedPass123!",
            rol=rol,
            estado_cuenta=User.EstadoCuenta.APROBADO,
        )

    def _post(self, titulo, category, tags, estado):
        post = Post.objects.create(
            titulo=titulo,
            contenido="Texto del artículo",
            autor=self.autor,
            category=category,
            estado=estado,
        )
        post.tags.set(tags)
        return post
