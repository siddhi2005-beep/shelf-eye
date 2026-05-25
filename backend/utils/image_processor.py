from pathlib import Path
from uuid import uuid4

from backend.services.vision import vision_analyzer


def process_shelf_image(image_path: str) -> str:
    """Backward-compatible wrapper used by early project scripts."""
    result = vision_analyzer.analyze(Path(image_path), f"legacy_{uuid4().hex[:8]}")
    return result["processed_image"]
