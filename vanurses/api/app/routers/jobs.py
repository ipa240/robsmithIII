"""Jobs API endpoints"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
import json
from datetime import datetime, timedelta
from ..database import get_db
from ..utils.normalizer import (
    normalize_to_db, normalize_list_to_db, to_display,
    get_region_db_values, normalize_region
)
from ..services.bls_data import get_market_rate

# Import job parser (installed in scraper module)
import sys
sys.path.insert(0, '/home/ian/vanurses/scraper')
try:
    from job_parser import enrich_job, parse_job_description
except ImportError:
    enrich_job = None
    parse_job_description = None

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
    childcare: Optional[str] = None,  # "onsite" or "nearby"
    # Location-based sorting
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    user_zip: Optional[str] = None,  # Alternative to lat/lng - will be geocoded
    sort_by_distance: Optional[bool] = None,
    max_distance_miles: Optional[int] = None,
    # New enrichment-based filters
    new_grad_friendly: Optional[bool] = None,
    bsn_required: Optional[str] = None,  # "yes", "no", or "any"
    certification: Optional[str] = None,  # e.g., "ACLS", "BLS", "PALS"
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
        # Get all DB variants that should match this canonical region
        # e.g., "Northern Virginia" matches ["nova", "northern_virginia", "Northern Virginia"]
        region_variants = get_region_db_values(region)
        if len(region_variants) == 1:
            where_clauses.append("f.region = :region_0")
            params["region_0"] = region_variants[0]
        else:
            region_conditions = []
            for i, variant in enumerate(region_variants):
                param_name = f"region_{i}"
                params[param_name] = variant
                region_conditions.append(f"f.region = :{param_name}")
            where_clauses.append(f"({' OR '.join(region_conditions)})")

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
        # Check both the column AND the JSON enrichment data (must be > 0)
        # Use regex to safely check for positive numbers
        # IMPORTANT: Wrap entire condition in parentheses so AND/OR precedence works correctly
        where_clauses.append("""(
            (j.sign_on_bonus IS NOT NULL AND j.sign_on_bonus > 0)
            OR (j.raw_schema_json->'parsed'->>'sign_on_bonus' IS NOT NULL
                AND j.raw_schema_json->'parsed'->>'sign_on_bonus' != ''
                AND j.raw_schema_json->'parsed'->>'sign_on_bonus' != '0'
                AND j.raw_schema_json->'parsed'->>'sign_on_bonus' ~ '^[1-9][0-9]*$')
        )""")

    if has_relocation:
        where_clauses.append("j.relocation_assistance = true")

    if pay_disclosed_only:
        # Check for actual pay data (pay_min or pay_max populated)
        where_clauses.append("(j.pay_min IS NOT NULL OR j.pay_max IS NOT NULL)")

    if posted_within_days:
        where_clauses.append(f"j.posted_at >= NOW() - INTERVAL '{posted_within_days} days'")

    if ofs_grade:
        # Match on stored ofs_grade string (supports A, B, C, D, F and +/- variants)
        # e.g., "B" matches "B", "B+", "B-"
        grade_letter = ofs_grade.upper()[0]  # Get just the letter (A, B, C, D, F)
        if grade_letter in ['A', 'B', 'C', 'D', 'F']:
            # Use LIKE to match the grade letter with optional +/- modifier
            where_clauses.append(f"fs.ofs_grade LIKE '{grade_letter}%'")

    # Childcare filter - joins with facility_amenities table
    needs_amenities_join = False
    if childcare:
        needs_amenities_join = True
        if childcare == "onsite":
            where_clauses.append("fa.has_onsite_daycare = true")
        elif childcare == "nearby":
            where_clauses.append("fa.childcare_count > 0")

    # New Grad Friendly filter - searches enrichment experience data
    # Note: Removed "GN " from title pattern as it matches "SiGN On Bonus" (false positives)
    # GN Program still valid in experience since it's a full phrase
    if new_grad_friendly:
        where_clauses.append("""(
            j.raw_schema_json->'parsed'->>'experience' ~* '(new grad|entry.level|0.year|no experience|graduate nurse|GN program|new graduate)'
            OR j.title ~* '(new grad|graduate nurse|residency)'
        )""")

    # BSN Required filter - searches enrichment education data
    if bsn_required == "yes":
        where_clauses.append("""
            j.raw_schema_json->'parsed'->>'education' ~* 'BSN.*(required|preferred|must)'
        """)
    elif bsn_required == "no":
        where_clauses.append("""(
            j.raw_schema_json->'parsed'->>'education' ~* '(ADN|ASN|Associate).*(accepted|ok|considered)'
            OR j.raw_schema_json->'parsed'->>'education' NOT LIKE '%BSN%required%'
        )""")

    # Certification filter - searches enrichment certifications data
    if certification:
        params["cert_filter"] = certification.upper()
        where_clauses.append("""
            j.raw_schema_json->'parsed'->>'certifications' ~* :cert_filter
        """)

    # Distance filter - use Haversine formula (miles)
    # If user_zip is provided, look up coordinates from zip_codes table
    if user_zip and (user_lat is None or user_lng is None):
        zip_result = db.execute(
            text("SELECT latitude, longitude FROM zip_codes WHERE zip_code = :zip"),
            {"zip": user_zip.strip()}
        ).fetchone()
        if zip_result:
            user_lat = float(zip_result[0])
            user_lng = float(zip_result[1])

    distance_select = ""
    distance_filter = ""
    has_location = user_lat is not None and user_lng is not None

    if has_location:
        params["user_lat"] = user_lat
        params["user_lng"] = user_lng
        # Haversine formula in SQL (returns miles)
        # Use facility coordinates - they're reliable (387/389 facilities have coords)
        # Job city data is unreliable (contains hospital names, not actual cities)
        distance_select = """,
            CASE
                WHEN f.latitude IS NOT NULL AND f.longitude IS NOT NULL THEN
                    3959 * acos(
                        LEAST(1.0, GREATEST(-1.0,
                            cos(radians(:user_lat)) * cos(radians(f.latitude)) *
                            cos(radians(f.longitude) - radians(:user_lng)) +
                            sin(radians(:user_lat)) * sin(radians(f.latitude))
                        ))
                    )
                ELSE NULL
            END as distance_miles"""

        # Max distance filter - require facilities to have coordinates
        # when a max distance is specified (user wants only results within range)
        if max_distance_miles:
            params["max_distance"] = max_distance_miles
            where_clauses.append("""
                f.latitude IS NOT NULL AND f.longitude IS NOT NULL AND
                3959 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                        cos(radians(:user_lat)) * cos(radians(f.latitude)) *
                        cos(radians(f.longitude) - radians(:user_lng)) +
                        sin(radians(:user_lat)) * sin(radians(f.latitude))
                    ))
                ) <= :max_distance
            """)

    where_sql = " AND ".join(where_clauses)

    # Build JOIN clause - add facility_amenities only when needed
    amenities_join = "LEFT JOIN facility_amenities fa ON f.id = fa.facility_id" if needs_amenities_join else ""

    # Determine sort order
    if sort_by_distance and has_location:
        order_sql = """
            ORDER BY
                CASE WHEN f.latitude IS NULL THEN 1 ELSE 0 END,
                distance_miles ASC NULLS LAST,
                j.posted_at DESC NULLS LAST
        """
    else:
        order_sql = "ORDER BY j.posted_at DESC NULLS LAST, j.scraped_at DESC"

    # Count query
    count_sql = f"""
        SELECT COUNT(*) FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        {amenities_join}
        WHERE {where_sql}
    """
    total = db.execute(text(count_sql), params).scalar()

    # Main query - includes enrichment data for display tags
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
            f.system_name as facility_system, f.city as facility_city,
            fs.ofs_score as facility_ofs_score,
            fs.ofs_grade as facility_ofs_grade,
            -- Enrichment data for tags
            j.raw_schema_json->'parsed'->>'education' as education_req,
            j.raw_schema_json->'parsed'->>'experience' as experience_req,
            j.raw_schema_json->'parsed'->>'certifications' as certifications_req,
            j.raw_schema_json->'parsed'->>'sign_on_bonus' as bonus_from_enrichment
            {distance_select}
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        {amenities_join}
        WHERE {where_sql}
        {order_sql}
        LIMIT :limit OFFSET :offset
    """

    result = db.execute(text(query), params)
    jobs = []
    for row in result:
        job = dict(row._mapping)
        # Add market rate for jobs without disclosed pay
        if not job.get('pay_min') and not job.get('pay_disclosed'):
            job['market_rate'] = get_market_rate(db, job.get('nursing_type'), job.get('city'))
        # Round distance to 1 decimal place if present
        if job.get('distance_miles') is not None:
            job['distance_miles'] = round(job['distance_miles'], 1)
        jobs.append(job)

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
        WHERE j.id = :job_id AND j.is_active = true
    """

    result = db.execute(text(query), {"job_id": job_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Job not found or no longer available")

    job = dict(result._mapping)
    # Add market rate for jobs without disclosed pay
    if not job.get('pay_min') and not job.get('pay_disclosed'):
        job['market_rate'] = get_market_rate(db, job.get('nursing_type'), job.get('city'))

    return {
        "success": True,
        "data": job
    }


@router.get("/{job_id}/details")
async def get_job_details(job_id: str, db: Session = Depends(get_db)):
    """Get enriched job details with parsed sections.

    Returns cached enrichment data only - no live AI calls.
    Jobs are enriched via batch process after scraping.

    Returns:
        - parsed: Structured sections (summary, education, experience, etc.)
        - raw_text: Clean text fallback
        - extraction_method: 'ollama', 'regex', or 'raw'
        - enriched: Whether this job has been processed by AI
    """
    # Get job from database with description fallback
    query = """
        SELECT id, source_url, description, raw_schema_json, is_active
        FROM jobs
        WHERE id = :job_id AND is_active = true
    """
    result = db.execute(text(query), {"job_id": job_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Job not found or no longer available")

    job = dict(result._mapping)
    raw_schema = job.get('raw_schema_json') or {}

    # Parse JSON if it's a string
    if isinstance(raw_schema, str):
        try:
            raw_schema = json.loads(raw_schema)
        except:
            raw_schema = {}

    # Check if we have enriched data
    has_enriched = bool(
        raw_schema.get('parsed') and
        raw_schema.get('extraction_method') in ('ollama', 'regex')
    )

    if has_enriched:
        # Return cached enrichment data
        return {
            "success": True,
            "data": raw_schema,
            "enriched": True
        }
    else:
        # No enrichment yet - return basic info with description
        return {
            "success": True,
            "data": {
                "parsed": {},
                "raw_text": job.get('description', ''),
                "extraction_method": "pending",
                "is_expired": raw_schema.get('is_expired', False)
            },
            "enriched": False
        }


@router.get("/{job_id}/preview")
async def get_job_preview(job_id: str, db: Session = Depends(get_db)):
    """Get a quick preview of job details for the drawer/popup view.

    Returns essential info plus parsed sections if available.
    Lighter weight than full details - doesn't trigger enrichment.
    """

    query = """
        SELECT
            j.id, j.title, j.description, j.nursing_type, j.specialty,
            j.employment_type, j.shift_type, j.shift_hours,
            j.city, j.state, j.zip,
            j.pay_min, j.pay_max, j.pay_disclosed, j.sign_on_bonus,
            j.posted_at, j.source_url, j.raw_schema_json,
            j.facility_id,
            f.name as facility_name, f.region as facility_region,
            f.system_name as facility_system,
            fs.ofs_score as facility_ofs_score,
            fs.ofs_grade as facility_ofs_grade
        FROM jobs j
        LEFT JOIN facilities f ON j.facility_id = f.id
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE j.id = :job_id AND j.is_active = true
    """

    result = db.execute(text(query), {"job_id": job_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Job not found or no longer available")

    job = dict(result._mapping)

    # Extract parsed data if available
    raw_schema = job.pop('raw_schema_json', None) or {}
    if isinstance(raw_schema, str):
        try:
            raw_schema = json.loads(raw_schema)
        except:
            raw_schema = {}

    # Add parsed sections to response
    job['parsed'] = raw_schema.get('parsed', {})
    job['has_enriched_data'] = bool(raw_schema.get('fetched_at'))

    # Add market rate if no disclosed pay
    if not job.get('pay_min') and not job.get('pay_disclosed'):
        job['market_rate'] = get_market_rate(db, job.get('nursing_type'), job.get('city'))

    return {
        "success": True,
        "data": job
    }
