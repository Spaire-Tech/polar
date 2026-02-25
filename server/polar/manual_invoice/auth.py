from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, Organization, User
from polar.auth.scope import Scope

_ManualInvoicesRead = Authenticator(
    required_scopes={Scope.web_read, Scope.web_write, Scope.orders_read},
    allowed_subjects={User, Organization},
)
ManualInvoicesRead = Annotated[
    AuthSubject[User | Organization], Depends(_ManualInvoicesRead)
]

_ManualInvoicesWrite = Authenticator(
    required_scopes={Scope.web_write, Scope.orders_write},
    allowed_subjects={User, Organization},
)
ManualInvoicesWrite = Annotated[
    AuthSubject[User | Organization], Depends(_ManualInvoicesWrite)
]
