from pathlib import Path
from uuid import uuid4

from backend.services.vision import vision_analyzer


def detect_objects(image_path: str) -> dict:
    """Backward-compatible wrapper for older demos."""
    return vision_analyzer.analyze(Path(image_path), f"legacy_{uuid4().hex[:8]}")
