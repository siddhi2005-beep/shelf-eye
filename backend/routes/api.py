from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.schemas import AlertUpdate, SubscriberCreate
from backend.services.agent import restock_agent
from backend.services.storage import store
from backend.services.vision import PROCESSED_DIR, UPLOAD_DIR, vision_analyzer


router = APIRouter(tags=["Shelf-Eye API"])


@router.get("/overview")
def overview() -> dict:
    data = store.all()
    open_alerts = [alert for alert in data["alerts"] if alert["status"] == "open"]
    return {
        "kpis": {
            "open_alerts": len(open_alerts),
            "restock_orders": len(data["restock_orders"]),
            "subscribers": len(data["subscribers"]),
            "notifications_sent": len(data["notifications"]),
        },
        "alerts": data["alerts"][:8],
        "restock_orders": data["restock_orders"][:8],
        "notifications": data["notifications"][:8],
    }


@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    store_id: str = "WM-101",
    aisle: str = "Aisle A14 - Dairy",
) -> dict:
    suffix = Path(file.filename or "frame.jpg").suffix.lower() or ".jpg"
    allowed_suffixes = {".jpg", ".jpeg", ".jfif", ".png", ".webp", ".bmp"}
    is_image_mime = bool(file.content_type and file.content_type.startswith("image/"))
    if not is_image_mime and suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail="Upload an image file.")

    frame_id = f"frame_{uuid4().hex[:10]}"
    image_path = UPLOAD_DIR / f"{frame_id}{suffix}"
    image_path.write_bytes(await file.read())

    try:
        analysis = vision_analyzer.analyze(image_path, frame_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    agent_result = restock_agent.evaluate(
        analysis=analysis,
        store_id=store_id,
        aisle=aisle,
        processed_image=analysis["processed_image"],
    )

    alert_count = len(agent_result["alerts"])
    summary = (
        f"{alert_count} shelf anomaly detected and {len(agent_result['restock_orders'])} restock order drafted."
        if alert_count
        else "No restock-triggering shelf anomaly detected."
    )

    return {
        "frame_id": frame_id,
        "store_id": store_id,
        "aisle": aisle,
        "detections": analysis["detections"],
        "alerts": agent_result["alerts"],
        "restock_orders": agent_result["restock_orders"],
        "notifications": agent_result["notifications"],
        "processed_image": analysis["processed_image"],
        "summary": summary,
    }


@router.get("/alerts")
def alerts() -> list[dict]:
    return store.list("alerts")


@router.patch("/alerts/{alert_id}")
def update_alert(alert_id: str, payload: AlertUpdate) -> dict:
    alert = store.update(
        "alerts",
        alert_id,
        {"status": payload.status.value, "updated_at": store.now()},
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found.")
    return alert


@router.get("/restock-orders")
def restock_orders() -> list[dict]:
    return store.list("restock_orders")


@router.get("/subscribers")
def subscribers() -> list[dict]:
    return store.list("subscribers")


@router.post("/subscribers", status_code=201)
def create_subscriber(payload: SubscriberCreate) -> dict:
    if not payload.email and not payload.phone:
        raise HTTPException(status_code=400, detail="Add an email or phone number for alerts.")
    subscriber = {
        "id": store.new_id("sub"),
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "store_id": payload.store_id,
        "created_at": store.now(),
    }
    return store.add("subscribers", subscriber)


@router.get("/notifications")
def notifications() -> list[dict]:
    return store.list("notifications")


@router.get("/images/{filename}")
def processed_image(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    image_path = PROCESSED_DIR / safe_name
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(image_path)
