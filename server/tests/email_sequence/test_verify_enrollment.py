import pytest

from polar.course.service import course_service
from polar.models import Course
from polar.models.email_sequence import (
    EmailSequence,
    EmailSequenceStatus,
    EmailSequenceTriggerType,
)
from polar.models.email_subscriber import EmailSubscriber, EmailSubscriberStatus
from tests.fixtures.random_objects import (
    create_customer,
    create_organization,
    create_product,
)


async def _setup(save_fixture, *, trigger: EmailSequenceTriggerType):
    org = await create_organization(save_fixture)
    product = await create_product(save_fixture, organization=org, recurring_interval=None)
    course = Course(product_id=product.id, organization_id=org.id, title="Mock course")
    await save_fixture(course)
    customer = await create_customer(
        save_fixture, organization=org, email="learner@example.com"
    )
    subscriber = EmailSubscriber(
        organization_id=org.id,
        email="learner@example.com",
        customer_id=customer.id,
        status=EmailSubscriberStatus.active,
    )
    await save_fixture(subscriber)
    seq = EmailSequence(
        organization_id=org.id,
        name="Welcome",
        trigger_type=trigger,
        status=EmailSequenceStatus.active,
        course_id=course.id,
        trigger_config={},
    )
    await save_fixture(seq)
    return org, course, customer, subscriber, seq


def _enroll_calls(enqueue_mock):
    return [
        c
        for c in enqueue_mock.call_args_list
        if c.args and c.args[0] == "email_sequence.enroll_subscriber"
    ]


@pytest.mark.xfail(
    strict=True,
    reason=(
        "VERIFIED BUG: enrolling a customer fires the `course.enrolled` event, but "
        "_fire_course_event never maps it to enroll_for_trigger, and the 'Student "
        "enrols' automation is wired to the on_purchase trigger — so the welcome "
        "email is never queued. Remove this xfail once course.enrolled enrols "
        "subscribers into the enrol-trigger sequences."
    ),
)
@pytest.mark.asyncio
async def test_enrol_welcome_email_fires_on_enrollment(save_fixture, session, mocker):
    # The "Student enrols" automation is saved as trigger_type=on_purchase.
    _, course, customer, _, seq = await _setup(
        save_fixture, trigger=EmailSequenceTriggerType.on_purchase
    )
    enqueue = mocker.patch("polar.email_sequence.service.enqueue_job")

    # Do exactly what the creator did: enrol the customer in the course.
    await course_service.enroll_customer(
        session, course_id=course.id, customer=customer
    )

    calls = _enroll_calls(enqueue)
    print(f"\n[ENROL] welcome-email enroll jobs queued = {len(calls)}")
    assert len(calls) >= 1, (
        "ENROLLING A CUSTOMER DID NOT QUEUE THE WELCOME EMAIL: "
        "course.enrolled is not wired to the on_purchase trigger."
    )


@pytest.mark.asyncio
async def test_course_completed_milestone_fires(save_fixture, session, mocker):
    _, course, customer, _, seq = await _setup(
        save_fixture, trigger=EmailSequenceTriggerType.on_course_completed
    )
    enqueue = mocker.patch("polar.email_sequence.service.enqueue_job")

    await course_service._fire_course_event(
        session,
        course_id=course.id,
        customer_id=customer.id,
        event_name="course.completed",
    )

    calls = _enroll_calls(enqueue)
    print(f"\n[COMPLETED] milestone enroll jobs queued = {len(calls)}")
    assert len(calls) >= 1, "course.completed milestone did not enqueue enrollment"
