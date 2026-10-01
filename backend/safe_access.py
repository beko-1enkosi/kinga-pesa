"""Recipient collection accounting. PIN decisions never leave this module."""
import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, SecretStr

ITERATIONS = 600_000


class PinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pin: SecretStr


class SetupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    primary_pin: SecretStr
    safety_pin: SecretStr
    protected_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class WithdrawalRequest(PinRequest):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


def valid_pin(pin):
    return len(pin) == 4 and all("0" <= digit <= "9" for digit in pin)


def hash_pin(pin, salt):
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), ITERATIONS).hex()


def real_remaining(db, transfer):
    # SQLite SUM would coerce decimal text to floating point.
    withdrawn = sum((Decimal(row["amount"]) for row in db.execute(
        "SELECT amount FROM withdrawals WHERE transfer_id = ?", (transfer["id"],)
    )), Decimal("0"))
    return Decimal(transfer["receive_amount"]) - withdrawn


def verified_access(db, transfer_id, pin):
    row = db.execute("SELECT * FROM safe_access WHERE transfer_id = ?", (transfer_id,)).fetchone()
    if row is None or not valid_pin(pin):
        raise HTTPException(403, "PIN could not be verified.")
    # Always calculate and compare both hashes, irrespective of which matches.
    primary = hmac.compare_digest(hash_pin(pin, row["primary_pin_salt"]), row["primary_pin_hash"])
    safety = hmac.compare_digest(hash_pin(pin, row["safety_pin_salt"]), row["safety_pin_hash"])
    if not (primary or safety):
        raise HTTPException(403, "PIN could not be verified.")
    return row, primary


def balance_response(amount, transfer):
    return {"available_to_collect": format(amount, ".2f"), "currency": transfer["receive_currency"]}


def register_routes(app, path, connect, get_transfer):
    @app.get("/transfers/{transfer_id}/safe-access")
    def status(transfer_id: int):
        with connect(path) as db:
            get_transfer(db, transfer_id)
            exists = db.execute("SELECT 1 FROM safe_access WHERE transfer_id = ?", (transfer_id,)).fetchone()
            return {"configured": exists is not None}

    @app.post("/transfers/{transfer_id}/safe-access")
    def setup(transfer_id: int, request: SetupRequest):
        primary, safety = request.primary_pin.get_secret_value(), request.safety_pin.get_secret_value()
        if not valid_pin(primary) or not valid_pin(safety):
            raise HTTPException(422, "PINs must be four numeric digits.")
        if primary == safety:
            raise HTTPException(422, "PINs must differ.")
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            transfer = get_transfer(db, transfer_id)
            if db.execute("SELECT 1 FROM safe_access WHERE transfer_id = ?", (transfer_id,)).fetchone():
                raise HTTPException(409, "Safe Access already configured.")
            if transfer["status"] != "Ready to Collect":
                raise HTTPException(409, "Transfer must be Ready to Collect.")
            if request.protected_amount >= real_remaining(db, transfer):
                raise HTTPException(422, "Invalid protected amount.")
            primary_salt, safety_salt = secrets.token_bytes(16).hex(), secrets.token_bytes(16).hex()
            db.execute("""INSERT INTO safe_access VALUES (?, ?, ?, ?, ?, ?, ?)""", (
                transfer_id, hash_pin(primary, primary_salt), primary_salt,
                hash_pin(safety, safety_salt), safety_salt, format(request.protected_amount, ".2f"),
                datetime.now(timezone.utc).isoformat(),
            ))
            return {"configured": True, "currency": transfer["receive_currency"]}

    @app.post("/transfers/{transfer_id}/recipient-access")
    def access(transfer_id: int, request: PinRequest):
        with connect(path) as db:
            db.execute("BEGIN")
            transfer = get_transfer(db, transfer_id)
            row, primary = verified_access(db, transfer_id, request.pin.get_secret_value())
            remaining = real_remaining(db, transfer)
            return balance_response(remaining if primary else min(Decimal(row["protected_remaining"]), remaining), transfer)

    @app.post("/transfers/{transfer_id}/withdrawals")
    def withdraw(transfer_id: int, request: WithdrawalRequest):
        with connect(path) as db:
            db.execute("BEGIN IMMEDIATE")
            transfer = get_transfer(db, transfer_id)
            row, primary = verified_access(db, transfer_id, request.pin.get_secret_value())
            remaining = real_remaining(db, transfer)
            if transfer["status"] == "Collected" or remaining == 0:
                raise HTTPException(409, "Transfer is already Collected")
            if transfer["status"] != "Ready to Collect":
                raise HTTPException(409, "Transfer must be Ready to Collect.")
            protected = Decimal(row["protected_remaining"])
            available = remaining if primary else min(protected, remaining)
            if request.amount > available:
                raise HTTPException(422, "Withdrawal exceeds available amount.")
            remaining -= request.amount
            protected = min(protected, remaining) if primary else protected - request.amount
            db.execute("INSERT INTO withdrawals (transfer_id, amount, created_at) VALUES (?, ?, ?)", (
                transfer_id, format(request.amount, ".2f"), datetime.now(timezone.utc).isoformat(),
            ))
            db.execute("UPDATE safe_access SET protected_remaining = ? WHERE transfer_id = ?",
                       (format(protected, ".2f"), transfer_id))
            if remaining == 0:
                db.execute("UPDATE transfers SET status = 'Collected' WHERE id = ?", (transfer_id,))
            return balance_response(remaining if primary else min(protected, remaining), transfer)
