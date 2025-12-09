"""Job Applications API - Database Integrated"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
import json

from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser

router = APIRouter(prefix="/api/applications", tags=["applications"])


class ApplicationCreate(BaseModel):
    job_id: str
    job_title: Optional[str] = None
    facility_name: Optional[str] = None
    facility_city: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    next_step: Optional[str] = None
    next_step_date: Optional[datetime] = None


class NoteCreate(BaseModel):
    note: str


@router.get("")
async def list_applications(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all applications for the current user"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("""
            SELECT
                ua.id, ua.job_id, ua.status, ua.applied_at, ua.notes,
                ua.follow_up_date, ua.created_at, ua.updated_at,
                j.title as job_title, j.facility_id,
                f.name as facility_name, f.city as facility_city
            FROM user_applications ua
            LEFT JOIN jobs j ON ua.job_id = j.id
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE ua.user_id = :user_id
            ORDER BY ua.applied_at DESC
        """),
        {"user_id": current_user.user_id}
    )

    applications = []
    for row in result:
        app = dict(row._mapping)
        app["id"] = str(app["id"]) if app["id"] else None
        app["job_id"] = str(app["job_id"]) if app["job_id"] else None
        app["applied_at"] = app["applied_at"].isoformat() if app["applied_at"] else None
        app["next_step_date"] = str(app["follow_up_date"]) if app.get("follow_up_date") else None
        app["next_step"] = ""
        app["events"] = []  # Events are derived from timeline, can add later
        applications.append(app)

    return applications


@router.post("")
async def create_application(
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new job application"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    app_id = str(uuid.uuid4())

    # Check if application already exists for this job
    existing = db.execute(
        text("SELECT id FROM user_applications WHERE user_id = :user_id AND job_id = :job_id"),
        {"user_id": current_user.user_id, "job_id": data.job_id}
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Application already exists for this job")

    db.execute(
        text("""
            INSERT INTO user_applications (id, user_id, job_id, status, applied_at, notes)
            VALUES (:id, :user_id, :job_id, 'applied', NOW(), '')
        """),
        {
            "id": app_id,
            "user_id": current_user.user_id,
            "job_id": data.job_id
        }
    )
    db.commit()

    # Get job info for response
    job_info = db.execute(
        text("""
            SELECT j.title as job_title, f.name as facility_name, f.city as facility_city
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.id = :job_id
        """),
        {"job_id": data.job_id}
    ).first()

    return {
        "id": app_id,
        "job_id": data.job_id,
        "job_title": job_info.job_title if job_info else data.job_title,
        "facility_name": job_info.facility_name if job_info else data.facility_name,
        "facility_city": job_info.facility_city if job_info else data.facility_city,
        "status": "applied",
        "applied_at": datetime.now().isoformat(),
        "notes": "",
        "next_step": "",
        "next_step_date": None,
        "events": []
    }


@router.get("/stats/summary")
async def get_application_stats(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get application statistics"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status IN ('applied', 'screening', 'interviewing')) as in_progress,
                COUNT(*) FILTER (WHERE status = 'offer') as offers,
                COUNT(*) FILTER (WHERE status = 'clicked') as clicked,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected
            FROM user_applications
            WHERE user_id = :user_id
        """),
        {"user_id": current_user.user_id}
    ).first()

    total = result.total if result else 0
    in_progress = result.in_progress if result else 0
    offers = result.offers if result else 0
    rejected = result.rejected if result else 0

    # Calculate response rate
    response_rate = 0
    if total > 0:
        # Applications that got any response (not just applied/clicked/rejected without interview)
        responded = total - (result.clicked or 0) - rejected
        response_rate = round(responded / total * 100) if total > 0 else 0

    # Get counts by status
    status_result = db.execute(
        text("""
            SELECT status, COUNT(*) as count
            FROM user_applications
            WHERE user_id = :user_id
            GROUP BY status
        """),
        {"user_id": current_user.user_id}
    )

    by_status = {}
    for row in status_result:
        by_status[row.status] = row.count

    return {
        "total": total,
        "in_progress": in_progress,
        "offers": offers,
        "response_rate": response_rate,
        "by_status": by_status
    }


