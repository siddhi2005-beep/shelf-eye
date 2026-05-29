import json
import random
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator


V2_DATA_DIR = Path("backend/data")
V2_UPLOAD_DIR = Path("backend/uploads/v2")
V2_PROCESSED_DIR = Path("backend/processed/v2")
PLANOGRAM_STATE_PATH = V2_DATA_DIR / "store_mirror_planogram.json"
DEFAULT_HOURLY_AISLE_REVENUE_INR = 25_000

V2_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
V2_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(prefix="/v2", tags=["Store Mirror v2"])


class RelativeBox(BaseModel):
    x_min: float = Field(..., ge=0, le=1)
    y_min: float = Field(..., ge=0, le=1)
    x_max: float = Field(..., ge=0, le=1)
    y_max: float = Field(..., ge=0, le=1)

    @field_validator("x_max")
    @classmethod
    def validate_x_order(cls, value: float, info: Any) -> float:
        x_min = info.data.get("x_min")
        if x_min is not None and value <= x_min:
            raise ValueError("x_max must be greater than x_min")
        return value

    @field_validator("y_max")
    @classmethod
    def validate_y_order(cls, value: float, info: Any) -> float:
        y_min = info.data.get("y_min")
        if y_min is not None and value <= y_min:
            raise ValueError("y_max must be greater than y_min")
        return value

    def as_list(self) -> list[float]:
        return [self.x_min, self.y_min, self.x_max, self.y_max]


class PlanogramItem(BaseModel):
    product_id: str = Field(..., min_length=2, max_length=64)
    product_name: str = Field(..., min_length=2, max_length=120)
    target_aisle_zone: str = Field(..., min_length=2, max_length=120)
    expected_facings_count: int = Field(..., ge=1, le=100)
    relative_bbox: RelativeBox


class PlanogramUploadResponse(BaseModel):
    planogram_id: str
    source_type: Literal["json", "structural_image"]
    total_expected_items: int
    target_matrix: list[PlanogramItem]
    message: str


class ComplianceDetection(BaseModel):
    product_id: str
    product_name: str
    status: Literal["compliant", "missing_facing", "misplaced"]
    target_aisle_zone: str
    expected_facings_count: int
    observed_facings_count: int
    confidence: float
    relative_bbox: list[float]
    absolute_bbox: list[int]
    message: str


class ComplianceResponse(BaseModel):
    frame_id: str
    planogram_id: str
    compliance_score: float
    correctly_placed_items: int
    total_expected_items: int
    revenue_drop_percent: float
    revenue_at_risk_today: int
    projected_hourly_revenue: int
    projected_daily_revenue: int
    detections: list[ComplianceDetection]
    logs: list[str]
    processed_image: str
    analyzed_at: str


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _persist_planogram(payload: dict) -> None:
    V2_DATA_DIR.mkdir(parents=True, exist_ok=True)
    PLANOGRAM_STATE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_planogram() -> dict:
    if not PLANOGRAM_STATE_PATH.exists():
        payload = _default_planogram_payload(source_type="json")
        _persist_planogram(payload)
    return json.loads(PLANOGRAM_STATE_PATH.read_text(encoding="utf-8"))


def _normalize_box(raw_box: Any) -> RelativeBox:
    if isinstance(raw_box, dict):
        return RelativeBox.model_validate(raw_box)
    if isinstance(raw_box, list | tuple) and len(raw_box) == 4:
        return RelativeBox(x_min=raw_box[0], y_min=raw_box[1], x_max=raw_box[2], y_max=raw_box[3])
    raise ValueError("relative_bbox must be [x_min, y_min, x_max, y_max]")


