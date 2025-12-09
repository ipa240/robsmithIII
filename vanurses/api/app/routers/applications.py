from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/applications", tags=["applications"])

# Mock database for applications
applications_db = {}

class ApplicationCreate(BaseModel):
    job_id: str
    job_title: str
    facility_name: str
    facility_city: str

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    next_step: Optional[str] = None
    next_step_date: Optional[datetime] = None

class NoteCreate(BaseModel):
    note: str

class Application(BaseModel):
    id: str
    job_id: str
    job_title: str
    facility_name: str
    facility_city: str
    status: str
    applied_at: datetime
    notes: str
    next_step: str
    next_step_date: Optional[datetime]
    events: List[dict]

@router.get("")
async def list_applications():
    """List all applications for the current user"""
    return list(applications_db.values())

@router.post("")
async def create_application(data: ApplicationCreate):
    """Create a new job application"""
    app_id = str(uuid.uuid4())
    application = {
        "id": app_id,
        "job_id": data.job_id,
        "job_title": data.job_title,
        "facility_name": data.facility_name,
        "facility_city": data.facility_city,
        "status": "applied",
        "applied_at": datetime.now().isoformat(),
        "notes": "",
        "next_step": "",
        "next_step_date": None,
        "events": []
    }
    applications_db[app_id] = application
    return application

@router.get("/{application_id}")
async def get_application(application_id: str):
    """Get a specific application"""
    if application_id not in applications_db:
        raise HTTPException(status_code=404, detail="Application not found")
    return applications_db[application_id]

@router.patch("/{application_id}")
async def update_application(application_id: str, data: ApplicationUpdate):
    """Update an application"""
    if application_id not in applications_db:
        raise HTTPException(status_code=404, detail="Application not found")

    app = applications_db[application_id]

    if data.status and data.status != app["status"]:
        old_status = app["status"]
        app["status"] = data.status
        app["events"].append({
            "id": str(uuid.uuid4()),
            "event_type": f"Status changed: {old_status} → {data.status}",
            "event_data": {"old_status": old_status, "new_status": data.status},
            "created_at": datetime.now().isoformat()
        })

    if data.notes is not None:
        app["notes"] = data.notes

    if data.next_step is not None:
        app["next_step"] = data.next_step
        if data.next_step:
            app["events"].append({
                "id": str(uuid.uuid4()),
                "event_type": f"Next step set: {data.next_step}",
                "event_data": {"next_step": data.next_step},
                "created_at": datetime.now().isoformat()
            })

    if data.next_step_date is not None:
        app["next_step_date"] = data.next_step_date.isoformat() if data.next_step_date else None

    return app

@router.post("/{application_id}/notes")
async def add_note(application_id: str, data: NoteCreate):
    """Add a note to an application"""
    if application_id not in applications_db:
        raise HTTPException(status_code=404, detail="Application not found")

    app = applications_db[application_id]

    # Append to existing notes
    if app["notes"]:
        app["notes"] += f"\n\n---\n{datetime.now().strftime('%Y-%m-%d %H:%M')}\n{data.note}"
    else:
        app["notes"] = f"{datetime.now().strftime('%Y-%m-%d %H:%M')}\n{data.note}"

    app["events"].append({
        "id": str(uuid.uuid4()),
        "event_type": "Note added",
        "event_data": {"note": data.note[:50] + "..." if len(data.note) > 50 else data.note},
        "created_at": datetime.now().isoformat()
    })

    return app

@router.delete("/{application_id}")
async def delete_application(application_id: str):
    """Delete an application"""
    if application_id not in applications_db:
        raise HTTPException(status_code=404, detail="Application not found")

    del applications_db[application_id]
    return {"status": "deleted"}

@router.post("/track-click")
async def track_apply_click(data: ApplicationCreate):
    """
    Track when user clicks 'Apply' on a job.
    Automatically creates an application record with 'clicked' status.
    """
    # Check if application already exists for this job
    for app in applications_db.values():
        if app["job_id"] == data.job_id:
            # Update to show they clicked again
            app["events"].append({
                "id": str(uuid.uuid4()),
                "event_type": "Clicked Apply (again)",
                "event_data": {},
                "created_at": datetime.now().isoformat()
            })
            return {"success": True, "application": app, "message": "Application already tracked"}

    # Create new application with 'clicked' status
    app_id = str(uuid.uuid4())
    application = {
        "id": app_id,
        "job_id": data.job_id,
        "job_title": data.job_title,
        "facility_name": data.facility_name,
        "facility_city": data.facility_city,
        "status": "clicked",
        "applied_at": datetime.now().isoformat(),
        "notes": "",
        "next_step": "",
        "next_step_date": None,
        "events": [{
            "id": str(uuid.uuid4()),
            "event_type": "Clicked Apply",
            "event_data": {"source_url": "external"},
            "created_at": datetime.now().isoformat()
        }]
    }
    applications_db[app_id] = application

    return {
        "success": True,
        "application": application,
        "message": "Application tracked! Update your status after applying."
    }


@router.get("/stats/summary")
async def get_application_stats():
    """Get application statistics"""
    apps = list(applications_db.values())

    status_counts = {}
    for app in apps:
        status = app["status"]
        status_counts[status] = status_counts.get(status, 0) + 1

    total = len(apps)
    in_progress = sum(1 for a in apps if a["status"] in ["applied", "screening", "interviewing"])
    offers = sum(1 for a in apps if a["status"] == "offer")

    return {
        "total": total,
        "in_progress": in_progress,
        "offers": offers,
        "response_rate": round((len([a for a in apps if a["status"] not in ["applied", "rejected"]]) / total * 100) if total > 0 else 0),
        "by_status": status_counts
    }
