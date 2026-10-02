from decimal import Decimal
import sqlite3

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import create_app
from pricing import get_rate


@pytest.fixture
def env(tmp_path):
    path = tmp_path / 'sender-currency.sqlite3'
    with TestClient(create_app(path)) as client:
        yield client, path


def quote(client, currency='BWP', recipient_id=1, amount='1000.00'):
    response = client.post('/quote', json={
        'recipient_id': recipient_id, 'amount': amount, 'send_currency': currency,
    })
    assert response.status_code == 200
    return response.json()


def service_quote(client, kind='airtime', currency='BWP', amount='100.00'):
    response = client.post('/service-quote', json={
        'recipient_id': 1, 'service_type': kind, 'amount': amount, 'send_currency': currency,
    })
    assert response.status_code == 200
    return response.json()


TARGETS = {'airtime': '+263771234567', 'electricity': '12345678901', 'grocery_voucher': 'Mama'}
PROVIDERS = {'airtime': 'Econet Zimbabwe', 'electricity': 'ZESA / ZETDC', 'grocery_voucher': 'Gain Cash & Carry'}


@pytest.mark.parametrize('endpoint,extra', [('/quote', {}), ('/service-quote', {'service_type': 'airtime'})])
def test_omitted_currency_matches_explicit_zar(env, endpoint, extra):
    client, _ = env
    body = {'recipient_id': 1, 'amount': '1000.00', **extra}
    legacy = client.post(endpoint, json=body)
    explicit = client.post(endpoint, json={**body, 'send_currency': 'ZAR'})
    assert legacy.status_code == explicit.status_code == 200
    assert legacy.json() == explicit.json()
    assert legacy.json()['send_currency'] == 'ZAR'


@pytest.mark.parametrize('currency,recipient_id,rate,receive_currency,received,fee,total', [
    ('ZAR', 1, '0.055', 'USD', '55.00', '30.00', '1030.00'),
    ('ZAR', 2, '0.75', 'BWP', '750.00', '30.00', '1030.00'),
    ('BWP', 1, '0.073333', 'USD', '73.33', '27.50', '1027.50'),
    ('BWP', 2, '1', 'BWP', '1000.00', '27.50', '1027.50'),
])
def test_remittance_matrix(env, currency, recipient_id, rate, receive_currency, received, fee, total):
    result = quote(env[0], currency, recipient_id)
    assert result == {
        'recipient_id': recipient_id, 'send_amount': '1000.00', 'send_currency': currency,
        'exchange_rate': rate, 'fee': fee, 'total_cost': total,
        'receive_amount': received, 'receive_currency': receive_currency,
    }


@pytest.mark.parametrize('endpoint,extra', [('/quote', {}), ('/service-quote', {'service_type': 'airtime'})])
@pytest.mark.parametrize('currency', ['USD', 'EUR', 'zar', '', None])
def test_unsupported_sender_currency(env, endpoint, extra, currency):
    assert env[0].post(endpoint, json={
        'recipient_id': 1, 'amount': '100', 'send_currency': currency, **extra,
    }).status_code == 422


def test_unsupported_pair_is_clear():
    with pytest.raises(HTTPException) as error:
        get_rate('BWP', 'ZAR')
    assert error.value.status_code == 422
    assert error.value.detail == 'Unsupported currency pair: BWP to ZAR.'


@pytest.mark.parametrize('amount,expected', [('0.06', '0.00'), ('0.07', '0.01'), ('100.00', '7.33'), ('45000.00', '3299.99')])
def test_bwp_to_usd_decimal_rounding_is_shared(env, amount, expected):
    client, _ = env
    assert quote(client, amount=amount)['receive_amount'] == expected
    assert service_quote(client, amount=amount)['local_value'] == expected


@pytest.mark.parametrize('currency,expected_fee,expected_total', [('ZAR', '10.01', '10.26'), ('BWP', '7.51', '7.76')])
def test_fee_rounds_half_up(env, currency, expected_fee, expected_total):
    result = quote(env[0], currency=currency, amount='0.25')
    assert result['fee'] == expected_fee
    assert result['total_cost'] == expected_total


@pytest.mark.parametrize('recipient_id', [1, 2])
def test_bwp_transfer_persists_and_restores(env, recipient_id):
    client, path = env
    response = client.post('/transfers', json=quote(client, recipient_id=recipient_id))
    assert response.status_code == 201
    transfer = response.json()
    assert transfer['send_currency'] == 'BWP'
    assert transfer['status'] == 'Sent'
    with TestClient(create_app(path)) as reopened:
        assert reopened.get(f"/transfers/{transfer['id']}").json() == transfer
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT send_currency FROM transfers WHERE id = ?', (transfer['id'],)).fetchone() == ('BWP',)


@pytest.mark.parametrize('field,value', [
    ('send_currency', 'ZAR'), ('fee', '30.00'), ('exchange_rate', '0.055'),
    ('total_cost', '1000.00'), ('receive_amount', '55.00'), ('receive_currency', 'BWP'),
])
def test_altered_bwp_remittance_rejected(env, field, value):
    client, path = env
    confirmed = quote(client)
    confirmed[field] = value
    assert client.post('/transfers', json=confirmed).status_code == 409
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT COUNT(*) FROM transfers').fetchone()[0] == 0