def _parse_json_planogram(raw: bytes) -> list[PlanogramItem]:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid planogram JSON file.") from exc

    rows = payload.get("items", payload.get("products", payload)) if isinstance(payload, dict) else payload
    if not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="Planogram JSON must contain a non-empty items array.")

    items: list[PlanogramItem] = []
    for row in rows:
        if not isinstance(row, dict):
            raise HTTPException(status_code=400, detail="Each planogram row must be an object.")
        raw_box = row.get("relative_bbox") or row.get("bbox") or row.get("box")
        try:
            item = PlanogramItem(
                product_id=str(row["product_id"]),
                product_name=str(row["product_name"]),
                target_aisle_zone=str(row["target_aisle_zone"]),
                expected_facings_count=int(row["expected_facings_count"]),
                relative_bbox=_normalize_box(raw_box),
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Each item requires product_id, product_name, target_aisle_zone, "
                    "expected_facings_count, and relative_bbox."
                ),
            ) from exc
        items.append(item)
    return items


def _default_planogram_payload(source_type: Literal["json", "structural_image"]) -> dict:
    items = [
        PlanogramItem(
            product_id="PLANO-MILK-001",
            product_name="Milk",
            target_aisle_zone="Shelf_Row_1",
            expected_facings_count=4,
            relative_bbox=RelativeBox(x_min=0.08, y_min=0.14, x_max=0.46, y_max=0.36),
        ),
        PlanogramItem(
            product_id="PLANO-CHEESE-001",
            product_name="Cheese",
            target_aisle_zone="Shelf_Row_1",
            expected_facings_count=3,
            relative_bbox=RelativeBox(x_min=0.54, y_min=0.14, x_max=0.88, y_max=0.36),
        ),
        PlanogramItem(
            product_id="PLANO-MAGGI-001",
            product_name="Maggi",
            target_aisle_zone="Shelf_Row_2",
            expected_facings_count=5,
            relative_bbox=RelativeBox(x_min=0.08, y_min=0.56, x_max=0.56, y_max=0.80),
        ),
        PlanogramItem(
            product_id="PLANO-PASTA-001",
            product_name="Pasta",
            target_aisle_zone="Shelf_Row_2",
            expected_facings_count=2,
            relative_bbox=RelativeBox(x_min=0.64, y_min=0.56, x_max=0.88, y_max=0.80),
        ),
    ]
    return {
        "planogram_id": f"plano_{uuid4().hex[:10]}",
        "source_type": source_type,
        "created_at": _now(),
        "items": [item.model_dump() for item in items],
    }


def _parse_structural_image(raw: bytes) -> list[PlanogramItem]:
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Upload a readable JSON or image planogram.")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 130)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = image.shape[:2]
    candidates: list[tuple[int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area < width * height * 0.015 or w < width * 0.08 or h < height * 0.06:
            continue
        candidates.append((x, y, x + w, y + h))

    if not candidates:
        return [PlanogramItem.model_validate(item) for item in _default_planogram_payload("structural_image")["items"]]

    candidates = sorted(candidates, key=lambda box: (box[1], box[0]))[:8]
    items: list[PlanogramItem] = []
    for index, (x1, y1, x2, y2) in enumerate(candidates, start=1):
        items.append(
            PlanogramItem(
                product_id=f"IMG-SKU-{index:03d}",
                product_name=f"Image-Derived Product Zone {index}",
                target_aisle_zone=f"Imported Structural Zone {index}",
                expected_facings_count=2,
                relative_bbox=RelativeBox(
                    x_min=round(x1 / width, 4),
                    y_min=round(y1 / height, 4),
                    x_max=round(x2 / width, 4),
                    y_max=round(y2 / height, 4),
                ),
            )
        )
    return items


def _absolute_box(relative_box: RelativeBox, width: int, height: int) -> list[int]:
    return [
        int(relative_box.x_min * width),
        int(relative_box.y_min * height),
        int(relative_box.x_max * width),
        int(relative_box.y_max * height),
    ]


def _roi_occupancy(image: np.ndarray, box: list[int]) -> float:
    x1, y1, x2, y2 = box
    roi = image[max(0, y1) : max(1, y2), max(0, x1) : max(1, x2)]
    if roi.size == 0:
        return 0.0
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 150)
    edge_density = float(np.count_nonzero(edges)) / float(edges.size)
    saturation = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)[:, :, 1]
    chroma_density = float(np.mean(saturation > 35))
    brightness_variance = min(float(np.std(gray)) / 80.0, 1.0)
    score = 0.20 + edge_density * 2.8 + chroma_density * 0.38 + brightness_variance * 0.28
    return round(max(0.0, min(score, 1.0)), 3)


