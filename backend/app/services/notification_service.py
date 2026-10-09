from sqlalchemy.orm import Session
from typing import Optional
from app.models.notification import Notification

def create_notification(
    db: Session,
    title: str,
    message: str,
    type: str = "info",
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    link: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        role=role,
        title=title,
        message=message,
        type=type,
        link=link,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
