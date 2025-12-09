"""
VANurses.com - FastAPI Backend
REST API for Virginia nursing job listings
"""

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

# Import Sully AI router
from sully import router as sully_router

# Import Auth router
from routers.auth import router as auth_router

# Import OAuth router
from routers.oauth import router as oauth_router

# Database config
DB_CONFIG = {
    'dbname': 'vanurses',
    'user': 'vanurses_app',
    'password': 'VaNurses2025Secure',
    'host': 'localhost',
    'port': 5432
}

app = FastAPI(
    title="VANurses.com API",
    description="Virginia Nursing Jobs API",
    version="1.0.0"
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Sully AI router
app.include_router(sully_router)

# Include Auth router
app.include_router(auth_router)

# Include OAuth router
app.include_router(oauth_router)


def get_db():
    """Get database connection."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)


# Pydantic models
class Job(BaseModel):
    id: str
    title: str
    nursing_type: Optional[str]
    specialty: Optional[str]
    employment_type: Optional[str]
    shift_type: Optional[str]
    city: Optional[str]
    state: str
    facility_name: Optional[str]
    system_name: Optional[str]
    source_url: Optional[str]
    posted_at: Optional[datetime]


class Facility(BaseModel):
    id: str
    name: str
    system_name: Optional[str]
    city: str
    state: str
    region: Optional[str]
    bed_count: Optional[int]
    career_url: Optional[str]
    job_count: int = 0


class Agency(BaseModel):
    id: str
    name: str
    headquarters_state: Optional[str]
    serves_virginia: bool
    website: Optional[str]
    specialties: Optional[List[str]]


class JobStats(BaseModel):
    total_jobs: int
    by_nursing_type: dict
    by_specialty: dict
    by_system: dict
    by_region: dict
    last_updated: datetime


# API Endpoints

@app.get("/")
async def root():
    """API health check."""
    return {"status": "ok", "service": "VANurses.com API", "version": "1.0.0"}


@app.get("/api/jobs", response_model=List[Job])
async def list_jobs(
    nursing_type: Optional[str] = Query(None, description="Filter by type: rn, lpn, cna, np, crna"),
    specialty: Optional[str] = Query(None, description="Filter by specialty: icu, er, or, med_surg, etc."),
    employment_type: Optional[str] = Query(None, description="Filter: full_time, part_time, prn, travel"),
    shift_type: Optional[str] = Query(None, description="Filter: days, nights, evenings, rotating"),
    system: Optional[str] = Query(None, description="Hospital system name"),
    city: Optional[str] = Query(None, description="City name"),
    region: Optional[str] = Query(None, description="Region: nova, hampton_roads, richmond, etc."),
    search: Optional[str] = Query(None, description="Search in job title"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List nursing jobs with optional filters."""
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT
            j.id::text, j.title, j.nursing_type, j.specialty, j.employment_type,
            j.shift_type, j.city, j.state, f.name as facility_name,
            f.system_name, j.source_url, j.posted_at
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE
    """
    params = []

    if nursing_type:
        query += " AND j.nursing_type = %s"
        params.append(nursing_type)

    if specialty:
        query += " AND j.specialty = %s"
        params.append(specialty)

    if employment_type:
        query += " AND j.employment_type = %s"
        params.append(employment_type)

    if shift_type:
        query += " AND j.shift_type = %s"
        params.append(shift_type)

    if system:
        query += " AND f.system_name ILIKE %s"
        params.append(f"%{system}%")

    if city:
        query += " AND j.city ILIKE %s"
        params.append(f"%{city}%")

    if region:
        query += " AND f.region = %s"
        params.append(region)

    if search:
        query += " AND j.title ILIKE %s"
        params.append(f"%{search}%")

    query += " ORDER BY j.posted_at DESC NULLS LAST, j.scraped_at DESC"
    query += f" LIMIT {limit} OFFSET {offset}"

    cur.execute(query, params)
    jobs = cur.fetchall()

    cur.close()
    conn.close()

    return [dict(j) for j in jobs]


@app.get("/api/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    """Get a specific job by ID."""
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            j.id::text, j.title, j.nursing_type, j.specialty, j.employment_type,
            j.shift_type, j.city, j.state, f.name as facility_name,
            f.system_name, j.source_url, j.posted_at
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        WHERE j.id = %s
    """, (job_id,))

    job = cur.fetchone()
    cur.close()
    conn.close()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return dict(job)


