"""Validated order and command contracts."""
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    artifact_id: Annotated[str, Field(min_length=1)]
    quantity: Annotated[int, Field(strict=True, gt=0)]
    priority: Annotated[int, Field(strict=True, ge=0)] = 0
    production_due: AwareDatetime
    ship_by: AwareDatetime

    @field_validator("production_due", "ship_by")
    @classmethod
    def utc(cls, value: datetime) -> datetime:
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def deadlines(self):
        if self.production_due > self.ship_by:
            raise ValueError("Production due time must not follow ship-by time")
        return self


class CommandEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: UUID
    expected_revision: Annotated[int, Field(strict=True, ge=0)]
    idempotency_key: UUID
    payload: OrderCreate


class Artifact(BaseModel):
    id: str
    name: str
    revision: int
    reference: str
    filament_type: str
    color: str
    duration_seconds: int
    filament_grams: float
    required_capabilities: list[str]


class Order(OrderCreate):
    id: UUID
    status: str
    successful_quantity: int


class Controls(BaseModel):
    agents_enabled: bool
    automatic_triggers: bool


class ActivityEvent(BaseModel):
    type: str
    order_id: UUID
    timestamp: AwareDatetime


class FactorySnapshot(BaseModel):
    session_id: UUID
    revision: int
    simulation_time: AwareDatetime
    running: bool
    printers: list[dict]
    orders: list[Order]
    jobs: list[dict]
    events: list[ActivityEvent]
    controls: Controls
    artifacts: list[Artifact]


def validate_order(data: dict) -> OrderCreate:
    return OrderCreate.model_validate(data)
