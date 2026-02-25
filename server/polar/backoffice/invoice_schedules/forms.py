from decimal import Decimal
from typing import Annotated

from pydantic import Field

from polar.kit.schemas import EmptyStrToNone

from .. import forms


class ScheduleCreateForm(forms.BaseForm):
    organization_id: Annotated[str, Field(title="Organization ID")]
    customer_id: Annotated[str, Field(title="Customer ID")]
    currency: Annotated[str, Field(default="usd", title="Currency (e.g. usd)")]
    billing_name: Annotated[EmptyStrToNone, Field(default=None, title="Billing name")]
    notes: Annotated[
        EmptyStrToNone,
        Field(default=None, title="Notes"),
        forms.TextAreaField(rows=3),
    ]
    recurring_interval: Annotated[
        str, Field(default="month", title="Interval (day/week/month/year)")
    ]
    recurring_interval_count: Annotated[
        int, Field(default=1, title="Every N intervals", ge=1)
    ]
    next_issue_date: Annotated[str, Field(title="First issue date (YYYY-MM-DD)")]
    auto_issue: Annotated[str, Field(default="", title="Auto-issue invoices")]
    auto_send_email: Annotated[str, Field(default="", title="Auto-send email")]


class ScheduleEditForm(forms.BaseForm):
    customer_id: Annotated[EmptyStrToNone, Field(default=None, title="Customer ID")]
    currency: Annotated[str, Field(title="Currency (e.g. usd)")]
    billing_name: Annotated[EmptyStrToNone, Field(default=None, title="Billing name")]
    notes: Annotated[
        EmptyStrToNone,
        Field(default=None, title="Notes"),
        forms.TextAreaField(rows=3),
    ]
    recurring_interval: Annotated[
        str, Field(title="Interval (day/week/month/year)")
    ]
    recurring_interval_count: Annotated[
        int, Field(default=1, title="Every N intervals", ge=1)
    ]
    next_issue_date: Annotated[str, Field(title="Next issue date (YYYY-MM-DD)")]
    auto_issue: Annotated[str, Field(default="", title="Auto-issue invoices")]
    auto_send_email: Annotated[str, Field(default="", title="Auto-send email")]


class AddItemForm(forms.BaseForm):
    description: Annotated[str, Field(title="Description")]
    quantity: Annotated[int, Field(default=1, title="Quantity", ge=1)]
    unit_amount: Annotated[
        Decimal, Field(title="Unit amount (dollars)", gt=0, decimal_places=2)
    ]
