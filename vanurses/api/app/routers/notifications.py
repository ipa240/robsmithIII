"""Notifications & Alerts API - Real DB Implementation"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth.zitadel import get_current_user_optional, CurrentUser
from ..services.email_alerts import send_job_alert, send_facility_job_alert, send_digest_email

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class AlertPreferences(BaseModel):
    email_enabled: bool = True
    email_frequency: str = "daily"
    new_matching_jobs: bool = True
    facility_score_changes: bool = True
    similar_jobs: bool = False
    price_changes: bool = True
    watched_facility_jobs: bool = True


class TestEmailRequest(BaseModel):
    email: str
    type: str = "job_alert"


async def get_user_from_db(current_user: Optional[CurrentUser], db: Session):
    """Get database user from Zitadel token"""
    if not current_user:
        return None
    result = db.execute(
        text("SELECT * FROM users WHERE email = :email LIMIT 1"),
        {"email": current_user.email}
    ).first()
    return dict(result._mapping) if result else None


@router.get("")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get user's notifications from job alerts and system events"""
    user = await get_user_from_db(current_user, db)
    if not user:
        return {"notifications": [], "total": 0, "unread_count": 0}
    
    # For now, generate notifications from alerts activity
    # This will be expanded when notifications table is created
    notifications = []
    
    # Get recent alert activity
    alerts = db.execute(
        text("""
            SELECT id, name, last_sent_at, jobs_sent_count, created_at
            FROM alerts 
            WHERE user_id = :user_id AND last_sent_at IS NOT NULL
            ORDER BY last_sent_at DESC
            LIMIT 10
        """),
        {"user_id": user["id"]}
    ).fetchall()
    
    for alert in alerts:
        notifications.append({
            "id": f"alert-{alert.id}",
            "type": "job_alert_sent",
            "title": f"Jobs sent for '{alert.name}'",
            "message": f"{alert.jobs_sent_count} jobs matched your alert criteria",
            "data": {"alert_id": str(alert.id)},
            "is_read": True,
            "created_at": alert.last_sent_at.isoformat() if alert.last_sent_at else None
        })
    
    # Get saved jobs count for notification
    saved_count = db.execute(
        text("SELECT COUNT(*) FROM saved_jobs WHERE user_id = :user_id"),
        {"user_id": user["id"]}
    ).scalar()
    
    if saved_count and saved_count > 0:
        notifications.insert(0, {
            "id": "saved-jobs",
            "type": "info",
            "title": f"You have {saved_count} saved jobs",
            "message": "Review your saved jobs and apply before they expire",
            "data": {"count": saved_count},
            "is_read": True,
            "created_at": datetime.now().isoformat()
        })
    
    return {
        "notifications": notifications[offset:offset + limit],
        "total": len(notifications),
        "unread_count": sum(1 for n in notifications if not n.get("is_read", True))
    }


