"""Stats API endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db

router = APIRouter(prefix="/api", tags=["stats"])


def to_title_case(s: str) -> str:
    """Convert underscore/hyphen separated string to Title Case"""
    if not s:
        return s
    # Replace underscores and hyphens with spaces, then title case
    return s.replace('_', ' ').replace('-', ' ').title()


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get overall site statistics"""

    # Active jobs count
    jobs_count = db.execute(text(
        "SELECT COUNT(*) FROM jobs WHERE is_active = true"
    )).scalar()

    # Facilities count
    facilities_count = db.execute(text(
        "SELECT COUNT(*) FROM facilities"
    )).scalar()

    # Jobs by nursing type
    nursing_types = db.execute(text("""
        SELECT nursing_type, COUNT(*) as count
        FROM jobs
        WHERE is_active = true AND nursing_type IS NOT NULL
        GROUP BY nursing_type
        ORDER BY count DESC
    """))
    jobs_by_nursing_type = [{"type": r[0], "count": r[1]} for r in nursing_types]

    # Jobs by specialty (top 10)
    specialties = db.execute(text("""
        SELECT specialty, COUNT(*) as count
        FROM jobs
        WHERE is_active = true AND specialty IS NOT NULL
        GROUP BY specialty
        ORDER BY count DESC
        LIMIT 10
    """))
    jobs_by_specialty = [{"specialty": r[0], "count": r[1]} for r in specialties]

    # Jobs by region
    regions = db.execute(text("""
        SELECT f.region, COUNT(*) as count
        FROM jobs j
        JOIN facilities f ON j.facility_id = f.id
        WHERE j.is_active = true AND f.region IS NOT NULL
        GROUP BY f.region
        ORDER BY count DESC
    """))
    jobs_by_region = [{"region": r[0], "count": r[1]} for r in regions]

    # Jobs by employment type
    employment = db.execute(text("""
        SELECT employment_type, COUNT(*) as count
        FROM jobs
        WHERE is_active = true AND employment_type IS NOT NULL
        GROUP BY employment_type
        ORDER BY count DESC
    """))
    jobs_by_employment = [{"type": r[0], "count": r[1]} for r in employment]

    return {
        "success": True,
        "data": {
            "total_jobs": jobs_count,
            "total_facilities": facilities_count,
            "jobs_by_nursing_type": jobs_by_nursing_type,
            "jobs_by_specialty": jobs_by_specialty,
            "jobs_by_region": jobs_by_region,
            "jobs_by_employment_type": jobs_by_employment
        }
    }


@router.get("/filters")
async def get_filters(db: Session = Depends(get_db)):
    """Get available filter options"""

    # Unique values for each filter
    nursing_types = db.execute(text("""
        SELECT DISTINCT nursing_type FROM jobs
        WHERE is_active = true AND nursing_type IS NOT NULL
        ORDER BY nursing_type
    """))

    specialties = db.execute(text("""
        SELECT DISTINCT specialty FROM jobs
        WHERE is_active = true AND specialty IS NOT NULL
        ORDER BY specialty
    """))

    employment_types = db.execute(text("""
        SELECT DISTINCT employment_type FROM jobs
        WHERE is_active = true AND employment_type IS NOT NULL
        ORDER BY employment_type
    """))

    shift_types = db.execute(text("""
        SELECT DISTINCT shift_type FROM jobs
        WHERE is_active = true AND shift_type IS NOT NULL
        ORDER BY shift_type
    """))

    cities = db.execute(text("""
        SELECT DISTINCT city FROM jobs
        WHERE is_active = true AND city IS NOT NULL
        ORDER BY city
    """))

    regions = db.execute(text("""
        SELECT DISTINCT region FROM facilities
        WHERE region IS NOT NULL
        ORDER BY region
    """))

    # NEW: Facility systems
    facility_systems = db.execute(text("""
        SELECT DISTINCT system_name FROM facilities
        WHERE system_name IS NOT NULL
        ORDER BY system_name
    """))

    return {
        "success": True,
        "data": {
            "nursing_types": [r[0].upper() for r in nursing_types if r[0]],
            "specialties": [r[0] for r in specialties if r[0]],
            "employment_types": [r[0] for r in employment_types if r[0]],
            "shift_types": [r[0] for r in shift_types if r[0]],
            "cities": [r[0] for r in cities if r[0]],
            "regions": [r[0] for r in regions if r[0]],
            "facility_systems": [r[0] for r in facility_systems if r[0]],
            "ofs_grades": ["A", "B", "C", "D", "F"],
            "posted_within_options": [
                {"value": 1, "label": "Last 24 hours"},
                {"value": 7, "label": "Last 7 days"},
                {"value": 30, "label": "Last 30 days"},
            ]
        }
    }


