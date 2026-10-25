"""Current-user notification listing and read state."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict[str, object]:
    items = db.scalars(
        select(Notification)
        .where(Notification.recipient_id == current.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    ).all()
    unread_count = db.scalar(
        select(func.count(Notification.id))
        .where(Notification.recipient_id == current.id, Notification.is_read.is_(False))
    )
    return {
        "items": [
            {
                "id": item.id,
                "title": item.title,
                "content": item.content,
                "is_read": item.is_read,
                "notification_type": item.notification_type,
                "created_at": item.created_at,
            }
            for item in items
        ],
        "unread_count": unread_count or 0,
    }


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict[str, bool]:
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="消息不存在")
    if notification.recipient_id != current.id:
        raise HTTPException(status_code=403, detail="无权访问该消息")
    if not notification.is_read:
        notification.is_read = True
        db.commit()
    return {"success": True}
