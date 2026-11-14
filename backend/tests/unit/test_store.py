import sqlite3

import pytest

from print_assist.store import Store


def test_transaction_releases_its_connection(tmp_path):
    store = Store(tmp_path / "factory.sqlite3")
    with store.transaction() as db:
        db.execute("SELECT 1")
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        db.execute("SELECT 1")
