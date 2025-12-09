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
    """Get system-wide admin statistics from database"""
    # User stats
    user_stats = db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week,
            COUNT(*) FILTER (WHERE tier != 'free') as active_subscriptions,
            COUNT(*) FILTER (WHERE tier = 'free') as trial_users
        FROM users
    """)).first()

    # Facility stats
    facility_stats = db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE id IN (SELECT facility_id FROM facility_scores)) as with_scores,
            COALESCE(ROUND(AVG(ofs_score)::numeric, 1), 0) as average_ofs
        FROM facilities
        LEFT JOIN facility_scores fs ON facilities.id = fs.facility_id
    """)).first()

    # Job stats
    job_stats = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE is_active = true) as total_active,
            COUNT(*) FILTER (WHERE scraped_at >= CURRENT_DATE) as new_today,
            COUNT(*) FILTER (WHERE scraped_at >= CURRENT_DATE - INTERVAL '7 days') as scraped_this_week
        FROM jobs
    """)).first()

    # Sully stats (from sully_interactions if table exists)
    sully_stats = {"questions_today": 0, "questions_this_week": 0, "avg_response_time_ms": 0}
    try:
        sully_result = db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as questions_today,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as questions_this_week
            FROM sully_interactions
        """)).first()
        if sully_result:
            sully_stats = {
                "questions_today": sully_result.questions_today or 0,
                "questions_this_week": sully_result.questions_this_week or 0,
                "avg_response_time_ms": 0
            }
    except Exception:
        pass

    # Revenue stats (estimate based on tiers)
    revenue_stats = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE tier = 'starter') * 9.99 +
            COUNT(*) FILTER (WHERE tier = 'pro') * 19.99 +
            COUNT(*) FILTER (WHERE tier = 'premium') * 39.99 as mrr,
            COUNT(*) FILTER (WHERE tier != 'free' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as new_subs_this_month
        FROM users
    """)).first()

    mrr = float(revenue_stats.mrr or 0)

    return {
        "users": {
            "total": user_stats.total or 0,
            "new_today": user_stats.new_today or 0,
            "new_this_week": user_stats.new_this_week or 0,
            "active_subscriptions": user_stats.active_subscriptions or 0,
            "trial_users": user_stats.trial_users or 0
        },
        "facilities": {
            "total": facility_stats.total or 0,
            "with_scores": facility_stats.with_scores or 0,
            "average_ofs": float(facility_stats.average_ofs or 0)
        },
        "jobs": {
            "total_active": job_stats.total_active or 0,
            "new_today": job_stats.new_today or 0,
            "scraped_this_week": job_stats.scraped_this_week or 0
        },
        "sully": sully_stats,
        "revenue": {
            "mrr": round(mrr, 2),
            "arr": round(mrr * 12, 2),
            "new_subs_this_month": revenue_stats.new_subs_this_month or 0
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
    """List users with filtering from database"""
    # Build query with filters
    params = {"limit": limit, "offset": offset}

    where_clauses = []
    if search:
        where_clauses.append("(email ILIKE '%' || :search || '%' OR COALESCE(name, '') ILIKE '%' || :search || '%')")
        params["search"] = search
    if tier:
        where_clauses.append("tier = :tier")
        params["tier"] = tier

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    # Get users
    result = db.execute(text(f"""
        SELECT id, email, name, tier, is_admin, created_at, last_login_at
        FROM users
        {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)

    users = []
    for row in result:
        user = dict(row._mapping)
        user["id"] = str(user["id"])
        user["created_at"] = user["created_at"].isoformat() if user["created_at"] else None
        user["last_login"] = user["last_login_at"].isoformat() if user.get("last_login_at") else None
        user["sully_questions_today"] = 0  # Could add sully_interactions query if needed
        users.append(user)

    # Get total count
    count_result = db.execute(text(f"""
        SELECT COUNT(*) as total FROM users {where_sql}
    """), params).first()

    return {
        "users": users,
        "total": count_result.total if count_result else 0,
        "limit": limit,
        "offset": offset
    }


@router.patch("/users/{user_id}/tier")
async def update_user_tier(user_id: str, tier: str, db: Session = Depends(get_db)):
    """Update a user's subscription tier"""
    valid_tiers = ["free", "starter", "pro", "premium", "hr_admin"]
    if tier not in valid_tiers:
        raise HTTPException(status_code=400, detail="Invalid tier")

    # Update user tier in database
    result = db.execute(
        text("UPDATE users SET tier = :tier WHERE id = :user_id RETURNING id"),
        {"tier": tier, "user_id": user_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    db.commit()
    return {"success": True, "user_id": user_id, "new_tier": tier}


@router.post("/users/{user_id}/ban")
async def ban_user(user_id: str, reason: Optional[str] = None, db: Session = Depends(get_db)):
    """Ban a user by setting is_active to false"""
    result = db.execute(
        text("UPDATE users SET is_active = FALSE WHERE id = :user_id RETURNING id"),
        {"user_id": user_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    db.commit()
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
    """Get scraper status from database"""
    # Get latest scraper run
    result = db.execute(text("""
        SELECT id, started_at, completed_at, status, jobs_found
        FROM scraper_runs
        ORDER BY started_at DESC
        LIMIT 1
    """)).first()

    if result:
        return {
            "status": result.status or "idle",
            "last_run": result.completed_at.isoformat() if result.completed_at else result.started_at.isoformat(),
            "jobs_found": result.jobs_found or 0,
            "next_scheduled": None  # Could calculate based on cron schedule
        }

    return {
        "status": "no_runs",
        "last_run": None,
        "jobs_found": 0,
        "next_scheduled": None
    }


@router.get("/scraper/logs")
async def get_scraper_logs(limit: int = 100, db: Session = Depends(get_db)):
    """Get recent scraper runs from database"""
    result = db.execute(text("""
        SELECT id, started_at, completed_at, status, jobs_found, errors
        FROM scraper_runs
        ORDER BY started_at DESC
        LIMIT :limit
    """), {"limit": limit})

    logs = []
    for row in result:
        if row.started_at:
            logs.append({
                "timestamp": row.started_at.isoformat(),
                "level": "INFO",
                "message": f"Scraper started"
            })
        if row.completed_at:
            logs.append({
                "timestamp": row.completed_at.isoformat(),
                "level": "INFO" if row.status == "completed" else "ERROR",
                "message": f"Found {row.jobs_found} jobs" if row.status == "completed" else (row.errors or "Scraper failed")
            })

    return {"logs": logs if logs else []}


# Support Tickets
@router.get("/tickets")
async def list_support_tickets(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List support tickets from database"""
    params = {"limit": limit}
    where_sql = ""
    if status:
        where_sql = "WHERE status = :status"
        params["status"] = status

    result = db.execute(text(f"""
        SELECT id, user_id, user_email, subject, message, status, priority, created_at
        FROM support_tickets
        {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit
    """), params)

    tickets = []
    for row in result:
        ticket = dict(row._mapping)
        ticket["id"] = str(ticket["id"])
        ticket["user_id"] = str(ticket["user_id"]) if ticket.get("user_id") else None
        ticket["created_at"] = ticket["created_at"].isoformat() if ticket["created_at"] else None
        tickets.append(ticket)

    # Get total count
    count_result = db.execute(text(f"""
        SELECT COUNT(*) as total FROM support_tickets {where_sql}
    """), params).first()

    return {"tickets": tickets, "total": count_result.total if count_result else 0}


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    status: Optional[str] = None,
    response: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update a support ticket"""
    updates = ["updated_at = NOW()"]
    params = {"ticket_id": ticket_id}

    if status:
        updates.append("status = :status")
        params["status"] = status

    db.execute(
        text(f"UPDATE support_tickets SET {', '.join(updates)} WHERE id = :ticket_id"),
        params
    )

    # Add response as ticket message if provided
    if response:
        db.execute(text("""
            INSERT INTO ticket_messages (ticket_id, sender_type, message)
            VALUES (:ticket_id, 'support', :message)
        """), {"ticket_id": ticket_id, "message": response})

    db.commit()
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
