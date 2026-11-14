"""Offline-only HTTP boundary. No provider imports or credential reads."""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException

from .contracts import CommandEnvelope, FactorySnapshot
from .service import FactoryService


def create_app(path=None):
    service = FactoryService(Path(path or os.environ.get("PRINT_ASSIST_DB", "factory.sqlite3")))
    app = FastAPI(title="Print Assist", version="0.1.0")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "mode": "offline"}

    @app.get("/api/state", response_model=FactorySnapshot)
    def state():
        return service.snapshot()

    @app.post("/api/orders", status_code=201, response_model=FactorySnapshot)
    def orders(command: CommandEnvelope):
        try:
            return service.execute(command)
        except ValueError as error:
            status = 422 if str(error) == "Unknown artifact" else 409
            raise HTTPException(status_code=status, detail=str(error)) from error

    return app
