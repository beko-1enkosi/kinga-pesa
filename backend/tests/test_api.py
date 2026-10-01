import pytest
from fastapi.testclient import TestClient

from main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "test.sqlite3")) as client:
        yield client


def send(client):
    quote = client.post("/quote", json={"recipient_id": 1, "amount": "1000.00"}).json()
    response = client.post("/transfers", json=quote)
    assert response.status_code == 201
    return response.json()


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seeded_recipients(client):
    assert client.get("/recipients").json() == [
        {"id": 1, "name": "Mama", "country": "Zimbabwe", "currency": "USD"},
        {"id": 2, "name": "Naledi", "country": "Botswana", "currency": "BWP"},
    ]


@pytest.mark.parametrize("recipient_id,rate,currency,received", [
    (1, "0.055", "USD", "55.00"), (2, "0.75", "BWP", "750.00"),
])
def test_quote_calculation(client, recipient_id, rate, currency, received):
    response = client.post("/quote", json={"recipient_id": recipient_id, "amount": "1000.00"})
    assert response.status_code == 200
    assert response.json() == {
        "recipient_id": recipient_id, "send_amount": "1000.00", "send_currency": "ZAR",
        "fee": "30.00", "exchange_rate": rate, "total_cost": "1030.00",
        "receive_amount": received, "receive_currency": currency,
    }


def test_quote_rounding(client):
    quote = client.post("/quote", json={"recipient_id": 1, "amount": "1.00"}).json()
    assert quote["receive_amount"] == "0.06"
    assert quote["fee"] == "10.02"
    assert quote["total_cost"] == "11.02"


@pytest.mark.parametrize("amount", [0, -1, "1.001", "NaN", "Infinity", "hello", 1000001])
def test_invalid_amount(client, amount):
    assert client.post("/quote", json={"recipient_id": 1, "amount": amount}).status_code == 422


def test_transfer_creation(client):
    transfer = send(client)
    assert transfer["status"] == "Sent"
    assert transfer["recipient_id"] == 1
    assert transfer["total_cost"] == "1030.00"
    assert transfer["created_at"].endswith("Z")
    assert client.get(f"/transfers/{transfer['id']}").json() == transfer


def test_altered_quote_rejected(client):
    quote = client.post("/quote", json={"recipient_id": 1, "amount": 1000}).json()
    quote["fee"] = "0.00"
    assert client.post("/transfers", json=quote).status_code == 409


def test_valid_status_progression(client):
    transfer = send(client)
    path = f"/transfers/{transfer['id']}"
    for status in ["In Transit", "Ready to Collect", "Collected"]:
        response = client.patch(f"{path}/status", json={"status": status})
        assert response.status_code == 200
        assert response.json()["status"] == status
        assert client.get(path).json()["status"] == status
    assert client.patch(f"{path}/status", json={"status": "Collected"}).status_code == 409


@pytest.mark.parametrize("status", ["Sent", "Ready to Collect", "Collected"])
def test_invalid_status_transition(client, status):
    transfer = send(client)
    path = f"/transfers/{transfer['id']}"
    assert client.patch(f"{path}/status", json={"status": status}).status_code == 409
    assert client.get(path).json()["status"] == "Sent"
    client.patch(f"{path}/status", json={"status": "In Transit"})
    assert client.patch(f"{path}/status", json={"status": "Sent"}).status_code == 409
    assert client.get(path).json()["status"] == "In Transit"


def test_missing_resources_and_unknown_status(client):
    assert client.get("/transfers/999").status_code == 404
    assert client.patch("/transfers/999/status", json={"status": "In Transit"}).status_code == 404
    assert client.post("/quote", json={"recipient_id": 999, "amount": 100}).status_code == 404
    transfer = send(client)
    assert client.patch(f"/transfers/{transfer['id']}/status", json={"status": "Lost"}).status_code == 422


def test_persistence_and_seed_is_repeatable(tmp_path):
    path = tmp_path / "persistent.sqlite3"
    with TestClient(create_app(path)) as first:
        transfer = send(first)
    with TestClient(create_app(path)) as second:
        assert second.get(f"/transfers/{transfer['id']}").json() == transfer
        assert len(second.get("/recipients").json()) == 2


def test_local_frontend_cors(client):
    response = client.options("/transfers/1/status", headers={
        "Origin": "http://127.0.0.1:5173",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
