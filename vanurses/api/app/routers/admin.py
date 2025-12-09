"""Admin API - User, Facility, and System Management"""
from typing import Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])


# Models
class UserListRequest(BaseModel):
    search: Optional[str] = None
    tier: Optional[str] = None
    limit: int = 50
    offset: int = 0


class UpdateUserTierRequest(BaseModel):
    user_id: str
    tier: str


class SupportTicket(BaseModel):
    id: str
    user_email: str
    subject: str
    message: str
    status: str
    created_at: datetime


def get_admin_user(current_user: CurrentUser, db: Session) -> dict:
    """Get admin user from database, verify admin status"""
    if not current_user or not current_user.email:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": current_user.email}
    ).first()

    if not result:
        raise HTTPException(status_code=401, detail="User not found")

    user = dict(result._mapping)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    return user


# Dashboard Stats
@router.get("/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Get system-wide admin statistics"""
    # TODO: Get actual stats from database
    # For now return mock data

    return {
        "users": {
            "total": 1247,
            "new_today": 15,
            "new_this_week": 89,
            "active_subscriptions": 342,
            "trial_users": 156
        },
        "facilities": {
            "total": 186,
            "with_scores": 178,
            "average_ofs": 72.4
        },
        "jobs": {
            "total_active": 3421,
            "new_today": 87,
            "scraped_this_week": 1245
        },
        "sully": {
            "questions_today": 423,
            "questions_this_week": 2891,
            "avg_response_time_ms": 2340
        },
        "revenue": {
            "mrr": 6780,
            "arr": 81360,
            "new_subs_this_month": 28
        }
    }


# User Management
@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List users with filtering"""
    # TODO: Get actual users from database
    mock_users = [
        {
            "id": "user-1",
            "email": "nurse.jane@example.com",
            "name": "Jane Smith",
            "tier": "pro",
            "created_at": "2025-11-15T10:30:00Z",
            "last_login": "2025-12-06T14:22:00Z",
            "sully_questions_today": 3
        },
        {
            "id": "user-2",
            "email": "john.doe@example.com",
            "name": "John Doe",
            "tier": "starter",
            "created_at": "2025-10-20T08:15:00Z",
            "last_login": "2025-12-06T09:45:00Z",
            "sully_questions_today": 1
        }
    ]

    return {
        "users": mock_users,
        "total": len(mock_users),
        "limit": limit,
        "offset": offset
    }


@router.patch("/users/{user_id}/tier")
async def update_user_tier(user_id: str, tier: str, db: Session = Depends(get_db)):
    """Update a user's subscription tier"""
    valid_tiers = ["free", "starter", "pro", "premium", "hr_admin"]
    if tier not in valid_tiers:
        raise HTTPException(status_code=400, detail="Invalid tier")

    # TODO: Update actual user in database
    return {"success": True, "user_id": user_id, "new_tier": tier}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, reason: Optional[str] = None, db: Session = Depends(get_db)):
    """Ban a user"""
    # TODO: Implement actual ban logic
    return {"success": True, "user_id": user_id, "banned": True}