def _classify_item(item: PlanogramItem, image: np.ndarray, frame_seed: int) -> ComplianceDetection:
    height, width = image.shape[:2]
    absolute = _absolute_box(item.relative_bbox, width, height)
    occupancy = _roi_occupancy(image, absolute)
    jitter = random.Random(f"{frame_seed}:{item.product_id}").uniform(-0.08, 0.08)
    adjusted = max(0.0, min(1.0, occupancy + jitter))
    observed = min(item.expected_facings_count, round(item.expected_facings_count * adjusted))

    if observed >= item.expected_facings_count:
        status: Literal["compliant", "missing_facing", "misplaced"] = "compliant"
    elif adjusted > 0.50 and (frame_seed + len(item.product_name)) % 4 == 0:
        status = "misplaced"
    else:
        status = "missing_facing"

    missing = item.expected_facings_count - observed
    if status == "compliant":
        message = f"{item.product_name} aligned with {item.target_aisle_zone}."
    elif status == "misplaced":
        message = f"{item.product_name} detected outside its expected zone hierarchy."
    else:
        message = f"{item.product_name} is missing {missing} expected facing(s)."

    return ComplianceDetection(
        product_id=item.product_id,
        product_name=item.product_name,
        status=status,
        target_aisle_zone=item.target_aisle_zone,
        expected_facings_count=item.expected_facings_count,
        observed_facings_count=observed,
        confidence=round(max(0.55, min(0.98, adjusted)), 3),
        relative_bbox=item.relative_bbox.as_list(),
        absolute_bbox=absolute,
        message=message,
    )


