import unittest
from pathlib import Path

from backend.services.agent import restock_agent
from backend.services.storage import store


class AgentWorkflowTest(unittest.TestCase):
    def setUp(self) -> None:
        self.original_path = store.path
        store.path = Path("backend/data/test_shelf_eye_db.json")
        if store.path.exists():
            store.path.unlink()
        store.seed()

    def tearDown(self) -> None:
        if store.path.exists():
            store.path.unlink()
        store.path = self.original_path

    def test_empty_shelf_creates_alert_order_and_notifications(self) -> None:
        result = restock_agent.evaluate(
            analysis={
                "detections": [
                    {
                        "label": "empty_shelf_gap",
                        "confidence": 0.84,
                        "box": [10, 20, 200, 120],
                        "source": "opencv",
                    }
                ]
            },
            store_id="WM-101",
            aisle="Aisle A14 - Dairy",
            processed_image="/api/images/test.jpg",
        )

        self.assertEqual(len(result["alerts"]), 1)
        self.assertEqual(len(result["restock_orders"]), 1)
        self.assertGreaterEqual(len(result["notifications"]), 1)
        self.assertEqual(result["alerts"][0]["severity"], "critical")


if __name__ == "__main__":
    unittest.main()