@router.get("/unread-count")
async def get_unread_count(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get count of unread notifications"""
    # For now return 0 until notifications table is created
    return {"count": 0}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    return {"success": True, "notification_id": notification_id}


@router.post("/read-all")
async def mark_all_read(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    return {"success": True, "updated_count": 0}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    return {"success": True, "notification_id": notification_id}


# Watches API - Use alerts table for facility watching
@router.get("/watches")
async def get_watches(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get user's watched facilities"""
    user = await get_user_from_db(current_user, db)
    if not user:
        return {"watches": []}
    
    # Get alerts that have facility_ids in filters
    result = db.execute(
        text("""
            SELECT a.id, a.name, a.filters, a.created_at
            FROM alerts a
            WHERE a.user_id = :user_id
            AND a.filters->>'facility_ids' IS NOT NULL
        """),
        {"user_id": user["id"]}
    ).fetchall()
    
    watches = []
    for row in result:
        filters = row.filters or {}
        facility_ids = filters.get("facility_ids", [])
        for fac_id in facility_ids:
            # Get facility name
            fac = db.execute(
                text("SELECT name, city FROM facilities WHERE id = :id"),
                {"id": fac_id}
            ).first()
            if fac:
                watches.append({
                    "id": f"watch-{row.id}-{fac_id}",
                    "entity_type": "facility",
                    "entity_id": fac_id,
                    "entity_name": f"{fac.name} ({fac.city})",
                    "created_at": row.created_at.isoformat() if row.created_at else None
                })
    
    return {"watches": watches}


@router.post("/watches")
async def add_watch(
    entity_type: str,
    entity_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Watch a facility (creates an alert for that facility)"""
    user = await get_user_from_db(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if entity_type != "facility":
        raise HTTPException(status_code=400, detail="Only facility watches supported")
    
    # Get facility name
    fac = db.execute(
        text("SELECT name FROM facilities WHERE id = :id"),
        {"id": entity_id}
    ).first()
    
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")
    
    # Create an alert for this facility
    import uuid
    import json
    alert_id = str(uuid.uuid4())
    filters = {"facility_ids": [entity_id]}
    
    db.execute(
        text("""
            INSERT INTO alerts (id, user_id, name, filters, frequency)
            VALUES (:id, :user_id, :name, :filters, 'daily')
        """),
        {
            "id": alert_id,
            "user_id": user["id"],
            "name": f"Watch: {fac.name}",
            "filters": json.dumps(filters)
        }
    )
    db.commit()
    
    return {
        "success": True,
        "watch": {
            "id": f"watch-{alert_id}-{entity_id}",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": fac.name
        }
    }


@router.delete("/watches/{watch_id}")
async def remove_watch(
    watch_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Remove a facility watch"""
    user = await get_user_from_db(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Parse watch_id: watch-{alert_id}-{facility_id}
    parts = watch_id.split("-")
    if len(parts) >= 2:
        alert_id = parts[1]
        # Just delete the alert
        db.execute(
            text("DELETE FROM alerts WHERE id = :id AND user_id = :user_id"),
            {"id": alert_id, "user_id": user["id"]}
        )
        db.commit()
    
    return {"success": True, "watch_id": watch_id}


# Alert Preferences
@router.get("/preferences")
async def get_alert_preferences(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get user's alert preferences"""
    # Return defaults until preferences table exists
    return AlertPreferences()


@router.put("/preferences")
async def update_alert_preferences(
    preferences: AlertPreferences,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Update user's alert preferences"""
    return {"success": True, "preferences": preferences}


# Email Test Endpoint
@router.post("/test-email")
async def send_test_email(
    request: TestEmailRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Send a test email alert"""
    # Get sample jobs from DB
    jobs_result = db.execute(
        text("""
            SELECT j.id, j.title, j.city, j.state, j.pay_min, j.pay_max, j.pay_type,
                   f.name as facility_name
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.is_active = true
            ORDER BY j.created_at DESC
            LIMIT 3
        """)
    ).fetchall()
    
    sample_jobs = []
    for job in jobs_result:
        sample_jobs.append({
            "id": str(job.id),
            "title": job.title,
            "facility_name": job.facility_name or "Unknown Facility",
            "city": job.city,
            "state": job.state or "VA",
            "pay_min": float(job.pay_min) if job.pay_min else None,
            "pay_max": float(job.pay_max) if job.pay_max else None,
            "pay_type": job.pay_type or "hourly"
        })
    
    if not sample_jobs:
        sample_jobs = [{
            "id": "test-1",
            "title": "ICU RN - Night Shift",
            "facility_name": "Sentara Norfolk General",
            "city": "Norfolk",
            "state": "VA",
            "pay_min": 45,
            "pay_max": 55,
            "pay_type": "hourly"
        }]
    
    if request.type == "job_alert":
        background_tasks.add_task(send_job_alert, request.email, "Test User", sample_jobs)
    elif request.type == "facility_alert":
        background_tasks.add_task(
            send_facility_job_alert,
            request.email,
            "Test User",
            {"id": "test", "name": "Sentara Norfolk General", "city": "Norfolk"},
            sample_jobs
        )
    elif request.type == "digest":
        background_tasks.add_task(
            send_digest_email,
            request.email,
            "Test User",
            sample_jobs,
            {},
            {"total_jobs": 1500, "avg_hourly": 42.50}
        )
    
    return {"success": True, "message": f"Test {request.type} email queued for {request.email}"}


@router.post("/trigger-alerts")
async def trigger_job_alerts(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger job alerts - called by cron"""
    # Redirect to the alerts router process endpoint
    return {
        "success": True,
        "message": "Use /api/alerts/process endpoint instead",
        "redirect": "/api/alerts/process"
    }
