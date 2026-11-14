"""Serialized, transactional order intake; one application owner per database."""
import json
import threading
from uuid import uuid4

from .contracts import CommandEnvelope
from .scenarios import initial_state
from .store import Store


class FactoryService:
    def __init__(self, path):
        self.store = Store(path)
        self.lock = threading.RLock()
        with self.store.transaction() as db:
            state = self.store.load(db) or initial_state()
            state["session_id"] = str(uuid4())
            state["running"] = False
            state["controls"] = {"agents_enabled": False, "automatic_triggers": False}
            db.execute("DELETE FROM commands")
            self.store.save(db, state)

    def snapshot(self) -> dict:
        with self.lock, self.store.transaction() as db:
            return self.store.load(db)

    def execute(self, command: dict | CommandEnvelope) -> dict:
        request = CommandEnvelope.model_validate(command)
        payload = request.payload.model_dump(mode="json")
        canonical = json.dumps(payload, sort_keys=True)
        key = str(request.idempotency_key)
        with self.lock, self.store.transaction() as db:
            state = self.store.load(db)
            if str(request.session_id) != state["session_id"]:
                raise ValueError("Stale session; refresh state before submitting")
            previous = db.execute("SELECT payload, result FROM commands WHERE key=?", (key,)).fetchone()
            if previous:
                if previous[0] != canonical:
                    raise ValueError("Idempotency key already used with a different payload")
                return json.loads(previous[1])
            if request.expected_revision != state["revision"]:
                raise ValueError("Stale revision; refresh state before submitting")
            if not any(item["id"] == payload["artifact_id"] for item in state["artifacts"]):
                raise ValueError("Unknown artifact")
            state["orders"].append({"id": str(uuid4()), **payload, "status": "queued", "successful_quantity": 0})
            state["revision"] += 1
            state["events"].append({"type": "order_created", "order_id": state["orders"][-1]["id"], "timestamp": state["simulation_time"]})
            self.store.save(db, state)
            db.execute("INSERT INTO commands VALUES (?, ?, ?)", (key, canonical, json.dumps(state)))
            return state
