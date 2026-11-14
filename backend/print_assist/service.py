"""Serialized, transactional order intake; one application owner per database."""
import json
import threading
from uuid import uuid4

from .contracts import CommandEnvelope, ScheduleCommand
from .scheduling import schedule, start_job
from .simulation import advance
from .scenarios import initial_state
from .store import Store
from .modeling import create_task, move_task


class FactoryService:
    def __init__(self, path):
        self.store = Store(path)
        self.lock = threading.RLock()
        with self.store.transaction() as db:
            state = self.store.load(db) or initial_state()
            if "printer_schema_version" not in state:
                state["printers"] = initial_state()["printers"]
                state["printer_schema_version"] = 1
            for job in state["jobs"]:
                if job["status"] == "running":
                    job["status"] = "paused"
                    next(printer for printer in state["printers"] if printer["id"] == job["printer_id"])["status"] = "paused"
            state["session_id"] = str(uuid4())
            state["running"] = False
            state["controls"] = {"agents_enabled": False, "automatic_triggers": False}
            db.execute("DELETE FROM commands")
            self.store.save(db, state)

    def snapshot(self) -> dict:
        with self.lock, self.store.transaction() as db:
            return self.store.load(db)

    def schedule(self, command: ScheduleCommand) -> dict:
        return self._transition(command, "schedule", lambda state: schedule(state, command.payload.mode))

    def create_model_task(self, command):
        return self._transition(command, 'model-create', lambda state: create_task(state, command.payload.model_dump(mode='json')))

    def move_model_task(self, command):
        return self._transition(command, 'model-move', lambda state: move_task(state, command.payload.model_dump(mode='json')))

    def start(self, command) -> dict:
        return self._transition(command, "start", lambda state: start_job(state, command.payload.job_id))

    def advance(self, command) -> dict:
        return self._transition(command, "advance", lambda state: advance(state, command.payload.seconds))

    def _transition(self, command, name, transition) -> dict:
        canonical = json.dumps({"command": name, "payload": command.payload.model_dump(mode="json")}, sort_keys=True)
        key = str(command.idempotency_key)
        with self.lock, self.store.transaction() as db:
            state = self.store.load(db)
            if str(command.session_id) != state["session_id"]:
                raise ValueError("Stale session; refresh state before submitting")
            previous = db.execute("SELECT payload, result FROM commands WHERE key=?", (key,)).fetchone()
            if previous:
                if previous[0] != canonical:
                    raise ValueError("Idempotency key already used with a different payload")
                return json.loads(previous[1])
            if command.expected_revision != state["revision"]:
                raise ValueError("Stale revision; refresh state before submitting")
            state = transition(state)
            state["revision"] += 1
            self.store.save(db, state)
            db.execute("INSERT INTO commands VALUES (?, ?, ?)", (key, canonical, json.dumps(state)))
            return state

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
