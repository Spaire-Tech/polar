from decimal import Decimal
from typing import Annotated

from pydantic import Field

from polar.kit.schemas import EmptyStrToNone

from .. import forms


class ManualInvoiceCreateForm(forms.BaseForm):
    organization_id: Annotated[str, Field(title="Organization ID")]
    customer_id: Annotated[EmptyStrToNone, Field(default=None, title="Customer ID")]
    currency: Annotated[str, Field(default="usd", title="Currency (e.g. usd)")]
    billing_name: Annotated[EmptyStrToNone, Field(default=None, title="Billing name")]
    notes: Annotated[
        EmptyStrToNone,
        Field(default=None, title="Notes"),
        forms.TextAreaField(rows=3),
    ]


class ManualInvoiceItemForm(forms.BaseForm):
    description: Annotated[str, Field(title="Description")]
    quantity: Annotated[int, Field(default=1, title="Quantity", ge=1)]
    unit_amount: Annotated[
        Decimal, Field(title="Unit amount (dollars)", gt=0, decimal_places=2)
    ]


class ManualInvoiceEditForm(forms.BaseForm):
    customer_id: Annotated[EmptyStrToNone, Field(default=None, title="Customer ID")]
    currency: Annotated[str, Field(title="Currency (e.g. usd)")]
    billing_name: Annotated[EmptyStrToNone, Field(default=None, title="Billing name")]
    notes: Annotated[
        EmptyStrToNone,
        Field(default=None, title="Notes"),
        forms.TextAreaField(rows=3),
    ]


class AddItemForm(forms.BaseForm):
    description: Annotated[str, Field(title="Description")]
    quantity: Annotated[int, Field(default=1, title="Quantity", ge=1)]
    unit_amount: Annotated[
        Decimal, Field(title="Unit amount (dollars)", gt=0, decimal_places=2)
    ]
