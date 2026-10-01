from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import sqlite3

import pytest
from fastapi.testclient import TestClient

from main import create_app
from database import connect
from safe_access import real_remaining


@pytest.fixture
def env(tmp_path):
    path = tmp_path / 'safe.sqlite3'
    with TestClient(create_app(path)) as client:
        quote = client.post('/quote', json={'recipient_id': 1, 'amount': '1000.00'}).json()
        transfer = client.post('/transfers', json=quote).json()
        yield client, path, transfer


def route(transfer, suffix):
    return f"/transfers/{transfer['id']}/{suffix}"


def ready(client, transfer):
    for status in ['In Transit', 'Ready to Collect']:
        assert client.patch(route(transfer, 'status'), json={'status': status}).status_code == 200


def setup(client, transfer, **overrides):
    return client.post(route(transfer, 'safe-access'), json={
        'primary_pin': '1234', 'safety_pin': '9876', 'protected_amount': '15.00', **overrides,
    })


def access(client, transfer, pin='1234'):
    return client.post(route(transfer, 'recipient-access'), json={'pin': pin})


def withdraw(client, transfer, amount, pin='1234'):
    return client.post(route(transfer, 'withdrawals'), json={'pin': pin, 'amount': amount})


@pytest.fixture
def configured(env):
    client, path, transfer = env
    ready(client, transfer)
    assert setup(client, transfer).status_code == 200
    return env


@pytest.mark.parametrize('status', ['Sent', 'In Transit', 'Collected'])
def test_setup_requires_ready(env, status):
    client, _, transfer = env
    if status == 'In Transit':
        client.patch(route(transfer, 'status'), json={'status': status})
    elif status == 'Collected':
        ready(client, transfer)
        client.patch(route(transfer, 'status'), json={'status': status})
    assert setup(client, transfer).status_code == 409


def test_setup_metadata_and_duplicate(env):
    client, _, transfer = env
    assert client.get(route(transfer, 'safe-access')).json() == {'configured': False}
    ready(client, transfer)
    assert setup(client, transfer).json() == {'configured': True, 'currency': 'USD'}
    assert client.get(route(transfer, 'safe-access')).json() == {'configured': True}
    assert setup(client, transfer).status_code == 409


@pytest.mark.parametrize('field', ['primary_pin', 'safety_pin'])
@pytest.mark.parametrize('pin', ['', '123', '12345', '12a4', '１２３４', ' 123', 1234, None])
def test_setup_pin_format(env, field, pin):
    client, _, transfer = env
    ready(client, transfer)
    response = setup(client, transfer, **{field: pin})
    assert response.status_code == 422
    assert 'input' not in response.text
    assert '9876' not in response.text


def test_pins_must_differ(env):
    client, _, transfer = env
    ready(client, transfer)
    assert setup(client, transfer, safety_pin='1234').status_code == 422


@pytest.mark.parametrize('amount', ['0', '-1', '55.00', '55.01', '1.001', 'NaN', 'Infinity'])
def test_invalid_protected_amount(env, amount):
    client, _, transfer = env
    ready(client, transfer)
    assert setup(client, transfer, protected_amount=amount).status_code == 422


def test_setup_uses_current_balance(env):
    client, path, transfer = env
    ready(client, transfer)
    with connect(path) as db:
        db.execute("INSERT INTO withdrawals (transfer_id, amount, created_at) VALUES (?, '45.00', '2026-01-01')", (transfer['id'],))
    assert setup(client, transfer, protected_amount='10.00').status_code == 422
    assert setup(client, transfer, protected_amount='9.99').status_code == 200


def test_storage_has_only_salted_hashes(configured):
    _, path, transfer = configured
    with connect(path) as db:
        row = dict(db.execute('SELECT * FROM safe_access').fetchone())
        assert row['primary_pin_salt'] != row['safety_pin_salt']
        for field in ['primary_pin_hash', 'safety_pin_hash']:
            assert len(bytes.fromhex(row[field])) == 32
        assert '1234' not in row.values() and '9876' not in row.values()
        assert set(row) == {'transfer_id', 'primary_pin_hash', 'primary_pin_salt', 'safety_pin_hash', 'safety_pin_salt', 'protected_remaining', 'created_at'}
        assert real_remaining(db, transfer) == Decimal('55.00')
        columns = {row['name'] for row in db.execute('PRAGMA table_info(withdrawals)')}
        assert columns == {'id', 'transfer_id', 'amount', 'created_at'}


def test_response_shapes_and_generic_wrong_pin(configured):
    client, _, transfer = configured
    assert access(client, transfer).json() == {'available_to_collect': '55.00', 'currency': 'USD'}
    assert access(client, transfer, '9876').json() == {'available_to_collect': '15.00', 'currency': 'USD'}
    for pin in ['0000', '1111', 'abcd']:
        response = access(client, transfer, pin)
        assert response.status_code == 403
        assert response.json() == {'detail': 'PIN could not be verified.'}


