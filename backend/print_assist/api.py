"""Offline-only HTTP boundary. No provider imports or credential reads."""
import os
import asyncio
from contextlib import asynccontextmanager
from .monitoring import project
from .contracts import ClockCommand, PlanOrderCommand
from pathlib import Path

from fastapi import FastAPI, HTTPException
from typing import Literal
from .contracts import ScheduleProposal, ApplyScheduleCommand

from .contracts import AdvanceCommand, CommandEnvelope, FactorySnapshot, ScheduleCommand, StartCommand
from .service import FactoryService
from .contracts import ModelTaskCommand, ModelActionCommand
from .contracts import PrinterControlCommand, ResetCommand


def create_app(path=None):
    service = FactoryService(Path(path or os.environ.get("PRINT_ASSIST_DB", "factory.sqlite3")))
    @asynccontextmanager
    async def lifespan(app):
        async def run_clock():
            while True:
                await asyncio.sleep(1)
                service.tick()
        task=asyncio.create_task(run_clock())
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    app = FastAPI(lifespan=lifespan,title="Print Assist", version="0.1.0")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "mode": "offline"}

    @app.post('/api/modeling/tasks', response_model=FactorySnapshot)
    def create_model_task(command: ModelTaskCommand):
        try:
            return project(service.create_model_task(command))
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post('/api/modeling/actions', response_model=FactorySnapshot)
    def move_model_task(command: ModelActionCommand):
        try:
            return project(service.move_model_task(command))
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.get("/api/state", response_model=FactorySnapshot)
    def state():
        return project(service.snapshot())

    @app.post("/api/orders", status_code=201, response_model=FactorySnapshot)
    def orders(command: CommandEnvelope):
        try:
            return project(service.execute(command))
        except ValueError as error:
            status = 422 if str(error) == "Unknown artifact" else 409
            raise HTTPException(status_code=status, detail=str(error)) from error

    @app.post("/api/schedule", response_model=FactorySnapshot)
    def schedule(command: ScheduleCommand):
        try:
            return project(service.schedule(command))
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post("/api/start", response_model=FactorySnapshot)
    def start(command: StartCommand):
        try:
            return project(service.start(command))
        except (ValueError, StopIteration) as error:
            raise HTTPException(status_code=409, detail=str(error) or "Unknown job or printer") from error

    @app.post("/api/advance", response_model=FactorySnapshot)
    def advance(command: AdvanceCommand):
        try:
            return project(service.advance(command))
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post('/api/printers/control',response_model=FactorySnapshot)
    def printer_control(command:PrinterControlCommand):
        try:
            return project(service.printer_control(command))
        except ValueError as error:
            raise HTTPException(status_code=409,detail=str(error)) from error

    @app.post('/api/scenarios/reset',response_model=FactorySnapshot)
    def reset(command:ResetCommand):
        try:
            return project(service.reset(command))
        except ValueError as error:
            raise HTTPException(status_code=409,detail=str(error)) from error

    @app.post('/api/clock',response_model=FactorySnapshot)
    def clock(command:ClockCommand):
        try:
            return project(service.clock(command))
        except ValueError as error:
            raise HTTPException(status_code=409,detail=str(error)) from error

    @app.post('/api/orders/plan',response_model=FactorySnapshot)
    def plan_order(command:PlanOrderCommand):
        try:
            return project(service.plan_order(command))
        except ValueError as error:
            raise HTTPException(status_code=409,detail=str(error)) from error

    @app.get('/api/schedule/proposal',response_model=ScheduleProposal)
    def proposal(mode:Literal['automatic','manual']='automatic'):
        return service.proposal(mode)

    @app.post('/api/schedule/apply',response_model=FactorySnapshot)
    def apply_schedule(command:ApplyScheduleCommand):
        try:
            return project(service.apply_schedule(command))
        except ValueError as error:
            raise HTTPException(status_code=409,detail=str(error)) from error

    return app
