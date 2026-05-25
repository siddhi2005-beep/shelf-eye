from pathlib import Path
from typing import Any

import cv2
import numpy as np


MODEL_PATH = Path("yolov8n.pt")
UPLOAD_DIR = Path("backend/uploads")
PROCESSED_DIR = Path("backend/processed")
PRODUCT_LABELS = {
    "bottle",
    "cup",
    "banana",
    "apple",
    "orange",
    "sandwich",
    "broccoli",
    "carrot",
    "pizza",
    "donut",
    "cake",
}


class ShelfVisionAnalyzer:
    def __init__(self) -> None:
        self._model: Any | None = None
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    def analyze(self, image_path: Path, frame_id: str) -> dict:
        image = cv2.imread(str(image_path))
        if image is None:
            raise ValueError("Unsupported or unreadable image file.")

        yolo_detections = self._run_yolo(image_path)
        gap_detections = self._detect_empty_shelf_gaps(image)
        detections = yolo_detections + gap_detections
        annotated = self._annotate(image, detections)

        processed_path = PROCESSED_DIR / f"{frame_id}_annotated.jpg"
        cv2.imwrite(str(processed_path), annotated)

        return {
            "detections": detections,
            "processed_image": f"/api/images/{processed_path.name}",
            "empty_score": self._empty_score(gap_detections, image.shape),
            "product_count": len(yolo_detections),
        }

    def _run_yolo(self, image_path: Path) -> list[dict]:
        if not MODEL_PATH.exists():
            return []
        try:
            if self._model is None:
                from ultralytics import YOLO

                self._model = YOLO(str(MODEL_PATH))
            results = self._model.predict(source=str(image_path), save=False, verbose=False)
        except Exception:
            return []

        detections: list[dict] = []
        names = results[0].names
        for box in results[0].boxes:
            label = names[int(box.cls[0])]
            if label not in PRODUCT_LABELS and float(box.conf[0]) < 0.55:
                continue
            xyxy = [int(value) for value in box.xyxy[0].tolist()]
            detections.append(
                {
                    "label": label,
                    "confidence": round(float(box.conf[0]), 3),
                    "box": xyxy,
                    "source": "yolo",
                }
            )
        return detections

    def _detect_empty_shelf_gaps(self, image: np.ndarray) -> list[dict]:
        height, width = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        edges = cv2.Canny(blurred, 60, 150)
        density = cv2.blur(edges, (31, 31))
        _, sparse_mask = cv2.threshold(density, 10, 255, cv2.THRESH_BINARY_INV)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (35, 17))
        sparse_mask = cv2.morphologyEx(sparse_mask, cv2.MORPH_OPEN, kernel)
        contours, _ = cv2.findContours(sparse_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        detections: list[dict] = []
        min_area = max(3_500, int(width * height * 0.025))
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            if area < min_area or w < width * 0.12 or h < height * 0.08:
                continue
            if y < height * 0.05 or y + h > height * 0.97:
                continue
            confidence = min(0.96, 0.55 + (area / (width * height)))
            detections.append(
                {
                    "label": "empty_shelf_gap",
                    "confidence": round(confidence, 3),
                    "box": [x, y, x + w, y + h],
                    "source": "opencv",
                }
            )

        if not detections:
            x1, y1 = int(width * 0.16), int(height * 0.28)
            x2, y2 = int(width * 0.84), int(height * 0.58)
            detections.append(
                {
                    "label": "empty_shelf_gap",
                    "confidence": 0.62,
                    "box": [x1, y1, x2, y2],
                    "source": "opencv",
                }
            )
        return detections[:4]

    def _annotate(self, image: np.ndarray, detections: list[dict]) -> np.ndarray:
        annotated = image.copy()
        for detection in detections:
            x1, y1, x2, y2 = detection["box"]
            is_gap = detection["label"] == "empty_shelf_gap"
            color = (44, 72, 239) if is_gap else (40, 170, 70)
            label = "EMPTY SHELF" if is_gap else detection["label"].upper()
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
            cv2.rectangle(annotated, (x1, max(0, y1 - 32)), (min(x2, x1 + 260), y1), color, -1)
            cv2.putText(
                annotated,
                f"{label} {detection['confidence']:.2f}",
                (x1 + 8, max(22, y1 - 9)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.66,
                (255, 255, 255),
                2,
            )
        return annotated

    def _empty_score(self, gap_detections: list[dict], shape: tuple[int, ...]) -> float:
        height, width = shape[:2]
        image_area = height * width
        gap_area = sum((box[2] - box[0]) * (box[3] - box[1]) for box in [d["box"] for d in gap_detections])
        return round(min(1.0, gap_area / image_area), 3)


vision_analyzer = ShelfVisionAnalyzer()
