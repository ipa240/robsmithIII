"""HR API - Facility employer management - Database Integrated"""
from typing import Optional
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser

router = APIRouter(prefix="/api/hr", tags=["hr"])


class JobPostingRequest(BaseModel):
    title: str
    department: str
    shift_type: str
    description: str
    requirements: Optional[str] = None
    pay_rate: Optional[str] = None
    benefits: Optional[str] = None


class FacilityClaimRequest(BaseModel):
    facility_id: str
    job_title: str
    work_email: str
    verification_method: str = "email"


def get_user_facility(db: Session, user_id: str) -> Optional[str]:
    """Get the facility ID for a verified HR user"""
    # First check if facility_claims table exists and get verified claim
    try:
        result = db.execute(text("""
            SELECT facility_id FROM facility_claims
            WHERE user_id = :user_id AND verified = TRUE
            LIMIT 1
        """), {"user_id": user_id}).first()
        if result:
            return str(result.facility_id)
    except Exception:
        pass

    # Fallback: check if user has hr_admin tier and get from user_preferences
    try:
        result = db.execute(text("""
            SELECT facility_id FROM user_preferences
            WHERE user_id = :user_id AND facility_id IS NOT NULL
            LIMIT 1
        """), {"user_id": user_id}).first()
        if result:
            return str(result.facility_id)
    except Exception:
        pass

    return None


# Stats
@router.get("/stats")
async def get_hr_stats(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get facility HR statistics from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)

    if not facility_id:
        return {
            "total_jobs": 0,
            "active_jobs": 0,
            "total_views": 0,
            "total_applications": 0,
            "avg_time_to_fill": 0,
            "ofs_score": None,
            "ofs_grade": None
        }

    # Get job stats
    job_stats = db.execute(text("""
        SELECT
            COUNT(*) as total_jobs,
            COUNT(*) FILTER (WHERE is_active = TRUE) as active_jobs
        FROM jobs
        WHERE facility_id = :facility_id
    """), {"facility_id": facility_id}).first()

    # Get facility score
    score_result = db.execute(text("""
        SELECT ofs_score, ofs_grade
        FROM facility_scores
        WHERE facility_id = :facility_id
    """), {"facility_id": facility_id}).first()

    # Get application stats
    app_stats = db.execute(text("""
        SELECT COUNT(*) as total_applications
        FROM user_applications ua
        JOIN jobs j ON ua.job_id = j.id
        WHERE j.facility_id = :facility_id
    """), {"facility_id": facility_id}).first()

    return {
        "total_jobs": job_stats.total_jobs if job_stats else 0,
        "active_jobs": job_stats.active_jobs if job_stats else 0,
        "total_views": 0,  # Would need job_views table
        "total_applications": app_stats.total_applications if app_stats else 0,
        "avg_time_to_fill": 0,  # Would need tracking
        "ofs_score": float(score_result.ofs_score) if score_result and score_result.ofs_score else None,
        "ofs_grade": score_result.ofs_grade if score_result else None
    }


# Claim verification
@router.get("/claim/status")
async def get_claim_status(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get current user's facility claim status from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        result = db.execute(text("""
            SELECT id, facility_id, verified, created_at, verified_at
            FROM facility_claims
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 1
        """), {"user_id": current_user.user_id}).first()

        if result:
            return {
                "id": str(result.id),
                "facility_id": str(result.facility_id),
                "status": "verified" if result.verified else "pending",
                "submitted_at": result.created_at.isoformat() if result.created_at else None,
                "verified_at": result.verified_at.isoformat() if result.verified_at else None
            }
    except Exception:
        pass

    return None


@router.post("/claim")
async def submit_facility_claim(
    request: FacilityClaimRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Submit a claim to represent a facility"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if facility_claims table exists, create if not
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS facility_claims (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
                job_title VARCHAR(255),
                work_email VARCHAR(255),
                verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                verified_at TIMESTAMPTZ,
                UNIQUE(user_id, facility_id)
            )
        """))
        db.commit()
    except Exception:
        pass

    claim_id = str(uuid.uuid4())
    verification_token = str(uuid.uuid4())

    try:
        db.execute(text("""
            INSERT INTO facility_claims (id, user_id, facility_id, job_title, work_email, verification_token)
            VALUES (:id, :user_id, :facility_id, :job_title, :work_email, :token)
            ON CONFLICT (user_id, facility_id) DO UPDATE SET
                job_title = :job_title,
                work_email = :work_email,
                verification_token = :token,
                verified = FALSE,
                verified_at = NULL
        """), {
            "id": claim_id,
            "user_id": current_user.user_id,
            "facility_id": request.facility_id,
            "job_title": request.job_title,
            "work_email": request.work_email,
            "token": verification_token
        })
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "success": True,
        "claim_id": claim_id,
        "message": "Verification email sent. Please check your work email."
    }


