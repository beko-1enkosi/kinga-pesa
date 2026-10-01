from decimal import Decimal
import re
import sqlite3

import pytest
from fastapi.testclient import TestClient

from main import create_app


@pytest.fixture
def env(tmp_path):
    path = tmp_path / 'services.sqlite3'
    with TestClient(create_app(path)) as client:
        yield client, path


PROVIDERS = {'airtime': 'Econet Zimbabwe', 'electricity': 'ZESA / ZETDC', 'grocery_voucher': 'Gain Cash & Carry'}
TARGETS = {'airtime': '+263771234567', 'electricity': '12345678901', 'grocery_voucher': 'Mama'}


def quote(client, kind='airtime', amount='100.00', recipient_id=1):
    return client.post('/service-quote', json={'recipient_id': recipient_id, 'service_type': kind, 'amount': amount})


def purchase(client, kind='airtime', amount='100.00', target=None):
    confirmed = quote(client, kind, amount)
    assert confirmed.status_code == 200
    return client.post('/service-purchases', json={'quote': confirmed.json(), 'target_reference': TARGETS[kind] if target is None else target})


def test_catalog(env):
    client, _ = env
    assert client.get('/recipients/1/services').json() == [
        {'type': kind, 'provider': provider} for kind, provider in PROVIDERS.items()
    ]
    assert client.get('/recipients/2/services').json() == []
    assert client.get('/recipients/999/services').status_code == 404


@pytest.mark.parametrize('kind,amount,local', [('airtime', '100.00', '5.50'), ('electricity', '300.00', '16.50'), ('grocery_voucher', '500.00', '27.50')])
def test_service_quotes(env, kind, amount, local):
    client, _ = env
    response = quote(client, kind, amount)
    assert response.status_code == 200
    assert response.json() == {
        'recipient_id': 1, 'service_type': kind, 'provider': PROVIDERS[kind],
        'send_amount': amount, 'send_currency': 'ZAR', 'service_fee': '0.00',
        'total_cost': amount, 'exchange_rate': '0.055', 'local_value': local, 'local_currency': 'USD',
    }


@pytest.mark.parametrize('amount,local', [('1.00', '0.06'), ('0.10', '0.01'), ('0.01', '0.00'), ('100000.00', '5500.00'), ('12345.67', '679.01')])
def test_decimal_rounding(env, amount, local):
    response = quote(env[0], amount=amount)
    assert response.status_code == 200
    assert response.json()['local_value'] == local
    assert Decimal(response.json()['total_cost']) == Decimal(amount)


@pytest.mark.parametrize('amount', ['0', '-1', '100000.01', '1.001', 'NaN', 'Infinity', 'hello', None])
def test_invalid_amount(env, amount):
    assert quote(env[0], amount=amount).status_code == 422


def test_unsupported_service_and_recipient(env):
    client, _ = env
    assert quote(client, kind='water').status_code == 422
    assert quote(client, recipient_id=2).status_code == 422
    assert quote(client, recipient_id=999).status_code == 404


def test_frontend_cannot_choose_provider(env):
    client, _ = env
    assert client.post('/service-quote', json={
        'recipient_id': 1, 'service_type': 'airtime', 'amount': '100', 'provider': 'Other provider',
    }).status_code == 422


@pytest.mark.parametrize('field,value', [
    ('provider', 'Other provider'), ('exchange_rate', '0.1'), ('local_value', '100'),
    ('total_cost', '1'), ('service_fee', '1'), ('send_amount', '101'), ('service_type', 'electricity'),
])
def test_altered_quote_rejected_without_purchase(env, field, value):
    client, path = env
    confirmed = quote(client).json()
    confirmed[field] = value
    response = client.post('/service-purchases', json={'quote': confirmed, 'target_reference': TARGETS['airtime']})
    assert response.status_code == 409
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT COUNT(*) FROM service_purchases').fetchone()[0] == 0


