"""Job Alerts API - Create and manage job alerts for paid users"""
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from ..database import get_db
from ..auth.zitadel import get_current_user_optional, CurrentUser
from ..services.email_alerts import send_job_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Tier-based alert limits
ALERT_LIMITS = {
    "free": 0,        # No alerts for free users
    "starter": 2,     # 2 alerts
    "pro": 5,         # 5 alerts
    "premium": 10,    # 10 alerts
    "hr_admin": 50,   # Unlimited-ish
}


class AlertFilters(BaseModel):
    nursing_types: Optional[List[str]] = None  # RN, LPN, CNA, etc.
    specialties: Optional[List[str]] = None    # ICU, ER, Med-Surg, etc.
    regions: Optional[List[str]] = None        # Hampton Roads, Richmond, NoVA, etc.
    min_pay: Optional[float] = None
    max_pay: Optional[float] = None
    shift_types: Optional[List[str]] = None    # Day, Night, Rotating
    employment_types: Optional[List[str]] = None  # Full-time, Part-time, PRN, Travel
    facility_ids: Optional[List[str]] = None   # Watch specific facilities


class CreateAlertRequest(BaseModel):
    name: str
    filters: AlertFilters
    frequency: str = "daily"  # instant, daily, weekly
    notify_email: bool = True


class UpdateAlertRequest(BaseModel):
    name: Optional[str] = None
    filters: Optional[AlertFilters] = None
    frequency: Optional[str] = None
    notify_email: Optional[bool] = None
    is_active: Optional[bool] = None


async def get_user_with_tier(current_user: Optional[CurrentUser], db: Session):
    """Get user info including tier"""
    if not current_user:
        return None, "free"
    
    result = db.execute(
        text("SELECT id, email, tier, first_name FROM users WHERE email = :email LIMIT 1"),
        {"email": current_user.email}
    ).first()
    
    if result:
        return dict(result._mapping), result.tier or "free"
    return None, "free"


@router.get("/jobs")
async def get_job_alerts(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get user's job alerts"""
    user, tier = await get_user_with_tier(current_user, db)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = db.execute(
        text("""
            SELECT id, name, filters, frequency, notify_email, is_active, 
                   last_sent_at, jobs_sent_count, created_at
            FROM alerts 
            WHERE user_id = :user_id
            ORDER BY created_at DESC
        """),
        {"user_id": user["id"]}
    ).fetchall()
    
    alerts = []
    for row in result:
        alerts.append({
            "id": str(row.id),
            "name": row.name,
            "filters": row.filters,
            "frequency": row.frequency,
            "notify_email": row.notify_email,
            "is_active": row.is_active,
            "last_sent_at": row.last_sent_at.isoformat() if row.last_sent_at else None,
            "jobs_sent_count": row.jobs_sent_count,
            "created_at": row.created_at.isoformat() if row.created_at else None
        })
    
    limit = ALERT_LIMITS.get(tier, 0)
    
    return {
        "alerts": alerts,
        "count": len(alerts),
        "limit": limit,
        "tier": tier,
        "can_create": len(alerts) < limit
    }


@router.post("/jobs")
async def create_job_alert(
    request: CreateAlertRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Create a new job alert (paid users only)"""
    user, tier = await get_user_with_tier(current_user, db)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    limit = ALERT_LIMITS.get(tier, 0)
    
    if limit == 0:
        raise HTTPException(
            status_code=403, 
            detail="Job alerts require a paid subscription. Upgrade to Starter or higher."
        )
    
    # Check current count
    count = db.execute(
        text("SELECT COUNT(*) FROM alerts WHERE user_id = :user_id"),
        {"user_id": user["id"]}
    ).scalar()
    
    if count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Alert limit reached ({limit}). Upgrade your plan for more alerts."
        )
    
    # Create alert
    alert_id = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO alerts (id, user_id, name, filters, frequency, notify_email)
            VALUES (:id, :user_id, :name, :filters, :frequency, :notify_email)
        """),
        {
            "id": alert_id,
            "user_id": user["id"],
            "name": request.name,
            "filters": request.filters.model_dump_json(),
            "frequency": request.frequency,
            "notify_email": request.notify_email
        }
    )
    db.commit()
    
    return {
        "success": True,
        "alert_id": alert_id,
        "message": f"Alert '{request.name}' created successfully"
    }


@router.put("/jobs/{alert_id}")
async def update_job_alert(
    alert_id: str,
    request: UpdateAlertRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Update an existing job alert"""
    user, _ = await get_user_with_tier(current_user, db)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Verify ownership
    alert = db.execute(
        text("SELECT id FROM alerts WHERE id = :id AND user_id = :user_id"),
        {"id": alert_id, "user_id": user["id"]}
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Build update
    updates = []
    params = {"id": alert_id}
    
    if request.name is not None:
        updates.append("name = :name")
        params["name"] = request.name
    if request.filters is not None:
        updates.append("filters = :filters")
        params["filters"] = request.filters.model_dump_json()
    if request.frequency is not None:
        updates.append("frequency = :frequency")
        params["frequency"] = request.frequency
    if request.notify_email is not None:
        updates.append("notify_email = :notify_email")
        params["notify_email"] = request.notify_email
    if request.is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = request.is_active
    
    if updates:
        updates.append("updated_at = NOW()")
        db.execute(
            text(f"UPDATE alerts SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        db.commit()
    
    return {"success": True, "alert_id": alert_id}


@router.delete("/jobs/{alert_id}")
async def delete_job_alert(
    alert_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Delete a job alert"""
    user, _ = await get_user_with_tier(current_user, db)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    result = db.execute(
        text("DELETE FROM alerts WHERE id = :id AND user_id = :user_id"),
        {"id": alert_id, "user_id": user["id"]}
    )
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"success": True, "alert_id": alert_id}


