"""Trends API - Market trends and analytics"""
from fastapi import APIRouter, Query, Depends
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..services.bls_data import get_all_market_rates

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

    # Average hourly rate by nursing type (from disclosed job pay)
    avg_hourly_by_type_results = db.execute(text("""
        SELECT
            nursing_type,
            ROUND(AVG(
                CASE
                    WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                    WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                    WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                    ELSE NULL
                END
            )::numeric, 2) as avg_hourly,
            COUNT(*) as job_count
        FROM jobs
        WHERE is_active = true AND pay_type IS NOT NULL AND nursing_type IS NOT NULL
        GROUP BY nursing_type
        ORDER BY avg_hourly DESC
    """)).fetchall()

    # Start with disclosed pay data
    avg_hourly_by_type = {
        r.nursing_type: {"avgHourly": float(r.avg_hourly) if r.avg_hourly else 0, "jobCount": r.job_count, "source": "disclosed"}
        for r in avg_hourly_by_type_results
    }

    # Fill in with market rates for all standard nursing types
    market_rates = get_all_market_rates(db)
    all_nursing_types = ['rn', 'lpn', 'cna', 'np', 'crna', 'travel']
    for nt in all_nursing_types:
        if nt not in avg_hourly_by_type or avg_hourly_by_type[nt]["jobCount"] < 5:
            # Use market rate if no disclosed pay or insufficient data
            if nt in market_rates:
                rate = market_rates[nt]
                avg_hourly_by_type[nt] = {
                    "avgHourly": rate["median"],
                    "minHourly": rate["min"],
                    "maxHourly": rate["max"],
                    "jobCount": 0,
                    "source": "market"
                }

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
            "avgHourlyByType": avg_hourly_by_type,
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


@router.get("/regions/timeline")
async def get_regional_trends_timeline(
    timeframe: str = Query(default="6m", regex="^(3m|6m|1y)$"),
    db: Session = Depends(get_db)
):
    """Get job volume over time by region"""
    months = {"3m": 3, "6m": 6, "1y": 12}[timeframe]

    results = db.execute(text("""
        SELECT
            COALESCE(f.region, 'Other') as region,
            to_char(j.posted_at, 'Mon') as month,
            to_char(j.posted_at, 'YYYY-MM') as month_key,
            COUNT(*) as jobs
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        WHERE j.posted_at IS NOT NULL
        AND j.posted_at > NOW() - INTERVAL :months MONTH
        AND j.is_active = true
        GROUP BY f.region, to_char(j.posted_at, 'Mon'), to_char(j.posted_at, 'YYYY-MM')
        ORDER BY month_key, region
    """), {"months": f"{months} month"}).fetchall()

    # Organize by region
    regions = {}
    for r in results:
        if r.region not in regions:
            regions[r.region] = []
        regions[r.region].append({
            "month": r.month,
            "monthKey": r.month_key,
            "jobs": r.jobs
        })

    return regions


@router.get("/nursing-types")
async def get_nursing_type_trends(db: Session = Depends(get_db)):
    """Get demand trends by nursing type (RN, LPN, CNA, etc.)"""

    results = db.execute(text("""
        SELECT
            nursing_type,
            COUNT(*) as jobs,
            ROUND(AVG(
                CASE
                    WHEN pay_type = 'hourly' THEN COALESCE(pay_max, pay_min)
                    WHEN pay_type = 'weekly' THEN COALESCE(pay_max, pay_min) / 40
                    WHEN pay_type = 'annual' THEN COALESCE(pay_max, pay_min) / 2080
                    ELSE NULL
                END
            )::numeric, 2) as avg_hourly
        FROM jobs
        WHERE is_active = true AND nursing_type IS NOT NULL
        GROUP BY nursing_type
        ORDER BY jobs DESC
    """)).fetchall()

    return [
        {
            "type": r.nursing_type.upper() if r.nursing_type else "Other",
            "jobs": r.jobs,
            "avgHourly": float(r.avg_hourly) if r.avg_hourly else None
        }
        for r in results
    ]


