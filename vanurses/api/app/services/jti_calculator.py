"""
Job Transparency Index (JTI) Calculator

Calculates transparency score for each facility based on how well their 
job postings disclose important information that job seekers care about.

JTI Formula:
- Pay Disclosure: 40% weight (pay_min or pay_max present)
- Benefits Disclosure: 25% weight (has any benefits info)
- Sign-on Bonus Disclosure: 15% weight (sign_on_bonus field not null)
- Shift Requirements Clarity: 20% weight (shift_type and shift_hours present)
"""

import logging
from typing import Dict, Any, Optional
from databases import Database

logger = logging.getLogger(__name__)

# JTI Component Weights
WEIGHTS = {
    "pay": 0.40,
    "benefits": 0.25,
    "bonus": 0.15,
    "shift": 0.20
}


async def calculate_facility_jti(db: Database, facility_id: str) -> Optional[Dict[str, Any]]:
    """Calculate JTI for a single facility based on its active jobs."""
    
    # Get job transparency metrics for this facility
    # benefits is a text array, use cardinality to check if non-empty
    query = """
    SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE pay_min IS NOT NULL OR pay_max IS NOT NULL) as pay_disclosed,
        COUNT(*) FILTER (WHERE benefits IS NOT NULL AND cardinality(benefits) > 0) as benefits_disclosed,
        COUNT(*) FILTER (WHERE sign_on_bonus IS NOT NULL AND sign_on_bonus > 0) as bonus_disclosed,
        COUNT(*) FILTER (WHERE shift_type IS NOT NULL AND length(shift_type) > 0 AND shift_hours IS NOT NULL) as shift_clear
    FROM jobs
    WHERE facility_id = :facility_id 
    AND is_active = TRUE
    """
    
    result = await db.fetch_one(query=query, values={"facility_id": facility_id})
    
    if not result or result.total_jobs == 0:
        return None
    
    total = result.total_jobs
    
    # Calculate percentages
    pay_pct = (result.pay_disclosed / total) * 100
    benefits_pct = (result.benefits_disclosed / total) * 100
    bonus_pct = (result.bonus_disclosed / total) * 100
    shift_pct = (result.shift_clear / total) * 100
    
    # Calculate weighted JTI score (0-100)
    jti_score = round(
        (pay_pct * WEIGHTS["pay"]) +
        (benefits_pct * WEIGHTS["benefits"]) +
        (bonus_pct * WEIGHTS["bonus"]) +
        (shift_pct * WEIGHTS["shift"])
    )
    
    return {
        "jti_score": min(100, max(0, jti_score)),  # Clamp to 0-100
        "jti_pay_disclosed_pct": round(pay_pct, 2),
        "jti_benefits_disclosed_pct": round(benefits_pct, 2),
        "jti_bonus_disclosed_pct": round(bonus_pct, 2),
        "jti_shift_clear_pct": round(shift_pct, 2),
        "total_jobs_analyzed": total
    }


async def update_facility_jti(db: Database, facility_id: str) -> bool:
    """Calculate and store JTI for a facility."""
    
    jti_data = await calculate_facility_jti(db, facility_id)
    
    if not jti_data:
        logger.debug(f"No active jobs for facility {facility_id}, skipping JTI")
        return False
    
    # Check if facility_scores row exists
    check_query = "SELECT 1 FROM facility_scores WHERE facility_id = :facility_id"
    exists = await db.fetch_one(query=check_query, values={"facility_id": facility_id})
    
    if exists:
        # Update existing row
        update_query = """
        UPDATE facility_scores SET
            jti_score = :jti_score,
            jti_pay_disclosed_pct = :pay_pct,
            jti_benefits_disclosed_pct = :benefits_pct,
            jti_bonus_disclosed_pct = :bonus_pct,
            jti_shift_clear_pct = :shift_pct,
            calculated_at = NOW()
        WHERE facility_id = :facility_id
        """
        await db.execute(query=update_query, values={
            "facility_id": facility_id,
            "jti_score": jti_data["jti_score"],
            "pay_pct": jti_data["jti_pay_disclosed_pct"],
            "benefits_pct": jti_data["jti_benefits_disclosed_pct"],
            "bonus_pct": jti_data["jti_bonus_disclosed_pct"],
            "shift_pct": jti_data["jti_shift_clear_pct"]
        })
    else:
        # Insert new row with just JTI data
        insert_query = """
        INSERT INTO facility_scores (
            facility_id, jti_score, 
            jti_pay_disclosed_pct, jti_benefits_disclosed_pct,
            jti_bonus_disclosed_pct, jti_shift_clear_pct,
            calculated_at
        ) VALUES (
            :facility_id, :jti_score,
            :pay_pct, :benefits_pct,
            :bonus_pct, :shift_pct,
            NOW()
        )
        """
        await db.execute(query=insert_query, values={
            "facility_id": facility_id,
            "jti_score": jti_data["jti_score"],
            "pay_pct": jti_data["jti_pay_disclosed_pct"],
            "benefits_pct": jti_data["jti_benefits_disclosed_pct"],
            "bonus_pct": jti_data["jti_bonus_disclosed_pct"],
            "shift_pct": jti_data["jti_shift_clear_pct"]
        })
    
    logger.info(f"Updated JTI for facility {facility_id}: {jti_data[jti_score]}")
    return True


async def recalculate_all_jti(db: Database) -> Dict[str, int]:
    """Recalculate JTI for all facilities with active jobs."""
    
    # Get all facilities with active jobs
    query = """
    SELECT DISTINCT facility_id 
    FROM jobs 
    WHERE is_active = TRUE AND facility_id IS NOT NULL
    """
    
    facilities = await db.fetch_all(query=query)
    
    updated = 0
    skipped = 0
    
    for row in facilities:
        success = await update_facility_jti(db, str(row.facility_id))
        if success:
            updated += 1
        else:
            skipped += 1
    
    logger.info(f"JTI recalculation complete: {updated} updated, {skipped} skipped")
    
    return {
        "updated": updated,
        "skipped": skipped,
        "total": len(facilities)
    }
