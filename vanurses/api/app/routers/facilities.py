"""Facilities API endpoints"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
from ..database import get_db
from ..utils.normalizer import get_region_db_values, get_canonical_regions

router = APIRouter(prefix="/api/facilities", tags=["facilities"])

# All 13 scoring indices with weights (total 100%)
SCORE_INDICES = [
    ("pci_score", "pci_weighted", 15),   # Pay Competitiveness Index
    ("eri_score", "eri_weighted", 12),   # Employee Reviews Index
    ("lssi_score", "lssi_weighted", 10), # Location Safety Index
    ("pei_score", "pei_weighted", 10),   # Patient Experience Index
    ("fsi_score", "fsi_weighted", 10),   # Facility Statistics Index
    ("cmsi_score", "cmsi_weighted", 8),  # CMS Quality Index (nursing homes)
    ("ali_score", "ali_weighted", 8),    # Amenities & Lifestyle Index
    ("jti_score", "jti_weighted", 7),    # Job Transparency Index
    ("lsi_score", "lsi_weighted", 6),    # Leapfrog Safety Index (hospitals)
    ("csi_score", "csi_weighted", 5),    # Commute Stress Index
    ("qli_score", "qli_weighted", 5),    # Quality of Life Index
    ("oii_score", "oii_weighted", 4),    # Opportunity Insights Index
    ("cci_score", "cci_weighted", 3),    # Climate Comfort Index
]

# Index names for human display
INDEX_NAMES = {
    "pci": "Pay Competitiveness",
    "eri": "Employee Reviews",
    "lssi": "Location Safety",
    "pei": "Patient Experience",
    "fsi": "Facility Statistics",
    "cmsi": "CMS Quality",
    "ali": "Amenities & Lifestyle",
    "jti": "Job Transparency",
    "lsi": "Leapfrog Safety",
    "csi": "Commute Stress",
    "qli": "Quality of Life",
    "oii": "Opportunity Insights",
    "cci": "Climate Comfort",
}


def build_score_object(row_dict: dict) -> Optional[dict]:
    """Extract and structure score data from a facility row"""
    if not row_dict.get("ofs_score"):
        # Remove all score fields and return None
        for idx, weighted, _ in SCORE_INDICES:
            row_dict.pop(idx, None)
            row_dict.pop(weighted, None)
        row_dict.pop("ofs_score", None)
        row_dict.pop("ofs_grade", None)
        row_dict.pop("indices_available", None)
        return None

    score = {
        "ofs_score": row_dict.pop("ofs_score"),
        "ofs_grade": row_dict.pop("ofs_grade"),
        "indices_available": row_dict.pop("indices_available", None),
        "indices": {}
    }

    for idx, weighted, weight in SCORE_INDICES:
        idx_key = idx.replace("_score", "")  # e.g., "pci"
        score["indices"][idx_key] = {
            "score": row_dict.pop(idx, None),
            "weighted": float(row_dict.pop(weighted, 0) or 0),
            "weight_pct": weight,
            "name": INDEX_NAMES.get(idx_key, idx_key.upper())
        }

    return score


@router.get("")
async def list_facilities(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=500),  # Increased for map view
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    region: Optional[str] = None,
    system: Optional[str] = None,
    min_grade: Optional[str] = None,
    # Location-based sorting
    user_zip: Optional[str] = None,
    sort_by_distance: Optional[bool] = None,
    max_distance_miles: Optional[int] = None,
):
    """Get paginated list of facilities with all scoring indices"""

    where_clauses = ["1=1"]
    params = {"limit": limit, "offset": offset}

    # Geocode zip to lat/lng
    user_lat = None
    user_lng = None
    if user_zip:
        zip_result = db.execute(
            text("SELECT latitude, longitude FROM zip_codes WHERE zip_code = :zip"),
            {"zip": user_zip.strip()}
        ).fetchone()
        if zip_result:
            user_lat = float(zip_result[0])
            user_lng = float(zip_result[1])

    if search:
        where_clauses.append("(f.name ILIKE :search OR f.system_name ILIKE :search)")
        params["search"] = f"%{search}%"

    if region:
        # Get all DB variants that should match this canonical region
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

    if system:
        where_clauses.append("f.system_name = :system")
        params["system"] = system

    if min_grade:
        # Exact grade match (A, B, C, D, or F)
        grade_letter = min_grade.upper()[0]
        if grade_letter in ['A', 'B', 'C', 'D', 'F']:
            where_clauses.append("fs.ofs_grade LIKE :grade_pattern")
            params["grade_pattern"] = f"{grade_letter}%"

    # Distance filtering
    distance_select = ""
    has_location = user_lat is not None and user_lng is not None

    if has_location:
        params["user_lat"] = user_lat
        params["user_lng"] = user_lng
        # Haversine formula in SQL (returns miles)
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

        # Max distance filter
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

    # Determine sort order
    if sort_by_distance and has_location:
        order_sql = """
            ORDER BY
                CASE WHEN f.latitude IS NULL THEN 1 ELSE 0 END,
                distance_miles ASC NULLS LAST,
                fs.ofs_score DESC NULLS LAST
        """
    else:
        order_sql = "ORDER BY fs.ofs_score DESC NULLS LAST, f.name ASC"

    # Count
    count_sql = f"""
        SELECT COUNT(*) FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_sql}
    """
    total = db.execute(text(count_sql), params).scalar()

    # Build score columns dynamically
    score_cols = ", ".join([
        f"fs.{idx}, fs.{weighted}"
        for idx, weighted, _ in SCORE_INDICES
    ])

    query = f"""
        SELECT
            f.id, f.name, f.city, f.state, f.zip_code, f.region,
            f.system_name, f.facility_type, f.bed_count, f.career_url,
            f.latitude, f.longitude, f.address,
            fs.ofs_score, fs.ofs_grade, fs.indices_available,
            {score_cols},
            (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as job_count
            {distance_select}
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_sql}
        {order_sql}
        LIMIT :limit OFFSET :offset
    """

    result = db.execute(text(query), params)
    facilities = []

    for row in result:
        facility = dict(row._mapping)
        # Round distance to 1 decimal place if present
        if facility.get('distance_miles') is not None:
            facility['distance_miles'] = round(facility['distance_miles'], 1)
        facility["score"] = build_score_object(facility)
        facilities.append(facility)

    return {
        "success": True,
        "data": facilities,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/compare")
async def compare_facilities(
    db: Session = Depends(get_db),
    ids: str = Query(..., description="Comma-separated facility UUIDs (max 5)")
):
    """Compare up to 5 facilities side-by-side with all indices"""

    id_list = [id.strip() for id in ids.split(",") if id.strip()]

    if len(id_list) == 0:
        raise HTTPException(status_code=400, detail="At least one facility ID required")
    if len(id_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 facilities for comparison")

    # Build score columns
    score_cols = ", ".join([
        f"fs.{idx}, fs.{weighted}"
        for idx, weighted, _ in SCORE_INDICES
    ])

    placeholders = ", ".join([f":id_{i}" for i in range(len(id_list))])
    params = {f"id_{i}": id_list[i] for i in range(len(id_list))}

    query = f"""
        SELECT
            f.id, f.name, f.city, f.state, f.region, f.system_name,
            f.facility_type, f.bed_count,
            fs.ofs_score, fs.ofs_grade, fs.indices_available,
            {score_cols},
            (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as job_count
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.id IN ({placeholders})
    """

    result = db.execute(text(query), params)
    facilities = []

    for row in result:
        facility = dict(row._mapping)
        facility["score"] = build_score_object(facility)
        facilities.append(facility)

    # Find best in each category
    best_in = {}
    for idx_key in INDEX_NAMES.keys():
        best_score = -1
        best_id = None
        for f in facilities:
            if f.get("score") and f["score"]["indices"].get(idx_key):
                score = f["score"]["indices"][idx_key].get("score") or 0
                if score > best_score:
                    best_score = score
                    best_id = f["id"]
        if best_id:
            best_in[idx_key] = best_id

    # Best overall
    best_ofs = -1
    best_overall = None
    for f in facilities:
        if f.get("score") and (f["score"]["ofs_score"] or 0) > best_ofs:
            best_ofs = f["score"]["ofs_score"]
            best_overall = f["id"]
    best_in["overall"] = best_overall

    return {
        "success": True,
        "data": {
            "facilities": facilities,
            "best_in": best_in
        }
    }


@router.get("/regions")
async def get_regions(db: Session = Depends(get_db)):
    """Get list of canonical region names"""
    # Return canonical region names instead of raw DB values
    regions = get_canonical_regions()
    return {"success": True, "data": regions}


@router.get("/systems")
async def get_systems(db: Session = Depends(get_db)):
    """Get list of unique health systems"""
    query = "SELECT DISTINCT system_name FROM facilities WHERE system_name IS NOT NULL ORDER BY system_name"
    result = db.execute(text(query))
    systems = [row[0] for row in result]
    return {"success": True, "data": systems}


@router.get("/stats")
async def get_facility_stats(db: Session = Depends(get_db)):
    """Get facility statistics including total count and scored count"""
    result = db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE fs.ofs_score IS NOT NULL) as scored_count
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
    """)).first()

    return {
        "success": True,
        "data": {
            "total": result.total,
            "scored_count": result.scored_count
        }
    }


