"""Validated order and command contracts."""
from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator
from .visual_assets import ASSETS, known_visual_asset


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


class SchedulePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["automatic", "manual"] = "automatic"


class ScheduleCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: UUID
    expected_revision: Annotated[int, Field(strict=True, ge=0)]
    idempotency_key: UUID
    payload: SchedulePayload


class PlanOrderPayload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    order: OrderCreate
    review_only: bool = False
    mode: Literal['automatic','manual']
    clock_speed: Literal[1,60,300,3600] = 60


class PlanOrderCommand(ScheduleCommand):
    payload: PlanOrderPayload


class ReviseOrderPayload(BaseModel):
    model_config = ConfigDict(extra='forbid')
    order_id: str
    order: OrderCreate


class ReviseOrderCommand(ScheduleCommand):
    payload: ReviseOrderPayload


class ApplySchedulePayload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    proposal_id: Annotated[str,Field(min_length=1)]
    clock_speed: Literal[1,60,300,3600] = 60
    mode: Literal['automatic','manual']
    require_on_time: bool = Field(default_factory=bool)

class ApplyScheduleCommand(ScheduleCommand):
    payload: ApplySchedulePayload

class ScheduleAssignment(BaseModel):
    order_id: str
    printer_id: str
    start: AwareDatetime
    finish: AwareDatetime
    filament_grams: float
    duration_seconds: int

class ScheduleBlocked(BaseModel):
    order_id: str
    quantity: int
    reason: str

class ScheduleProposal(BaseModel):
    id: str
    session_id: str
    revision: int
    mode: Literal['automatic','manual']
    assignments: list[ScheduleAssignment]
    blocked: list[ScheduleBlocked]
    assumptions: str

class MaterialReservation(BaseModel):
    printer_id: str
    stock_grams: float
    reserved_grams: float
    available_grams: float

class StartPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: Annotated[str, Field(min_length=1)]


class AdvancePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seconds: Annotated[int, Field(strict=True, ge=0)]


class ClockPayload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    running: bool
    speed: Literal[1,60,300,3600]


class ClockCommand(ScheduleCommand):
    payload: ClockPayload


class StartCommand(ScheduleCommand):
    payload: StartPayload


class AdvanceCommand(ScheduleCommand):
    payload: AdvancePayload


class PrinterControlPayload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    printer_id: Annotated[str,Field(min_length=1)]
    action: Literal['pause','resume','offline','online']


class PrinterControlCommand(ScheduleCommand):
    payload: PrinterControlPayload


class ResetPayload(BaseModel):
    model_config=ConfigDict(extra='forbid')
    scenario: Literal['empty','seeded']


class ResetCommand(ScheduleCommand):
    payload: ResetPayload


class ModelTaskFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: Annotated[str, Field(min_length=1)]
    modelReference: Annotated[str, Field(min_length=1)]
    duration_seconds: Annotated[int, Field(strict=True, gt=0)]
    filament_grams: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    filament_type: Annotated[str, Field(min_length=1)]
    color: Annotated[str, Field(min_length=1)]
    required_capabilities: Annotated[list[Annotated[str, Field(min_length=1)]], Field(min_length=1)]
    visual_asset_id: str | None = None


class ModelTaskCreate(ModelTaskFields):
    _visual_asset = field_validator('visual_asset_id')(known_visual_asset)


