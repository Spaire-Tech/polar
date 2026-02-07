from typing import Annotated

from fastapi import Depends

from polar.auth.dependencies import Authenticator
from polar.auth.models import AuthSubject, User
from polar.auth.scope import Scope

_BusinessWalletRead = Authenticator(
    required_scopes={
        Scope.web_read,
        Scope.web_write,
        Scope.business_wallet_read,
    },
    allowed_subjects={User},
)
BusinessWalletRead = Annotated[AuthSubject[User], Depends(_BusinessWalletRead)]

_BusinessWalletWrite = Authenticator(
    required_scopes={
        Scope.web_write,
        Scope.business_wallet_write,
    },
    allowed_subjects={User},
)
BusinessWalletWrite = Annotated[AuthSubject[User], Depends(_BusinessWalletWrite)]
