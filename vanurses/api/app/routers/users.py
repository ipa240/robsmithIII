"""Users API endpoints"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from ..database import get_db
from ..auth.zitadel import get_current_user, CurrentUser
from ..utils.normalizer import normalize_to_db, normalize_list_to_db, to_display, to_display_list
import uuid

router = APIRouter(prefix="/api", tags=["users"])


class UserProfile(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class UserPreferences(BaseModel):
    # License info
    license_type: Optional[str] = None
    license_state: Optional[str] = None
    compact_license: bool = False
    nclex_passed: Optional[bool] = None
    license_number: Optional[str] = None
    license_expires_at: Optional[str] = None

    # Experience
    years_experience: Optional[int] = None
    specialties: List[str] = []
    certifications: List[str] = []

    # Job preferences
    employment_types: List[str] = []
    shift_preferences: List[str] = []
    childcare_needs: Optional[str] = None

    # Location
    location_zip: Optional[str] = None

    # OFS Index priorities (1-5 scale)
    index_priorities: dict = {
        "pci": 3, "ali": 3, "csi": 3, "cci": 3,
        "lssi": 3, "qli": 3, "pei": 3, "fsi": 3
    }


def get_or_create_user(db: Session, zitadel_user: CurrentUser) -> dict:
    """Get user from DB or create if doesn't exist"""
    # First try to find by email (for existing users migrated to Zitadel)
    result = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": zitadel_user.email}
    ).first()

    if result:
        user = dict(result._mapping)
        # Update oauth_provider info if not set
        if not user.get("oauth_provider_id"):
            db.execute(
                text("""
                    UPDATE users SET
                        oauth_provider = 'zitadel',
                        oauth_provider_id = :oauth_id,
                        first_name = COALESCE(first_name, :first_name),
                        last_name = COALESCE(last_name, :last_name),
                        updated_at = NOW()
                    WHERE id = :user_id
                """),
                {
                    "user_id": user["id"],
                    "oauth_id": zitadel_user.zitadel_id,
                    "first_name": zitadel_user.given_name or None,
                    "last_name": zitadel_user.family_name or None
                }
            )
            db.commit()
            # Re-fetch updated user
            result = db.execute(
                text("SELECT * FROM users WHERE id = :id"),
                {"id": user["id"]}
            ).first()
            return dict(result._mapping)
        return user

    # Check by oauth_provider_id (for new Zitadel users)
    result = db.execute(
        text("SELECT * FROM users WHERE oauth_provider = 'zitadel' AND oauth_provider_id = :oauth_id"),
        {"oauth_id": zitadel_user.zitadel_id}
    ).first()

    if result:
        return dict(result._mapping)

    # Create new user
    user_id = str(uuid.uuid4())
    db.execute(
        text("""
            INSERT INTO users (id, email, first_name, last_name, oauth_provider, oauth_provider_id, email_verified)
            VALUES (:id, :email, :first_name, :last_name, 'zitadel', :oauth_id, :email_verified)
        """),
        {
            "id": user_id,
            "email": zitadel_user.email,
            "first_name": zitadel_user.given_name or None,
            "last_name": zitadel_user.family_name or None,
            "oauth_id": zitadel_user.zitadel_id,
            "email_verified": zitadel_user.email_verified
        }
    )
    db.commit()

    # Get the created user
    result = db.execute(
        text("SELECT * FROM users WHERE id = :id"),
        {"id": user_id}
    ).first()

    return dict(result._mapping)


