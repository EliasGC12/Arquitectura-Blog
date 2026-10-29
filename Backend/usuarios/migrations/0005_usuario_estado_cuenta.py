from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0004_usuario_cover"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="estado_cuenta",
            field=models.CharField(
                choices=[
                    ("PENDIENTE", "Pendiente"),
                    ("APROBADO", "Aprobado"),
                    ("RECHAZADO", "Rechazado"),
                ],
                default="APROBADO",
                max_length=12,
            ),
        ),
        migrations.AlterField(
            model_name="usuario",
            name="estado_cuenta",
            field=models.CharField(
                choices=[
                    ("PENDIENTE", "Pendiente"),
                    ("APROBADO", "Aprobado"),
                    ("RECHAZADO", "Rechazado"),
                ],
                default="PENDIENTE",
                max_length=12,
            ),
        ),
    ]