@pytest.mark.parametrize('kind', PROVIDERS)
def test_purchase_persists_and_reopens(env, kind):
    client, path = env
    response = purchase(client, kind)
    assert response.status_code == 201
    result = response.json()
    assert result['provider'] == PROVIDERS[kind]
    assert result['target_reference'] == TARGETS[kind]
    assert result['status'] == 'Successful'
    assert result['local_value'] == '5.50'
    assert result['service_fee'] == '0.00'
    assert result['created_at'].endswith('Z')
    assert client.get(f"/service-purchases/{result['id']}").json() == result
    with TestClient(create_app(path)) as reopened:
        assert reopened.get(f"/service-purchases/{result['id']}").json() == result
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT typeof(send_amount), typeof(exchange_rate), typeof(local_value), typeof(service_fee), typeof(total_cost) FROM service_purchases').fetchone() == ('text',) * 5


@pytest.mark.parametrize('kind,prefix', [('airtime', 'AIR'), ('electricity', 'ELEC'), ('grocery_voucher', 'GROC')])
def test_mock_fulfillment_format_and_unique_generation(env, kind, prefix):
    client, _ = env
    first, second = purchase(client, kind).json(), purchase(client, kind).json()
    assert re.fullmatch(prefix + r'-[0-9A-F]{16}', first['fulfillment_reference'])
    assert first['fulfillment_reference'] != second['fulfillment_reference']
    if kind == 'electricity':
        assert re.fullmatch(r'[0-9]{4}( [0-9]{4}){4}', first['electricity_token'])
        assert first['electricity_token'] != second['electricity_token']
        assert first['voucher_code'] is None
    elif kind == 'grocery_voucher':
        assert re.fullmatch(r'KP-FOOD-[0-9A-F]{12}', first['voucher_code'])
        assert first['voucher_code'] != second['voucher_code']
        assert first['electricity_token'] is None
    else:
        assert first['electricity_token'] is None and first['voucher_code'] is None


@pytest.mark.parametrize('kind,target', [
    ('airtime', ''), ('airtime', '+27711234567'), ('airtime', '+263123'), ('airtime', '+263abcdefghj'),
    ('electricity', ''), ('electricity', 'abc123'), ('electricity', '12345'), ('electricity', '1' * 21),
    ('grocery_voucher', ''), ('grocery_voucher', '   '), ('grocery_voucher', 'Mama\nOther'),
])
def test_target_validation(env, kind, target):
    client, path = env
    assert purchase(client, kind, target=target).status_code == 422
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT COUNT(*) FROM service_purchases').fetchone()[0] == 0


def test_phone_normalization(env):
    assert purchase(env[0], target='+263 77-123-4567').json()['target_reference'] == '+263771234567'


def test_missing_purchase(env):
    assert env[0].get('/service-purchases/999').status_code == 404


def test_reject_unknown_fields_and_invalid_confirmed_amount(env):
    client, _ = env
    confirmed = quote(client).json()
    assert client.post('/service-purchases', json={
        'quote': confirmed, 'target_reference': TARGETS['airtime'], 'provider': 'Other',
    }).status_code == 422
    confirmed['send_amount'] = '0'
    assert client.post('/service-purchases', json={'quote': confirmed, 'target_reference': TARGETS['airtime']}).status_code == 422


def test_additive_schema_preserves_remittance_and_notification(env):
    client, path = env
    confirmed = client.post('/quote', json={'recipient_id': 1, 'amount': '1000'}).json()
    transfer = client.post('/transfers', json=confirmed).json()
    for status in ['In Transit', 'Ready to Collect']:
        assert client.patch(f"/transfers/{transfer['id']}/status", json={'status': status}).status_code == 200
    original = client.get(f"/transfers/{transfer['id']}/notifications").json()
    with sqlite3.connect(path) as db:
        # Only the disposable test database: emulate the pre-services schema.
        db.execute('DROP TABLE service_purchases')
    with TestClient(create_app(path)) as upgraded:
        assert upgraded.get(f"/transfers/{transfer['id']}/notifications").json() == original
        assert purchase(upgraded).status_code == 201
        assert upgraded.get(f"/transfers/{transfer['id']}").json()['receive_amount'] == '55.00'
