from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from pricing import SenderCurrency

Money = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
Status = Literal["Sent", "In Transit", "Ready to Collect", "Collected"]


class Recipient(BaseModel):
    id: int
    name: str
    country: str
    currency: str


class QuoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipient_id: int = Field(gt=0, strict=True)
    amount: Decimal = Field(gt=0, le=1_000_000, decimal_places=2)
    send_currency: SenderCurrency = "ZAR"


class Quote(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipient_id: int = Field(gt=0, strict=True)
    send_amount: Money
    send_currency: SenderCurrency
    exchange_rate: Decimal = Field(gt=0, max_digits=10, decimal_places=6)
    fee: Money
    total_cost: Money
    receive_amount: Money
    receive_currency: Literal["USD", "BWP"]


class Transfer(Quote):
    id: int
    status: Status
    created_at: datetime


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Status


class Notification(BaseModel):
    id: int
    transfer_id: int
    recipient_id: int
    channel: Literal["SMS"]
    message: str
    status: Literal["sent"]
    created_at: datetime
    # Structured display data lets the frontend translate without parsing the message.
    recipient_name: str
    receive_amount: Money
    receive_currency: Literal["USD", "BWP"]