@app.get("/api/facilities", response_model=List[Facility])
async def list_facilities(
    system: Optional[str] = Query(None, description="Hospital system name"),
    region: Optional[str] = Query(None, description="Region code"),
    has_jobs: bool = Query(False, description="Only show facilities with active jobs"),
    limit: int = Query(100, ge=1, le=500),
):
    """List healthcare facilities."""
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT
            f.id::text, f.name, f.system_name, f.city, f.state, f.region,
            f.bed_count, f.career_url,
            COUNT(j.id) as job_count
        FROM facilities f
        LEFT JOIN jobs j ON f.id = j.facility_id AND j.is_active = TRUE
        WHERE 1=1
    """
    params = []

    if system:
        query += " AND f.system_name ILIKE %s"
        params.append(f"%{system}%")

    if region:
        query += " AND f.region = %s"
        params.append(region)

    query += " GROUP BY f.id"

    if has_jobs:
        query += " HAVING COUNT(j.id) > 0"

    query += " ORDER BY f.system_name, f.name"
    query += f" LIMIT {limit}"

    cur.execute(query, params)
    facilities = cur.fetchall()

    cur.close()
    conn.close()

    return [dict(f) for f in facilities]


@app.get("/api/agencies", response_model=List[Agency])
async def list_agencies(
    specialty: Optional[str] = Query(None, description="Filter by specialty"),
    limit: int = Query(50, ge=1, le=100),
):
    """List travel nursing agencies."""
    conn = get_db()
    cur = conn.cursor()

    query = """
        SELECT
            id::text, name, headquarters_state, serves_virginia,
            website, specialties
        FROM agencies
        WHERE serves_virginia = TRUE
    """
    params = []

    if specialty:
        query += " AND %s = ANY(specialties)"
        params.append(specialty)

    query += " ORDER BY name"
    query += f" LIMIT {limit}"

    cur.execute(query, params)
    agencies = cur.fetchall()

    cur.close()
    conn.close()

    return [dict(a) for a in agencies]


@app.get("/api/stats", response_model=JobStats)
async def get_stats():
    """Get job statistics and counts."""
    conn = get_db()
    cur = conn.cursor()

    stats = {
        'total_jobs': 0,
        'by_nursing_type': {},
        'by_specialty': {},
        'by_system': {},
        'by_region': {},
        'last_updated': datetime.now()
    }

    # Total active jobs
    cur.execute("SELECT COUNT(*) FROM jobs WHERE is_active = TRUE")
    stats['total_jobs'] = cur.fetchone()['count']

    # By nursing type
    cur.execute("""
        SELECT nursing_type, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND nursing_type IS NOT NULL
        GROUP BY nursing_type ORDER BY count DESC
    """)
    stats['by_nursing_type'] = {row['nursing_type']: row['count'] for row in cur.fetchall()}

    # By specialty
    cur.execute("""
        SELECT specialty, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND specialty IS NOT NULL
        GROUP BY specialty ORDER BY count DESC LIMIT 15
    """)
    stats['by_specialty'] = {row['specialty']: row['count'] for row in cur.fetchall()}

    # By hospital system
    cur.execute("""
        SELECT f.system_name, COUNT(j.id) as count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE
        GROUP BY f.system_name ORDER BY count DESC
    """)
    stats['by_system'] = {row['system_name']: row['count'] for row in cur.fetchall()}

    # By region
    cur.execute("""
        SELECT f.region, COUNT(j.id) as count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE AND f.region IS NOT NULL
        GROUP BY f.region ORDER BY count DESC
    """)
    stats['by_region'] = {row['region']: row['count'] for row in cur.fetchall()}

    # Last scrape time
    cur.execute("SELECT MAX(scraped_at) as last FROM jobs")
    result = cur.fetchone()
    if result and result['last']:
        stats['last_updated'] = result['last']

    cur.close()
    conn.close()

    return stats


@app.get("/api/dashboard/analytics")
async def get_dashboard_analytics():
    """Get comprehensive dashboard analytics."""
    conn = get_db()
    cur = conn.cursor()

    analytics = {}

    # === SUMMARY STATS ===
    cur.execute("""
        SELECT
            COUNT(*) as total_jobs,
            COUNT(CASE WHEN pay_min IS NOT NULL THEN 1 END) as jobs_with_pay,
            ROUND(AVG(NULLIF(pay_min, 0))::numeric, 2) as avg_pay_min,
            ROUND(AVG(NULLIF(pay_max, 0))::numeric, 2) as avg_pay_max,
            COUNT(CASE WHEN sign_on_bonus > 0 THEN 1 END) as jobs_with_bonus,
            ROUND(AVG(CASE WHEN sign_on_bonus > 0 THEN sign_on_bonus END)::numeric, 2) as avg_bonus,
            COUNT(DISTINCT facility_id) as unique_facilities
        FROM jobs WHERE is_active = TRUE
    """)
    row = cur.fetchone()
    analytics['summary'] = dict(row) if row else {}

    # === EMPLOYMENT TYPE DISTRIBUTION ===
    cur.execute("""
        SELECT employment_type, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND employment_type IS NOT NULL
        GROUP BY employment_type ORDER BY count DESC
    """)
    analytics['by_employment_type'] = {r['employment_type']: r['count'] for r in cur.fetchall()}

    # === SHIFT TYPE DISTRIBUTION (cleaned) ===
    cur.execute("""
        SELECT
            CASE
                WHEN shift_type ILIKE '%day%' OR shift_type LIKE '% D' OR shift_type LIKE '% D/%' THEN 'Days'
                WHEN shift_type ILIKE '%night%' OR shift_type LIKE '% N' OR shift_type LIKE '% N/%' THEN 'Nights'
                WHEN shift_type ILIKE '%evening%' OR shift_type LIKE '% E' OR shift_type LIKE '% E/%' THEN 'Evenings'
                WHEN shift_type ILIKE '%rotating%' THEN 'Rotating'
                WHEN shift_type ILIKE '%weekend%' THEN 'Weekends'
                ELSE 'Other'
            END as shift_category,
            COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND shift_type IS NOT NULL
        GROUP BY shift_category ORDER BY count DESC
    """)
    analytics['by_shift'] = {r['shift_category']: r['count'] for r in cur.fetchall()}

    # === JOBS POSTED TREND (last 14 days) ===
    cur.execute("""
        SELECT
            TO_CHAR(DATE(posted_at), 'Mon DD') as date_label,
            DATE(posted_at) as post_date,
            COUNT(*) as count
        FROM jobs
        WHERE is_active = TRUE AND posted_at IS NOT NULL
            AND posted_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(posted_at), TO_CHAR(DATE(posted_at), 'Mon DD')
        ORDER BY post_date
    """)
    analytics['jobs_trend'] = [{'date': r['date_label'], 'count': r['count']} for r in cur.fetchall()]

    # === TOP CITIES ===
    cur.execute("""
        SELECT city, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND city IS NOT NULL
        GROUP BY city ORDER BY count DESC LIMIT 10
    """)
    analytics['top_cities'] = {r['city']: r['count'] for r in cur.fetchall()}

    # === PAY RANGES BY SPECIALTY (hourly) ===
    cur.execute("""
        SELECT
            specialty,
            ROUND(AVG(pay_min)::numeric, 2) as avg_min,
            ROUND(AVG(pay_max)::numeric, 2) as avg_max,
            COUNT(*) as job_count
        FROM jobs
        WHERE is_active = TRUE AND specialty IS NOT NULL
            AND pay_min IS NOT NULL AND pay_min > 0 AND pay_min < 500
        GROUP BY specialty
        HAVING COUNT(*) >= 3
        ORDER BY AVG(pay_max) DESC NULLS LAST
        LIMIT 10
    """)
    analytics['pay_by_specialty'] = [
        {'specialty': r['specialty'], 'avg_min': float(r['avg_min']) if r['avg_min'] else 0,
         'avg_max': float(r['avg_max']) if r['avg_max'] else 0, 'count': r['job_count']}
        for r in cur.fetchall()
    ]

    # === PAY RANGES BY SYSTEM ===
    cur.execute("""
        SELECT
            f.system_name,
            ROUND(AVG(j.pay_min)::numeric, 2) as avg_min,
            ROUND(AVG(j.pay_max)::numeric, 2) as avg_max,
            COUNT(*) as job_count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE AND f.system_name IS NOT NULL
            AND j.pay_min IS NOT NULL AND j.pay_min > 0 AND j.pay_min < 500
        GROUP BY f.system_name
        HAVING COUNT(*) >= 3
        ORDER BY AVG(j.pay_max) DESC NULLS LAST
        LIMIT 10
    """)
    analytics['pay_by_system'] = [
        {'system': r['system_name'], 'avg_min': float(r['avg_min']) if r['avg_min'] else 0,
         'avg_max': float(r['avg_max']) if r['avg_max'] else 0, 'count': r['job_count']}
        for r in cur.fetchall()
    ]

    # === NURSING TYPE BREAKDOWN ===
    cur.execute("""
        SELECT nursing_type, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND nursing_type IS NOT NULL
        GROUP BY nursing_type ORDER BY count DESC
    """)
    analytics['by_nursing_type'] = {r['nursing_type']: r['count'] for r in cur.fetchall()}

    # === SPECIALTY BREAKDOWN (top 15) ===
    cur.execute("""
        SELECT specialty, COUNT(*) as count
        FROM jobs WHERE is_active = TRUE AND specialty IS NOT NULL
        GROUP BY specialty ORDER BY count DESC LIMIT 15
    """)
    analytics['by_specialty'] = {r['specialty']: r['count'] for r in cur.fetchall()}

    # === SYSTEM BREAKDOWN ===
    cur.execute("""
        SELECT f.system_name, COUNT(j.id) as count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE AND f.system_name IS NOT NULL
        GROUP BY f.system_name ORDER BY count DESC
    """)
    analytics['by_system'] = {r['system_name']: r['count'] for r in cur.fetchall()}

    # === REGION BREAKDOWN ===
    cur.execute("""
        SELECT f.region, COUNT(j.id) as count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = TRUE AND f.region IS NOT NULL
        GROUP BY f.region ORDER BY count DESC
    """)
    analytics['by_region'] = {r['region']: r['count'] for r in cur.fetchall()}

    # === JOBS BY DAY OF WEEK ===
    cur.execute("""
        SELECT
            TO_CHAR(posted_at, 'Dy') as day_name,
            EXTRACT(DOW FROM posted_at) as day_num,
            COUNT(*) as count
        FROM jobs
        WHERE is_active = TRUE AND posted_at IS NOT NULL
        GROUP BY TO_CHAR(posted_at, 'Dy'), EXTRACT(DOW FROM posted_at)
        ORDER BY day_num
    """)
    analytics['by_day_of_week'] = [{'day': r['day_name'], 'count': r['count']} for r in cur.fetchall()]

    # === RECENT ACTIVITY ===
    cur.execute("""
        SELECT
            COUNT(CASE WHEN posted_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
            COUNT(CASE WHEN posted_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d,
            COUNT(CASE WHEN posted_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30d
        FROM jobs WHERE is_active = TRUE
    """)
    row = cur.fetchone()
    analytics['recent_activity'] = dict(row) if row else {}

    # === FACILITY COUNT ===
    cur.execute("SELECT COUNT(*) as count FROM facilities")
    analytics['total_facilities'] = cur.fetchone()['count']

    # === LAST UPDATED ===
    cur.execute("SELECT MAX(scraped_at) as last FROM jobs")
    result = cur.fetchone()
    analytics['last_updated'] = result['last'].isoformat() if result and result['last'] else None

    cur.close()
    conn.close()

    return analytics


@app.get("/api/filters")
async def get_filters():
    """Get available filter options."""
    conn = get_db()
    cur = conn.cursor()

    filters = {}

    # Nursing types
    cur.execute("""
        SELECT DISTINCT nursing_type FROM jobs
        WHERE is_active = TRUE AND nursing_type IS NOT NULL
        ORDER BY nursing_type
    """)
    filters['nursing_types'] = [r['nursing_type'] for r in cur.fetchall()]

    # Specialties
    cur.execute("""
        SELECT DISTINCT specialty FROM jobs
        WHERE is_active = TRUE AND specialty IS NOT NULL
        ORDER BY specialty
    """)
    filters['specialties'] = [r['specialty'] for r in cur.fetchall()]

    # Employment types
    cur.execute("""
        SELECT DISTINCT employment_type FROM jobs
        WHERE is_active = TRUE AND employment_type IS NOT NULL
        ORDER BY employment_type
    """)
    filters['employment_types'] = [r['employment_type'] for r in cur.fetchall()]

    # Shift types
    cur.execute("""
        SELECT DISTINCT shift_type FROM jobs
        WHERE is_active = TRUE AND shift_type IS NOT NULL
        ORDER BY shift_type
    """)
    filters['shift_types'] = [r['shift_type'] for r in cur.fetchall()]

    # Hospital systems
    cur.execute("""
        SELECT DISTINCT f.system_name FROM facilities f
        JOIN jobs j ON f.id = j.facility_id
        WHERE j.is_active = TRUE AND f.system_name IS NOT NULL
        ORDER BY f.system_name
    """)
    filters['systems'] = [r['system_name'] for r in cur.fetchall()]

    # Regions
    cur.execute("""
        SELECT DISTINCT f.region FROM facilities f
        JOIN jobs j ON f.id = j.facility_id
        WHERE j.is_active = TRUE AND f.region IS NOT NULL
        ORDER BY f.region
    """)
    filters['regions'] = [r['region'] for r in cur.fetchall()]

    # Cities with jobs
    cur.execute("""
        SELECT DISTINCT city FROM jobs
        WHERE is_active = TRUE AND city IS NOT NULL
        ORDER BY city LIMIT 50
    """)
    filters['cities'] = [r['city'] for r in cur.fetchall()]

    cur.close()
    conn.close()

    return filters


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5010)
