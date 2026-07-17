from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import require_password_changed
from app.database import get_db
from app.models import Notification, DevicePushToken, User
from app.schemas import NotificationResponse, UnreadCountResponse, DevicePushTokenCreate

router = APIRouter(tags=["notifications"])


@router.get("/notifications", response_model=List[NotificationResponse])
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str = Query(default="all", alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if status_filter == "unread":
        query = query.filter(Notification.is_read == False)
    elif status_filter == "read":
        query = query.filter(Notification.is_read == True)

    offset = (page - 1) * page_size
    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return notifications


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )
    return {"unread_count": count}


@router.patch("/notifications/{id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == id, Notification.user_id == current_user.id)
        .first()
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)

    return notification


@router.patch("/notifications/read-all", response_model=List[NotificationResponse])
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    unread_notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .all()
    )

    now = datetime.now(timezone.utc)
    for notification in unread_notifications:
        notification.is_read = True
        notification.read_at = now

    db.commit()
    return unread_notifications


@router.post("/devices/push-token", status_code=status.HTTP_201_CREATED)
def register_push_token(
    payload: DevicePushTokenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    existing_token = None
    if payload.expo_push_token:
        existing_token = (
            db.query(DevicePushToken)
            .filter(
                DevicePushToken.user_id == current_user.id,
                DevicePushToken.expo_push_token == payload.expo_push_token,
            )
            .first()
        )

    if existing_token:
        existing_token.is_active = True
        existing_token.last_seen_at = datetime.now(timezone.utc)
        if payload.app_version:
            existing_token.app_version = payload.app_version
        db.commit()
        return {"status": "ok", "message": "Token updated successfully"}

    device_token = DevicePushToken(
        user_id=current_user.id,
        expo_push_token=payload.expo_push_token,
        native_push_token=payload.native_push_token,
        platform=payload.platform,
        device_identifier=payload.device_identifier,
        app_version=payload.app_version,
        is_active=True,
    )
    db.add(device_token)
    db.commit()
    return {"status": "ok", "message": "Token registered successfully"}


@router.delete("/devices/push-token", status_code=status.HTTP_200_OK)
def deregister_push_token(
    expo_push_token: str = Query(..., description="The token to deactivate"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_password_changed),
):
    device_token = (
        db.query(DevicePushToken)
        .filter(
            DevicePushToken.user_id == current_user.id,
            DevicePushToken.expo_push_token == expo_push_token,
        )
        .first()
    )
    if device_token:
        device_token.is_active = False
        db.commit()

    return {"status": "ok", "message": "Token deactivated successfully"}