@router.post("/jobs/{alert_id}/test")
async def test_job_alert(
    alert_id: str,
    background_tasks: BackgroundTasks,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Test a job alert by sending matching jobs"""
    user, tier = await get_user_with_tier(current_user, db)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get alert
    alert = db.execute(
        text("SELECT * FROM alerts WHERE id = :id AND user_id = :user_id"),
        {"id": alert_id, "user_id": user["id"]}
    ).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    # Get matching jobs
    jobs = get_matching_jobs(alert.filters, db, limit=5)
    
    if jobs:
        background_tasks.add_task(
            send_job_alert,
            user["email"],
            user.get("first_name", "there"),
            jobs
        )
    
    return {
        "success": True,
        "matching_jobs": len(jobs),
        "message": f"Found {len(jobs)} matching jobs. Email sent!" if jobs else "No matching jobs found for this alert."
    }


def get_matching_jobs(filters: dict, db: Session, limit: int = 10, since_hours: int = 24) -> List[dict]:
    """Get jobs matching alert filters"""
    conditions = ["j.is_active = true"]
    params = {"limit": limit, "since": datetime.now() - timedelta(hours=since_hours)}
    
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    
    # Filter by nursing types
    if filters.get("nursing_types"):
        conditions.append("j.nursing_type = ANY(:nursing_types)")
        params["nursing_types"] = filters["nursing_types"]
    
    # Filter by specialties
    if filters.get("specialties"):
        conditions.append("j.specialty = ANY(:specialties)")
        params["specialties"] = filters["specialties"]
    
    # Filter by regions (cities)
    if filters.get("regions"):
        region_conditions = []
        for i, region in enumerate(filters["regions"]):
            region_conditions.append(f"j.city ILIKE :region_{i}")
            params[f"region_{i}"] = f"%{region}%"
        if region_conditions:
            conditions.append(f"({' OR '.join(region_conditions)})")
    
    # Filter by min pay
    if filters.get("min_pay"):
        conditions.append("(j.pay_min >= :min_pay OR j.pay_max >= :min_pay)")
        params["min_pay"] = filters["min_pay"]
    
    # Filter by shift types
    if filters.get("shift_types"):
        conditions.append("j.shift_type = ANY(:shift_types)")
        params["shift_types"] = filters["shift_types"]
    
    # Filter by employment types
    if filters.get("employment_types"):
        conditions.append("j.employment_type = ANY(:employment_types)")
        params["employment_types"] = filters["employment_types"]
    
    # Filter by specific facilities
    if filters.get("facility_ids"):
        conditions.append("j.facility_id = ANY(:facility_ids::uuid[])")
        params["facility_ids"] = filters["facility_ids"]
    
    # Only jobs posted since last check
    conditions.append("j.created_at >= :since")
    
    where_clause = " AND ".join(conditions)
    
    result = db.execute(
        text(f"""
            SELECT j.id, j.title, j.city, j.state, j.pay_min, j.pay_max, j.pay_type,
                   j.nursing_type, j.specialty, j.shift_type, j.employment_type,
                   f.name as facility_name
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE {where_clause}
            ORDER BY j.created_at DESC
            LIMIT :limit
        """),
        params
    ).fetchall()
    
    jobs = []
    for row in result:
        jobs.append({
            "id": str(row.id),
            "title": row.title,
            "city": row.city,
            "state": row.state,
            "pay_min": float(row.pay_min) if row.pay_min else None,
            "pay_max": float(row.pay_max) if row.pay_max else None,
            "pay_type": row.pay_type,
            "nursing_type": row.nursing_type,
            "specialty": row.specialty,
            "shift_type": row.shift_type,
            "employment_type": row.employment_type,
            "facility_name": row.facility_name
        })
    
    return jobs


@router.post("/process")
async def process_all_alerts(
    background_tasks: BackgroundTasks,
    frequency: str = "daily",
    db: Session = Depends(get_db)
):
    """
    Process all alerts for a given frequency.
    This endpoint is called by a cron job.
    """
    # Get all active alerts for this frequency
    result = db.execute(
        text("""
            SELECT a.id, a.user_id, a.name, a.filters, a.frequency, a.last_sent_at,
                   u.email, u.first_name, u.tier
            FROM alerts a
            JOIN users u ON a.user_id = u.id
            WHERE a.is_active = true 
            AND a.notify_email = true
            AND a.frequency = :frequency
            AND u.tier != 'free'
        """),
        {"frequency": frequency}
    ).fetchall()
    
    processed = 0
    emails_queued = 0
    
    for alert in result:
        # Determine hours since last send
        if alert.last_sent_at:
            hours_since = (datetime.now() - alert.last_sent_at).total_seconds() / 3600
        else:
            hours_since = 9999  # First time
        
        # Check if enough time has passed
        min_hours = {"instant": 0, "daily": 20, "weekly": 160}.get(frequency, 20)
        if hours_since < min_hours:
            continue
        
        # Get matching jobs
        jobs = get_matching_jobs(alert.filters, db, limit=10, since_hours=int(min_hours) or 24)
        
        if jobs:
            # Queue email
            background_tasks.add_task(
                send_job_alert,
                alert.email,
                alert.first_name or "there",
                jobs
            )
            emails_queued += 1
            
            # Update last_sent_at
            db.execute(
                text("""
                    UPDATE alerts 
                    SET last_sent_at = NOW(), 
                        jobs_sent_count = jobs_sent_count + :count
                    WHERE id = :id
                """),
                {"id": alert.id, "count": len(jobs)}
            )
        
        processed += 1
    
    db.commit()
    
    return {
        "success": True,
        "frequency": frequency,
        "alerts_processed": processed,
        "emails_queued": emails_queued
    }
