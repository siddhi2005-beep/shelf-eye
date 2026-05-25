import json
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4


DATA_DIR = Path("backend/data")
DB_PATH = DATA_DIR / "shelf_eye_db.json"


class JsonStore:
    def __init__(self, path: Path = DB_PATH) -> None:
        self.path = path
        self.lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def seed(self) -> None:
        if self.path.exists():
            return
        self._write(
            {
                "alerts": [],
                "restock_orders": [],
                "subscribers": [
                    {
                        "id": self.new_id("sub"),
                        "name": "Store Operations Lead",
                        "email": "ops.lead@example.com",
                        "phone": "+15550101010",
                        "store_id": "WM-101",
                        "created_at": self.now(),
                    }
                ],
                "notifications": [],
            }
        )

    def all(self) -> dict:
        self.seed()
        with self.lock:
            return self._read()

    def list(self, collection: str) -> list[dict]:
        return self.all().get(collection, [])

    def add(self, collection: str, item: dict) -> dict:
        self.seed()
        with self.lock:
            data = self._read()
            data.setdefault(collection, []).insert(0, item)
            self._write(data)
        return item

    def update(self, collection: str, item_id: str, changes: dict) -> dict | None:
        self.seed()
        with self.lock:
            data = self._read()
            for item in data.get(collection, []):
                if item.get("id") == item_id:
                    item.update(changes)
                    self._write(data)
                    return item
        return None

    def new_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid4().hex[:10]}"

    def now(self) -> str:
        return datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")

    def _read(self) -> dict:
        if not self.path.exists():
            return {}
        return json.loads(self.path.read_text(encoding="utf-8"))

    def _write(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")


store = JsonStore()