@router.get("/facilities/top-hiring")
async def get_top_hiring_facilities(
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db)
):
    """Get facilities with most active job postings"""

    results = db.execute(text("""
        SELECT
            f.id,
            f.name,
            f.city,
            f.region,
            COUNT(j.id) as active_jobs,
            fs.ofs_grade as grade,
            fs.ofs_score as score
        FROM facilities f
        JOIN jobs j ON f.id = j.facility_id AND j.is_active = true
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        GROUP BY f.id, f.name, f.city, f.region, fs.ofs_grade, fs.ofs_score
        ORDER BY active_jobs DESC
        LIMIT :limit
    """), {"limit": limit}).fetchall()

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "city": r.city or "Virginia",
            "region": r.region,
            "activeJobs": r.active_jobs,
            "grade": r.grade,
            "score": r.score
        }
        for r in results
    ]


@router.get("/daily-postings")
async def get_daily_postings(
    days: int = Query(default=30, le=90),
    db: Session = Depends(get_db)
):
    """Get new job postings by day"""

    results = db.execute(text("""
        SELECT
            DATE(posted_at) as post_date,
            to_char(posted_at, 'Dy') as day_name,
            COUNT(*) as jobs
        FROM jobs
        WHERE posted_at IS NOT NULL
        AND posted_at > NOW() - INTERVAL :days DAY
        GROUP BY DATE(posted_at), to_char(posted_at, 'Dy')
        ORDER BY post_date
    """), {"days": f"{days} day"}).fetchall()

    return [
        {
            "date": r.post_date.isoformat(),
            "dayName": r.day_name,
            "jobs": r.jobs
        }
        for r in results
    ]


@router.get("/job-types")
async def get_job_type_distribution(db: Session = Depends(get_db)):
    """Get distribution by employment type (full-time, part-time, PRN, travel)"""

    results = db.execute(text("""
        SELECT
            COALESCE(employment_type, 'Not Specified') as employment_type,
            COUNT(*) as jobs,
            ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
        FROM jobs
        WHERE is_active = true
        GROUP BY employment_type
        ORDER BY jobs DESC
    """)).fetchall()

    return [
        {
            "type": r.employment_type.replace('_', ' ').title() if r.employment_type else "Not Specified",
            "jobs": r.jobs,
            "percentage": float(r.percentage) if r.percentage else 0
        }
        for r in results
    ]


@router.get("/benefits")
async def get_benefits_trends(db: Session = Depends(get_db)):
    """Get most commonly offered benefits"""

    results = db.execute(text("""
        SELECT
            benefit,
            COUNT(*) as job_count,
            ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_active = true AND benefits IS NOT NULL), 0), 1) as percentage
        FROM jobs, unnest(benefits) as benefit
        WHERE is_active = true AND benefits IS NOT NULL
        GROUP BY benefit
        ORDER BY job_count DESC
        LIMIT 15
    """)).fetchall()

    return [
        {
            "benefit": r.benefit.replace('_', ' ').title() if r.benefit else "Other",
            "jobs": r.job_count,
            "percentage": float(r.percentage) if r.percentage else 0
        }
        for r in results
    ]


@router.get("/shifts")
async def get_shift_availability(db: Session = Depends(get_db)):
    """Get breakdown by shift type"""

    results = db.execute(text("""
        SELECT
            COALESCE(shift_type, 'Not Specified') as shift_type,
            COUNT(*) as jobs,
            ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
        FROM jobs
        WHERE is_active = true
        GROUP BY shift_type
        ORDER BY jobs DESC
    """)).fetchall()

    return [
        {
            "shift": r.shift_type.replace('_', ' ').title() if r.shift_type else "Not Specified",
            "jobs": r.jobs,
            "percentage": float(r.percentage) if r.percentage else 0
        }
        for r in results
    ]


@router.get("/experience")
async def get_experience_requirements(db: Session = Depends(get_db)):
    """Get experience requirements analysis"""

    results = db.execute(text("""
        SELECT
            experience_level,
            jobs,
            ROUND(100.0 * jobs / SUM(jobs) OVER(), 1) as percentage,
            sort_order
        FROM (
            SELECT
                CASE
                    WHEN years_experience_min IS NULL OR years_experience_min = 0 THEN 'Entry Level (0 years)'
                    WHEN years_experience_min = 1 THEN '1 Year'
                    WHEN years_experience_min = 2 THEN '2 Years'
                    WHEN years_experience_min BETWEEN 3 AND 4 THEN '3-4 Years'
                    ELSE '5+ Years'
                END as experience_level,
                CASE
                    WHEN years_experience_min IS NULL OR years_experience_min = 0 THEN 0
                    WHEN years_experience_min = 1 THEN 1
                    WHEN years_experience_min = 2 THEN 2
                    WHEN years_experience_min BETWEEN 3 AND 4 THEN 3
                    ELSE 5
                END as sort_order,
                COUNT(*) as jobs
            FROM jobs
            WHERE is_active = true
            GROUP BY 1, 2
        ) sub
        ORDER BY sort_order
    """)).fetchall()

    return [
        {
            "level": r.experience_level,
            "jobs": r.jobs,
            "percentage": float(r.percentage) if r.percentage else 0
        }
        for r in results
    ]


