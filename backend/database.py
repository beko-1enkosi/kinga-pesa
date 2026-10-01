import sqlite3
from contextlib import contextmanager


@contextmanager
def connect(path):
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(path):
    with connect(path) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS recipients (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                country TEXT NOT NULL,
                currency TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_id INTEGER NOT NULL REFERENCES recipients(id),
                send_amount TEXT NOT NULL,
                send_currency TEXT NOT NULL,
                exchange_rate TEXT NOT NULL,
                fee TEXT NOT NULL,
                total_cost TEXT NOT NULL,
                receive_amount TEXT NOT NULL,
                receive_currency TEXT NOT NULL,
                status TEXT NOT NULL CHECK (
                    status IN ('Sent', 'In Transit', 'Ready to Collect', 'Collected')
                ),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_id INTEGER NOT NULL UNIQUE REFERENCES transfers(id),
                recipient_id INTEGER NOT NULL REFERENCES recipients(id),
                channel TEXT NOT NULL CHECK (channel = 'SMS'),
                message TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status = 'sent'),
                created_at TEXT NOT NULL
            );
        """)
        db.executemany(
            "INSERT OR IGNORE INTO recipients VALUES (?, ?, ?, ?)",
            [(1, "Mama", "Zimbabwe", "USD"), (2, "Naledi", "Botswana", "BWP")],
        )
