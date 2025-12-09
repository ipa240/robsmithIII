"""Jobs API endpoints"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
from ..database import get_db
from ..utils.normalizer import normalize_to_db, normalize_list_to_db, to_display

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    nursing_type: Optional[str] = None,
    specialty: Optional[str] = None,
    employment_type: Optional[str] = None,
    shift_type: Optional[str] = None,
    city: Optional[str] = None,
    region: Optional[str] = None,
    facility_id: Optional[str] = None,
    facility_system: Optional[str] = None,
    min_pay: Optional[int] = None,
    max_pay: Optional[int] = None,
    has_sign_on_bonus: Optional[bool] = None,
    has_relocation: Optional[bool] = None,
    pay_disclosed_only: Optional[bool] = None,
    posted_within_days: Optional[int] = None,
    ofs_grade: Optional[str] = None,
):
    """Get paginated list of jobs with filters"""

    # Build WHERE clauses
    where_clauses = ["j.is_active = true"]
    params = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append("(j.title ILIKE :search OR j.description ILIKE :search)")
        params["search"] = f"%{search}%"

    # Normalize filter values before matching - handles any input format
    if nursing_type:
        normalized_nt = normalize_to_db(nursing_type, "nursing_type")
        where_clauses.append("LOWER(REPLACE(REPLACE(j.nursing_type, '{', ''), '}', '')) = :nursing_type")
        params["nursing_type"] = normalized_nt

    if specialty:
        normalized_sp = normalize_to_db(specialty, "specialty")
        where_clauses.append("LOWER(REPLACE(REPLACE(j.specialty, '{', ''), '}', '')) = :specialty")
        params["specialty"] = normalized_sp

    if employment_type:
        normalized_et = normalize_to_db(employment_type, "employment_type")
        where_clauses.append("LOWER(REPLACE(REPLACE(j.employment_type, '{', ''), '}', '')) = :employment_type")
        params["employment_type"] = normalized_et

    if shift_type:
        normalized_st = normalize_to_db(shift_type, "shift_type")
        where_clauses.append("LOWER(REPLACE(REPLACE(j.shift_type, '{', ''), '}', '')) = :shift_type")
        params["shift_type"] = normalized_st

    if city:
        where_clauses.append("j.city = :city")
        params["city"] = city

    if region:
        where_clauses.append("f.region = :region")
        params["region"] = region

    if facility_id:
        where_clauses.append("j.facility_id = :facility_id")
        params["facility_id"] = facility_id

    if facility_system:
        where_clauses.append("f.system_name = :facility_system")
        params["facility_system"] = facility_system

    if min_pay is not None:
        where_clauses.append("j.pay_min >= :min_pay")
        params["min_pay"] = min_pay

    if max_pay is not None:
        where_clauses.append("(j.pay_max <= :max_pay OR j.pay_min <= :max_pay)")
        params["max_pay"] = max_pay

    if has_sign_on_bonus:
        where_clauses.append("j.sign_on_bonus IS NOT NULL AND j.sign_on_bonus > 0")

    if has_relocation:
        where_clauses.append("j.relocation_assistance = true")

    if pay_disclosed_only:
        where_clauses.append("j.pay_disclosed = true")

    if posted_within_days:
        where_clauses.append(f"j.posted_at >= NOW() - INTERVAL '{posted_within_days} days'")

    if ofs_grade:
        # OFS grades: A = 90-100, B = 80-89, C = 70-79, D = 60-69, F = <60
        grade_ranges = {
            'A': (90, 100),
            'B': (80, 89),
            'C': (70, 79),
            'D': (60, 69),
            'F': (0, 59),
        }
        if ofs_grade.upper() in grade_ranges:
            min_score, max_score = grade_ranges[ofs_grade.upper()]
            where_clauses.append(f"fs.ofs_score >= {min_score} AND fs.ofs_score <= {max_score}")

    where_sql = " AND ".join(where_clauses)

    # Count query
    count_sql = f"""
        SELECT COUNT(*) FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_sql}
    """
    total = db.execute(text(count_sql), params).scalar()

    # Main query
    query = f"""
        SELECT
            j.id, j.title, j.description, j.nursing_type, j.specialty,
            j.employment_type, j.shift_type, j.shift_hours,
            j.city, j.state, j.zip,
            j.pay_min, j.pay_max, j.pay_disclosed,
            j.sign_on_bonus, j.relocation_assistance,
            j.posted_at, j.source_url, j.external_job_id,
            j.facility_id,
            f.name as facility_name, f.region as facility_region,
            f.system_name as facility_system,
            fs.ofs_score as facility_ofs_score,
            fs.ofs_grade as facility_ofs_grade
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_sql}
        ORDER BY j.posted_at DESC NULLS LAST, j.scraped_at DESC
        LIMIT :limit OFFSET :offset
    """

    result = db.execute(text(query), params)
    jobs = [dict(row._mapping) for row in result]

    return {
        "success": True,
        "data": jobs,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/recent-diverse")
async def get_recent_diverse_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=20),
):
    """Get recent jobs with diversity across facilities (not all from same facility)"""

    # Use a window function to get one job per facility, then order by recency
    query = """
        WITH ranked_jobs AS (
            SELECT
                j.id, j.title, j.nursing_type, j.specialty,
                j.employment_type, j.shift_type,
                j.city, j.state,
                j.pay_min, j.pay_max, j.posted_at,
                j.facility_id,
                f.name as facility_name,
                ROW_NUMBER() OVER (PARTITION BY j.facility_id ORDER BY j.posted_at DESC NULLS LAST) as rn
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.is_active = true
        )
        SELECT * FROM ranked_jobs
        WHERE rn <= 2
        ORDER BY posted_at DESC NULLS LAST
        LIMIT :limit
    """

    result = db.execute(text(query), {"limit": limit})
    jobs = [dict(row._mapping) for row in result]

    # Remove the ranking column
    for job in jobs:
        job.pop('rn', None)

    return {
        "success": True,
        "data": jobs
    }


@router.get("/matched")
async def get_matched_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    specialties: Optional[str] = None,
    employment_types: Optional[str] = None,
):
    """Get jobs matched to user preferences with facility scores for personalized ranking.

    Accepts filter values in ANY format:
    - Display format: "Full-Time", "ICU", "Med-Surg"
    - Database format: "full_time", "icu", "med_surg"
    - Legacy format: "{FULL_TIME}", "{ICU}"

    All formats are normalized to match database values.
    """

    # Build WHERE clauses
    where_clauses = ["j.is_active = true"]
    params = {"limit": limit}

    # Filter by specialties if provided - NORMALIZE INPUT
    if specialties:
        raw_specialties = [s.strip() for s in specialties.split(',') if s.strip()]
        normalized_specialties = normalize_list_to_db(raw_specialties, "specialty")
        if normalized_specialties:
            # Match against normalized database values (handles legacy braces too)
            specialty_conditions = []
            for i, spec in enumerate(normalized_specialties):
                param_name = f"spec_{i}"
                params[param_name] = spec
                specialty_conditions.append(f"LOWER(REPLACE(REPLACE(j.specialty, '{{', ''), '}}', '')) = :{param_name}")
            where_clauses.append(f"({' OR '.join(specialty_conditions)})")

    # Filter by employment types if provided - NORMALIZE INPUT
    if employment_types:
        raw_emp_types = [e.strip() for e in employment_types.split(',') if e.strip()]
        normalized_emp_types = normalize_list_to_db(raw_emp_types, "employment_type")
        if normalized_emp_types:
            # Match against normalized database values (handles legacy braces too)
            emp_conditions = []
            for i, emp in enumerate(normalized_emp_types):
                param_name = f"emp_{i}"
                params[param_name] = emp
                emp_conditions.append(f"LOWER(REPLACE(REPLACE(j.employment_type, '{{', ''), '}}', '')) = :{param_name}")
            where_clauses.append(f"({' OR '.join(emp_conditions)})")

    where_sql = " AND ".join(where_clauses)

    # Query jobs with facility scores - diverse results from different facilities
    # Use window function to limit jobs per facility for variety
    query = f"""
        WITH ranked_jobs AS (
            SELECT
                j.id, j.title, j.nursing_type, j.specialty,
                j.employment_type, j.shift_type,
                j.city, j.state,
                j.pay_min, j.pay_max,
                j.facility_id,
                f.name as facility_name,
                fs.ofs_score, fs.ofs_grade,
                fs.pci_score, fs.ali_score, fs.csi_score, fs.cci_score,
                fs.lssi_score, fs.qli_score, fs.pei_score, fs.fsi_score,
                ROW_NUMBER() OVER (PARTITION BY j.facility_id ORDER BY RANDOM()) as facility_rank
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            LEFT JOIN facility_scores fs ON f.id = fs.facility_id
            WHERE {where_sql}
        )
        SELECT * FROM ranked_jobs
        WHERE facility_rank <= 3
        ORDER BY
            CASE WHEN ofs_score IS NOT NULL THEN 0 ELSE 1 END,
            RANDOM(),
            ofs_score DESC NULLS LAST
        LIMIT :limit
    """

    result = db.execute(text(query), params)
    jobs = []

    for row in result:
        row_dict = dict(row._mapping)
        # Remove ranking column
        row_dict.pop('facility_rank', None)
        # Build facility_score object
        if row_dict.get('ofs_score'):
            row_dict['facility_score'] = {
                'ofs_score': row_dict.pop('ofs_score'),
                'ofs_grade': row_dict.pop('ofs_grade'),
                'pci_score': row_dict.pop('pci_score'),
                'ali_score': row_dict.pop('ali_score'),
                'csi_score': row_dict.pop('csi_score'),
                'cci_score': row_dict.pop('cci_score'),
                'lssi_score': row_dict.pop('lssi_score'),
                'qli_score': row_dict.pop('qli_score'),
                'pei_score': row_dict.pop('pei_score'),
                'fsi_score': row_dict.pop('fsi_score'),
            }
        else:
            # Remove the score fields if no score
            for key in ['ofs_score', 'ofs_grade', 'pci_score', 'ali_score', 'csi_score',
                       'cci_score', 'lssi_score', 'qli_score', 'pei_score', 'fsi_score']:
                row_dict.pop(key, None)
            row_dict['facility_score'] = None

        jobs.append(row_dict)

    return {
        "success": True,
        "data": jobs
    }


@router.get("/{job_id}")
async def get_job(job_id: str, db: Session = Depends(get_db)):
    """Get single job by ID"""

    query = """
        SELECT
            j.*,
            f.name as facility_name, f.region as facility_region,
            f.system_name as facility_system, f.city as facility_city,
            f.state as facility_state, f.career_url as facility_career_url
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        WHERE j.id = :job_id
    """

    result = db.execute(text(query), {"job_id": job_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "success": True,
        "data": dict(result._mapping)
    }
