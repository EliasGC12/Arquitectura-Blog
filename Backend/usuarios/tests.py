from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class JwtAuthTests(APITestCase):
    def test_una_cuenta_pendiente_no_recibe_tokens(self):
        User.objects.create_user(
            username="pendiente",
            password="SeedPass123!",
            estado_cuenta=User.EstadoCuenta.PENDIENTE,
        )

        response = self.client.post(
            "/api/token/",
            {"username": "pendiente", "password": "SeedPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access", response.data)
        self.assertNotIn("refresh", response.data)

    def test_el_refresh_emite_un_access_nuevo(self):
        User.objects.create_user(
            username="aprobado",
            password="SeedPass123!",
            estado_cuenta=User.EstadoCuenta.APROBADO,
        )

        login = self.client.post(
            "/api/token/",
            {"username": "aprobado", "password": "SeedPass123!"},
            format="json",
        )
        refreshed = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )

        self.assertEqual(login.status_code, 200)
        self.assertEqual(refreshed.status_code, 200)
        self.assertTrue(refreshed.data["access"])
        self.assertNotEqual(refreshed.data["access"], login.data["access"])
