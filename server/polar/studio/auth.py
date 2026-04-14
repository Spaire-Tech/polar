from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope
from polar.models.organization import Organization

_StudioWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.studio_write,
    },
    allowed_subjects={User, Organization},
)
StudioWrite = Annotated[AuthSubject[User | Organization], Depends(_StudioWrite)]
