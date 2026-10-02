"""Local-only demo fulfilment. No provider clients, credentials or network calls."""
from datetime import datetime, timezone
from decimal import Decimal
import re
import secrets
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from models import Money
from pricing import SenderCurrency, get_rate, round_money

ServiceType = Literal['airtime', 'electricity', 'grocery_voucher']
SERVICE_CATALOG = {
    'Zimbabwe': {
        'airtime': {'provider': 'Econet Zimbabwe', 'currency': 'USD'},
        'electricity': {'provider': 'ZESA / ZETDC', 'currency': 'USD'},
        'grocery_voucher': {'provider': 'Gain Cash & Carry', 'currency': 'USD'},
    },
}


class ServiceQuoteRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    recipient_id: int = Field(gt=0, strict=True)
    service_type: ServiceType
    amount: Decimal = Field(gt=0, le=100_000, decimal_places=2)
    send_currency: SenderCurrency = 'ZAR'


class ServiceQuote(BaseModel):
    model_config = ConfigDict(extra='forbid')
    recipient_id: int = Field(gt=0, strict=True)
    service_type: ServiceType
    provider: str = Field(min_length=1, max_length=100)
    send_amount: Decimal = Field(gt=0, le=100_000, decimal_places=2)
    send_currency: SenderCurrency
    service_fee: Money
    total_cost: Money
    exchange_rate: Decimal = Field(gt=0, max_digits=10, decimal_places=6)
    local_value: Money
    local_currency: Literal['USD']


class ServicePurchaseRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    quote: ServiceQuote
    target_reference: str = Field(min_length=1, max_length=100)


class ServicePurchase(ServiceQuote):
    id: int
    target_reference: str
    status: Literal['Successful']
    fulfillment_reference: str
    electricity_token: str | None
    voucher_code: str | None
    created_at: datetime


def calculate_service_quote(recipient, service_type, amount, send_currency='ZAR'):
    service = SERVICE_CATALOG.get(recipient['country'], {}).get(service_type)
    if service is None:
        raise HTTPException(422, 'Service unavailable for this recipient.')
    rate = get_rate(send_currency, service['currency'])
    amount = round_money(amount)
    return ServiceQuote(
        recipient_id=recipient['id'], service_type=service_type,
        provider=service['provider'], send_amount=amount, send_currency=send_currency,
        service_fee=Decimal('0.00'), total_cost=amount, exchange_rate=rate,
        local_value=round_money(amount * rate),
        local_currency=service['currency'],
    )


def validate_target(service_type, target):
    target = target.strip()
    if service_type == 'airtime':
        # Demo format check only; no operator/subscriber lookup.
        target = re.sub(r'[\s-]', '', target)
        if not re.fullmatch(r'\+263[0-9]{9}', target):
            raise HTTPException(422, 'Enter a Zimbabwe phone number in +263 format.')
    elif service_type == 'electricity':
        # Deliberately a simple demo format check, not real meter validation.
        if not re.fullmatch(r'[0-9]{6,20}', target):
            raise HTTPException(422, 'Enter a demo meter number of 6 to 20 digits.')
    elif not target or any(ord(character) < 32 for character in target):
        raise HTTPException(422, 'Enter a delivery recipient.')
    return target


def mock_fulfillment(service_type):
    prefix = {'airtime': 'AIR', 'electricity': 'ELEC', 'grocery_voucher': 'GROC'}[service_type]
    reference = f'{prefix}-{secrets.token_hex(8).upper()}'
    token = voucher = None
    if service_type == 'electricity':
        # Random display digits only, never an STS token or provider-issued value.
        digits = ''.join(secrets.choice('0123456789') for _ in range(20))
        token = ' '.join(digits[index:index + 4] for index in range(0, 20, 4))
    elif service_type == 'grocery_voucher':
        voucher = f'KP-FOOD-{secrets.token_hex(6).upper()}'
    return reference, token, voucher


def get_purchase(db, purchase_id):
    row = db.execute('SELECT * FROM service_purchases WHERE id = ?', (purchase_id,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Service purchase not found.')
    return dict(row)


def register_service_routes(app, path, connect, get_recipient):
    @app.get('/recipients/{recipient_id}/services')
    def catalog(recipient_id: int):
        with connect(path) as db:
            recipient = get_recipient(db, recipient_id)
            return [{'type': kind, 'provider': service['provider']}
                    for kind, service in SERVICE_CATALOG.get(recipient['country'], {}).items()]

    @app.post('/service-quote', response_model=ServiceQuote)
    def quote(request: ServiceQuoteRequest):
        with connect(path) as db:
            return calculate_service_quote(get_recipient(db, request.recipient_id), request.service_type, request.amount, request.send_currency)

    @app.post('/service-purchases', response_model=ServicePurchase, status_code=201)
    def purchase(request: ServicePurchaseRequest):
        with connect(path) as db:
            db.execute('BEGIN IMMEDIATE')
            confirmed = request.quote
            expected = calculate_service_quote(get_recipient(db, confirmed.recipient_id), confirmed.service_type, confirmed.send_amount, confirmed.send_currency)
            if confirmed != expected:
                raise HTTPException(409, 'Service quote no longer matches.')
            target = validate_target(expected.service_type, request.target_reference)
            reference, token, voucher = mock_fulfillment(expected.service_type)
            values = expected.model_dump(mode='json')
            values.update(target_reference=target, status='Successful', fulfillment_reference=reference,
                          electricity_token=token, voucher_code=voucher,
                          created_at=datetime.now(timezone.utc).isoformat())
            cursor = db.execute('''INSERT INTO service_purchases (
                recipient_id, service_type, provider, target_reference, send_amount, send_currency,
                service_fee, total_cost, exchange_rate, local_value, local_currency, status,
                fulfillment_reference, electricity_token, voucher_code, created_at
            ) VALUES (
                :recipient_id, :service_type, :provider, :target_reference, :send_amount, :send_currency,
                :service_fee, :total_cost, :exchange_rate, :local_value, :local_currency, :status,
                :fulfillment_reference, :electricity_token, :voucher_code, :created_at
            )''', values)
            return get_purchase(db, cursor.lastrowid)

    @app.get('/service-purchases/{purchase_id}', response_model=ServicePurchase)
    def lookup(purchase_id: int):
        with connect(path) as db:
            return get_purchase(db, purchase_id)
