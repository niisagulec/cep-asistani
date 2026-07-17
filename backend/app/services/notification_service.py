import json
import logging
import urllib.request
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models import Notification, DevicePushToken

logger = logging.getLogger(__name__)


def send_expo_push_notification(tokens: list, title: str, body: str, data: dict):
    """
    Sends push notifications via Expo's Push Service API (https://exp.host/--/api/v2/push/send)
    runs in a background thread to prevent blocking database transactions or API responses.
    """
    if not tokens:
        return

    payload = []
    for token in tokens:
        # Expo push tokens must start with ExponentPushToken[...]
        if token.startswith("ExponentPushToken"):
            payload.append({
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data,
                "badge": 1
            })

    if not payload:
        return

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://exp.host/--/api/v2/push/send",
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate"
        },
        method="POST"
    )

    try:
        logger.info(f"Sending push notifications to {len(payload)} devices...")
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            logger.info(f"Expo push response: {res_body}")
    except Exception as e:
        logger.error(f"Failed to send push notification via Expo: {e}")


def create_and_send_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    send_push: bool = True
) -> Notification:
    """
    Creates a notification entry in the database and sends a push notification
    asynchronously using Expo Push API to all active registered devices of the user.
    """
    if data is None:
        data = {}

    # 1. Create DB Notification Entry
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        data=data,
        is_read=False,
        created_at=datetime.now(timezone.utc)
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # 2. Get Active Device Push Tokens
    if send_push:
        active_tokens = (
            db.query(DevicePushToken.expo_push_token)
            .filter(
                DevicePushToken.user_id == user_id,
                DevicePushToken.is_active == True,
                DevicePushToken.expo_push_token.isnot(None)
            )
            .all()
        )
        token_strings = [r[0] for r in active_tokens if r[0]]

        if token_strings:
            # Safe payload for lock screen privacy (exclude sensitive fields if needed)
            push_title = title
            push_body = body

            # Simple sanitization for sensitive categories (e.g. Leave health reasons)
            if type == "LEAVE_STATUS" and "health" in str(data.get("leave_type", "")).lower():
                push_body = "İzin talebiniz sonuçlandırıldı. Detaylar için dokunun."

            # Start background thread to avoid blocking main FastAPI worker
            thread = threading.Thread(
                target=send_expo_push_notification,
                args=(token_strings, push_title, push_body, data)
            )
            thread.start()

    return notification
