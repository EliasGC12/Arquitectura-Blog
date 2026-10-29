from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0003_usuario_profile_picture"),
    ]

    operations = [
        migrations.AddField(
            model_name="usuario",
            name="cover_color",
            field=models.CharField(default="#1b4f9c", max_length=7),
        ),
        migrations.AddField(
            model_name="usuario",
            name="cover_image",
            field=models.ImageField(blank=True, null=True, upload_to="portadas/"),
        ),
    ]