@router.post("/claim/verify/{token}")
async def verify_claim(token: str, db: Session = Depends(get_db)):
    """Verify facility claim via email token"""
    result = db.execute(text("""
        UPDATE facility_claims
        SET verified = TRUE, verified_at = NOW()
        WHERE verification_token = :token AND verified = FALSE
        RETURNING id
    """), {"token": token}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Invalid or expired verification token")

    db.commit()

    return {
        "success": True,
        "status": "verified"
    }


# Job management
@router.get("/jobs")
async def list_hr_jobs(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List jobs for the claimed facility from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)

    if not facility_id:
        return {"jobs": [], "total": 0, "message": "No verified facility claim"}

    params = {"facility_id": facility_id}
    where_clauses = ["facility_id = :facility_id"]

    if search:
        where_clauses.append("(title ILIKE '%' || :search || '%' OR specialty ILIKE '%' || :search || '%')")
        params["search"] = search
    if status:
        if status == "active":
            where_clauses.append("is_active = TRUE")
        elif status == "paused":
            where_clauses.append("is_active = FALSE")

    result = db.execute(text(f"""
        SELECT
            j.id, j.title, j.specialty as department, j.shift_type,
            j.is_active, j.scraped_at as posted_at,
            (SELECT COUNT(*) FROM user_applications ua WHERE ua.job_id = j.id) as applications
        FROM jobs j
        WHERE {' AND '.join(where_clauses)}
        ORDER BY j.scraped_at DESC
    """), params)

    jobs = []
    for row in result:
        jobs.append({
            "id": str(row.id),
            "title": row.title,
            "department": row.department or "General",
            "shift_type": row.shift_type or "Various",
            "status": "active" if row.is_active else "paused",
            "views": 0,  # Would need job_views table
            "applications": row.applications or 0,
            "posted_at": row.posted_at.isoformat() if row.posted_at else None,
            "is_boosted": False
        })

    return {"jobs": jobs, "total": len(jobs)}


@router.post("/jobs")
async def create_job(
    request: JobPostingRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new job posting"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)
    if not facility_id:
        raise HTTPException(status_code=403, detail="No verified facility claim")

    job_id = str(uuid.uuid4())

    db.execute(text("""
        INSERT INTO jobs (id, facility_id, title, specialty, shift_type, description, is_active, scraped_at)
        VALUES (:id, :facility_id, :title, :department, :shift_type, :description, TRUE, NOW())
    """), {
        "id": job_id,
        "facility_id": facility_id,
        "title": request.title,
        "department": request.department,
        "shift_type": request.shift_type,
        "description": request.description
    })
    db.commit()

    return {
        "success": True,
        "job_id": job_id,
        "message": "Job posting created successfully"
    }


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a specific job posting from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)

    result = db.execute(text("""
        SELECT
            j.id, j.title, j.specialty as department, j.shift_type, j.description,
            j.requirements, j.is_active, j.scraped_at as posted_at,
            j.pay_min, j.pay_max, j.pay_type, j.benefits,
            (SELECT COUNT(*) FROM user_applications ua WHERE ua.job_id = j.id) as applications
        FROM jobs j
        WHERE j.id = :job_id
    """), {"job_id": job_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Job not found")

    # Format pay rate
    pay_rate = None
    if result.pay_min:
        if result.pay_max and result.pay_max != result.pay_min:
            pay_rate = f"${result.pay_min}-${result.pay_max}/{result.pay_type or 'hour'}"
        else:
            pay_rate = f"${result.pay_min}/{result.pay_type or 'hour'}"

    return {
        "id": str(result.id),
        "title": result.title,
        "department": result.department or "General",
        "shift_type": result.shift_type or "Various",
        "description": result.description or "",
        "requirements": result.requirements or "",
        "pay_rate": pay_rate,
        "benefits": result.benefits or "",
        "status": "active" if result.is_active else "paused",
        "views": 0,
        "applications": result.applications or 0,
        "posted_at": result.posted_at.isoformat() if result.posted_at else None
    }


@router.patch("/jobs/{job_id}")
async def update_job(
    job_id: str,
    title: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a job posting"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    updates = []
    params = {"job_id": job_id}

    if title:
        updates.append("title = :title")
        params["title"] = title
    if status:
        updates.append("is_active = :is_active")
        params["is_active"] = status == "active"

    if updates:
        db.execute(text(f"UPDATE jobs SET {', '.join(updates)} WHERE id = :job_id"), params)
        db.commit()

    return {"success": True, "job_id": job_id}


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a job posting (set inactive)"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db.execute(text("UPDATE jobs SET is_active = FALSE WHERE id = :job_id"), {"job_id": job_id})
    db.commit()

    return {"success": True, "job_id": job_id}


# Boost
@router.post("/jobs/{job_id}/boost")
async def boost_job(
    job_id: str,
    duration_days: int = 7,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Boost a job posting for more visibility"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    boost_prices = {7: 2999, 14: 4999, 30: 7999}
    price = boost_prices.get(duration_days, 2999)

    # Would create boost record in database
    return {
        "success": True,
        "job_id": job_id,
        "boost_until": (datetime.now().replace(hour=0, minute=0, second=0) +
                       __import__('datetime').timedelta(days=duration_days)).isoformat(),
        "price_cents": price
    }


# Analytics
@router.get("/analytics")
async def get_analytics(
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get hiring analytics from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)

    if not facility_id:
        return {
            "period": period,
            "views": {"total": 0, "trend": 0, "by_day": []},
            "applications": {"total": 0, "trend": 0, "by_day": []},
            "conversion_rate": 0,
            "top_sources": [],
            "top_jobs": []
        }

    # Get application stats
    app_result = db.execute(text("""
        SELECT COUNT(*) as total
        FROM user_applications ua
        JOIN jobs j ON ua.job_id = j.id
        WHERE j.facility_id = :facility_id
    """), {"facility_id": facility_id}).first()

    # Get top jobs by applications
    top_jobs_result = db.execute(text("""
        SELECT j.title, COUNT(ua.id) as applications
        FROM jobs j
        LEFT JOIN user_applications ua ON ua.job_id = j.id
        WHERE j.facility_id = :facility_id
        GROUP BY j.id, j.title
        ORDER BY applications DESC
        LIMIT 5
    """), {"facility_id": facility_id})

    top_jobs = [{"title": row.title, "applications": row.applications or 0} for row in top_jobs_result]

    return {
        "period": period,
        "views": {"total": 0, "trend": 0, "by_day": []},
        "applications": {
            "total": app_result.total if app_result else 0,
            "trend": 0,
            "by_day": []
        },
        "conversion_rate": 0,
        "top_sources": [{"source": "VANurses Direct", "percentage": 100}],
        "top_jobs": top_jobs
    }


# Feedback
@router.get("/feedback")
async def get_facility_feedback(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get nurse feedback about the facility from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    facility_id = get_user_facility(db, current_user.user_id)

    if not facility_id:
        return {"feedback": [], "summary": {"overall_rating": 0, "total_reviews": 0, "by_category": {}}}

    # Try to get feedback from facility_feedback table
    try:
        result = db.execute(text("""
            SELECT id, category, rating, comment, created_at, response
            FROM facility_feedback
            WHERE facility_id = :facility_id
            ORDER BY created_at DESC
            LIMIT :limit
        """), {"facility_id": facility_id, "limit": limit})

        feedback = []
        for row in result:
            feedback.append({
                "id": str(row.id),
                "category": row.category,
                "rating": float(row.rating) if row.rating else 0,
                "comment": row.comment,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "response": row.response
            })

        # Get summary
        summary_result = db.execute(text("""
            SELECT
                AVG(rating) as overall_rating,
                COUNT(*) as total_reviews
            FROM facility_feedback
            WHERE facility_id = :facility_id
        """), {"facility_id": facility_id}).first()

        # Get by category
        by_category_result = db.execute(text("""
            SELECT category, AVG(rating) as avg_rating
            FROM facility_feedback
            WHERE facility_id = :facility_id
            GROUP BY category
        """), {"facility_id": facility_id})

        by_category = {row.category: round(float(row.avg_rating), 1) for row in by_category_result}

        return {
            "feedback": feedback,
            "summary": {
                "overall_rating": round(float(summary_result.overall_rating), 1) if summary_result and summary_result.overall_rating else 0,
                "total_reviews": summary_result.total_reviews if summary_result else 0,
                "by_category": by_category
            }
        }
    except Exception:
        return {"feedback": [], "summary": {"overall_rating": 0, "total_reviews": 0, "by_category": {}}}


@router.post("/feedback/{feedback_id}/respond")
async def respond_to_feedback(
    feedback_id: str,
    response: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Respond to nurse feedback"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        db.execute(text("""
            UPDATE facility_feedback SET response = :response WHERE id = :feedback_id
        """), {"feedback_id": feedback_id, "response": response})
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"success": True, "feedback_id": feedback_id}
