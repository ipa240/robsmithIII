"""Learning & CEU Management API - Database Integrated"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser

router = APIRouter(prefix="/api/learning", tags=["learning"])


class CEUCreate(BaseModel):
    title: str
    provider: str
    hours: float
    category: str
    completion_date: str
    certificate_url: Optional[str] = None


class CEUUpdate(BaseModel):
    title: Optional[str] = None
    provider: Optional[str] = None
    hours: Optional[float] = None
    category: Optional[str] = None
    completion_date: Optional[str] = None
    certificate_url: Optional[str] = None


@router.get("/ceus")
async def list_ceus(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all CEU logs for the current user"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("""
            SELECT id, title, provider, hours, category, completion_date, certificate_url, created_at
            FROM user_ceus
            WHERE user_id = :user_id
            ORDER BY completion_date DESC NULLS LAST
        """),
        {"user_id": current_user.user_id}
    )

    ceus = []
    for row in result:
        ceu = dict(row._mapping)
        ceu["id"] = str(ceu["id"])
        ceu["hours"] = float(ceu["hours"]) if ceu["hours"] else 0
        ceu["completion_date"] = str(ceu["completion_date"]) if ceu["completion_date"] else None
        ceus.append(ceu)

    return ceus


@router.post("/ceus")
async def create_ceu(
    data: CEUCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Log a new CEU"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    ceu_id = str(uuid.uuid4())

    # Parse completion date
    completion_date = None
    if data.completion_date:
        try:
            completion_date = datetime.strptime(data.completion_date, "%Y-%m-%d").date()
        except ValueError:
            completion_date = None

    db.execute(
        text("""
            INSERT INTO user_ceus (id, user_id, title, provider, hours, category, completion_date, certificate_url)
            VALUES (:id, :user_id, :title, :provider, :hours, :category, :completion_date, :certificate_url)
        """),
        {
            "id": ceu_id,
            "user_id": current_user.user_id,
            "title": data.title,
            "provider": data.provider,
            "hours": data.hours,
            "category": data.category,
            "completion_date": completion_date,
            "certificate_url": data.certificate_url
        }
    )
    db.commit()

    return {
        "id": ceu_id,
        "title": data.title,
        "provider": data.provider,
        "hours": data.hours,
        "category": data.category,
        "completion_date": data.completion_date,
        "certificate_url": data.certificate_url
    }


@router.get("/ceus/stats/summary")
async def get_ceu_stats(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get CEU statistics for the current user"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get total hours and count
    result = db.execute(
        text("""
            SELECT
                COALESCE(SUM(hours), 0) as total_hours,
                COUNT(*) as courses_completed
            FROM user_ceus
            WHERE user_id = :user_id
        """),
        {"user_id": current_user.user_id}
    ).first()

    total_hours = float(result.total_hours) if result else 0
    courses_completed = int(result.courses_completed) if result else 0

    # Get hours by category
    by_category_result = db.execute(
        text("""
            SELECT category, COALESCE(SUM(hours), 0) as hours
            FROM user_ceus
            WHERE user_id = :user_id
            GROUP BY category
        """),
        {"user_id": current_user.user_id}
    )

    by_category = {}
    for row in by_category_result:
        by_category[row.category or "Other"] = float(row.hours)

    return {
        "total_hours": total_hours,
        "required_hours": 30,  # Virginia requirement
        "remaining_hours": max(0, 30 - total_hours),
        "by_category": by_category,
        "courses_completed": courses_completed
    }


@router.get("/ceus/{ceu_id}")
async def get_ceu(
    ceu_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a specific CEU log"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("""
            SELECT id, title, provider, hours, category, completion_date, certificate_url, created_at
            FROM user_ceus
            WHERE id = :id AND user_id = :user_id
        """),
        {"id": ceu_id, "user_id": current_user.user_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="CEU not found")

    ceu = dict(result._mapping)
    ceu["id"] = str(ceu["id"])
    ceu["hours"] = float(ceu["hours"]) if ceu["hours"] else 0
    ceu["completion_date"] = str(ceu["completion_date"]) if ceu["completion_date"] else None

    return ceu


@router.patch("/ceus/{ceu_id}")
async def update_ceu(
    ceu_id: str,
    data: CEUUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a CEU log"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if CEU exists and belongs to user
    existing = db.execute(
        text("SELECT id FROM user_ceus WHERE id = :id AND user_id = :user_id"),
        {"id": ceu_id, "user_id": current_user.user_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="CEU not found")

    # Build update query dynamically
    updates = []
    params = {"id": ceu_id, "user_id": current_user.user_id}

    update_data = data.model_dump(exclude_unset=True)

    if "title" in update_data:
        updates.append("title = :title")
        params["title"] = update_data["title"]
    if "provider" in update_data:
        updates.append("provider = :provider")
        params["provider"] = update_data["provider"]
    if "hours" in update_data:
        updates.append("hours = :hours")
        params["hours"] = update_data["hours"]
    if "category" in update_data:
        updates.append("category = :category")
        params["category"] = update_data["category"]
    if "completion_date" in update_data:
        updates.append("completion_date = :completion_date")
        try:
            params["completion_date"] = datetime.strptime(update_data["completion_date"], "%Y-%m-%d").date() if update_data["completion_date"] else None
        except ValueError:
            params["completion_date"] = None
    if "certificate_url" in update_data:
        updates.append("certificate_url = :certificate_url")
        params["certificate_url"] = update_data["certificate_url"]

    if updates:
        db.execute(
            text(f"UPDATE user_ceus SET {', '.join(updates)} WHERE id = :id AND user_id = :user_id"),
            params
        )
        db.commit()

    # Return updated CEU
    return await get_ceu(ceu_id, db, current_user)


@router.delete("/ceus/{ceu_id}")
async def delete_ceu(
    ceu_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a CEU log"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check if CEU exists and belongs to user
    existing = db.execute(
        text("SELECT id FROM user_ceus WHERE id = :id AND user_id = :user_id"),
        {"id": ceu_id, "user_id": current_user.user_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="CEU not found")

    db.execute(
        text("DELETE FROM user_ceus WHERE id = :id AND user_id = :user_id"),
        {"id": ceu_id, "user_id": current_user.user_id}
    )
    db.commit()

    return {"status": "deleted"}


@router.get("/resources")
async def list_resources(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List learning resources from database"""
    # Try to get from database first
    try:
        if category and category != "All":
            result = db.execute(
                text("""
                    SELECT id, title, description, url, category, provider, is_free, sort_order
                    FROM learning_resources
                    WHERE LOWER(category) = LOWER(:category)
                    ORDER BY sort_order, title
                """),
                {"category": category}
            )
        else:
            result = db.execute(
                text("""
                    SELECT id, title, description, url, category, provider, is_free, sort_order
                    FROM learning_resources
                    ORDER BY sort_order, title
                """)
            )

        resources = [dict(row._mapping) for row in result]

        if resources:
            for r in resources:
                r["id"] = str(r["id"])
            return resources
    except Exception:
        pass

    # Fallback to empty list (no more hardcoded data)
    return []


