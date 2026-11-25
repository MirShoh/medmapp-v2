from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_otpcode")]
    operations = [
        migrations.AddField(model_name="otpcode", name="purpose",
                            field=models.CharField(choices=[("login", "Sign in"), ("register", "Registration"),
                                                            ("reset", "Password reset")], default="login", max_length=10)),
    ]