@router.get("/certifications")
async def get_certification_requirements(db: Session = Depends(get_db)):
    """Get most commonly required certifications"""

    results = db.execute(text("""
        SELECT
            cert,
            COUNT(*) as job_count,
            ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM jobs WHERE is_active = true AND certifications_required IS NOT NULL), 0), 1) as percentage
        FROM jobs, unnest(certifications_required) as cert
        WHERE is_active = true AND certifications_required IS NOT NULL
        GROUP BY cert
        ORDER BY job_count DESC
        LIMIT 12
    """)).fetchall()

    return [
        {
            "certification": r.cert.upper() if r.cert else "Other",
            "jobs": r.job_count,
            "percentage": float(r.percentage) if r.percentage else 0
        }
        for r in results
    ]


@router.get("/travel")
async def get_travel_nurse_trends(db: Session = Depends(get_db)):
    """Get travel nursing opportunities overview"""

    # Overall travel stats
    travel_stats = db.execute(text("""
        SELECT
            COUNT(*) as total_travel_jobs,
            ROUND(AVG(weekly_gross_pay)::numeric, 0) as avg_weekly_pay,
            ROUND(AVG(contract_length_weeks)::numeric, 0) as avg_contract_weeks,
            ROUND(AVG(stipend_housing)::numeric, 0) as avg_housing_stipend,
            ROUND(AVG(stipend_meals)::numeric, 0) as avg_meals_stipend
        FROM jobs
        WHERE is_active = true
        AND (nursing_type = 'travel' OR employment_type ILIKE '%travel%')
    """)).fetchone()

    # Travel jobs by region
    by_region = db.execute(text("""
        SELECT
            COALESCE(f.region, 'Other') as region,
            COUNT(*) as jobs,
            ROUND(AVG(j.weekly_gross_pay)::numeric, 0) as avg_weekly
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = true
        AND (j.nursing_type = 'travel' OR j.employment_type ILIKE '%travel%')
        GROUP BY f.region
        ORDER BY jobs DESC
    """)).fetchall()

    return {
        "stats": {
            "totalJobs": travel_stats.total_travel_jobs if travel_stats else 0,
            "avgWeeklyPay": float(travel_stats.avg_weekly_pay) if travel_stats and travel_stats.avg_weekly_pay else None,
            "avgContractWeeks": int(travel_stats.avg_contract_weeks) if travel_stats and travel_stats.avg_contract_weeks else None,
            "avgHousingStipend": float(travel_stats.avg_housing_stipend) if travel_stats and travel_stats.avg_housing_stipend else None,
            "avgMealsStipend": float(travel_stats.avg_meals_stipend) if travel_stats and travel_stats.avg_meals_stipend else None
        },
        "byRegion": [
            {
                "region": r.region,
                "jobs": r.jobs,
                "avgWeekly": float(r.avg_weekly) if r.avg_weekly else None
            }
            for r in by_region
        ]
    }


@router.get("/seasonal")
async def get_seasonal_patterns(db: Session = Depends(get_db)):
    """Get hiring patterns by month to identify seasonal trends"""

    results = db.execute(text("""
        SELECT
            EXTRACT(MONTH FROM posted_at) as month_num,
            to_char(posted_at, 'Mon') as month_name,
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
        AND posted_at > NOW() - INTERVAL '12 months'
        GROUP BY EXTRACT(MONTH FROM posted_at), to_char(posted_at, 'Mon')
        ORDER BY month_num
    """)).fetchall()

    # Calculate the average to identify high/low hiring months
    if results:
        avg_jobs = sum(r.jobs for r in results) / len(results)
    else:
        avg_jobs = 0

    return [
        {
            "month": r.month_name,
            "monthNum": int(r.month_num),
            "jobs": r.jobs,
            "avgPay": float(r.avg_pay) if r.avg_pay else None,
            "intensity": "high" if r.jobs > avg_jobs * 1.2 else ("low" if r.jobs < avg_jobs * 0.8 else "normal")
        }
        for r in results
    ]
