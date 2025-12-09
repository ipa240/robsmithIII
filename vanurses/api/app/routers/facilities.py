"""Facilities API endpoints"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
from ..database import get_db

router = APIRouter(prefix="/api/facilities", tags=["facilities"])

# All 10 scoring indices with weights (total 100%)
# Note: JTI column may not exist yet - handled gracefully in queries
SCORE_INDICES = [
    ("pci_score", "pci_weighted", 17),   # Pay Competitiveness Index
    ("eri_score", "eri_weighted", 14),   # Employee Reviews Index
    ("lssi_score", "lssi_weighted", 12), # Location Safety Index
    ("pei_score", "pei_weighted", 11),   # Patient Experience Index
    ("fsi_score", "fsi_weighted", 11),   # Facility Statistics Index
    ("ali_score", "ali_weighted", 9),    # Amenities & Lifestyle Index
    ("csi_score", "csi_weighted", 7),    # Commute Stress Index
    ("qli_score", "qli_weighted", 7),    # Quality of Life Index
    ("cci_score", "cci_weighted", 4),    # Climate Comfort Index
]

# JTI is handled separately as it may not exist yet (requires migration)
JTI_INDEX = ("jti_score", "jti_weighted", 8)  # Job Transparency Index

# Index names for human display
INDEX_NAMES = {
    "pci": "Pay Competitiveness",
    "eri": "Employee Reviews",
    "lssi": "Location Safety",
    "pei": "Patient Experience",
    "fsi": "Facility Statistics",
    "ali": "Amenities & Lifestyle",
    "jti": "Job Transparency",
    "csi": "Commute Stress",
    "qli": "Quality of Life",
    "cci": "Climate Comfort",
}


def build_score_object(row_dict: dict) -> Optional[dict]:
    """Extract and structure score data from a facility row"""
    if not row_dict.get("ofs_score"):
        # Remove all score fields and return None
        for idx, weighted, _ in SCORE_INDICES:
            row_dict.pop(idx, None)
            row_dict.pop(weighted, None)
        # Also remove JTI if present
        row_dict.pop("jti_score", None)
        row_dict.pop("jti_weighted", None)
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

    # Add JTI - may not exist in DB yet (requires migration)
    jti_score = row_dict.pop("jti_score", None)
    jti_weighted = row_dict.pop("jti_weighted", None)
    score["indices"]["jti"] = {
        "score": jti_score,
        "weighted": float(jti_weighted or 0),
        "weight_pct": 8,
        "name": "Job Transparency"
    }

    return score


@router.get("")
async def list_facilities(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    region: Optional[str] = None,
    system: Optional[str] = None,
    min_grade: Optional[str] = None,
):
    """Get paginated list of facilities with all scoring indices"""

    where_clauses = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if search:
        where_clauses.append("(f.name ILIKE :search OR f.system_name ILIKE :search)")
        params["search"] = f"%{search}%"

    if region:
        where_clauses.append("f.region = :region")
        params["region"] = region

    if system:
        where_clauses.append("f.system_name = :system")
        params["system"] = system

    if min_grade:
        grade_order = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
        min_val = grade_order.get(min_grade.upper()[0], 0)
        if min_val > 0:
            where_clauses.append("""
                CASE
                    WHEN fs.ofs_grade LIKE 'A%' THEN 5
                    WHEN fs.ofs_grade LIKE 'B%' THEN 4
                    WHEN fs.ofs_grade LIKE 'C%' THEN 3
                    WHEN fs.ofs_grade LIKE 'D%' THEN 2
                    WHEN fs.ofs_grade LIKE 'F%' THEN 1
                    ELSE 0
                END >= :min_grade_val
            """)
            params["min_grade_val"] = min_val

    where_sql = " AND ".join(where_clauses)

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
        FROM facilities f
        LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE {where_sql}
        ORDER BY fs.ofs_score DESC NULLS LAST, f.name ASC
        LIMIT :limit OFFSET :offset
    """

    result = db.execute(text(query), params)
    facilities = []

    for row in result:
        facility = dict(row._mapping)
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
    """Get list of unique regions"""
    query = "SELECT DISTINCT region FROM facilities WHERE region IS NOT NULL ORDER BY region"
    result = db.execute(text(query))
    regions = [row[0] for row in result]
    return {"success": True, "data": regions}


@router.get("/systems")
async def get_systems(db: Session = Depends(get_db)):
    """Get list of unique health systems"""
    query = "SELECT DISTINCT system_name FROM facilities WHERE system_name IS NOT NULL ORDER BY system_name"
    result = db.execute(text(query))
    systems = [row[0] for row in result]
    return {"success": True, "data": systems}


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