def test_safety_withdrawal_and_restart(configured):
    client, path, transfer = configured
    assert withdraw(client, transfer, '5.00', '9876').json() == {'available_to_collect': '10.00', 'currency': 'USD'}
    assert access(client, transfer).json()['available_to_collect'] == '50.00'
    assert access(client, transfer, '9876').json()['available_to_collect'] == '10.00'
    with TestClient(create_app(path)) as reopened:
        assert access(reopened, transfer).json()['available_to_collect'] == '50.00'
        assert access(reopened, transfer, '9876').json()['available_to_collect'] == '10.00'
    assert client.get(f"/transfers/{transfer['id']}").json()['receive_amount'] == '55.00'


def test_primary_clamps_protected(configured):
    client, _, transfer = configured
    assert withdraw(client, transfer, '45.00').json()['available_to_collect'] == '10.00'
    assert access(client, transfer, '9876').json()['available_to_collect'] == '10.00'


@pytest.mark.parametrize('pin,amount', [('1234', '55.01'), ('9876', '15.01'), ('1234', '0'), ('9876', '-1'), ('1234', '0.001'), ('1234', 'NaN')])
def test_withdrawal_limits(configured, pin, amount):
    client, _, transfer = configured
    assert withdraw(client, transfer, amount, pin).status_code == 422
    assert access(client, transfer).json()['available_to_collect'] == '55.00'


def test_withdrawal_reverifies_pin(configured):
    client, _, transfer = configured
    access(client, transfer)
    assert withdraw(client, transfer, '5', '0000').status_code == 403
    assert access(client, transfer).json()['available_to_collect'] == '55.00'


def test_protected_zero_keeps_real_funds(configured):
    client, _, transfer = configured
    assert withdraw(client, transfer, '15', '9876').json()['available_to_collect'] == '0.00'
    assert access(client, transfer, '9876').json()['available_to_collect'] == '0.00'
    assert access(client, transfer).json()['available_to_collect'] == '40.00'
    assert client.get(f"/transfers/{transfer['id']}").json()['status'] == 'Ready to Collect'
    assert withdraw(client, transfer, '0.01', '9876').status_code == 422


def test_real_zero_collects_and_preserves_notification(configured):
    client, _, transfer = configured
    original = client.get(route(transfer, 'notifications')).json()
    assert len(original) == 1
    assert withdraw(client, transfer, '55').json()['available_to_collect'] == '0.00'
    assert client.get(f"/transfers/{transfer['id']}").json()['status'] == 'Collected'
    for pin in ['1234', '9876']:
        assert access(client, transfer, pin).json()['available_to_collect'] == '0.00'
        assert withdraw(client, transfer, '0.01', pin).status_code == 409
    assert client.get(route(transfer, 'notifications')).json() == original


def test_manual_collection_guard(configured):
    client, _, transfer = configured
    response = client.patch(route(transfer, 'status'), json={'status': 'Collected'})
    assert response.status_code == 409
    assert response.json()['detail'] == 'Collect remaining funds through recipient access.'


def test_manual_collection_without_setup(env):
    client, _, transfer = env
    ready(client, transfer)
    assert client.patch(route(transfer, 'status'), json={'status': 'Collected'}).status_code == 200


def test_decimal_subtraction(configured):
    client, path, transfer = configured
    withdraw(client, transfer, '0.10', '9876')
    result = withdraw(client, transfer, '0.20', '9876')
    assert result.json()['available_to_collect'] == '14.70'
    with connect(path) as db:
        assert real_remaining(db, transfer) == Decimal('54.70')


def test_concurrent_withdrawals_cannot_overspend(configured):
    client, _, transfer = configured
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: withdraw(client, transfer, '10', '9876').status_code, range(2)))
    assert sorted(responses) == [200, 422]
    assert access(client, transfer).json()['available_to_collect'] == '45.00'


def test_transaction_rolls_back_withdrawal(configured):
    _, path, transfer = configured
    with connect(path) as db:
        db.execute("CREATE TRIGGER fail_balance BEFORE UPDATE ON safe_access BEGIN SELECT RAISE(ABORT, 'test'); END")
    with TestClient(create_app(path), raise_server_exceptions=False) as client:
        assert withdraw(client, transfer, '5', '9876').status_code == 500
        assert access(client, transfer).json()['available_to_collect'] == '55.00'


def test_additive_upgrade_preserves_existing_database(env):
    client, path, transfer = env
    ready(client, transfer)
    original = client.get(route(transfer, 'notifications')).json()
    # Recreate the old schema state using only this disposable test database.
    with sqlite3.connect(path) as db:
        db.execute('DROP TABLE safe_access')
        db.execute('DROP TABLE withdrawals')
    with TestClient(create_app(path)) as upgraded:
        assert upgraded.get(route(transfer, 'notifications')).json() == original
        assert setup(upgraded, transfer).status_code == 200


def test_missing_transfer_and_unconfigured_pin(env):
    client, _, transfer = env
    assert client.get('/transfers/999/safe-access').status_code == 404
    assert access(client, transfer).json() == {'detail': 'PIN could not be verified.'}
    assert withdraw(client, transfer, '1').status_code == 403
