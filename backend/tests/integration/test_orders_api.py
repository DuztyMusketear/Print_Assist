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
