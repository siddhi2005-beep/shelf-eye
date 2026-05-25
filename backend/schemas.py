from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class AlertStatus(str, Enum):
    open = "open"
    acknowledged = "acknowledged"
    resolved = "resolved"


class AlertSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SubscriberCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    store_id: str = Field(default="WM-101")


class Subscriber(SubscriberCreate):
    id: str
    created_at: datetime


class Alert(BaseModel):
    id: str
    store_id: str
    aisle: str
    product: str
    issue_type: Literal["empty_shelf", "misplaced_product", "low_facing"]
    severity: AlertSeverity
    confidence: float
    status: AlertStatus = AlertStatus.open
    message: str
    processed_image: str | None = None
    created_at: datetime
    updated_at: datetime


class RestockOrder(BaseModel):
    id: str
    alert_id: str
    store_id: str
    sku: str
    product: str
    quantity: int
    distribution_center: str
    status: Literal["drafted", "queued", "sent"] = "drafted"
    created_at: datetime


class Notification(BaseModel):
    id: str
    alert_id: str
    subscriber_id: str
    channel: Literal["email", "sms"]
    destination: str
    status: Literal["simulated", "failed"]
    created_at: datetime
    subscriber_name: str | None = None
    message: str | None = None


class Detection(BaseModel):
    label: str
    confidence: float
    box: list[int]
    source: Literal["yolo", "opencv"]


class AnalysisResponse(BaseModel):
    frame_id: str
    store_id: str
    aisle: str
    detections: list[Detection]
    alerts: list[Alert]
    restock_orders: list[RestockOrder]
    notifications: list[Notification]
    processed_image: str
    summary: str


class AlertUpdate(BaseModel):
    status: AlertStatus
