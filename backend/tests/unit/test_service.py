import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest

from print_assist.service import FactoryService


def command(service, order, **overrides):
    state = service.snapshot()
    return {
        "session_id": state["session_id"], "expected_revision": state["revision"],
        "idempotency_key": str(uuid.uuid4()), "payload": order, **overrides,
    }


def test_order_is_saved_once_and_replayed_without_new_revision(tmp_path, order):
    service = FactoryService(tmp_path / "factory.sqlite3")
    request = command(service, order)
    created = service.execute(request)
    assert created["revision"] == 1
    assert len(created["orders"]) == 1
    assert created["orders"][0]["quantity"] == 2
    assert service.execute(request) == created
    assert len(service.snapshot()["orders"]) == 1


def test_restart_retains_orders_but_invalidates_old_session(tmp_path, order):
    path = tmp_path / "factory.sqlite3"
    service = FactoryService(path)
    request = command(service, order)
    service.execute(request)
    restarted = FactoryService(path)
    state = restarted.snapshot()
    assert len(state["orders"]) == 1
    assert state["session_id"] != request["session_id"]
    assert state["running"] is False
    assert state["controls"] == {"agents_enabled": False, "automatic_triggers": False}
    with pytest.raises(ValueError, match="session"):
        restarted.execute(request)


def test_unknown_artifact_changes_nothing(tmp_path, order):
    service = FactoryService(tmp_path / "factory.sqlite3")
    before = service.snapshot()
    order["artifact_id"] = "missing"
    with pytest.raises(ValueError, match="artifact"):
        service.execute(command(service, order))
    assert service.snapshot() == before


def test_changed_payload_cannot_reuse_idempotency_key(tmp_path, order):
    service = FactoryService(tmp_path / "factory.sqlite3")
    request = command(service, order)
    service.execute(request)
    with pytest.raises(ValueError, match="Idempotency"):
        service.execute({**request, "payload": {**order, "quantity": 3}})


def test_concurrent_same_revision_accepts_only_one_order(tmp_path, order):
    service = FactoryService(tmp_path / "factory.sqlite3")
    requests = [command(service, order), command(service, order)]

    def execute(request):
        try:
            service.execute(request)
            return "accepted"
        except ValueError:
            return "conflict"

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(execute, requests)) == ["accepted", "conflict"]
    assert len(service.snapshot()["orders"]) == 1


def test_snapshot_cannot_mutate_authoritative_state(tmp_path):
    service = FactoryService(tmp_path / "factory.sqlite3")
    state = service.snapshot()
    state["orders"].append({"fake": True})
    assert service.snapshot()["orders"] == []


def test_fresh_factory_has_three_distinct_idle_printers(tmp_path):
    printers = FactoryService(tmp_path / "factory.sqlite3").snapshot()["printers"]
    assert len(printers) == 3
    assert len({printer["id"] for printer in printers}) == 3
    assert all(printer["status"] == "idle" for printer in printers)
    assert all(printer["capabilities"] and printer["material"]["grams"] > 0 for printer in printers)


def test_legacy_state_migrates_once_and_preserves_orders_and_printer_state(tmp_path, order):
    path = tmp_path / "factory.sqlite3"
    service = FactoryService(path)
    service.execute(command(service, order))
    with service.store.transaction() as db:
        legacy = service.store.load(db)
        legacy.pop("printer_schema_version", None)
        legacy["printers"] = []
        service.store.save(db, legacy)
    migrated = FactoryService(path)
    state = migrated.snapshot()
    assert len(state["orders"]) == 1
    assert len(state["printers"]) == 3
    with migrated.store.transaction() as db:
        state["printers"][0]["material"]["grams"] = 42
        migrated.store.save(db, state)
    assert FactoryService(path).snapshot()["printers"][0]["material"]["grams"] == 42