class SupportAssessment(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    supports_required: bool
    support_reference: str | None = None
    support_material_grams: Annotated[float | None, Field(ge=0, allow_inf_nan=False)] = None
    removal_notes: str | None = None


class SupportTask(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str
    assessment_status: Literal['pending', 'ready-for-review', 'not-required']
    supports_required: bool | None = None
    support_reference: str | None = None
    support_material_grams: Annotated[float | None, Field(ge=0, allow_inf_nan=False)] = None
    removal_notes: str | None = None


class LibraryUpload(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: Annotated[str, Field(min_length=1, max_length=160)]
    filename: Annotated[str, Field(min_length=5, max_length=200, pattern=r'^[^/\\]+\.[sS][tT][lL]$')]
    stl_base64: Annotated[str, Field(max_length=13981016)]
    duration_seconds: Annotated[int, Field(strict=True, gt=0)]
    filament_grams: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    filament_type: Annotated[str, Field(min_length=1)]
    color: Annotated[str, Field(min_length=1)]
    support_assessment: SupportAssessment


class LibraryUploadCommand(ScheduleCommand):
    payload: LibraryUpload


class ExampleFeedPayload(BaseModel):
    model_config = ConfigDict(extra='forbid')


class ExampleFeedCommand(ScheduleCommand):
    payload: ExampleFeedPayload


class ShopDecision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: str
    decision: Literal['accept','reject']
    artifact_id: str | None = None


class ShopDecisionCommand(ScheduleCommand):
    payload: ShopDecision


class ShopRequest(OrderCreate):
    artifact_id: str | None = None
    id: str
    source: Literal['example']
    sku: str
    product_name: str
    status: Literal['pending','accepted','rejected']
    order_id: str | None = None


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
    visual_asset_id: str | None = None
    support_task: SupportTask | None = None


class VisualAsset(BaseModel):
    id: str
    name: str
    path: str
    units: Literal['mm']
    rotation_degrees: tuple[float, float, float]


class ModelTask(ModelTaskFields):
    id: str
    stage: Literal['modeling', 'supports', 'review', 'approved']
    reviewOutcome: Literal['changes-requested'] | None = None
    support_task: SupportTask | None = None


class ModelTaskCommand(ScheduleCommand):
    payload: ModelTaskCreate


class ModelAction(BaseModel):
    model_config = ConfigDict(extra='forbid')
    task_id: str
    action: Literal['prepare-supports', 'submit-review', 'approve', 'request-changes', 'remove']
    support_assessment: SupportAssessment | None = None


class ModelActionCommand(ScheduleCommand):
    payload: ModelAction


class Order(OrderCreate):
    requires_schedule_review: bool = Field(default_factory=bool)
    id: UUID
    status: str
    successful_quantity: int
    schedule_mode: Literal["automatic", "manual"] | None = None


class Controls(BaseModel):
    agents_enabled: bool
    automatic_triggers: bool


class PrinterMaterial(BaseModel):
    type: str
    color: str
    grams: float


class Printer(BaseModel):
    id: str
    status: str
    capabilities: list[str]
    material: PrinterMaterial


class ActivityEvent(BaseModel):
    type: str
    order_id: UUID | None = None
    timestamp: AwareDatetime
    printer_id: str | None = None
    job_id: str | None = None
    source: Literal['user','simulation','system'] = 'user'
    status: Literal['accepted','blocked'] = 'accepted'
    message: str = ''


class Forecast(BaseModel):
    order_id: UUID
    completion: AwareDatetime | None
    risk: Literal['on_time','late','unavailable']
    reason: str


class Telemetry(BaseModel):
    printer_id: str
    nozzle_c: int
    bed_c: int
    simulated: bool


class FactorySnapshot(BaseModel):
    session_id: UUID
    revision: int
    simulation_time: AwareDatetime
    running: bool
    clock_speed: int = 60
    material_reservations: list[MaterialReservation] = Field(default_factory=list)
    forecasts: list[Forecast] = Field(default_factory=list)
    telemetry: list[Telemetry] = Field(default_factory=list)
    printers: list[Printer]
    orders: list[Order]
    jobs: list[dict]
    events: list[ActivityEvent]
    controls: Controls
    artifacts: list[Artifact]
    modeling_tasks: list[ModelTask] = Field(default_factory=list)
    shop_requests: list[ShopRequest] = Field(default_factory=list)
    visual_assets: list[VisualAsset] = Field(default_factory=lambda: [VisualAsset(**asset) for asset in ASSETS])


def validate_order(data: dict) -> OrderCreate:
    return OrderCreate.model_validate(data)