# Facility Management
@router.get("/facilities")
async def list_admin_facilities(
    search: Optional[str] = None,
    has_issues: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List facilities for admin management"""
    # Get real facilities from database
    try:
        result = db.execute(text("""
            SELECT f.id, f.name, f.city, fs.ofs_score, fs.ofs_grade,
                   (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as active_jobs
            FROM facilities f
            LEFT JOIN facility_scores fs ON f.id = fs.facility_id
            ORDER BY f.name
            LIMIT :limit OFFSET :offset
        """), {"limit": limit, "offset": offset}).fetchall()

        facilities = []
        for row in result:
            facilities.append({
                "id": str(row[0]),
                "name": row[1],
                "city": row[2],
                "ofs_score": row[3],
                "ofs_grade": row[4],
                "active_jobs": row[5]
            })

        return {"facilities": facilities, "total": len(facilities)}
    except Exception as e:
        return {"facilities": [], "total": 0, "error": str(e)}


@router.patch("/facilities/{facility_id}")
async def update_facility(
    facility_id: str,
    notes: Optional[str] = None,
    hidden: bool = False,
    db: Session = Depends(get_db)
):
    """Update facility admin settings"""
    # TODO: Implement actual update
    return {"success": True, "facility_id": facility_id}


# ============================================================
# Community Category Management
# ============================================================

@router.get("/community/categories")
async def admin_list_categories(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all community categories (including pending) for admin"""
    admin_user = get_admin_user(current_user, db)

    result = db.execute(
        text("""
            SELECT
                cc.id, cc.name, cc.slug, cc.description, cc.icon,
                cc.is_approved, cc.is_active, cc.sort_order,
                cc.created_at, cc.approved_at,
                u_created.email as created_by_email,
                u_approved.email as approved_by_email
            FROM community_categories cc
            LEFT JOIN users u_created ON cc.created_by = u_created.id
            LEFT JOIN users u_approved ON cc.approved_by = u_approved.id
            ORDER BY cc.is_approved ASC, cc.created_at DESC
        """)
    )
    categories = [dict(row._mapping) for row in result]

    # Count pending
    pending_count = sum(1 for c in categories if not c.get("is_approved"))

    return {
        "categories": categories,
        "total": len(categories),
        "pending_count": pending_count
    }


@router.post("/community/categories/{category_id}/approve")
async def approve_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Approve a pending category"""
    admin_user = get_admin_user(current_user, db)

    # Check category exists and is pending
    existing = db.execute(
        text("SELECT id, name, is_approved FROM community_categories WHERE id = :id"),
        {"id": category_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    if existing.is_approved:
        raise HTTPException(status_code=400, detail="Category is already approved")

    # Approve the category
    db.execute(
        text("""
            UPDATE community_categories
            SET is_approved = TRUE, approved_by = :approved_by, approved_at = NOW()
            WHERE id = :id
        """),
        {"id": category_id, "approved_by": admin_user["id"]}
    )
    db.commit()

    return {
        "success": True,
        "message": f"Category '{existing.name}' approved",
        "category_id": category_id
    }


@router.delete("/community/categories/{category_id}")
async def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete/reject a category"""
    admin_user = get_admin_user(current_user, db)

    # Check category exists
    existing = db.execute(
        text("SELECT id, name FROM community_categories WHERE id = :id"),
        {"id": category_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check if category has posts
    post_count = db.execute(
        text("SELECT COUNT(*) FROM community_posts WHERE category_id = :id"),
        {"id": category_id}
    ).scalar()

    if post_count > 0:
        # Soft delete - set is_active to FALSE
        db.execute(
            text("UPDATE community_categories SET is_active = FALSE WHERE id = :id"),
            {"id": category_id}
        )
        db.commit()
        return {
            "success": True,
            "message": f"Category '{existing.name}' deactivated (has {post_count} posts)",
            "soft_deleted": True
        }
    else:
        # Hard delete - no posts
        db.execute(
            text("DELETE FROM community_categories WHERE id = :id"),
            {"id": category_id}
        )
        db.commit()
        return {
            "success": True,
            "message": f"Category '{existing.name}' deleted",
            "soft_deleted": False
        }


@router.patch("/community/categories/{category_id}")
async def update_category(
    category_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a category's details"""
    admin_user = get_admin_user(current_user, db)

    # Check category exists
    existing = db.execute(
        text("SELECT id FROM community_categories WHERE id = :id"),
        {"id": category_id}
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")

    updates = []
    params = {"id": category_id}

    if name is not None:
        updates.append("name = :name")
        params["name"] = name
    if description is not None:
        updates.append("description = :description")
        params["description"] = description
    if icon is not None:
        updates.append("icon = :icon")
        params["icon"] = icon
    if sort_order is not None:
        updates.append("sort_order = :sort_order")
        params["sort_order"] = sort_order
    if is_active is not None:
        updates.append("is_active = :is_active")
        params["is_active"] = is_active

    if updates:
        db.execute(
            text(f"UPDATE community_categories SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        db.commit()

    return {"success": True, "message": "Category updated"}


# ============================================================
# Scraper Controls
# ============================================================

@router.post("/scraper/trigger")
async def trigger_scraper(db: Session = Depends(get_db)):
    """Manually trigger the job scraper"""
    # TODO: Implement actual scraper trigger
    return {"success": True, "message": "Scraper job queued"}


@router.get("/scraper/status")
async def get_scraper_status(db: Session = Depends(get_db)):
    """Get scraper status"""
    return {
        "status": "idle",
        "last_run": "2025-12-06T03:00:00Z",
        "jobs_found": 87,
        "next_scheduled": "2025-12-07T03:00:00Z"
    }


@router.get("/scraper/logs")
async def get_scraper_logs(limit: int = 100, db: Session = Depends(get_db)):
    """Get recent scraper logs"""
    # TODO: Get actual logs
    return {
        "logs": [
            {"timestamp": "2025-12-06T03:00:00Z", "level": "INFO", "message": "Scraper started"},
            {"timestamp": "2025-12-06T03:05:23Z", "level": "INFO", "message": "Found 87 new jobs"},
            {"timestamp": "2025-12-06T03:05:25Z", "level": "INFO", "message": "Scraper completed"}
        ]
    }


# Support Tickets
@router.get("/tickets")
async def list_support_tickets(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List support tickets"""
    # TODO: Get actual tickets from database
    mock_tickets = [
        {
            "id": "ticket-1",
            "user_email": "user@example.com",
            "subject": "Cannot access facility scores",
            "message": "When I try to view facility details, the scores don't load.",
            "status": "open",
            "created_at": "2025-12-06T10:30:00Z"
        }
    ]

    return {"tickets": mock_tickets, "total": len(mock_tickets)}


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    status: Optional[str] = None,
    response: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update a support ticket"""
    return {"success": True, "ticket_id": ticket_id}


# JTI Recalculation
@router.post("/jti/recalculate")
async def recalculate_jti(db: Session = Depends(get_db)):
    """Recalculate JTI (Job Transparency Index) for all facilities.

    This calculates transparency scores based on:
    - Pay disclosure (40%)
    - Benefits disclosure (25%)
    - Sign-on bonus disclosure (15%)
    - Shift clarity (20%)
    """
    from ..services.jti_calculator import recalculate_all_jti
    from databases import Database

    # Get database URL from session
    db_url = str(db.get_bind().url)

    # Create async database connection
    async_db = Database(db_url.replace("postgresql://", "postgresql+asyncpg://"))
    await async_db.connect()

    try:
        result = await recalculate_all_jti(async_db)
        return {
            "success": True,
            "message": f"JTI recalculated for {result['updated']} facilities",
            **result
        }
    finally:
        await async_db.disconnect()


@router.post("/jti/recalculate/{facility_id}")
async def recalculate_facility_jti(facility_id: str, db: Session = Depends(get_db)):
    """Recalculate JTI for a single facility."""
    from ..services.jti_calculator import update_facility_jti, calculate_facility_jti
    from databases import Database

    # Get database URL from session
    db_url = str(db.get_bind().url)

    # Create async database connection
    async_db = Database(db_url.replace("postgresql://", "postgresql+asyncpg://"))
    await async_db.connect()

    try:
        # First calculate to get the data
        jti_data = await calculate_facility_jti(async_db, facility_id)

        if not jti_data:
            return {
                "success": False,
                "message": "No active jobs found for this facility"
            }

        # Then update
        await update_facility_jti(async_db, facility_id)

        return {
            "success": True,
            "facility_id": facility_id,
            "jti": jti_data
        }
    finally:
        await async_db.disconnect()
