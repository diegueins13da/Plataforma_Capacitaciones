import factory
from factory.django import DjangoModelFactory

from apps.users.models import User, UserProfile


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


class UserProfileFactory(DjangoModelFactory):
    class Meta:
        model = UserProfile

    user = factory.SubFactory(UserFactory)
    area = factory.Faker("job", locale="es_MX")
    cargo = factory.Faker("job", locale="es_MX")
