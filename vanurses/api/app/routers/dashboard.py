"""Dashboard API endpoints for personalized insights"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser
from .users import get_or_create_user
from datetime import date, datetime

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/market-score")
async def get_market_score(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Calculate personalized Market Advantage Score (0-100)

    Based on:
    - License type demand (40%)
    - Specialty demand (40%)
    - Experience level match (20%)
    """
    user = get_or_create_user(db, current_user)

    # Check if onboarding completed
    if not user.get("onboarding_completed"):
        return {
            "score": None,
            "message": "Complete onboarding to see your Market Advantage Score",
            "factors": {}
        }

    license_type = user.get("license_type")
    specialties = user.get("specialties") or []
    years_exp = user.get("years_experience") or 0

    # Calculate license demand score
    license_score = 0
    if license_type:
        result = db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE nursing_type = :license) as type_jobs,
                COUNT(*) as total_jobs
            FROM jobs WHERE is_active = true
        """), {"license": license_type}).first()

        if result and result.total_jobs > 0:
            license_score = min(100, (result.type_jobs / result.total_jobs) * 200)

    # Calculate specialty demand score
    specialty_score = 0
    if specialties:
        result = db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE specialty = ANY(:specs)) as spec_jobs,
                COUNT(*) as total_jobs
            FROM jobs WHERE is_active = true
        """), {"specs": specialties}).first()

        if result and result.total_jobs > 0:
            specialty_score = min(100, (result.spec_jobs / result.total_jobs) * 300)

    # Calculate experience score (most jobs are 0-2 years, experienced is valuable)
    experience_score = 0
    if years_exp is not None:
        result = db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE years_experience_min IS NULL OR years_experience_min <= :years) as matching_jobs,
                COUNT(*) as total_jobs
            FROM jobs WHERE is_active = true
        """), {"years": years_exp}).first()

        if result and result.total_jobs > 0:
            experience_score = (result.matching_jobs / result.total_jobs) * 100

    # Weighted average
    final_score = int(
        license_score * 0.4 +
        specialty_score * 0.4 +
        experience_score * 0.2
    )
    final_score = min(100, max(0, final_score))

    # Determine grade and suggestions
    if final_score >= 80:
        grade = "Excellent"
        suggestions = ["Your profile is highly competitive in the current market!"]
    elif final_score >= 60:
        grade = "Good"
        suggestions = ["Consider adding more certifications to boost your score"]
    elif final_score >= 40:
        grade = "Fair"
        suggestions = [
            "Add more specialties to your profile",
            "Consider obtaining additional certifications"
        ]
    else:
        grade = "Building"
        suggestions = [
            "Complete your profile to improve matching",
            "Add your license type and specialties"
        ]

    return {
        "score": final_score,
        "grade": grade,
        "factors": {
            "license_demand": round(license_score, 1),
            "specialty_demand": round(specialty_score, 1),
            "experience_match": round(experience_score, 1)
        },
        "suggestions": suggestions
    }


@router.get("/quick-insights")
async def get_quick_insights(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get 4 quick insight cards:
    - Pay spikes (facilities paying above average)
    - Sign-on bonuses available
    - Hot specialties
    - Job matches for user
    """
    user = get_or_create_user(db, current_user)

    specialties = user.get("specialties") or []
    license_type = user.get("license_type")
    prefs = user.get("preferences") or {}
    location_zip = prefs.get("location_zip")

    # 1. Pay spikes - facilities with pay > avg * 1.15
    pay_spikes = db.execute(text("""
        WITH avg_pay AS (
            SELECT AVG(pay_max) as avg_max FROM jobs WHERE is_active = true AND pay_max > 0
        )
        SELECT f.name, f.city, COUNT(*) as high_pay_jobs
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        CROSS JOIN avg_pay ap
        WHERE j.is_active = true
        AND j.pay_max > ap.avg_max * 1.15
        GROUP BY f.id, f.name, f.city
        ORDER BY high_pay_jobs DESC
        LIMIT 3
    """)).fetchall()

    # 2. Sign-on bonuses
    bonus_jobs = db.execute(text("""
        SELECT COUNT(*) as count,
               AVG(sign_on_bonus) as avg_bonus
        FROM jobs
        WHERE is_active = true
        AND sign_on_bonus > 0
    """)).first()

    # 3. Hot specialties (top 3 by job count growth)
    hot_specialties = db.execute(text("""
        SELECT specialty, COUNT(*) as job_count
        FROM jobs
        WHERE is_active = true AND specialty IS NOT NULL
        GROUP BY specialty
        ORDER BY job_count DESC
        LIMIT 3
    """)).fetchall()

    # 4. Job matches for user
    job_matches = 0
    if specialties or license_type:
        conditions = ["is_active = true"]
        params = {}

        if specialties:
            conditions.append("specialty = ANY(:specs)")
            params["specs"] = specialties
        if license_type:
            conditions.append("nursing_type = :license")
            params["license"] = license_type

        result = db.execute(text(f"""
            SELECT COUNT(*) FROM jobs WHERE {" AND ".join(conditions)}
        """), params).scalar()
        job_matches = result or 0

    return {
        "paySpikes": {
            "facilities": [
                {"name": r.name, "city": r.city, "jobs": r.high_pay_jobs}
                for r in pay_spikes
            ],
            "description": "Facilities paying 15%+ above average"
        },
        "signOnBonuses": {
            "count": bonus_jobs.count or 0 if bonus_jobs else 0,
            "avgBonus": round(bonus_jobs.avg_bonus or 0) if bonus_jobs else 0,
            "description": "Jobs with sign-on bonuses"
        },
        "hotSpecialties": {
            "specialties": [
                {"name": r.specialty, "jobs": r.job_count}
                for r in hot_specialties
            ],
            "description": "Most in-demand specialties"
        },
        "jobMatches": {
            "count": job_matches,
            "description": "Jobs matching your profile" if (specialties or license_type) else "Complete profile to see matches"
        }
    }