@router.get("/me")
async def get_me(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get current user profile"""
    user = get_or_create_user(db, current_user)
    user["email_verified"] = current_user.email_verified

    return {"success": True, "data": user}


@router.patch("/me")
async def update_me(
    profile: UserProfile,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update current user profile"""
    user = get_or_create_user(db, current_user)

    db.execute(
        text("""
            UPDATE users SET
                first_name = COALESCE(:first_name, first_name),
                last_name = COALESCE(:last_name, last_name),
                updated_at = NOW()
            WHERE id = :user_id
        """),
        {
            "user_id": user["id"],
            "first_name": profile.first_name,
            "last_name": profile.last_name
        }
    )
    db.commit()

    return {"success": True, "message": "Profile updated"}


@router.get("/me/preferences")
async def get_preferences(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get user preferences (from users table + JSONB preferences column)

    Returns values in display format for the frontend.
    """
    user = get_or_create_user(db, current_user)

    # Combine data from users table columns and JSONB preferences
    prefs_json = user.get("preferences") or {}

    # Get raw values and convert to display format
    raw_specialties = user.get("specialties", []) or []
    raw_emp_types = prefs_json.get("employment_types", []) or []
    raw_shifts = prefs_json.get("shift_preferences", []) or []

    return {
        "success": True,
        "data": {
            # From users table columns
            "license_type": to_display(user.get("license_type") or "", "nursing_type") if user.get("license_type") else None,
            "license_state": user.get("license_state"),
            "compact_license": user.get("license_compact", False),
            "license_number": user.get("license_number"),
            "years_experience": user.get("years_experience"),
            "specialties": to_display_list(raw_specialties, "specialty"),

            # From JSONB preferences column
            "nclex_passed": prefs_json.get("nclex_passed"),
            "license_expires_at": prefs_json.get("license_expires_at"),
            "certifications": prefs_json.get("certifications", []),
            "employment_types": to_display_list(raw_emp_types, "employment_type"),
            "shift_preferences": to_display_list(raw_shifts, "shift_type"),
            "location_zip": prefs_json.get("location_zip"),
            "index_priorities": prefs_json.get("index_priorities", {
                "pci": 3, "ali": 3, "csi": 3, "cci": 3,
                "lssi": 3, "qli": 3, "pei": 3, "fsi": 3
            }),
            "preference_changes_count": prefs_json.get("preference_changes_count", 0)
        }
    }


class ExtendedProfile(BaseModel):
    """Extended profile for resume builder"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    license_type: Optional[str] = None
    license_state: Optional[str] = None
    license_number: Optional[str] = None
    license_expires_at: Optional[str] = None
    compact_license: bool = False
    certifications: List[str] = []
    years_experience: Optional[int] = None
    specialties: List[str] = []
    education: List[dict] = []
    work_history: List[dict] = []
    summary: Optional[str] = None
    skills: List[str] = []


@router.get("/me/profile")
async def get_full_profile(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get full profile for resume builder"""
    user = get_or_create_user(db, current_user)
    prefs_json = user.get("preferences") or {}
    profile_json = prefs_json.get("profile", {})

    # Get specialties and convert to display format
    raw_specialties = user.get("specialties") or []

    return {
        "first_name": user.get("first_name") or "",
        "last_name": user.get("last_name") or "",
        "email": user.get("email") or "",
        "phone": profile_json.get("phone", ""),
        "city": profile_json.get("city", ""),
        "state": profile_json.get("state", "VA"),
        "zip_code": profile_json.get("zip_code", ""),
        "license_type": to_display(user.get("license_type") or "", "nursing_type") if user.get("license_type") else "",
        "license_state": user.get("license_state") or "VA",
        "license_number": user.get("license_number") or "",
        "license_expires_at": prefs_json.get("license_expires_at", ""),
        "compact_license": user.get("license_compact", False),
        "certifications": prefs_json.get("certifications", []),
        "years_experience": user.get("years_experience") or 0,
        "specialties": to_display_list(raw_specialties, "specialty"),
        "education": profile_json.get("education", []),
        "work_history": profile_json.get("work_history", []),
        "summary": profile_json.get("summary", ""),
        "skills": profile_json.get("skills", [])
    }


@router.put("/me/profile")
async def update_full_profile(
    profile: ExtendedProfile,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update full profile for resume builder"""
    import json

    user = get_or_create_user(db, current_user)
    existing_prefs = user.get("preferences") or {}

    # Store extended profile fields in preferences.profile
    profile_data = {
        "phone": profile.phone,
        "city": profile.city,
        "state": profile.state,
        "zip_code": profile.zip_code,
        "education": profile.education,
        "work_history": profile.work_history,
        "summary": profile.summary,
        "skills": profile.skills
    }

    # Merge with existing preferences
    existing_prefs["profile"] = profile_data
    existing_prefs["certifications"] = profile.certifications
    existing_prefs["license_expires_at"] = profile.license_expires_at

    # NORMALIZE specialties before saving
    normalized_specialties = normalize_list_to_db(profile.specialties, "specialty")
    # NORMALIZE license_type before saving
    normalized_license_type = normalize_to_db(profile.license_type, "nursing_type") if profile.license_type else None

    # Update users table and preferences JSON
    db.execute(
        text("""
            UPDATE users SET
                first_name = :first_name,
                last_name = :last_name,
                license_type = :license_type,
                license_state = :license_state,
                license_number = :license_number,
                license_compact = :compact_license,
                years_experience = :years_experience,
                specialties = :specialties,
                preferences = CAST(:preferences AS jsonb),
                updated_at = NOW()
            WHERE id = :user_id
        """),
        {
            "user_id": user["id"],
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "license_type": normalized_license_type,
            "license_state": profile.license_state,
            "license_number": profile.license_number,
            "compact_license": profile.compact_license,
            "years_experience": profile.years_experience,
            "specialties": normalized_specialties,
            "preferences": json.dumps(existing_prefs)
        }
    )
    db.commit()

    return {"success": True, "message": "Profile updated"}


@router.put("/me/preferences")
async def update_preferences(
    preferences: UserPreferences,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update user preferences (saves to users table + JSONB preferences column)

    Accepts values in ANY format (display or database format).
    All values are normalized to database format before saving.
    """
    import json

    user = get_or_create_user(db, current_user)

    # NORMALIZE all list fields before saving
    normalized_specialties = normalize_list_to_db(preferences.specialties, "specialty")
    normalized_employment_types = normalize_list_to_db(preferences.employment_types, "employment_type")
    normalized_shift_preferences = normalize_list_to_db(preferences.shift_preferences, "shift_type")
    normalized_license_type = normalize_to_db(preferences.license_type, "nursing_type") if preferences.license_type else None

    # Build JSONB preferences object for new fields
    prefs_json = {
        "nclex_passed": preferences.nclex_passed,
        "license_expires_at": preferences.license_expires_at,
        "certifications": preferences.certifications,
        "employment_types": normalized_employment_types,  # NORMALIZED
        "shift_preferences": normalized_shift_preferences,  # NORMALIZED
        "childcare_needs": preferences.childcare_needs,
        "location_zip": preferences.location_zip,
        "index_priorities": preferences.index_priorities,
        "preference_changes_count": (user.get("preferences") or {}).get("preference_changes_count", 0)
    }

    # Update both table columns and JSONB preferences
    db.execute(
        text("""
            UPDATE users SET
                license_type = :license_type,
                license_state = :license_state,
                license_compact = :compact_license,
                license_number = :license_number,
                years_experience = :years_experience,
                specialties = :specialties,
                preferences = CAST(:preferences AS jsonb),
                updated_at = NOW()
            WHERE id = :user_id
        """),
        {
            "user_id": user["id"],
            "license_type": normalized_license_type,  # NORMALIZED
            "license_state": preferences.license_state,
            "compact_license": preferences.compact_license,
            "license_number": preferences.license_number,
            "years_experience": preferences.years_experience,
            "specialties": normalized_specialties,  # NORMALIZED
            "preferences": json.dumps(prefs_json)
        }
    )
    db.commit()

    return {"success": True, "message": "Preferences updated"}


@router.post("/me/onboarding/complete")
async def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Mark onboarding as complete"""
    user = get_or_create_user(db, current_user)

    db.execute(
        text("""
            UPDATE users
            SET onboarding_completed = true, updated_at = NOW()
            WHERE id = :user_id
        """),
        {"user_id": user["id"]}
    )
    db.commit()

    return {"success": True, "message": "Onboarding completed"}


@router.get("/me/saved-jobs")
async def get_saved_jobs(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get user's saved jobs"""
    user = get_or_create_user(db, current_user)

    result = db.execute(
        text("""
            SELECT j.id, j.title, j.nursing_type, j.specialty,
                   j.employment_type, j.shift_type, j.city, j.state,
                   j.pay_min, j.pay_max, j.posted_at,
                   f.name as facility_name, sj.saved_at
            FROM saved_jobs sj
            JOIN jobs j ON sj.job_id = j.id
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE sj.user_id = :user_id
            ORDER BY sj.saved_at DESC
        """),
        {"user_id": user["id"]}
    )

    jobs = [dict(row._mapping) for row in result]

    return {"success": True, "data": jobs}


@router.post("/me/saved-jobs/{job_id}")
async def save_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Save a job"""
    user = get_or_create_user(db, current_user)

    # Check job exists
    job = db.execute(
        text("SELECT id FROM jobs WHERE id = :job_id"),
        {"job_id": job_id}
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Upsert saved job
    db.execute(
        text("""
            INSERT INTO saved_jobs (user_id, job_id)
            VALUES (:user_id, :job_id)
            ON CONFLICT DO NOTHING
        """),
        {"user_id": user["id"], "job_id": job_id}
    )
    db.commit()

    return {"success": True, "message": "Job saved"}


@router.delete("/me/saved-jobs/{job_id}")
async def unsave_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Remove a saved job"""
    user = get_or_create_user(db, current_user)

    db.execute(
        text("""
            DELETE FROM saved_jobs
            WHERE user_id = :user_id AND job_id = :job_id
        """),
        {"user_id": user["id"], "job_id": job_id}
    )
    db.commit()

    return {"success": True, "message": "Job removed"}


@router.delete("/users/me")
async def delete_account(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete user account and all associated data.

    This permanently deletes:
    - User profile
    - Saved jobs
    - Applications
    - Preferences
    - All other user data

    This action cannot be undone.
    """
    user = get_or_create_user(db, current_user)
    user_id = user["id"]

    try:
        # Delete all related data first (foreign key constraints)
        # Saved jobs
        db.execute(
            text("DELETE FROM saved_jobs WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        # Applications
        db.execute(
            text("DELETE FROM applications WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        # Job alerts
        db.execute(
            text("DELETE FROM job_alerts WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        # Notifications
        db.execute(
            text("DELETE FROM notifications WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        # Community posts
        db.execute(
            text("DELETE FROM community_posts WHERE user_id = :user_id"),
            {"user_id": user_id}
        )

        # Finally delete the user
        db.execute(
            text("DELETE FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        )

        db.commit()

        return {"success": True, "message": "Account deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete account: {str(e)}"
        )