@router.get("/stats/scoring")
async def get_scoring_stats(db: Session = Depends(get_db)):
    """Get scoring distribution statistics"""

    # Grade distribution - use subquery to allow ORDER BY on computed grade
    grade_dist = db.execute(text("""
        SELECT grade, SUM(cnt) as count FROM (
            SELECT
                CASE
                    WHEN fs.ofs_grade LIKE 'A%' THEN 'A'
                    WHEN fs.ofs_grade LIKE 'B%' THEN 'B'
                    WHEN fs.ofs_grade LIKE 'C%' THEN 'C'
                    WHEN fs.ofs_grade LIKE 'D%' THEN 'D'
                    WHEN fs.ofs_grade LIKE 'F%' THEN 'F'
                    ELSE 'Unscored'
                END as grade,
                1 as cnt
            FROM facilities f
            LEFT JOIN facility_scores fs ON f.id = fs.facility_id
        ) sub
        GROUP BY grade
        ORDER BY
            CASE grade
                WHEN 'A' THEN 1
                WHEN 'B' THEN 2
                WHEN 'C' THEN 3
                WHEN 'D' THEN 4
                WHEN 'F' THEN 5
                ELSE 6
            END
    """))
    grade_distribution = {r[0]: r[1] for r in grade_dist}

    # Average scores by region
    region_avg = db.execute(text("""
        SELECT
            f.region,
            ROUND(AVG(fs.ofs_score)::numeric, 1) as avg_score,
            COUNT(*) as facility_count
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.region IS NOT NULL AND fs.ofs_score IS NOT NULL
        GROUP BY f.region
        ORDER BY avg_score DESC
    """))
    by_region = [
        {"region": r[0], "avg_score": float(r[1]) if r[1] else None, "count": r[2]}
        for r in region_avg
    ]

    # Average scores by health system
    system_avg = db.execute(text("""
        SELECT
            f.system_name,
            ROUND(AVG(fs.ofs_score)::numeric, 1) as avg_score,
            COUNT(*) as facility_count
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE f.system_name IS NOT NULL AND fs.ofs_score IS NOT NULL
        GROUP BY f.system_name
        ORDER BY avg_score DESC
        LIMIT 20
    """))
    by_system = [
        {"system": r[0], "avg_score": float(r[1]) if r[1] else None, "count": r[2]}
        for r in system_avg
    ]

    # Score percentiles
    percentiles = db.execute(text("""
        SELECT
            percentile_cont(0.25) WITHIN GROUP (ORDER BY ofs_score) as p25,
            percentile_cont(0.50) WITHIN GROUP (ORDER BY ofs_score) as p50,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY ofs_score) as p75,
            percentile_cont(0.90) WITHIN GROUP (ORDER BY ofs_score) as p90,
            MIN(ofs_score) as min_score,
            MAX(ofs_score) as max_score,
            ROUND(AVG(ofs_score)::numeric, 1) as avg_score
        FROM facility_scores
        WHERE ofs_score IS NOT NULL
    """)).first()

    # Average by index
    index_avg = db.execute(text("""
        SELECT
            ROUND(AVG(pci_score)::numeric, 1) as pci_avg,
            ROUND(AVG(eri_score)::numeric, 1) as eri_avg,
            ROUND(AVG(lssi_score)::numeric, 1) as lssi_avg,
            ROUND(AVG(pei_score)::numeric, 1) as pei_avg,
            ROUND(AVG(fsi_score)::numeric, 1) as fsi_avg,
            ROUND(AVG(ali_score)::numeric, 1) as ali_avg,
            ROUND(AVG(csi_score)::numeric, 1) as csi_avg,
            ROUND(AVG(qli_score)::numeric, 1) as qli_avg,
            ROUND(AVG(cci_score)::numeric, 1) as cci_avg
        FROM facility_scores
    """)).first()

    return {
        "success": True,
        "data": {
            "grade_distribution": grade_distribution,
            "by_region": by_region,
            "by_system": by_system,
            "percentiles": {
                "p25": float(percentiles.p25) if percentiles and percentiles.p25 else None,
                "p50": float(percentiles.p50) if percentiles and percentiles.p50 else None,
                "p75": float(percentiles.p75) if percentiles and percentiles.p75 else None,
                "p90": float(percentiles.p90) if percentiles and percentiles.p90 else None,
                "min": percentiles.min_score if percentiles else None,
                "max": percentiles.max_score if percentiles else None,
                "avg": float(percentiles.avg_score) if percentiles and percentiles.avg_score else None,
            },
            "index_averages": {
                "pci": float(index_avg.pci_avg) if index_avg and index_avg.pci_avg else None,
                "eri": float(index_avg.eri_avg) if index_avg and index_avg.eri_avg else None,
                "lssi": float(index_avg.lssi_avg) if index_avg and index_avg.lssi_avg else None,
                "pei": float(index_avg.pei_avg) if index_avg and index_avg.pei_avg else None,
                "fsi": float(index_avg.fsi_avg) if index_avg and index_avg.fsi_avg else None,
                "ali": float(index_avg.ali_avg) if index_avg and index_avg.ali_avg else None,
                "csi": float(index_avg.csi_avg) if index_avg and index_avg.csi_avg else None,
                "qli": float(index_avg.qli_avg) if index_avg and index_avg.qli_avg else None,
                "cci": float(index_avg.cci_avg) if index_avg and index_avg.cci_avg else None,
            }
        }
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "vanurses-api"}