@router.get("/pay-percentile")
async def get_pay_percentile(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get pay percentile data for user's specialty

    Returns min, 25th, median, 75th, max pay rates
    """
    user = get_or_create_user(db, current_user)

    if not user.get("onboarding_completed"):
        return {
            "data": None,
            "message": "Complete onboarding to see pay comparisons"
        }

    specialties = user.get("specialties") or []
    license_type = user.get("license_type")

    # Get pay percentiles for user's specialties
    if specialties:
        result = db.execute(text("""
            SELECT
                MIN(pay_max) as min_pay,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY pay_max) as p25,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY pay_max) as median,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY pay_max) as p75,
                MAX(pay_max) as max_pay,
                COUNT(*) as sample_size
            FROM jobs
            WHERE is_active = true
            AND specialty = ANY(:specs)
            AND pay_max > 0
        """), {"specs": specialties}).first()
    elif license_type:
        result = db.execute(text("""
            SELECT
                MIN(pay_max) as min_pay,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY pay_max) as p25,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY pay_max) as median,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY pay_max) as p75,
                MAX(pay_max) as max_pay,
                COUNT(*) as sample_size
            FROM jobs
            WHERE is_active = true
            AND nursing_type = :license
            AND pay_max > 0
        """), {"license": license_type}).first()
    else:
        # All jobs
        result = db.execute(text("""
            SELECT
                MIN(pay_max) as min_pay,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY pay_max) as p25,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY pay_max) as median,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY pay_max) as p75,
                MAX(pay_max) as max_pay,
                COUNT(*) as sample_size
            FROM jobs
            WHERE is_active = true
            AND pay_max > 0
        """)).first()

    if not result or result.sample_size < 5:
        return {
            "data": None,
            "message": "Not enough data for pay comparison"
        }

    return {
        "data": {
            "min": round(float(result.min_pay or 0), 2),
            "p25": round(float(result.p25 or 0), 2),
            "median": round(float(result.median or 0), 2),
            "p75": round(float(result.p75 or 0), 2),
            "max": round(float(result.max_pay or 0), 2),
            "sampleSize": result.sample_size
        },
        "specialty": ", ".join(specialties) if specialties else license_type,
        "message": None
    }


@router.get("/recommendations")
async def get_recommendations(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get personalized job recommendations:
    - Best Pay (highest paying matching jobs)
    - Best Facility (top rated facilities with matching jobs)
    - New This Week (recent postings matching profile)
    """
    user = get_or_create_user(db, current_user)

    specialties = user.get("specialties") or []
    license_type = user.get("license_type")

    # Build base conditions
    conditions = ["j.is_active = true"]
    params = {}

    if specialties:
        conditions.append("j.specialty = ANY(:specs)")
        params["specs"] = specialties
    if license_type:
        conditions.append("j.nursing_type = :license")
        params["license"] = license_type

    where_clause = " AND ".join(conditions) if len(conditions) > 1 else conditions[0]

    # Best Pay - highest paying jobs
    best_pay = db.execute(text(f"""
        SELECT j.id, j.title, j.specialty, j.pay_min, j.pay_max, j.city, j.state,
               f.name as facility_name, fs.ofs_grade
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_clause} AND j.pay_max > 0
        ORDER BY j.pay_max DESC
        LIMIT 3
    """), params).fetchall()

    # Best Facility - jobs at top-rated facilities
    best_facility = db.execute(text(f"""
        SELECT j.id, j.title, j.specialty, j.pay_min, j.pay_max, j.city, j.state,
               f.name as facility_name, fs.ofs_grade, fs.ofs_score
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_clause}
        ORDER BY fs.ofs_score DESC NULLS LAST
        LIMIT 3
    """), params).fetchall()

    # New This Week
    new_this_week = db.execute(text(f"""
        SELECT j.id, j.title, j.specialty, j.pay_min, j.pay_max, j.city, j.state,
               f.name as facility_name, fs.ofs_grade, j.posted_at
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_clause} AND j.posted_at >= NOW() - INTERVAL '7 days'
        ORDER BY j.posted_at DESC
        LIMIT 3
    """), params).fetchall()

    def job_to_dict(row):
        return {
            "id": str(row.id),
            "title": row.title,
            "specialty": row.specialty,
            "payMin": float(row.pay_min) if row.pay_min else None,
            "payMax": float(row.pay_max) if row.pay_max else None,
            "city": row.city,
            "state": row.state,
            "facilityName": row.facility_name,
            "ofsGrade": row.ofs_grade
        }

    return {
        "bestPay": {
            "title": "Best Pay",
            "icon": "dollar",
            "jobs": [job_to_dict(r) for r in best_pay]
        },
        "bestFacility": {
            "title": "Top Rated Facilities",
            "icon": "star",
            "jobs": [job_to_dict(r) for r in best_facility]
        },
        "newThisWeek": {
            "title": "New This Week",
            "icon": "clock",
            "jobs": [job_to_dict(r) for r in new_this_week]
        }
    }


