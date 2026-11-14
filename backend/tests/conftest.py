import socket

import pytest


@pytest.fixture(autouse=True)
def deny_network(monkeypatch):
    """Backend unit/in-process integration tests never need network access."""
    def guarded(method):
        def connect(sock, address):
            if isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1"}:
                return method(sock, address)
            raise AssertionError("Outbound network is disabled in tests")
        return connect

    monkeypatch.setattr(socket.socket, "connect", guarded(socket.socket.connect))
    monkeypatch.setattr(socket.socket, "connect_ex", guarded(socket.socket.connect_ex))


@pytest.fixture
def order():
    return {
        "artifact_id": "figure-pla-blue",
        "quantity": 2,
        "priority": 1,
        "production_due": "2026-11-15T12:00:00Z",
        "ship_by": "2026-11-16T12:00:00Z",
    }
