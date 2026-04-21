from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_BioRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.bio_read,
        Scope.bio_write,
    },
    allowed_subjects={User, Organization},
)
BioRead = Annotated[AuthSubject[User | Organization], Depends(_BioRead)]

_BioWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.bio_write,
    },
    allowed_subjects={User, Organization},
)
BioWrite = Annotated[AuthSubject[User | Organization], Depends(_BioWrite)]
