import uuid

from polar.email.react import render_email_template
from polar.email.schemas import UserWelcomeEmail, UserWelcomeProps
from polar.email.sender import enqueue_email
from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import UserRepository

BIRK_FROM_NAME = "Birk from Spaire"
BIRK_FROM_EMAIL = "birk@spairehq.com"


class UserTaskError(PolarTaskError): ...


class UserDoesNotExist(UserTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message)


@actor(actor_name="user.on_after_signup", priority=TaskPriority.LOW)
async def user_on_after_signup(user_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_id(user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        body = render_email_template(
            UserWelcomeEmail(props=UserWelcomeProps(email=user.email))
        )
        enqueue_email(
            to_email_addr=user.email,
            subject="Hey, thanks for signing up to use Spaire!",
            html_content=body,
            from_name=BIRK_FROM_NAME,
            from_email_addr=BIRK_FROM_EMAIL,
            reply_to_name=BIRK_FROM_NAME,
            reply_to_email_addr=BIRK_FROM_EMAIL,
        )
