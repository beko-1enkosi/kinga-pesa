from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import sqlite3

import pytest
from fastapi.testclient import TestClient

from main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / 'notifications.sqlite3')) as client:
        yield client


def send(client, recipient_id=1):
    quote = client.post('/quote', json={'recipient_id': recipient_id, 'amount': '1000.00'}).json()
    response = client.post('/transfers', json=quote)
    assert response.status_code == 201
    return response.json()


def advance(client, transfer, status):
    response = client.patch(f"/transfers/{transfer['id']}/status", json={'status': status})
    assert response.status_code == 200
    return response.json()


def notifications(client, transfer):
    response = client.get(f"/transfers/{transfer['id']}/notifications")
    assert response.status_code == 200
    return response.json()


def ready(client, transfer):
    advance(client, transfer, 'In Transit')
    advance(client, transfer, 'Ready to Collect')


@pytest.mark.parametrize('status', ['Sent', 'In Transit'])
def test_no_notification_before_ready(client, status):
    transfer = send(client)
    if status == 'In Transit':
        advance(client, transfer, status)
    assert notifications(client, transfer) == []


@pytest.mark.parametrize('recipient_id,name,currency,amount', [
    (1, 'Mama', 'USD', '55.00'),
    (2, 'Naledi', 'BWP', '750.00'),
])
def test_ready_creates_one_correct_notification(client, recipient_id, name, currency, amount):
    transfer = send(client, recipient_id)
    ready(client, transfer)
    records = notifications(client, transfer)
    assert len(records) == 1
    notification = records[0]
    assert notification['id'] > 0
    assert notification['transfer_id'] == transfer['id']
    assert notification['recipient_id'] == recipient_id
    assert notification['recipient_name'] == name
    assert notification['receive_amount'] == amount
    assert notification['receive_currency'] == currency
    assert notification['channel'] == 'SMS'
    assert notification['status'] == 'sent'
    assert notification['message'] == f'{name}, your KingaPesa transfer of {currency} {amount} is ready to collect.'
    assert datetime.fromisoformat(notification['created_at']).tzinfo is not None


def test_retries_and_refresh_do_not_duplicate_notification(client):
    transfer = send(client)
    ready(client, transfer)
    original = notifications(client, transfer)
    for _ in range(3):
        # Existing strict status transition behaviour stays unchanged.
        response = client.patch(f"/transfers/{transfer['id']}/status", json={'status': 'Ready to Collect'})
        assert response.status_code == 409
        assert client.get(f"/transfers/{transfer['id']}").json()['status'] == 'Ready to Collect'
        assert notifications(client, transfer) == original


def test_collected_retains_notification(client):
    transfer = send(client)
    ready(client, transfer)
    original = notifications(client, transfer)
    advance(client, transfer, 'Collected')
    assert notifications(client, transfer) == original


def test_notifications_are_scoped_to_transfer(client):
    first = send(client)
    second = send(client)
    ready(client, first)
    assert notifications(client, second) == []
    ready(client, second)
    assert notifications(client, first)[0]['transfer_id'] == first['id']
    assert notifications(client, second)[0]['transfer_id'] == second['id']
    assert notifications(client, first)[0]['id'] != notifications(client, second)[0]['id']


def test_unknown_transfer_notifications(client):
    response = client.get('/transfers/999/notifications')
    assert response.status_code == 404
    assert response.json()['detail'] == 'Transfer not found'


def test_invalid_transition_does_not_create_notification(client):
    transfer = send(client)
    response = client.patch(f"/transfers/{transfer['id']}/status", json={'status': 'Ready to Collect'})
    assert response.status_code == 409
    assert notifications(client, transfer) == []


def test_notification_survives_restart_and_database_prevents_duplicates(tmp_path):
    path = tmp_path / 'persistent.sqlite3'
    with TestClient(create_app(path)) as client:
        transfer = send(client)
        ready(client, transfer)
        original = notifications(client, transfer)
    with TestClient(create_app(path)) as client:
        assert notifications(client, transfer) == original
    with sqlite3.connect(path) as db:
        with pytest.raises(sqlite3.IntegrityError, match='UNIQUE constraint failed'):
            db.execute('''INSERT INTO notifications
                (transfer_id, recipient_id, channel, message, status, created_at)
                SELECT transfer_id, recipient_id, channel, message, status, created_at
                FROM notifications''')


def test_notification_failure_rolls_back_status_change(tmp_path):
    path = tmp_path / 'atomic.sqlite3'
    with TestClient(create_app(path), raise_server_exceptions=False) as client:
        transfer = send(client)
        advance(client, transfer, 'In Transit')
        with sqlite3.connect(path) as db:
            db.execute('''CREATE TRIGGER fail_notification BEFORE INSERT ON notifications
                BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END''')
        response = client.patch(f"/transfers/{transfer['id']}/status", json={'status': 'Ready to Collect'})
        assert response.status_code == 500
        assert client.get(f"/transfers/{transfer['id']}").json()['status'] == 'In Transit'
        assert notifications(client, transfer) == []


def test_concurrent_retries_create_only_one_notification(client):
    transfer = send(client)
    advance(client, transfer, 'In Transit')

    def mark_ready():
        return client.patch(f"/transfers/{transfer['id']}/status", json={'status': 'Ready to Collect'}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: mark_ready(), range(2)))
    assert sorted(responses) == [200, 409]
    assert len(notifications(client, transfer)) == 1
