import factory
from factory.django import DjangoModelFactory

from apps.users.models import Group, User, UserProfile


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.Sequence(lambda n: f"user_{n}@empresa.com")
    first_name = factory.Faker("first_name", locale="es_MX")
    last_name = factory.Faker("last_name", locale="es_MX")
    password = factory.django.Password("TestPassword123!")
    role = User.Role.USUARIO
    is_active = True
    must_change_password = False


class AdminUserFactory(UserFactory):
    role = User.Role.ADMIN
    is_staff = True


class TrainerUserFactory(UserFactory):
    role = User.Role.TRAINER


class GroupFactory(DjangoModelFactory):
    class Meta:
        model = Group

    nombre = factory.Sequence(lambda n: f"Grupo {n}")
    descripcion = factory.Faker("sentence", nb_words=6, locale="es_MX")
    activo = True


class UserProfileFactory(DjangoModelFactory):
    """
    UserProfile is auto-created by a post_save signal on User.
    This factory updates the already-existing profile rather than inserting a new row.
    """

    class Meta:
        model = UserProfile

    user = factory.SubFactory(UserFactory)
    area = factory.Faker("job", locale="es_MX")
    cargo = factory.Faker("job", locale="es_MX")

    @classmethod
    def _create(cls, model_class, *args, **kwargs):  # type: ignore[override]
        user = kwargs["user"]
        profile, _ = model_class.objects.get_or_create(user=user)
        for field, value in kwargs.items():
            if field != "user":
                setattr(profile, field, value)
        profile.save()
        return profile
