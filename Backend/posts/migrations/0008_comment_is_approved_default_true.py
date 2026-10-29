from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("posts", "0007_post_titulo_bold_post_titulo_color_post_titulo_font_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="comment",
            name="is_approved",
            field=models.BooleanField(default=True),
        ),
    ]