@router.get("/names")
async def get_facility_names(db: Session = Depends(get_db)):
    """Get list of all facility names with IDs for dropdown filters"""
    query = """
        SELECT id, name, city
        FROM facilities
        ORDER BY name ASC
    """
    result = db.execute(text(query))
    facilities = [{"id": str(row.id), "name": row.name, "city": row.city} for row in result]
    return {"success": True, "data": facilities}


@router.get("/{facility_id}")
async def get_facility(facility_id: str, db: Session = Depends(get_db)):
    """Get single facility with all scores and demographics"""
    # Validate UUID format
    try:
        uuid.UUID(facility_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid facility ID format")

    # Build score columns
    score_cols = ", ".join([
        f"fs.{idx}, fs.{weighted}"
        for idx, weighted, _ in SCORE_INDICES
    ])

    # Note: facility_demographics table may not exist, so we don't join it
    query = f"""
        SELECT
            f.*,
            fs.ofs_score, fs.ofs_grade, fs.indices_available, fs.calculation_notes,
            {score_cols}
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.id = :facility_id
    """

    result = db.execute(text(query), {"facility_id": facility_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Facility not found")

    facility = dict(result._mapping)

    # Extract calculation notes before building score object
    calculation_notes = facility.pop("calculation_notes", None)

    # Build score object
    facility["score"] = build_score_object(facility)
    if facility["score"]:
        facility["score"]["calculation_notes"] = calculation_notes

    # Demographics - set to None since table doesn't exist yet
    facility["demographics"] = None

    return {
        "success": True,
        "data": facility
    }


@router.get("/{facility_id}/transparency")
async def get_facility_transparency(facility_id: str, db: Session = Depends(get_db)):
    """Get Job Transparency Index (JTI) details for a facility"""

    # Get facility JTI score with component breakdowns
    score_query = """
        SELECT fs.jti_score, fs.jti_weighted,
               fs.jti_pay_disclosed_pct, fs.jti_benefits_disclosed_pct,
               fs.jti_bonus_disclosed_pct, fs.jti_shift_clear_pct
        FROM facility_scores fs
        WHERE fs.facility_id = :facility_id
    """
    score_result = db.execute(text(score_query), {"facility_id": facility_id}).first()

    # Get total jobs count
    jobs_query = """
        SELECT COUNT(*) as total_jobs
        FROM jobs
        WHERE facility_id = :facility_id AND is_active = true
    """
    jobs_result = db.execute(text(jobs_query), {"facility_id": facility_id}).first()

    # Get regional comparison
    region_query = """
        SELECT
            AVG(fs.jti_score) as region_avg,
            f.region
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.region = (SELECT region FROM facilities WHERE id = :facility_id)
        AND fs.jti_score IS NOT NULL
        GROUP BY f.region
    """
    region_result = db.execute(text(region_query), {"facility_id": facility_id}).first()

    jti_score = score_result.jti_score if score_result else None
    region_avg = float(region_result.region_avg) if region_result and region_result.region_avg else None

    # Calculate grade
    def score_to_grade(score):
        if score is None:
            return None
        if score >= 90:
            return "A"
        if score >= 80:
            return "B"
        if score >= 70:
            return "C"
        if score >= 60:
            return "D"
        return "F"

    return {
        "success": True,
        "data": {
            "jti_score": jti_score,
            "jti_grade": score_to_grade(jti_score),
            "jobs_analyzed": jobs_result.total_jobs if jobs_result else 0,
            "breakdown": {
                "pay_disclosure_rate": round(float(score_result.jti_pay_disclosed_pct or 0), 1) if score_result else 0,
                "benefits_disclosure_rate": round(float(score_result.jti_benefits_disclosed_pct or 0), 1) if score_result else 0,
                "bonus_disclosure_rate": round(float(score_result.jti_bonus_disclosed_pct or 0), 1) if score_result else 0,
                "shift_clarity_rate": round(float(score_result.jti_shift_clear_pct or 0), 1) if score_result else 0,
            },
            "comparison": {
                "region": region_result.region if region_result else None,
                "region_average": round(region_avg, 1) if region_avg else None,
                "vs_region": round(jti_score - region_avg, 1) if jti_score and region_avg else None
            }
        }
    }


@router.get("/{facility_id}/jobs")
async def get_facility_jobs(facility_id: str, db: Session = Depends(get_db)):
    """Get all active jobs for a facility"""

    query = """
        SELECT
            id, title, nursing_type, specialty, employment_type,
            shift_type, shift_hours, city, state,
            pay_min, pay_max, pay_disclosed, posted_at
        FROM jobs
        WHERE facility_id = :facility_id AND is_active = true
        ORDER BY posted_at DESC NULLS LAST
    """

    result = db.execute(text(query), {"facility_id": facility_id})
    jobs = [dict(row._mapping) for row in result]

    return {
        "success": True,
        "data": jobs
    }


@router.get("/{facility_id}/analytics")
async def get_facility_analytics(facility_id: str, db: Session = Depends(get_db)):
    """Get comprehensive analytics data for a facility (Premium/Pro feature)"""

    # Validate UUID format
    try:
        uuid.UUID(facility_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid facility ID format")

    # Get basic facility info
    facility_query = """
        SELECT f.name, f.city, f.state, f.region, f.zip_code, f.system_name,
               f.facility_type, f.bed_count,
               fs.ofs_score, fs.ofs_grade, fs.indices_available,
               fs.pci_score, fs.eri_score, fs.lssi_score, fs.pei_score,
               fs.fsi_score, fs.cmsi_score, fs.ali_score, fs.jti_score,
               fs.lsi_score, fs.csi_score, fs.qli_score, fs.oii_score, fs.cci_score
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.id = :facility_id
    """
    facility = db.execute(text(facility_query), {"facility_id": facility_id}).first()

    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    facility_dict = dict(facility._mapping)

    # Build indices object
    indices = {}
    for idx_key, name in INDEX_NAMES.items():
        score_col = f"{idx_key}_score"
        if score_col in facility_dict:
            indices[idx_key] = {
                "score": facility_dict.get(score_col),
                "name": name
            }

    # Get pay comparison data
    pay_query = """
        SELECT
            AVG(CASE WHEN pay_min > 0 THEN pay_min END) as facility_avg,
            (SELECT AVG(pay_min) FROM jobs j2
             JOIN facilities f2 ON j2.facility_id = f2.id
             WHERE f2.region = (SELECT region FROM facilities WHERE id = :facility_id)
             AND j2.pay_min > 0 AND j2.is_active = true) as regional_avg,
            (SELECT AVG(pay_min) FROM jobs j3
             WHERE j3.pay_min > 0 AND j3.is_active = true) as state_avg
        FROM jobs
        WHERE facility_id = :facility_id AND pay_min > 0 AND is_active = true
    """
    pay_result = db.execute(text(pay_query), {"facility_id": facility_id}).first()

    # Get pay by nursing type
    pay_by_type_query = """
        SELECT nursing_type, AVG(pay_min) as avg_hourly, COUNT(*) as job_count
        FROM jobs
        WHERE facility_id = :facility_id AND pay_min > 0 AND is_active = true
        GROUP BY nursing_type
        ORDER BY job_count DESC
    """
    pay_by_type = db.execute(text(pay_by_type_query), {"facility_id": facility_id}).fetchall()

    # Get job market stats
    job_market_query = """
        SELECT
            COUNT(*) as total_active_jobs,
            SUM(CASE WHEN pay_disclosed = true THEN 1 ELSE 0 END) as jobs_with_pay_disclosed,
            SUM(CASE WHEN sign_on_bonus > 0 THEN 1 ELSE 0 END) as jobs_with_bonus
        FROM jobs
        WHERE facility_id = :facility_id AND is_active = true
    """
    job_market = db.execute(text(job_market_query), {"facility_id": facility_id}).first()

    # Get specialty breakdown
    specialty_query = """
        SELECT specialty, COUNT(*) as count
        FROM jobs
        WHERE facility_id = :facility_id AND is_active = true AND specialty IS NOT NULL
        GROUP BY specialty
        ORDER BY count DESC
        LIMIT 10
    """
    specialties = db.execute(text(specialty_query), {"facility_id": facility_id}).fetchall()

    # Get transparency data
    transparency_query = """
        SELECT
            fs.jti_pay_disclosed_pct as pay_disclosure_rate,
            fs.jti_benefits_disclosed_pct as benefits_disclosure_rate,
            fs.jti_bonus_disclosed_pct as bonus_disclosure_rate,
            fs.jti_shift_clear_pct as shift_clarity_rate
        FROM facility_scores fs
        WHERE fs.facility_id = :facility_id
    """
    transparency = db.execute(text(transparency_query), {"facility_id": facility_id}).first()

    # Get CMS quality ratings (nursing homes) - joined by matching name and city
    cms_query = """
        SELECT cms.overall_rating, cms.health_inspection_rating, cms.staffing_rating,
               cms.qm_rating as quality_measure_rating, cms.abuse_icon
        FROM cms_nursing_home_ratings cms
        JOIN facilities f ON LOWER(cms.provider_name) = LOWER(f.name)
                         AND LOWER(cms.city) = LOWER(f.city)
        WHERE f.id = :facility_id
    """
    try:
        cms = db.execute(text(cms_query), {"facility_id": facility_id}).first()
    except Exception:
        cms = None

    # Get Leapfrog safety grade (hospitals) - from facility_scores
    leapfrog_query = """
        SELECT leapfrog_grade as safety_grade
        FROM facility_scores
        WHERE facility_id = :facility_id
    """
    try:
        leapfrog = db.execute(text(leapfrog_query), {"facility_id": facility_id}).first()
    except Exception:
        leapfrog = None

    # Get BLS market wages - use soc_title for occupation, filter for VA nursing occupations
    bls_query = """
        SELECT soc_title as occupation, hourly_25th, hourly_median, hourly_75th, hourly_90th, area_name
        FROM bls_wage_data
        WHERE area_name LIKE '%Virginia%' OR area_name LIKE 'VA%'
        ORDER BY soc_title
        LIMIT 10
    """
    try:
        bls_wages = db.execute(text(bls_query)).fetchall()
    except Exception:
        bls_wages = []

    # Get HCAHPS patient satisfaction - joined by facility name and city
    hcahps_query = """
        SELECT h.overall_star_rating as star_rating,
               h.nurse_communication_pct as nurse_communication,
               h.doctor_communication_pct as doctor_communication,
               h.staff_responsiveness_pct as staff_responsiveness,
               h.cleanliness_pct as cleanliness,
               h.quietness_pct as quietness,
               h.discharge_info_pct as discharge_info,
               h.overall_rating_9_10_pct as overall_rating_9_10,
               h.would_recommend_pct as would_recommend,
               h.number_of_surveys as surveys_completed
        FROM cms_hcahps_scores h
        JOIN facilities f ON LOWER(h.facility_name) = LOWER(f.name)
                         AND LOWER(h.city) = LOWER(f.city)
        WHERE f.id = :facility_id
    """
    try:
        hcahps = db.execute(text(hcahps_query), {"facility_id": facility_id}).first()
    except Exception:
        hcahps = None

    # Get housing costs
    housing_query = """
        SELECT median_rent, median_home_value, rent_burden_pct, median_income, area
        FROM census_housing_data
        WHERE zip_code = (SELECT zip_code FROM facilities WHERE id = :facility_id)
    """
    try:
        housing = db.execute(text(housing_query), {"facility_id": facility_id}).first()
    except Exception:
        housing = None

    # Get compensation (sign-on bonus, travel)
    comp_query = """
        SELECT
            AVG(sign_on_bonus) FILTER (WHERE sign_on_bonus > 0) as avg_sign_on_bonus,
            COUNT(*) FILTER (WHERE sign_on_bonus > 0) as jobs_with_bonus,
            COUNT(*) FILTER (WHERE employment_type = 'travel') as travel_contracts
        FROM jobs
        WHERE facility_id = :facility_id AND is_active = true
    """
    try:
        comp = db.execute(text(comp_query), {"facility_id": facility_id}).first()
    except Exception:
        comp = None

    # Get amenities
    amenities_query = """
        SELECT restaurants, grocery_stores, gyms, parks, childcare,
               has_onsite_daycare, overall_score as overall, grade
        FROM facility_amenities
        WHERE facility_id = :facility_id
    """
    try:
        amenities = db.execute(text(amenities_query), {"facility_id": facility_id}).first()
    except Exception:
        amenities = None

    # Get commute data
    commute_query = """
        SELECT commute_score, commute_grade, congestion_ratio,
               day_shift_grade, night_shift_grade, am_rush_ratio
        FROM facility_commute_data
        WHERE facility_id = :facility_id
    """
    try:
        commute = db.execute(text(commute_query), {"facility_id": facility_id}).first()
    except Exception:
        commute = None

    # Get safety/crime data
    safety_query = """
        SELECT safety_grade, safety_score, violent_crime_rate, property_crime_rate,
               vs_state_violent, state_percentile
        FROM facility_crime_data
        WHERE facility_id = :facility_id
    """
    try:
        safety = db.execute(text(safety_query), {"facility_id": facility_id}).first()
    except Exception:
        safety = None

    # Build response
    response = {
        "region": facility_dict.get("region"),
        "score_summary": {
            "ofs_score": facility_dict.get("ofs_score"),
            "ofs_grade": facility_dict.get("ofs_grade"),
            "indices_available": facility_dict.get("indices_available"),
            "regional_rank": None  # TODO: Calculate
        },
        "indices": indices,
        "pay_comparison": {
            "facility_avg": float(pay_result.facility_avg) if pay_result and pay_result.facility_avg else None,
            "regional_avg": float(pay_result.regional_avg) if pay_result and pay_result.regional_avg else None,
            "state_avg": float(pay_result.state_avg) if pay_result and pay_result.state_avg else None,
            "by_nursing_type": [
                {"nursing_type": row.nursing_type, "avg_hourly": float(row.avg_hourly) if row.avg_hourly else None, "job_count": row.job_count}
                for row in pay_by_type
            ] if pay_by_type else []
        },
        "job_market": {
            "total_active_jobs": job_market.total_active_jobs if job_market else 0,
            "jobs_with_pay_disclosed": job_market.jobs_with_pay_disclosed if job_market else 0,
            "jobs_with_bonus": job_market.jobs_with_bonus if job_market else 0,
            "specialty_breakdown": [
                {"specialty": row.specialty, "count": row.count}
                for row in specialties
            ] if specialties else []
        },
        "transparency": {
            "pay_disclosure_rate": float(transparency.pay_disclosure_rate) if transparency and transparency.pay_disclosure_rate else 0,
            "benefits_disclosure_rate": float(transparency.benefits_disclosure_rate) if transparency and transparency.benefits_disclosure_rate else 0,
            "bonus_disclosure_rate": float(transparency.bonus_disclosure_rate) if transparency and transparency.bonus_disclosure_rate else 0,
            "shift_clarity_rate": float(transparency.shift_clarity_rate) if transparency and transparency.shift_clarity_rate else 0,
        } if transparency else None,
        "quality_ratings": {
            "cms": {
                "overall_rating": cms.overall_rating,
                "health_inspection_rating": cms.health_inspection_rating,
                "staffing_rating": cms.staffing_rating,
                "quality_measure_rating": cms.quality_measure_rating,
                "abuse_icon": cms.abuse_icon,
            } if cms else None,
            "leapfrog": {
                "safety_grade": leapfrog.safety_grade,
                "grade_period": "Fall 2024"
            } if leapfrog and leapfrog.safety_grade else None
        },
        "bls_market_wages": {
            "state_wages": [
                {
                    "occupation": row.occupation,
                    "hourly_25th": float(row.hourly_25th) if row.hourly_25th else None,
                    "hourly_median": float(row.hourly_median) if row.hourly_median else None,
                    "hourly_75th": float(row.hourly_75th) if row.hourly_75th else None,
                    "hourly_90th": float(row.hourly_90th) if row.hourly_90th else None,
                }
                for row in bls_wages
            ] if bls_wages else [],
            "metro_wages": [],  # TODO: Add metro-specific data
            "metro_area": None
        },
        "patient_satisfaction": {
            "star_rating": hcahps.star_rating,
            "nurse_communication": hcahps.nurse_communication,
            "doctor_communication": hcahps.doctor_communication,
            "staff_responsiveness": hcahps.staff_responsiveness,
            "cleanliness": hcahps.cleanliness,
            "quietness": hcahps.quietness,
            "discharge_info": hcahps.discharge_info,
            "overall_rating_9_10": hcahps.overall_rating_9_10,
            "would_recommend": hcahps.would_recommend,
            "surveys_completed": hcahps.surveys_completed,
        } if hcahps else None,
        "housing_costs": {
            "median_rent": housing.median_rent,
            "median_home_value": housing.median_home_value,
            "rent_burden_pct": float(housing.rent_burden_pct) if housing and housing.rent_burden_pct else None,
            "median_income": housing.median_income,
            "area": housing.area,
        } if housing else None,
        "compensation": {
            "avg_sign_on_bonus": float(comp.avg_sign_on_bonus) if comp and comp.avg_sign_on_bonus else None,
            "jobs_with_bonus": comp.jobs_with_bonus if comp else 0,
            "travel_contracts": comp.travel_contracts if comp else 0,
        } if comp else None,
        "amenities": {
            "restaurants": amenities.restaurants,
            "grocery_stores": amenities.grocery_stores,
            "gyms": amenities.gyms,
            "parks": amenities.parks,
            "childcare": amenities.childcare,
            "has_onsite_daycare": amenities.has_onsite_daycare,
            "scores": {
                "overall": amenities.overall,
                "grade": amenities.grade
            }
        } if amenities else None,
        "commute": {
            "commute_score": commute.commute_score,
            "commute_grade": commute.commute_grade,
            "congestion_ratio": float(commute.congestion_ratio) if commute and commute.congestion_ratio else None,
            "day_shift_grade": commute.day_shift_grade,
            "night_shift_grade": commute.night_shift_grade,
            "am_rush_ratio": float(commute.am_rush_ratio) if commute and commute.am_rush_ratio else None,
        } if commute else None,
        "safety": {
            "safety_grade": safety.safety_grade,
            "safety_score": safety.safety_score,
            "violent_crime_rate": float(safety.violent_crime_rate) if safety and safety.violent_crime_rate else None,
            "property_crime_rate": float(safety.property_crime_rate) if safety and safety.property_crime_rate else None,
            "vs_state_violent": float(safety.vs_state_violent) if safety and safety.vs_state_violent else None,
            "state_percentile": safety.state_percentile,
        } if safety else None,
        "facility_stats": {
            "total_beds": facility_dict.get("bed_count"),
            "ownership_type": None,  # TODO: Add to facilities table
            "is_teaching": None,  # Column doesn't exist yet
            "hospital_type": facility_dict.get("facility_type"),
            "has_emergency": None,  # TODO: Add to facilities table
        }
    }

    return {
        "success": True,
        "data": response
    }
