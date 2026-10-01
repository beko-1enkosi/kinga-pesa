from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import connect, initialize
from models import Notification, Quote, QuoteRequest, Recipient, StatusUpdate, Transfer

# Demo values only: units of recipient currency per 1 ZAR.
MOCK_RATES = {"USD": Decimal("0.055"), "BWP": Decimal("0.75")}
STATUSES = ["Sent", "In Transit", "Ready to Collect", "Collected"]


def calculate_quote(recipient, amount):
    rate = MOCK_RATES[recipient["currency"]]
    fee = (Decimal("10") + amount * Decimal("0.02")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return Quote(
        recipient_id=recipient["id"],
        send_amount=amount,
        send_currency="ZAR",
        exchange_rate=rate,
        fee=fee,
        total_cost=amount + fee,
        receive_amount=(amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        receive_currency=recipient["currency"],
    )


def get_recipient(db, recipient_id):
    row = db.execute("SELECT * FROM recipients WHERE id = ?", (recipient_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Recipient not found")
    return row


def get_transfer(db, transfer_id):
    row = db.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Transfer not found")
    return dict(row)


def create_app(database_path=None):
    path = database_path or Path(__file__).with_name("kingapesa.sqlite3")

    @asynccontextmanager
    async def lifespan(app):
        initialize(path)
        yield

    app = FastAPI(title="KingaPesa MVP", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/recipients", response_model=list[Recipient])
    def recipients():
        with connect(path) as db:
            return [dict(row) for row in db.execute("SELECT * FROM recipients ORDER BY id")]

    @app.post("/quote", response_model=Quote)
    def quote(request: QuoteRequest):
        with connect(path) as db:
            return calculate_quote(get_recipient(db, request.recipient_id), request.amount)

    @app.post("/transfers", response_model=Transfer, status_code=201)
    def create_transfer(confirmed_quote: Quote):
        # The client submits the displayed quote. Recalculate to reject altered totals.
        if not Decimal("0") < confirmed_quote.send_amount <= Decimal("1000000"):
            raise HTTPException(422, "Send amount must be greater than 0 and at most 1,000,000 ZAR")
        with connect(path) as db:
            expected = calculate_quote(
                get_recipient(db, confirmed_quote.recipient_id), confirmed_quote.send_amount
            )
            if confirmed_quote != expected:
                raise HTTPException(409, "Quote no longer matches. Please get a new quote.")
            # Decimal values are stored as text to preserve exact monetary amounts.
            values = expected.model_dump(mode="json")
            values.update(status="Sent", created_at=datetime.now(timezone.utc).isoformat())
            cursor = db.execute(
                """INSERT INTO transfers (
                    recipient_id, send_amount, send_currency, exchange_rate, fee,
                    total_cost, receive_amount, receive_currency, status, created_at
                ) VALUES (
                    :recipient_id, :send_amount, :send_currency, :exchange_rate, :fee,
                    :total_cost, :receive_amount, :receive_currency, :status, :created_at
                )""",
                values,
            )
            return get_transfer(db, cursor.lastrowid)

    @app.get("/transfers/{transfer_id}", response_model=Transfer)
    def transfer(transfer_id: int):
        with connect(path) as db:
            return get_transfer(db, transfer_id)

    @app.get("/transfers/{transfer_id}/notifications", response_model=list[Notification])
    def notifications(transfer_id: int):
        with connect(path) as db:
            get_transfer(db, transfer_id)
            rows = db.execute(
                """SELECT n.*, r.name AS recipient_name,
                          t.receive_amount, t.receive_currency
                   FROM notifications n
                   JOIN recipients r ON r.id = n.recipient_id
                   JOIN transfers t ON t.id = n.transfer_id
                   WHERE n.transfer_id = ? ORDER BY n.id""",
                (transfer_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    @app.patch("/transfers/{transfer_id}/status", response_model=Transfer)
    def update_status(transfer_id: int, request: StatusUpdate):
        with connect(path) as db:
            # Serialize demo status updates so concurrent requests cannot skip steps.
            db.execute("BEGIN IMMEDIATE")
            current = get_transfer(db, transfer_id)
            index = STATUSES.index(current["status"])
            next_status = STATUSES[index + 1] if index < len(STATUSES) - 1 else None
            if request.status != next_status:
                detail = f"Next allowed status: {next_status}" if next_status else "Transfer is already Collected"
                raise HTTPException(409, detail)
            db.execute("UPDATE transfers SET status = ? WHERE id = ?", (request.status, transfer_id))
            if request.status == "Ready to Collect":
                recipient = get_recipient(db, current["recipient_id"])
                message = (
                    f"{recipient['name']}, your KingaPesa transfer of "
                    f"{current['receive_currency']} {Decimal(current['receive_amount']):.2f} "
                    "is ready to collect."
                )
                # Simulated SMS only. The notification and status commit together.
                # The unique transfer_id also prevents duplicate rows on retries.
                db.execute(
                    """INSERT INTO notifications
                       (transfer_id, recipient_id, channel, message, status, created_at)
                       VALUES (?, ?, 'SMS', ?, 'sent', ?)
                       ON CONFLICT(transfer_id) DO NOTHING""",
                    (transfer_id, current["recipient_id"], message,
                     datetime.now(timezone.utc).isoformat()),
                )
            return get_transfer(db, transfer_id)

    return app


app = create_app()
