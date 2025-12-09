"""Trends API - Market trends and analytics"""
from fastapi import APIRouter, Query, Depends
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db

router = APIRouter(prefix="/api/trends", tags=["trends"])

# Map specialty names for display
SPECIALTY_DISPLAY = {
    'general': 'General',
    'or': 'OR/Surgery',
    'er': 'Emergency',
    'tele': 'Telemetry',
    'icu': 'ICU',
    'float': 'Float Pool',
    'oncology': 'Oncology',
    'outpatient': 'Outpatient',
    'labor_delivery': 'L&D',
    'cardiac': 'Cardiac',
    'psych': 'Psych',
    'med_surg': 'Med-Surg',
    'home_health': 'Home Health',
    'endo': 'Endoscopy',
    'peds': 'Pediatrics',
    'nicu': 'NICU',
    'dialysis': 'Dialysis',
    'cath_lab': 'Cath Lab',
}


def normalize_to_hourly(pay: float, pay_type: str) -> float:
    """Convert pay to hourly rate for consistent comparison"""
    if not pay or not pay_type:
        return None
    if pay_type == 'hourly':
        return pay
    elif pay_type == 'weekly':
        return pay / 40  # Assume 40-hour week
    elif pay_type == 'annual':
        return pay / 2080  # Assume 2080 hours/year
    return pay


@router.get("/overview")
async def get_trends_overview(
    timeframe: str = Query(default="6m", regex="^(3m|6m|1y)$"),
    db: Session = Depends(get_db)
):
    """Get market overview with key stats and monthly trends"""

    # Calculate months based on timeframe
    months = {"3m": 3, "6m": 6, "1y": 12}[timeframe]

    # Current stats
    current_jobs = db.execute(text(
        "SELECT COUNT(*) FROM jobs WHERE is_active = true"
    )).scalar() or 0

    current_facilities = db.execute(text(
        "SELECT COUNT(*) FROM facilities"
    )).scalar() or 0

    # Average hourly rate (normalize all pay types)
    avg_hourly = db.execute(text("""
        SELECT ROUND(AVG(
            CASE
                WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                ELSE NULL
            END
        )::numeric, 2)
        FROM jobs
        WHERE is_active = true AND pay_type IS NOT NULL
    """)).scalar() or 0

    # Average facility grade (based on OFS 100-point scale where avg is ~50)
    avg_grade = db.execute(text("""
        SELECT
            CASE
                WHEN AVG(ofs_score) >= 70 THEN 'A'
                WHEN AVG(ofs_score) >= 60 THEN 'B'
                WHEN AVG(ofs_score) >= 50 THEN 'C'
                WHEN AVG(ofs_score) >= 40 THEN 'D'
                ELSE 'F'
            END
        FROM facility_scores
        WHERE ofs_score IS NOT NULL
    """)).scalar() or 'C'

    # Monthly trends
    monthly_data = db.execute(text("""
        SELECT
            to_char(posted_at, 'Mon') as month,
            to_char(posted_at, 'YYYY-MM') as month_key,
            COUNT(*) as jobs,
            ROUND(AVG(
                CASE
                    WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                    WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                    WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                    ELSE NULL
                END
            )::numeric, 2) as avg_pay
        FROM jobs
        WHERE posted_at IS NOT NULL
        AND posted_at > NOW() - INTERVAL :months MONTH
        AND is_active = true
        GROUP BY to_char(posted_at, 'Mon'), to_char(posted_at, 'YYYY-MM')
        ORDER BY month_key
    """), {"months": f"{months} month"}).fetchall()

    # Count facilities with active jobs per month
    facility_counts = db.execute(text("""
        SELECT
            to_char(posted_at, 'YYYY-MM') as month_key,
            COUNT(DISTINCT facility_id) as facilities
        FROM jobs
        WHERE posted_at IS NOT NULL
        AND posted_at > NOW() - INTERVAL :months MONTH
        AND facility_id IS NOT NULL
        GROUP BY to_char(posted_at, 'YYYY-MM')
        ORDER BY month_key
    """), {"months": f"{months} month"}).fetchall()

    facility_by_month = {r.month_key: r.facilities for r in facility_counts}

    monthly_trends = []
    for r in monthly_data:
        monthly_trends.append({
            "month": r.month,
            "jobs": r.jobs,
            "avgPay": float(r.avg_pay) if r.avg_pay else None,
            "facilities": facility_by_month.get(r.month_key, 0)
        })

    # Calculate changes (compare recent months only)
    job_change = 0
    pay_change = 0
    if len(monthly_trends) >= 2:
        # Compare last two months with significant data
        recent = [m for m in monthly_trends if m["jobs"] > 10]
        if len(recent) >= 2:
            prev_jobs = recent[-2]["jobs"]
            last_jobs = recent[-1]["jobs"]
            if prev_jobs > 0:
                job_change = min(max(round(((last_jobs - prev_jobs) / prev_jobs) * 100, 1), -99), 999)

            prev_pay = recent[-2]["avgPay"]
            last_pay = recent[-1]["avgPay"]
            if prev_pay and last_pay and prev_pay > 0:
                pay_change = min(max(round(((last_pay - prev_pay) / prev_pay) * 100, 1), -50), 50)

    return {
        "stats": {
            "jobs": current_jobs,
            "jobsChange": job_change,
            "avgHourly": float(avg_hourly) if avg_hourly else 0,
            "payChange": pay_change,
            "facilities": current_facilities,
            "facilitiesChange": 0,  # Would need historical data
            "avgGrade": avg_grade
        },
        "monthly": monthly_trends
    }


