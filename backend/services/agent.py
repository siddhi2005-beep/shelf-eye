from backend.services.storage import store


SKU_MAP = {
    "empty_shelf_gap": ("WM-DAIRY-042", "Great Value 2% Milk"),
    "misplaced_product": ("WM-PLANOGRAM-017", "Planogram Correction"),
}


class RestockAgent:
    def evaluate(self, analysis: dict, store_id: str, aisle: str, processed_image: str) -> dict:
        alerts = []
        restock_orders = []
        notifications = []

        for detection in analysis["detections"]:
            if detection["label"] != "empty_shelf_gap" or detection["confidence"] < 0.58:
                continue

            sku, product = SKU_MAP["empty_shelf_gap"]
            alert = self._create_alert(store_id, aisle, product, detection, processed_image)
            order = self._create_restock_order(alert, sku, product)
            alerts.append(alert)
            restock_orders.append(order)
            notifications.extend(self._notify_subscribers(alert))

        return {
            "alerts": alerts,
            "restock_orders": restock_orders,
            "notifications": notifications,
        }

    def _create_alert(self, store_id: str, aisle: str, product: str, detection: dict, processed_image: str) -> dict:
        now = store.now()
        severity = "critical" if detection["confidence"] >= 0.78 else "high"
        alert = {
            "id": store.new_id("alert"),
            "store_id": store_id,
            "aisle": aisle,
            "product": product,
            "issue_type": "empty_shelf",
            "severity": severity,
            "confidence": detection["confidence"],
            "status": "open",
            "message": f"{severity.title()} shelf availability risk detected for {product} in {aisle}.",
            "processed_image": processed_image,
            "created_at": now,
            "updated_at": now,
        }
        return store.add("alerts", alert)

    def _create_restock_order(self, alert: dict, sku: str, product: str) -> dict:
        order = {
            "id": store.new_id("order"),
            "alert_id": alert["id"],
            "store_id": alert["store_id"],
            "sku": sku,
            "product": product,
            "quantity": 24 if alert["severity"] == "critical" else 12,
            "distribution_center": "DC-6094 Bentonville",
            "status": "drafted",
            "created_at": store.now(),
        }
        return store.add("restock_orders", order)

    def _notify_subscribers(self, alert: dict) -> list[dict]:
        notifications = []
        subscribers = [
            subscriber
            for subscriber in store.list("subscribers")
            if subscriber["store_id"] in {alert["store_id"], "*"}
        ]
        for subscriber in subscribers:
            for channel, destination in (("email", subscriber.get("email")), ("sms", subscriber.get("phone"))):
                if not destination:
                    continue
                notification = {
                    "id": store.new_id("note"),
                    "alert_id": alert["id"],
                    "subscriber_id": subscriber["id"],
                    "subscriber_name": subscriber.get("name"),
                    "channel": channel,
                    "destination": destination,
                    "message": alert["message"],
                    "status": "simulated",
                    "created_at": store.now(),
                }
                notifications.append(store.add("notifications", notification))
        return notifications


restock_agent = RestockAgent()
