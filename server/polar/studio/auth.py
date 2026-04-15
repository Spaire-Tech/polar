from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_StudioRead = Authenticator(
    required_scopes={Scope.web_read, Scope.web_write},
    allowed_subjects={User},
)
StudioRead = Annotated[AuthSubject[User], Depends(_StudioRead)]

_StudioWrite = Authenticator(
    required_scopes={Scope.web_write},
    allowed_subjects={User},
)
StudioWrite = Annotated[AuthSubject[User], Depends(_StudioWrite)]
