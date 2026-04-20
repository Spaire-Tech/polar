from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_OrganizationLinksRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.organization_links_read,
        Scope.organization_links_write,
    },
    allowed_subjects={User, Organization},
)
OrganizationLinksRead = Annotated[
    AuthSubject[User | Organization], Depends(_OrganizationLinksRead)
]

_OrganizationLinksWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.organization_links_write,
    },
    allowed_subjects={User, Organization},
)
OrganizationLinksWrite = Annotated[
    AuthSubject[User | Organization], Depends(_OrganizationLinksWrite)
]