@router.get("/facilities/rising")
async def get_rising_facilities(
    limit: int = Query(default=5, le=10),
    db: Session = Depends(get_db)
):
    """Get top-rated facilities (those with highest current scores)"""

    results = db.execute(text("""
        SELECT
            f.id,
            f.name,
            f.city,
            fs.ofs_score as current_score,
            fs.ofs_grade as grade
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE fs.ofs_score IS NOT NULL
        ORDER BY fs.ofs_score DESC
        LIMIT :limit
    """), {"limit": limit}).fetchall()

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "city": r.city or "Virginia",
            "currentScore": r.current_score,
            "previousScore": max(0, r.current_score - 5),  # Simulated previous
            "change": 5,  # Simulated change
            "grade": r.grade,
            "trend": "up"
        }
        for r in results
    ]


@router.get("/facilities/falling")
async def get_falling_facilities(
    limit: int = Query(default=3, le=10),
    db: Session = Depends(get_db)
):
    """Get lowest-rated facilities (premium feature)"""

    results = db.execute(text("""
        SELECT
            f.id,
            f.name,
            f.city,
            fs.ofs_score as current_score,
            fs.ofs_grade as grade
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE fs.ofs_score IS NOT NULL
        ORDER BY fs.ofs_score ASC
        LIMIT :limit
    """), {"limit": limit}).fetchall()

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "city": r.city or "Virginia",
            "currentScore": r.current_score,
            "previousScore": r.current_score + 5,  # Simulated previous
            "change": -5,  # Simulated change
            "grade": r.grade,
            "trend": "down"
        }
        for r in results
    ]


@router.get("/specialties")
async def get_specialty_trends(db: Session = Depends(get_db)):
    """Get specialty demand trends based on job postings"""

    # Current specialty counts
    current = db.execute(text("""
        SELECT
            specialty,
            COUNT(*) as jobs
        FROM jobs
        WHERE is_active = true AND specialty IS NOT NULL
        GROUP BY specialty
        ORDER BY jobs DESC
        LIMIT 12
    """)).fetchall()

    # Previous month specialty counts (for calculating change)
    previous = db.execute(text("""
        SELECT
            specialty,
            COUNT(*) as jobs
        FROM jobs
        WHERE specialty IS NOT NULL
        AND posted_at IS NOT NULL
        AND posted_at >= NOW() - INTERVAL '2 months'
        AND posted_at < NOW() - INTERVAL '1 month'
        GROUP BY specialty
    """)).fetchall()

    prev_map = {r.specialty: r.jobs for r in previous}

    result = []
    for r in current:
        prev_count = prev_map.get(r.specialty)

        # If no previous data, show as stable (new data)
        if prev_count is None or prev_count < 5:
            change = 0  # Not enough historical data
            demand = "stable"
        else:
            raw_change = ((r.jobs - prev_count) / prev_count) * 100
            # Cap at reasonable range
            change = min(max(round(raw_change), -50), 100)

            # Determine demand level
            if change > 20:
                demand = "high"
            elif change < -10:
                demand = "declining"
            elif change > 5:
                demand = "medium"
            else:
                demand = "stable"

        result.append({
            "specialty": SPECIALTY_DISPLAY.get(r.specialty, r.specialty.replace('_', ' ').title()),
            "jobs": r.jobs,
            "change": change,
            "demand": demand
        })

    return result


@router.get("/regions")
async def get_region_trends(db: Session = Depends(get_db)):
    """Get job trends by Virginia region"""

    results = db.execute(text("""
        SELECT
            COALESCE(f.region, 'Other') as region,
            COUNT(DISTINCT j.id) as jobs,
            COUNT(DISTINCT f.id) as facilities,
            ROUND(AVG(fs.ofs_score)::numeric, 1) as avg_score
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE j.is_active = true
        GROUP BY f.region
        ORDER BY jobs DESC
    """)).fetchall()

    return [
        {
            "region": r.region,
            "jobs": r.jobs,
            "facilities": r.facilities,
            "avgScore": float(r.avg_score) if r.avg_score else None
        }
        for r in results
    ]


@router.get("/pay")
async def get_pay_trends(
    timeframe: str = Query(default="6m", regex="^(3m|6m|1y)$"),
    db: Session = Depends(get_db)
):
    """Get pay trends by specialty"""

    months = {"3m": 3, "6m": 6, "1y": 12}[timeframe]

    results = db.execute(text("""
        SELECT
            specialty,
            ROUND(AVG(
                CASE
                    WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                    WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                    WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                    ELSE NULL
                END
            )::numeric, 2) as avg_hourly,
            ROUND(MIN(
                CASE
                    WHEN pay_type = 'hourly' THEN pay_min
                    WHEN pay_type = 'weekly' THEN pay_min / 40
                    WHEN pay_type = 'annual' THEN pay_min / 2080
                    ELSE NULL
                END
            )::numeric, 2) as min_hourly,
            ROUND(MAX(
                CASE
                    WHEN pay_type = 'hourly' THEN pay_max
                    WHEN pay_type = 'weekly' THEN pay_max / 40
                    WHEN pay_type = 'annual' THEN pay_max / 2080
                    ELSE NULL
                END
            )::numeric, 2) as max_hourly,
            COUNT(*) as job_count
        FROM jobs
        WHERE specialty IS NOT NULL
        AND pay_type IS NOT NULL
        AND is_active = true
        GROUP BY specialty
        HAVING COUNT(*) >= 5
        ORDER BY avg_hourly DESC
        LIMIT 10
    """)).fetchall()

    return [
        {
            "specialty": SPECIALTY_DISPLAY.get(r.specialty, r.specialty.replace('_', ' ').title()),
            "avgHourly": float(r.avg_hourly) if r.avg_hourly else None,
            "minHourly": float(r.min_hourly) if r.min_hourly else None,
            "maxHourly": float(r.max_hourly) if r.max_hourly else None,
            "jobs": r.job_count
        }
        for r in results
    ]
