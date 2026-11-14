"""SQLite snapshot storage with atomic command results."""
import json
import sqlite3
from contextlib import closing, contextmanager


class Store:
    def __init__(self, path):
        self.path = path
        with self.transaction() as db:
            db.execute("CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS commands (key TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL)")
            db.execute("PRAGMA user_version = 1")

    @contextmanager
    def transaction(self):
        with closing(sqlite3.connect(self.path, timeout=10)) as db:
            with db:
                db.execute("BEGIN IMMEDIATE")
                yield db

    def load(self, db):
        row = db.execute("SELECT data FROM state WHERE id=1").fetchone()
        return json.loads(row[0]) if row else None

    def save(self, db, state):
        db.execute("INSERT OR REPLACE INTO state VALUES (1, ?)", (json.dumps(state),))