@router.get("/salary-data")
async def get_salary_data(db: Session = Depends(get_db)):
    """Get nursing salary data from jobs table"""
    try:
        # Calculate salary data from actual jobs
        result = db.execute(
            text("""
                SELECT
                    specialty,
                    ROUND(AVG(CASE
                        WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                        WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                        WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                        ELSE NULL
                    END)::numeric, 2) as avg_hourly,
                    ROUND(MIN(CASE
                        WHEN pay_type = 'hourly' THEN pay_min
                        WHEN pay_type = 'weekly' THEN pay_min / 40
                        WHEN pay_type = 'annual' THEN pay_min / 2080
                        ELSE NULL
                    END)::numeric, 2) as min_hourly,
                    ROUND(MAX(CASE
                        WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                        WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                        WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                        ELSE NULL
                    END)::numeric, 2) as max_hourly,
                    COUNT(*) as job_count
                FROM jobs
                WHERE is_active = true
                AND specialty IS NOT NULL
                AND specialty != ''
                AND pay_min IS NOT NULL
                GROUP BY specialty
                HAVING COUNT(*) >= 3
                ORDER BY avg_hourly DESC NULLS LAST
                LIMIT 10
            """)
        )

        salary_data = []
        for row in result:
            salary_data.append({
                "specialty": row.specialty,
                "avg_hourly": float(row.avg_hourly) if row.avg_hourly else 0,
                "min_hourly": float(row.min_hourly) if row.min_hourly else 0,
                "max_hourly": float(row.max_hourly) if row.max_hourly else 0,
                "job_count": row.job_count,
                "change_pct": 0  # Would need historical data to calculate
            })

        if salary_data:
            return salary_data
    except Exception:
        pass

    # Return empty list if no data (no more hardcoded fallback)
    return []
