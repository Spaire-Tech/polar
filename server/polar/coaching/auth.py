from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

# Coaching reuses the products auth scopes — a coaching program is a product
# with extra structure, and creators / org admins who can edit products can
# edit coaching events.

_CoachingRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.products_read,
        Scope.products_write,
    },
    allowed_subjects={User, Organization},
)
CoachingRead = Annotated[AuthSubject[User | Organization], Depends(_CoachingRead)]

_CoachingWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.products_write,
    },
    allowed_subjects={User, Organization},
)
CoachingWrite = Annotated[AuthSubject[User | Organization], Depends(_CoachingWrite)]