@router.get("/streak")
async def get_user_streak(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get user's login streak and achievements"""
    user = get_or_create_user(db, current_user)

    # Get streak from preferences (we'll store it there)
    prefs = user.get("preferences") or {}
    streak_data = prefs.get("streak", {})

    current_streak = streak_data.get("current", 0)
    longest_streak = streak_data.get("longest", 0)
    last_login = streak_data.get("last_login")

    # Check and update streak
    today = date.today().isoformat()

    if last_login:
        last_date = date.fromisoformat(last_login)
        days_diff = (date.today() - last_date).days

        if days_diff == 0:
            # Already logged in today, no change
            pass
        elif days_diff == 1:
            # Consecutive day, increment streak
            current_streak += 1
            if current_streak > longest_streak:
                longest_streak = current_streak
        else:
            # Streak broken, reset
            current_streak = 1
    else:
        # First login
        current_streak = 1

    # Update streak in database
    import json
    prefs["streak"] = {
        "current": current_streak,
        "longest": longest_streak,
        "last_login": today
    }

    db.execute(text("""
        UPDATE users SET preferences = CAST(:prefs AS jsonb), updated_at = NOW()
        WHERE id = :user_id
    """), {"user_id": user["id"], "prefs": json.dumps(prefs)})
    db.commit()

    # Determine badges based on streak
    badges = []
    if current_streak >= 1:
        badges.append({"id": "first_login", "name": "First Steps", "icon": "footprints"})
    if current_streak >= 3:
        badges.append({"id": "streak_3", "name": "Getting Started", "icon": "fire"})
    if current_streak >= 7:
        badges.append({"id": "streak_7", "name": "Week Warrior", "icon": "trophy"})
    if current_streak >= 30:
        badges.append({"id": "streak_30", "name": "Dedicated Seeker", "icon": "crown"})

    # Check for other achievements
    if user.get("onboarding_completed"):
        badges.append({"id": "onboarding", "name": "Profile Complete", "icon": "check-circle"})

    # Check saved jobs count
    saved_count = db.execute(text("""
        SELECT COUNT(*) FROM saved_jobs WHERE user_id = :user_id
    """), {"user_id": user["id"]}).scalar()

    if saved_count >= 1:
        badges.append({"id": "first_save", "name": "Job Saver", "icon": "bookmark"})
    if saved_count >= 10:
        badges.append({"id": "save_10", "name": "Collector", "icon": "folder"})

    return {
        "currentStreak": current_streak,
        "longestStreak": longest_streak,
        "lastLogin": today,
        "badges": badges,
        "nextMilestone": get_next_milestone(current_streak)
    }


def get_next_milestone(current: int) -> dict:
    """Get the next streak milestone"""
    milestones = [
        (3, "3 Day Streak", "fire"),
        (7, "Week Warrior", "trophy"),
        (14, "Two Week Champion", "medal"),
        (30, "Monthly Master", "crown"),
        (60, "Persistence Pro", "diamond"),
        (90, "Quarter Legend", "star")
    ]

    for days, name, icon in milestones:
        if current < days:
            return {
                "days": days,
                "name": name,
                "icon": icon,
                "daysRemaining": days - current
            }

    return {
        "days": 90,
        "name": "Max Level Achieved!",
        "icon": "star",
        "daysRemaining": 0
    }
