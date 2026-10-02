"""Shared demo pricing. All rates are destination units per one sender unit."""
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import HTTPException

SenderCurrency = Literal['ZAR', 'BWP']
MOCK_RATES = {
    ('ZAR', 'USD'): Decimal('0.055'),
    ('ZAR', 'BWP'): Decimal('0.75'),
    ('BWP', 'USD'): Decimal('0.073333'),
    ('BWP', 'BWP'): Decimal('1'),
}
FIXED_FEES = {'ZAR': Decimal('10.00'), 'BWP': Decimal('7.50')}
PERCENTAGE_FEE = Decimal('0.02')


def get_rate(send_currency, receive_currency):
    rate = MOCK_RATES.get((send_currency, receive_currency))
    if rate is None:
        raise HTTPException(422, f'Unsupported currency pair: {send_currency} to {receive_currency}.')
    return rate


def round_money(amount):
    return amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def remittance_fee(amount, send_currency):
    return round_money(FIXED_FEES[send_currency] + amount * PERCENTAGE_FEE)