def test_altered_zar_sender_currency_rejected(env):
    client, _ = env
    confirmed = quote(client, currency='ZAR')
    confirmed['send_currency'] = 'BWP'
    assert client.post('/transfers', json=confirmed).status_code == 409


@pytest.mark.parametrize('kind', TARGETS)
@pytest.mark.parametrize('currency,rate,local', [('ZAR', '0.055', '5.50'), ('BWP', '0.073333', '7.33')])
def test_service_quote_and_purchase_for_both_senders(env, kind, currency, rate, local):
    client, path = env
    confirmed = service_quote(client, kind=kind, currency=currency)
    assert confirmed == {
        'recipient_id': 1, 'service_type': kind, 'provider': PROVIDERS[kind],
        'send_amount': '100.00', 'send_currency': currency, 'service_fee': '0.00',
        'total_cost': '100.00', 'exchange_rate': rate, 'local_value': local, 'local_currency': 'USD',
    }
    response = client.post('/service-purchases', json={'quote': confirmed, 'target_reference': TARGETS[kind]})
    assert response.status_code == 201
    purchase = response.json()
    assert purchase['send_currency'] == currency
    assert purchase['local_currency'] == 'USD'
    assert purchase['local_value'] == local
    with TestClient(create_app(path)) as reopened:
        assert reopened.get(f"/service-purchases/{purchase['id']}").json() == purchase
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT send_currency FROM service_purchases WHERE id = ?', (purchase['id'],)).fetchone() == (currency,)


@pytest.mark.parametrize('field,value,status', [
    ('send_currency', 'ZAR', 409), ('provider', 'Other', 409), ('exchange_rate', '0.055', 409),
    ('local_value', '5.50', 409), ('total_cost', '1.00', 409), ('service_fee', '1.00', 409),
    ('local_currency', 'BWP', 422), ('send_currency', 'USD', 422),
])
def test_altered_bwp_service_quote_rejected(env, field, value, status):
    client, path = env
    confirmed = service_quote(client)
    confirmed[field] = value
    assert client.post('/service-purchases', json={'quote': confirmed, 'target_reference': TARGETS['airtime']}).status_code == status
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT COUNT(*) FROM service_purchases').fetchone()[0] == 0


@pytest.mark.parametrize('currency', ['ZAR', 'BWP'])
@pytest.mark.parametrize('kind', TARGETS)
def test_sender_does_not_expand_service_availability(env, currency, kind):
    client, _ = env
    assert client.get('/recipients/2/services').json() == []
    response = client.post('/service-quote', json={
        'recipient_id': 2, 'service_type': kind, 'amount': '100', 'send_currency': currency,
    })
    assert response.status_code == 422
    assert response.json()['detail'] == 'Service unavailable for this recipient.'


def test_bwp_notification_and_safe_access_stay_in_usd(env):
    client, path = env
    response = client.post('/transfers', json=quote(client))
    assert response.status_code == 201
    transfer = response.json()
    url = f"/transfers/{transfer['id']}"
    for status in ['In Transit', 'Ready to Collect']:
        assert client.patch(url + '/status', json={'status': status}).status_code == 200
    notification = client.get(url + '/notifications').json()[0]
    assert notification['receive_amount'] == '73.33'
    assert notification['receive_currency'] == 'USD'
    assert notification['message'] == 'Mama, your KingaPesa transfer of USD 73.33 is ready to collect.'
    assert client.post(url + '/safe-access', json={
        'primary_pin': '1234', 'safety_pin': '9876', 'protected_amount': '15.00',
    }).status_code == 200
    assert client.post(url + '/recipient-access', json={'pin': '1234'}).json() == {'available_to_collect': '73.33', 'currency': 'USD'}
    assert client.post(url + '/withdrawals', json={'pin': '9876', 'amount': '5.00'}).json() == {'available_to_collect': '10.00', 'currency': 'USD'}
    with TestClient(create_app(path)) as reopened:
        assert reopened.post(url + '/recipient-access', json={'pin': '1234'}).json() == {'available_to_collect': '68.33', 'currency': 'USD'}
        assert reopened.post(url + '/recipient-access', json={'pin': '9876'}).json() == {'available_to_collect': '10.00', 'currency': 'USD'}
        assert reopened.post(url + '/withdrawals', json={'pin': '1234', 'amount': '68.33'}).json() == {'available_to_collect': '0.00', 'currency': 'USD'}
        assert reopened.get(url).json()['status'] == 'Collected'
        assert reopened.get(url + '/notifications').json() == [notification]


@pytest.mark.parametrize('endpoint,extra,maximum', [('/quote', {}, '1000000.00'), ('/service-quote', {'service_type': 'airtime'}, '100000.00')])
def test_bwp_preserves_numeric_amount_limits(env, endpoint, extra, maximum):
    client, _ = env
    body = {'recipient_id': 1, 'send_currency': 'BWP', 'amount': maximum, **extra}
    assert client.post(endpoint, json=body).status_code == 200
    body['amount'] = str(Decimal(maximum) + Decimal('0.01'))
    assert client.post(endpoint, json=body).status_code == 422
