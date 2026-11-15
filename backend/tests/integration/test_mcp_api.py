import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

from print_assist.api import create_app
from print_assist.mcp_server import create_mcp_server


def mcp_post(client, request_id, method, params=None):
    return client.post("/mcp", headers={
        "accept": "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2025-06-18",
    }, json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}})


def test_mcp_streamable_http_lists_only_read_tools_and_reads_factory_state(tmp_path):
    with TestClient(create_app(tmp_path / "factory.sqlite3"), base_url="http://127.0.0.1:8000") as client:
        initialized = mcp_post(client, 1, "initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"},
        })
        assert initialized.status_code == 200
        client.post("/mcp", headers={
            "accept": "application/json, text/event-stream",
            "content-type": "application/json",
            "mcp-protocol-version": "2025-06-18",
        }, json={"jsonrpc": "2.0", "method": "notifications/initialized"})

        listed = mcp_post(client, 2, "tools/list").json()
        tools = listed["result"]["tools"]
        names = {tool["name"] for tool in tools}
        assert names == {"get_workshop_overview", "list_printers", "list_orders", "list_incidents", "list_tasks", "list_supplies"}
        assert all("read-only" in tool["description"].lower() for tool in tools)
        assert all(tool["annotations"] == {
            "readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False,
        } for tool in tools)

        before = client.get("/api/state").json()
        called = mcp_post(client, 3, "tools/call", {"name": "get_workshop_overview", "arguments": {}}).json()
        overview = json.loads(called["result"]["content"][0]["text"])
        after = client.get("/api/state").json()
        assert overview["printers_by_status"] == {"idle": 3}
        assert overview["orders_by_status"] == {}
        assert after == before


def test_mcp_rejects_unlisted_tool_calls_without_mutating_state(tmp_path, monkeypatch):
    monkeypatch.setenv("PRINT_ASSIST_MCP_ALLOWED_HOSTS", "127.0.0.1:8000")
    with TestClient(create_app(tmp_path / "factory.sqlite3"), base_url="http://127.0.0.1:8000") as client:
        before = client.get("/api/state").json()
        response = mcp_post(client, 1, "tools/call", {"name": "reset_workshop", "arguments": {}})
        assert response.status_code == 200
        assert response.json()["result"]["isError"] is True
        assert client.get("/api/state").json() == before


def test_mcp_tools_filter_orders_and_summarize_printers_and_incidents():
    class Service:
        def snapshot(self):
            return {
                "revision": 8,
                "running": True,
                "printers": [
                    {"id": "p1", "status": "idle", "capabilities": ["FFF"], "material": {"type": "PLA", "color": "blue", "grams": 1000}},
                    {"id": "p2", "name": "North", "status": "printing", "current_job_id": "j1",
                     "capabilities": ["FFF"], "material": {"type": "PETG", "color": "black", "grams": 800}, "fault": None, "telemetry": {"temperature": 205}},
                    {"id": "p3", "capabilities": ["FFF"],
                     "material": {"type": "PLA", "color": "red", "grams": 500}},
                ],
                "orders": [
                    {"id": "o1", "artifact_id": "a1", "status": "queued", "quantity": 3},
                    {"id": "o2", "status": "completed", "quantity": 1, "successful_quantity": 1},
                ],
                "artifacts": [{"id": "a1", "name": "Blue tower", "filament_type": "PLA", "color": "blue",
                               "filament_grams": 20, "duration_seconds": 1000}],
                "modeling_tasks": [{"id": "m1", "title": "Miniature", "stage": "supports", "filament_type": "PLA",
                                    "filament_grams": 25, "support_task": {"assessment_status": "pending"}}],
                "jobs": [{"id": "j1", "order_id": "o1", "printer_id": "p2", "status": "running",
                          "elapsed_seconds": 500, "schedule_mode": "automatic"},
                         {"id": "j2", "order_id": "missing-order", "printer_id": "p3", "status": "cancelled"}],
                "incidents": [
                    {"id": "i1", "status": "investigating", "printer_id": "p2", "message": "Inspect nozzle"},
                    {"id": "i2", "status": "resolved", "printer_id": "p1", "resolved_at": "now"},
                ],
            }

    mcp = create_mcp_server(Service(), ["127.0.0.1:8000"])
    mcp_app = mcp.streamable_http_app()

    @asynccontextmanager
    async def lifespan(app):
        async with mcp.session_manager.run():
            yield

    app = FastAPI(lifespan=lifespan)
    app.mount("", mcp_app)
    with TestClient(app, base_url="http://127.0.0.1:8000") as client:
        mcp_post(client, 1, "initialize", {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"},
        })
        client.post("/mcp", headers={
            "accept": "application/json, text/event-stream", "content-type": "application/json",
            "mcp-protocol-version": "2025-06-18",
        }, json={"jsonrpc": "2.0", "method": "notifications/initialized"})

        def call(request_id, name, arguments=None):
            result = mcp_post(client, request_id, "tools/call", {"name": name, "arguments": arguments or {}}).json()
            return json.loads(result["result"]["content"][0]["text"])

        assert call(2, "get_workshop_overview") == {
            "revision": 8, "simulation_running": True,
            "printers_by_status": {"idle": 1, "printing": 1, "unknown": 1},
            "orders_by_status": {"queued": 1, "completed": 1}, "open_incidents": 1,
        }
        printers = call(3, "list_printers")
        assert len(printers) == 3 and printers[1]["telemetry"] == {"temperature": 205}
        assert "telemetry" not in printers[0] and "telemetry" not in printers[2]
        assert [row["id"] for row in call(4, "list_orders")] == ["o1", "o2"]
        assert [row["id"] for row in call(5, "list_orders", {"status": "open"})] == ["o1"]
        assert [row["id"] for row in call(6, "list_orders", {"status": "completed"})] == ["o2"]
        assert [row["id"] for row in call(7, "list_incidents")] == ["i1", "i2"]
        tasks = call(8, "list_tasks")
        assert tasks["modeling_tasks"][0]["title"] == "Miniature"
        assert tasks["print_jobs"][0]["artifact_name"] == "Blue tower"
        assert "artifact_name" not in tasks["print_jobs"][1]
        supplies = call(9, "list_supplies")
        assert supplies["by_printer"][0] == {
            "printer_id": "p1", "filament_type": "PLA", "color": "blue",
            "stock_grams": 1000, "reserved_grams": 0, "available_grams": 1000,
        }