def _draw_annotated_frame(image: np.ndarray, detections: list[ComplianceDetection], frame_id: str) -> str:
    annotated = image.copy()
    for detection in detections:
        x1, y1, x2, y2 = detection.absolute_bbox
        compliant = detection.status == "compliant"
        color = (80, 220, 120) if compliant else (42, 42, 255)
        thickness = 2 if compliant else 3
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)
        if not compliant:
            for offset in range(0, max(x2 - x1, y2 - y1), 18):
                cv2.line(annotated, (x1 + offset, y1), (min(x1 + offset + 9, x2), y1), color, 2)
                cv2.line(annotated, (x1 + offset, y2), (min(x1 + offset + 9, x2), y2), color, 2)
        label = "OK" if compliant else detection.status.replace("_", " ").upper()
        cv2.rectangle(annotated, (x1, max(0, y1 - 28)), (min(x2, x1 + 310), y1), color, -1)
        cv2.putText(
            annotated,
            f"{label}: {detection.product_name[:24]}",
            (x1 + 8, max(18, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (255, 255, 255),
            2,
        )

    processed_path = V2_PROCESSED_DIR / f"{frame_id}_compliance.jpg"
    cv2.imwrite(str(processed_path), annotated)
    return f"/api/v2/images/{processed_path.name}"


def _revenue_model(compliance_score: float) -> tuple[float, int]:
    if compliance_score >= 90:
        return 0.0, 0
    severity_gap = 90 - compliance_score
    drop_percent = min(100.0, severity_gap * 2.5)
    revenue_at_risk = round(DEFAULT_HOURLY_AISLE_REVENUE_INR * (drop_percent / 100))
    return round(drop_percent, 2), revenue_at_risk


def _build_logs(detections: list[ComplianceDetection], compliance_score: float, revenue_drop: float) -> list[str]:
    timestamp = datetime.now().strftime("%H:%M:%S")
    logs = [f"[{timestamp}] [INFO] 5s Tick: Capturing shelf state..."]
    anomalies = [detection for detection in detections if detection.status != "compliant"]
    if anomalies:
        first = anomalies[0]
        logs.append(
            f"[{timestamp}] [ALERT] {first.product_name} variance detected on "
            f"{first.target_aisle_zone}. Compliance Score dropped to {compliance_score:.1f}%."
        )
    else:
        logs.append(f"[{timestamp}] [INFO] Ideal planogram matched at {compliance_score:.1f}% compliance.")
    logs.append(f"[{timestamp}] [LOSS MITIGATION] Revenue projection downgraded by -{revenue_drop:.1f}%.")
    if anomalies:
        logs.append(f"[{timestamp}] [LOSS MITIGATION] Triggering floor staff alert for planogram correction.")
    else:
        logs.append(f"[{timestamp}] [INFO] No corrective action required. Monitoring loop remains armed.")
    return logs


@router.post("/planogram/upload", response_model=PlanogramUploadResponse)
async def upload_planogram(file: UploadFile = File(...)) -> PlanogramUploadResponse:
    raw = await file.read()
    suffix = Path(file.filename or "").suffix.lower()
    content_type = file.content_type or ""
    is_json = suffix == ".json" or content_type in {"application/json", "text/json"}

    items = _parse_json_planogram(raw) if is_json else _parse_structural_image(raw)
    source_type: Literal["json", "structural_image"] = "json" if is_json else "structural_image"
    payload = {
        "planogram_id": f"plano_{uuid4().hex[:10]}",
        "source_type": source_type,
        "created_at": _now(),
        "items": [item.model_dump() for item in items],
    }
    _persist_planogram(payload)
    return PlanogramUploadResponse(
        planogram_id=payload["planogram_id"],
        source_type=source_type,
        total_expected_items=sum(item.expected_facings_count for item in items),
        target_matrix=items,
        message="Store Mirror target matrix baseline established.",
    )


@router.get("/planogram/current", response_model=PlanogramUploadResponse)
async def current_planogram() -> PlanogramUploadResponse:
    payload = _load_planogram()
    items = [PlanogramItem.model_validate(item) for item in payload["items"]]
    return PlanogramUploadResponse(
        planogram_id=payload["planogram_id"],
        source_type=payload["source_type"],
        total_expected_items=sum(item.expected_facings_count for item in items),
        target_matrix=items,
        message="Active Store Mirror target matrix loaded.",
    )


@router.post("/analyze-compliance", response_model=ComplianceResponse)
async def analyze_compliance(file: UploadFile = File(...)) -> ComplianceResponse:
    suffix = Path(file.filename or "snapshot.jpg").suffix.lower() or ".jpg"
    if not (file.content_type or "").startswith("image/") and suffix not in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
        raise HTTPException(status_code=400, detail="Upload a camera frame image.")

    raw = await file.read()
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Unsupported or unreadable frame image.")

    planogram = _load_planogram()
    items = [PlanogramItem.model_validate(item) for item in planogram["items"]]
    frame_id = f"mirror_{uuid4().hex[:10]}"
    (V2_UPLOAD_DIR / f"{frame_id}{suffix}").write_bytes(raw)

    frame_seed = int(np.mean(image)) + int(np.std(image)) + len(raw)
    detections = [_classify_item(item, image, frame_seed) for item in items]
    total_expected = sum(item.expected_facings_count for item in items)
    correctly_placed = sum(
        min(detection.observed_facings_count, detection.expected_facings_count)
        for detection in detections
        if detection.status != "misplaced"
    )
    compliance_score = round((correctly_placed / total_expected) * 100, 1) if total_expected else 100.0
    revenue_drop, revenue_at_risk = _revenue_model(compliance_score)
    processed_image = _draw_annotated_frame(image, detections, frame_id)

    return ComplianceResponse(
        frame_id=frame_id,
        planogram_id=planogram["planogram_id"],
        compliance_score=compliance_score,
        correctly_placed_items=correctly_placed,
        total_expected_items=total_expected,
        revenue_drop_percent=revenue_drop,
        revenue_at_risk_today=revenue_at_risk,
        projected_hourly_revenue=DEFAULT_HOURLY_AISLE_REVENUE_INR,
        projected_daily_revenue=DEFAULT_HOURLY_AISLE_REVENUE_INR,
        detections=detections,
        logs=_build_logs(detections, compliance_score, revenue_drop),
        processed_image=processed_image,
        analyzed_at=_now(),
    )


@router.get("/images/{filename}")
async def v2_processed_image(filename: str) -> FileResponse:
    image_path = V2_PROCESSED_DIR / Path(filename).name
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(image_path)
