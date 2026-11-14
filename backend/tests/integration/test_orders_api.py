from uuid import uuid4

from fastapi.testclient import TestClient

from print_assist.api import create_app


def request_body(client, order):
    state = client.get("/api/state").json()
    return {"session_id": state["session_id"], "expected_revision": state["revision"],
            "idempotency_key": str(uuid4()), "payload": order}


def test_health_and_offline_intake_persist_without_network(tmp_path, order, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "fake-test-value")
    path = tmp_path / "factory.sqlite3"
    with TestClient(create_app(path)) as client:
        assert client.get("/api/health").json() == {"status": "ok", "mode": "offline"}
        body = request_body(client, order)
        created = client.post("/api/orders", json=body)
        assert created.status_code == 201
        assert len(created.json()["orders"]) == 1
        assert client.post("/api/orders", json=body).json() == created.json()
        changed = {**body, "payload": {**order, "quantity": 3}}
        assert client.post("/api/orders", json=changed).status_code == 409
        assert client.get("/api/state").json()["controls"]["agents_enabled"] is False
    with TestClient(create_app(path)) as client:
        assert len(client.get("/api/state").json()["orders"]) == 1
        assert client.post("/api/orders", json=body).status_code == 409


def test_api_rejects_invalid_unknown_and_stale_requests(tmp_path, order):
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        body = request_body(client, order)
        for quantity in [0, 1.5, True]:
            invalid = {**body, "payload": {**order, "quantity": quantity}}
            assert client.post("/api/orders", json=invalid).status_code == 422
        unknown = {**body, "payload": {**order, "artifact_id": "missing"}}
        assert client.post("/api/orders", json=unknown).status_code == 422
        assert client.post("/api/orders", json={**body, "expected_revision": 10}).status_code == 409
        assert client.get("/api/state").json()["orders"] == []


def test_openapi_exposes_snapshot_contract(tmp_path):
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        schema = client.get("/openapi.json").json()
        response = schema["paths"]["/api/state"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]
        assert response == {"$ref": "#/components/schemas/FactorySnapshot"}


def test_printer_snapshot_has_typed_contract_and_seeded_material(tmp_path):
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        schema = client.get("/openapi.json").json()["components"]["schemas"]
        assert schema["FactorySnapshot"]["properties"]["printers"]["items"] == {"$ref": "#/components/schemas/Printer"}
        printers = client.get("/api/state").json()["printers"]
        assert len(printers) == 3
        assert printers[0]["material"] == {"type": "PLA", "color": "blue", "grams": 1000}


def test_schedule_command_is_transactional_and_replayable(tmp_path, order):
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        created = client.post("/api/orders", json=request_body(client, order)).json()
        command = {"session_id": created["session_id"], "expected_revision": created["revision"],
                   "idempotency_key": str(uuid4()), "payload": {"mode": "manual"}}
        response = client.post("/api/schedule", json=command)
        assert response.status_code == 200
        assert len(response.json()["jobs"]) == 2
        assert all(job["status"] == "pending" for job in response.json()["jobs"])
        assert client.post("/api/schedule", json=command).json() == response.json()
        stale = {**command, "idempotency_key": str(uuid4())}
        assert client.post("/api/schedule", json=stale).status_code == 409


def test_manual_start_and_clock_commands_complete_order(tmp_path, order):
    order["quantity"] = 1
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        state = client.post("/api/orders", json=request_body(client, order)).json()
        def send(path, payload):
            nonlocal state
            command = {"session_id": state["session_id"], "expected_revision": state["revision"],
                       "idempotency_key": str(uuid4()), "payload": payload}
            response = client.post(path, json=command)
            assert response.status_code == 200, response.text
            state = response.json()
        send("/api/schedule", {"mode": "manual"})
        send("/api/start", {"job_id": state["jobs"][0]["id"]})
        assert state["jobs"][0]["status"] == "running"
        send("/api/advance", {"seconds": 7200})
        assert state["orders"][0]["successful_quantity"] == 1
        assert state["printers"][0]["status"] == "idle"


def test_production_commands_reject_stale_session_and_reused_key(tmp_path):
    with TestClient(create_app(tmp_path / "factory.sqlite3")) as client:
        state = client.get("/api/state").json()
        command = {"session_id": state["session_id"], "expected_revision": state["revision"],
                   "idempotency_key": str(uuid4()), "payload": {"seconds": 1}}
        assert client.post("/api/advance", json=command).status_code == 200
        assert client.post("/api/advance", json={**command, "payload": {"seconds": 2}}).status_code == 409
        assert client.post("/api/advance", json={**command, "session_id": str(uuid4())}).status_code == 409
        start = {**command, "idempotency_key": str(uuid4()), "expected_revision": 1, "payload": {"job_id": "missing"}}
        assert client.post("/api/start", json=start).status_code == 409


def test_restart_pauses_running_work_until_explicitly_resumed(tmp_path, order):
    path = tmp_path / "factory.sqlite3"
    order["quantity"] = 1
    with TestClient(create_app(path)) as client:
        state = client.post("/api/orders", json=request_body(client, order)).json()
        command = {"session_id": state["session_id"], "expected_revision": state["revision"],
                   "idempotency_key": str(uuid4()), "payload": {"mode": "automatic"}}
        assert client.post("/api/schedule", json=command).status_code == 200
    with TestClient(create_app(path)) as client:
        state = client.get("/api/state").json()
        assert state["jobs"][0]["status"] == "paused"
        command = {"session_id": state["session_id"], "expected_revision": state["revision"],
                   "idempotency_key": str(uuid4()), "payload": {"seconds": 3600}}
        state = client.post("/api/advance", json=command).json()
        assert state["jobs"][0].get("elapsed_seconds", 0) == 0
        command.update(expected_revision=state["revision"], idempotency_key=str(uuid4()), payload={"job_id": state["jobs"][0]["id"]})
        assert client.post("/api/start", json=command).json()["jobs"][0]["status"] == "running"


def test_restart_preserves_pending_manual_job(tmp_path, order):
    path = tmp_path / "factory.sqlite3"
    with TestClient(create_app(path)) as client:
        state = client.post("/api/orders", json=request_body(client, order)).json()
        command = {"session_id": state["session_id"], "expected_revision": state["revision"],
                   "idempotency_key": str(uuid4()), "payload": {"mode": "manual"}}
        assert client.post("/api/schedule", json=command).status_code == 200
    with TestClient(create_app(path)) as client:
        assert all(job["status"] == "pending" for job in client.get("/api/state").json()["jobs"])
