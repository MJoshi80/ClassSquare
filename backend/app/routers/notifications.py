from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(
        or_(
            Notification.user_id == current_user.id,
            Notification.role == current_user.role.value,
            Notification.role == "all"
        )
    )
    # Strictly restrict technical / system notifications to administrators
    if current_user.role != UserRole.admin:
        query = query.filter(Notification.type != "system")

    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifs = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifs

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Notification).filter(
        Notification.is_read == False,
        or_(
            Notification.user_id == current_user.id,
            Notification.role == current_user.role.value,
            Notification.role == "all"
        )
    )
    # Strictly restrict technical / system notifications to administrators
    if current_user.role != UserRole.admin:
        query = query.filter(Notification.type != "system")

    count = query.count()
    return {"unread_count": count}

@router.post("/{id}/read", response_model=NotificationResponse)
def mark_as_read(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif

@router.post("/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.is_read == False,
        or_(
            Notification.user_id == current_user.id,
            Notification.role == current_user.role.value,
            Notification.role == "all"
        )
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"message": "All notifications marked as read"}