@router.get("/{application_id}")
async def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a specific application"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("""
            SELECT
                ua.id, ua.job_id, ua.status, ua.applied_at, ua.notes,
                ua.follow_up_date, ua.created_at, ua.updated_at,
                j.title as job_title, j.facility_id,
                f.name as facility_name, f.city as facility_city
            FROM user_applications ua
            LEFT JOIN jobs j ON ua.job_id = j.id
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE ua.id = :id AND ua.user_id = :user_id
        """),
        {"id": application_id, "user_id": current_user.user_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Application not found")

    app = dict(result._mapping)
    app["id"] = str(app["id"])
    app["job_id"] = str(app["job_id"]) if app["job_id"] else None
    app["applied_at"] = app["applied_at"].isoformat() if app["applied_at"] else None
    app["next_step_date"] = str(app["follow_up_date"]) if app.get("follow_up_date") else None
    app["next_step"] = ""
    app["events"] = []

    return app


@router.patch("/{application_id}")
async def update_application(
    application_id: str,
    data: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update an application"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if exists and belongs to user
    existing = db.execute(
        text("SELECT id, status FROM user_applications WHERE id = :id AND user_id = :user_id"),
        {"id": application_id, "user_id": current_user.user_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")

    # Build update query
    updates = ["updated_at = NOW()"]
    params = {"id": application_id, "user_id": current_user.user_id}

    if data.status is not None:
        updates.append("status = :status")
        params["status"] = data.status

    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes

    if data.next_step_date is not None:
        updates.append("follow_up_date = :follow_up_date")
        params["follow_up_date"] = data.next_step_date.date() if data.next_step_date else None

    db.execute(
        text(f"UPDATE user_applications SET {', '.join(updates)} WHERE id = :id AND user_id = :user_id"),
        params
    )
    db.commit()

    return await get_application(application_id, db, current_user)


@router.post("/{application_id}/notes")
async def add_note(
    application_id: str,
    data: NoteCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Add a note to an application"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get existing notes
    existing = db.execute(
        text("SELECT id, notes FROM user_applications WHERE id = :id AND user_id = :user_id"),
        {"id": application_id, "user_id": current_user.user_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")

    # Append new note with timestamp
    current_notes = existing.notes or ""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')

    if current_notes:
        new_notes = f"{current_notes}\n\n---\n{timestamp}\n{data.note}"
    else:
        new_notes = f"{timestamp}\n{data.note}"

    db.execute(
        text("UPDATE user_applications SET notes = :notes, updated_at = NOW() WHERE id = :id AND user_id = :user_id"),
        {"id": application_id, "user_id": current_user.user_id, "notes": new_notes}
    )
    db.commit()

    return await get_application(application_id, db, current_user)


@router.delete("/{application_id}")
async def delete_application(
    application_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete an application"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    existing = db.execute(
        text("SELECT id FROM user_applications WHERE id = :id AND user_id = :user_id"),
        {"id": application_id, "user_id": current_user.user_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Application not found")

    db.execute(
        text("DELETE FROM user_applications WHERE id = :id AND user_id = :user_id"),
        {"id": application_id, "user_id": current_user.user_id}
    )
    db.commit()

    return {"status": "deleted"}


@router.post("/track-click")
async def track_apply_click(
    data: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Track when user clicks 'Apply' on a job.
    Automatically creates an application record with 'clicked' status.
    """
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if application already exists for this job
    existing = db.execute(
        text("""
            SELECT ua.id, ua.status, j.title as job_title, f.name as facility_name, f.city as facility_city
            FROM user_applications ua
            LEFT JOIN jobs j ON ua.job_id = j.id
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE ua.user_id = :user_id AND ua.job_id = :job_id
        """),
        {"user_id": current_user.user_id, "job_id": data.job_id}
    ).first()

    if existing:
        app = {
            "id": str(existing.id),
            "job_id": data.job_id,
            "job_title": existing.job_title or data.job_title,
            "facility_name": existing.facility_name or data.facility_name,
            "facility_city": existing.facility_city or data.facility_city,
            "status": existing.status
        }
        return {"success": True, "application": app, "message": "Application already tracked"}

    # Create new application with 'clicked' status
    app_id = str(uuid.uuid4())

    db.execute(
        text("""
            INSERT INTO user_applications (id, user_id, job_id, status, applied_at, notes)
            VALUES (:id, :user_id, :job_id, 'clicked', NOW(), '')
        """),
        {
            "id": app_id,
            "user_id": current_user.user_id,
            "job_id": data.job_id
        }
    )
    db.commit()

    # Get job info for response
    job_info = db.execute(
        text("""
            SELECT j.title as job_title, f.name as facility_name, f.city as facility_city
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.id = :job_id
        """),
        {"job_id": data.job_id}
    ).first()

    application = {
        "id": app_id,
        "job_id": data.job_id,
        "job_title": job_info.job_title if job_info else data.job_title,
        "facility_name": job_info.facility_name if job_info else data.facility_name,
        "facility_city": job_info.facility_city if job_info else data.facility_city,
        "status": "clicked",
        "applied_at": datetime.now().isoformat(),
        "notes": "",
        "next_step": "",
        "next_step_date": None,
        "events": []
    }

    return {
        "success": True,
        "application": application,
        "message": "Application tracked! Update your status after applying."
    }
