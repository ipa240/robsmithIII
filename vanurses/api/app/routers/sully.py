"""Sully AI Chatbot API - Enhanced with factual data, search modes, and tier-based rate limiting"""
import httpx
import re
from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..auth.zitadel import get_current_user_optional, CurrentUser

router = APIRouter(prefix="/api/sully", tags=["sully"])

# Ollama configuration
OLLAMA_URL = "http://192.168.0.105:11434"
OLLAMA_MODEL = "dolphin-mistral:7b"

# Tier-based daily limits
TIER_LIMITS = {
    "free": {"daily_chats": 3, "nofilter_allowed": False},
    "starter": {"daily_chats": 10, "nofilter_allowed": False},
    "pro": {"daily_chats": 25, "nofilter_allowed": True},
    "premium": {"daily_chats": 100, "nofilter_allowed": True},
    "hr_admin": {"daily_chats": 200, "nofilter_allowed": True},
}

# Search modes
SEARCH_MODES = {
    "internal": "VANurses Database Only (Recommended)",
    "hybrid": "Database + Web Search",
    "web": "Web Search Only"
}

# Enhanced mood system prompts - all focused on FACTUAL data
MOOD_PROMPTS = {
    "optimistic": """You are Sully, a warm and encouraging AI nursing career assistant for VANurses.net in Virginia.

PERSONALITY: Friendly, supportive, uses occasional emojis. You celebrate wins and find opportunities in challenges.

CRITICAL RULES:
1. ONLY use data provided in the DATABASE CONTEXT section below
2. ALWAYS cite specific facility names, scores, and numbers from the data
3. NEVER make up facility names, scores, or statistics
4. If data isn't provided, say "I don't have that specific data right now"
5. Be encouraging but TRUTHFUL - don't sugarcoat bad scores

When discussing facilities, ALWAYS mention the actual name, city, and score from the data provided.""",

    "neutral": """You are Sully, a professional AI nursing career assistant for VANurses.net in Virginia.

PERSONALITY: Balanced, factual, objective. You present data clearly without bias or emotion.

CRITICAL RULES:
1. ONLY use data provided in the DATABASE CONTEXT section below
2. ALWAYS cite specific facility names, scores, and numbers from the data
3. NEVER make up facility names, scores, or statistics
4. If data isn't provided, say "I don't have that specific data available"
5. Present both positives and negatives objectively

Format responses clearly with bullet points or numbered lists when presenting multiple items.""",

    "stern": """You are Sully, a no-nonsense AI nursing career assistant for VANurses.net in Virginia.

PERSONALITY: Blunt, direct, occasionally uses mild profanity (damn, hell, crap). You don't sugarcoat anything.

CRITICAL RULES:
1. ONLY use data provided in the DATABASE CONTEXT section below
2. ALWAYS cite specific facility names, scores, and numbers from the data
3. NEVER make up facility names, scores, or statistics
4. If data isn't provided, say "I don't have that damn data right now"
5. Be brutally honest about bad scores - nurses need to know

Cut the fluff. Give them the facts straight.""",

    "nofilter": """You are Sully, a veteran ICU nurse turned AI assistant for VANurses.net in Virginia.

PERSONALITY: Brutally honest, blunt, no BS. Talk like a nurse giving real advice after a rough shift. You can use mild profanity (damn, hell, crap) but keep it professional enough for work.

CRITICAL RULES:
1. ONLY use data provided in the DATABASE CONTEXT section below
2. ALWAYS cite specific facility names, scores, and numbers from the data
3. NEVER make up facility names, scores, or statistics
4. If data isn't provided, say "I don't have that data right now"
5. Call out bad facilities by name - nurses deserve the truth
6. Keep responses real but not crude

Give nurses the straight truth without the corporate sugarcoating."""
}


class ChatRequest(BaseModel):
    message: str
    mood: str = "neutral"
    search_mode: str = "internal"  # internal, hybrid, web
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    response: str
    mood: str
    search_mode: str
    data_sources: list
    remaining: int
    tier: str
    daily_limit: int
    used_today: int


async def get_user_from_token(current_user: Optional[CurrentUser], db: Session) -> Optional[dict]:
    """Get user from database based on Zitadel token"""
    if not current_user or not current_user.email:
        return None

    result = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": current_user.email}
    ).first()

    if result:
        return dict(result._mapping)
    return None


def get_user_usage_today(db: Session, user_id: str) -> int:
    """Get number of Sully chats user has made today"""
    result = db.execute(
        text("""
            SELECT COUNT(*) as count
            FROM sully_interactions
            WHERE user_id = :user_id
              AND DATE(created_at) = CURRENT_DATE
        """),
        {"user_id": user_id}
    ).first()
    return result.count if result else 0


def record_sully_interaction(db: Session, user_id: str, question: str, response: str, mood: str):
    """Record a Sully chat interaction for rate limiting"""
    db.execute(
        text("""
            INSERT INTO sully_interactions (user_id, question, response, mood, created_at)
            VALUES (:user_id, :question, :response, :mood, NOW())
        """),
        {"user_id": user_id, "question": question[:500], "response": response[:2000], "mood": mood}
    )
    db.commit()


def get_comprehensive_context(db: Session, message: str) -> tuple[str, list]:
    """Fetch comprehensive data from database based on user query - ALWAYS provides data"""
    context_parts = []
    data_sources = []
    message_lower = message.lower()

    # Always provide basic stats
    basic_stats = db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM jobs WHERE is_active = true) as total_jobs,
            (SELECT COUNT(*) FROM facilities) as total_facilities,
            (SELECT COUNT(*) FROM facility_scores WHERE ofs_score IS NOT NULL) as scored_facilities
    """)).first()
    if basic_stats:
        context_parts.append(f"DATABASE OVERVIEW: {basic_stats.total_jobs} active jobs, {basic_stats.total_facilities} facilities ({basic_stats.scored_facilities} with scores)")
        data_sources.append("VANurses Database")

    # ========== ALWAYS INCLUDE FACILITY DATA ==========
    stats = db.execute(text("""
        SELECT
            ROUND(AVG(ofs_score)::numeric, 1) as avg_score,
            ROUND(MIN(ofs_score)::numeric, 1) as min_score,
            ROUND(MAX(ofs_score)::numeric, 1) as max_score
        FROM facility_scores WHERE ofs_score IS NOT NULL
    """)).first()
    if stats:
        context_parts.append(f"\nFACILITY SCORE STATS: Average={stats.avg_score}, Range={stats.min_score}-{stats.max_score}")

    # TOP 5 BEST facilities
    best = db.execute(text("""
        SELECT f.name, f.city, f.system_name,
               ROUND(fs.ofs_score::numeric, 1) as score, fs.ofs_grade,
               (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as open_jobs
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE fs.ofs_score IS NOT NULL
        ORDER BY fs.ofs_score DESC
        LIMIT 5
    """)).fetchall()
    if best:
        best_list = []
        for i, b in enumerate(best, 1):
            system_str = f" ({b.system_name})" if b.system_name else ""
            jobs_str = f", {b.open_jobs} open jobs" if b.open_jobs else ""
            best_list.append(f"  {i}. {b.name}{system_str} in {b.city} - Score: {b.score} (Grade {b.ofs_grade}){jobs_str}")
        context_parts.append(f"\nTOP 5 BEST-RATED FACILITIES:\n" + "\n".join(best_list))

    # BOTTOM 5 WORST facilities
    worst = db.execute(text("""
        SELECT f.name, f.city, f.system_name,
               ROUND(fs.ofs_score::numeric, 1) as score, fs.ofs_grade,
               (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as open_jobs
        FROM facilities f
        JOIN facility_scores fs ON f.id = fs.facility_id
        WHERE fs.ofs_score IS NOT NULL
        ORDER BY fs.ofs_score ASC
        LIMIT 5
    """)).fetchall()
    if worst:
        worst_list = []
        for i, w in enumerate(worst, 1):
            system_str = f" ({w.system_name})" if w.system_name else ""
            jobs_str = f", {w.open_jobs} open jobs" if w.open_jobs else ""
            worst_list.append(f"  {i}. {w.name}{system_str} in {w.city} - Score: {w.score} (Grade {w.ofs_grade}){jobs_str}")
        context_parts.append(f"\nBOTTOM 5 LOWEST-RATED FACILITIES:\n" + "\n".join(worst_list))

    # Grade distribution
    grades = db.execute(text("""
        SELECT ofs_grade, COUNT(*) as count
        FROM facility_scores
        WHERE ofs_grade IS NOT NULL
        GROUP BY ofs_grade
        ORDER BY ofs_grade
    """)).fetchall()
    if grades:
        grade_str = ", ".join([f"{g.ofs_grade}: {g.count}" for g in grades])
        context_parts.append(f"\nGRADE DISTRIBUTION: {grade_str}")

    # ========== REGIONAL QUERIES ==========
    regions = {
        'nova': 'Northern Virginia',
        'northern virginia': 'Northern Virginia',
        'richmond': 'Richmond',
        'hampton': 'Hampton Roads',
        'hampton roads': 'Hampton Roads',
        'roanoke': 'Roanoke',
        'shenandoah': 'Shenandoah Valley',
        'charlottesville': 'Charlottesville',
        'fredericksburg': 'Fredericksburg',
        'tidewater': 'Hampton Roads',
        'virginia beach': 'Hampton Roads'
    }

    for keyword, region_name in regions.items():
        if keyword in message_lower:
            region_data = db.execute(text("""
                SELECT
                    COUNT(DISTINCT f.id) as facility_count,
                    ROUND(AVG(fs.ofs_score)::numeric, 1) as avg_score,
                    (SELECT COUNT(*) FROM jobs j
                     JOIN facilities f2 ON j.facility_id = f2.id
                     WHERE f2.region ILIKE :region AND j.is_active = true) as job_count
                FROM facilities f
                LEFT JOIN facility_scores fs ON f.id = fs.facility_id
                WHERE f.region ILIKE :region
            """), {"region": f"%{region_name}%"}).first()

            if region_data and region_data.facility_count > 0:
                context_parts.append(f"\n{region_name.upper()} REGION: {region_data.facility_count} facilities, {region_data.job_count} active jobs, Avg Score: {region_data.avg_score}")

            regional_best = db.execute(text("""
                SELECT f.name, f.city, ROUND(fs.ofs_score::numeric, 1) as score, fs.ofs_grade
                FROM facilities f
                JOIN facility_scores fs ON f.id = fs.facility_id
                WHERE f.region ILIKE :region AND fs.ofs_score IS NOT NULL
                ORDER BY fs.ofs_score DESC
                LIMIT 3
            """), {"region": f"%{region_name}%"}).fetchall()

            if regional_best:
                best_list = [f"  - {r.name} ({r.city}): {r.score} ({r.ofs_grade})" for r in regional_best]
                context_parts.append(f"Best in {region_name}:\n" + "\n".join(best_list))
            break

    # ========== ALWAYS INCLUDE JOB DATA ==========
    job_stats = db.execute(text("""
        SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN pay_disclosed THEN 1 END) as with_pay,
            ROUND(AVG(pay_min)::numeric, 2) as avg_pay_min,
            ROUND(AVG(pay_max)::numeric, 2) as avg_pay_max,
            COUNT(CASE WHEN sign_on_bonus IS NOT NULL AND sign_on_bonus > 0 THEN 1 END) as with_bonus
        FROM jobs WHERE is_active = true
    """)).first()
    if job_stats:
        context_parts.append(f"\nJOB MARKET: {job_stats.total} active jobs, {job_stats.with_pay} with disclosed pay, {job_stats.with_bonus} with sign-on bonus")
        if job_stats.avg_pay_min:
            context_parts.append(f"PAY RANGE: Average ${job_stats.avg_pay_min}-${job_stats.avg_pay_max}/hr")

    # Top nursing types
    types = db.execute(text("""
        SELECT nursing_type, COUNT(*) as count
        FROM jobs WHERE is_active = true AND nursing_type IS NOT NULL
        GROUP BY nursing_type ORDER BY count DESC LIMIT 5
    """)).fetchall()
    if types:
        types_str = ", ".join([f"{t.nursing_type}: {t.count}" for t in types])
        context_parts.append(f"TOP JOB TYPES: {types_str}")

    # Top specialties
    specialties = db.execute(text("""
        SELECT specialty, COUNT(*) as count
        FROM jobs WHERE is_active = true AND specialty IS NOT NULL
        GROUP BY specialty ORDER BY count DESC LIMIT 5
    """)).fetchall()
    if specialties:
        spec_str = ", ".join([f"{s.specialty}: {s.count}" for s in specialties])
        context_parts.append(f"TOP SPECIALTIES: {spec_str}")

    # ========== PAY/SALARY QUERIES ==========
    if any(word in message_lower for word in ['pay', 'salary', 'wage', 'hourly', 'money', 'compensation',
                                               'bonus', 'sign-on', 'highest paying', 'best paying']):
        high_pay = db.execute(text("""
            SELECT j.title, f.name as facility, j.city, j.pay_max, j.pay_min
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.is_active = true AND j.pay_disclosed = true AND j.pay_max IS NOT NULL
            ORDER BY j.pay_max DESC
            LIMIT 5
        """)).fetchall()
        if high_pay:
            pay_list = [f"  - {p.title} at {p.facility or 'Unknown'} ({p.city}): ${p.pay_min}-${p.pay_max}/hr" for p in high_pay]
            context_parts.append(f"\nHIGHEST PAYING JOBS:\n" + "\n".join(pay_list))

        bonus_jobs = db.execute(text("""
            SELECT j.title, f.name as facility, j.city, j.sign_on_bonus
            FROM jobs j
            LEFT JOIN facilities f ON j.facility_id = f.id
            WHERE j.is_active = true AND j.sign_on_bonus IS NOT NULL AND j.sign_on_bonus > 0
            ORDER BY j.sign_on_bonus DESC
            LIMIT 5
        """)).fetchall()
        if bonus_jobs:
            bonus_list = [f"  - {b.title} at {b.facility or 'Unknown'} ({b.city}): ${b.sign_on_bonus:,.0f} bonus" for b in bonus_jobs]
            context_parts.append(f"\nBEST SIGN-ON BONUSES:\n" + "\n".join(bonus_list))

    # ========== SPECIFIC FACILITY SEARCH ==========
    if len(message_lower) < 100 and not any(q in message_lower for q in ['what', 'which', 'where', 'who', 'how', '?']):
        facility_search = db.execute(text("""
            SELECT f.name, f.city, f.system_name, f.bed_count, f.region,
                   ROUND(fs.ofs_score::numeric, 1) as score, fs.ofs_grade,
                   (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as open_jobs
            FROM facilities f
            LEFT JOIN facility_scores fs ON f.id = fs.facility_id
            WHERE LOWER(f.name) LIKE :search OR LOWER(f.system_name) LIKE :search
            LIMIT 3
        """), {"search": f"%{message_lower}%"}).fetchall()

        if facility_search:
            for fac in facility_search:
                beds = f", {fac.bed_count} beds" if fac.bed_count else ""
                score_str = f", Score: {fac.score} ({fac.ofs_grade})" if fac.score else ", No score yet"
                context_parts.append(f"\nFACILITY DETAILS - {fac.name}:")
                context_parts.append(f"  Location: {fac.city}, {fac.region or 'Virginia'}")
                if fac.system_name:
                    context_parts.append(f"  System: {fac.system_name}")
                context_parts.append(f"  Stats: {fac.open_jobs} open jobs{beds}{score_str}")

    return "\n".join(context_parts) if context_parts else "No specific data found for this query.", data_sources


@router.post("/chat")
async def chat_with_sully(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Chat with Sully AI assistant - enforces tier-based rate limits"""

    # Get user from token
    user = await get_user_from_token(current_user, db)

    # Determine tier and limits
    if user:
        user_id = str(user["id"])
        tier = user.get("tier", "free") or "free"
    else:
        # Anonymous users get very limited access
        user_id = None
        tier = "free"

    tier_config = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    daily_limit = tier_config["daily_chats"]

    # Check rate limit for authenticated users
    used_today = 0
    if user_id:
        used_today = get_user_usage_today(db, user_id)

        if used_today >= daily_limit:
            remaining = 0
            return ChatResponse(
                response=f"You've reached your daily limit of {daily_limit} Sully chats. "
                         f"{'Upgrade your plan for more chats!' if tier == 'free' else 'Your limit resets at midnight.'}",
                mood=request.mood,
                search_mode=request.search_mode,
                data_sources=[],
                remaining=remaining,
                tier=tier,
                daily_limit=daily_limit,
                used_today=used_today
            )

    # Validate mood
    mood = request.mood.lower()
    if mood not in MOOD_PROMPTS:
        mood = "neutral"

    # Check if nofilter is allowed for this tier
    if mood == "nofilter" and not tier_config["nofilter_allowed"]:
        return ChatResponse(
            response="NoFilter mode requires a Pro or higher subscription. Upgrade to access unfiltered Sully!",
            mood="neutral",
            search_mode=request.search_mode,
            data_sources=[],
            remaining=daily_limit - used_today,
            tier=tier,
            daily_limit=daily_limit,
            used_today=used_today
        )

    # Validate search mode
    search_mode = request.search_mode.lower()
    if search_mode not in SEARCH_MODES:
        search_mode = "internal"

    data_sources = []

    # Get database context
    db_context = ""
    if search_mode in ["internal", "hybrid"]:
        db_context, data_sources = get_comprehensive_context(db, request.message)

    # Build the system prompt
    system_prompt = MOOD_PROMPTS[mood]

    if db_context:
        system_prompt += f"""

=== DATABASE CONTEXT (USE THIS DATA) ===
{db_context}
=== END DATABASE CONTEXT ===

REMEMBER: You MUST use the facility names, scores, and numbers from the DATABASE CONTEXT above.
Do NOT make up any facility names or statistics. If the data isn't in the context, say you don't have it."""

    if search_mode == "hybrid":
        system_prompt += "\n\nYou may supplement the database info with general nursing career advice, but always prioritize the specific Virginia data provided."
        data_sources.append("General Knowledge")

    if search_mode == "web":
        system_prompt += "\n\nProvide general nursing career advice for Virginia. Note: Web search not fully implemented yet."
        data_sources = ["General Knowledge"]

    # Call Ollama
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": request.message,
                    "system": system_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3 if mood == "neutral" else 0.5,
                        "top_p": 0.85,
                        "num_predict": 500
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            ai_response = data.get("response", "I'm having trouble responding right now.")
            ai_response = ai_response.replace("DATASET", "").strip()
            ai_response = re.sub(r"[--]", "", ai_response)

    except httpx.TimeoutException:
        ai_response = "Sorry, I'm taking too long to think. Try a simpler question or ask again!"
    except httpx.HTTPError as e:
        ai_response = "Sully is having connection issues. Try again in a moment."
    except Exception as e:
        ai_response = f"Something went wrong: {str(e)[:100]}"

    # Record interaction for rate limiting (only for authenticated users)
    if user_id:
        record_sully_interaction(db, user_id, request.message, ai_response, mood)
        used_today += 1

    remaining = max(0, daily_limit - used_today)

    return ChatResponse(
        response=ai_response,
        mood=mood,
        search_mode=search_mode,
        data_sources=data_sources,
        remaining=remaining,
        tier=tier,
        daily_limit=daily_limit,
        used_today=used_today
    )


@router.get("/status")
async def sully_status():
    """Check if Sully (Ollama) is available"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            response.raise_for_status()
            return {"status": "online", "model": OLLAMA_MODEL}
    except:
        return {"status": "offline", "model": OLLAMA_MODEL}


@router.get("/usage")
async def get_sully_usage(
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Get current user's Sully usage for today"""
    user = await get_user_from_token(current_user, db)

    if not user:
        return {
            "tier": "free",
            "daily_limit": TIER_LIMITS["free"]["daily_chats"],
            "used_today": 0,
            "remaining": TIER_LIMITS["free"]["daily_chats"],
            "nofilter_allowed": False
        }

    tier = user.get("tier", "free") or "free"
    tier_config = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    used_today = get_user_usage_today(db, str(user["id"]))

    return {
        "tier": tier,
        "daily_limit": tier_config["daily_chats"],
        "used_today": used_today,
        "remaining": max(0, tier_config["daily_chats"] - used_today),
        "nofilter_allowed": tier_config["nofilter_allowed"]
    }


@router.get("/search-modes")
async def get_search_modes():
    """Get available search modes"""
    return {
        "modes": [
            {"id": "internal", "name": "VANurses Database Only", "description": "Search only our curated Virginia nursing database (Recommended)", "recommended": True},
            {"id": "hybrid", "name": "Database + General", "description": "Database results supplemented with general nursing knowledge", "recommended": False},
            {"id": "web", "name": "General Knowledge", "description": "General nursing career advice only", "recommended": False}
        ],
        "default": "internal"
    }


class JobOpinionRequest(BaseModel):
    job_id: str
    job_title: str
    facility_name: Optional[str] = None
    city: Optional[str] = None
    specialty: Optional[str] = None
    nursing_type: Optional[str] = None
    shift_type: Optional[str] = None
    employment_type: Optional[str] = None
    mood: str = "optimistic"


# Mood prompts for job opinions
JOB_OPINION_PROMPTS = {
    "optimistic": """You are Sully, a warm and encouraging AI nursing career advisor for VANurses.net.
Your job is to give a brief, personalized opinion on whether this job is a good match for the user based on their preferences.

PERSONALITY: Friendly, supportive, uses occasional emojis. You find the positives and encourage them!

RESPONSE FORMAT:
- Keep it to 2-3 sentences max
- Be encouraging and find the bright side
- If it's a great match, say so enthusiastically!
- If there are concerns, frame them as opportunities
- Use occasional emojis to be friendly""",

    "neutral": """You are Sully, a professional AI nursing career advisor for VANurses.net.
Your job is to give a brief, personalized opinion on whether this job is a good match for the user based on their preferences.

PERSONALITY: Balanced, factual, objective. You present the pros and cons clearly.

RESPONSE FORMAT:
- Keep it to 2-3 sentences max
- Be objective and balanced
- State both positives and concerns clearly
- No emotional language, just facts""",

    "stern": """You are Sully, a direct and no-nonsense AI nursing career advisor for VANurses.net.
Your job is to give a brief, personalized opinion on whether this job is a good match for the user based on their preferences.

PERSONALITY: Blunt, direct, tells it like it is. You can use mild language (damn, hell) occasionally.

RESPONSE FORMAT:
- Keep it to 2-3 sentences max
- Be direct and don't sugarcoat
- Point out potential red flags clearly
- Give real talk, not corporate fluff""",

    "nofilter": """You are Sully, a veteran ICU nurse turned AI career advisor for VANurses.net.
Your job is to give a brief, personalized opinion on whether this job is a good match for the user based on their preferences.

PERSONALITY: Brutally honest, talk like a real nurse giving advice after a long shift. You can use mild profanity (damn, hell, crap) but keep it work-appropriate.

RESPONSE FORMAT:
- Keep it to 2-3 sentences max
- Tell them the truth, no BS
- Call out any red flags bluntly
- Talk like a real nurse would to a colleague"""
}


@router.post("/job-opinion")
async def get_job_opinion(
    request: JobOpinionRequest,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Get Sully's personalized opinion on a job based on user's profile and preferences"""

    # Get user from token
    user = await get_user_from_token(current_user, db)

    if not user:
        raise HTTPException(status_code=401, detail="Please sign in to get Sully's opinion")

    user_id = str(user["id"])
    tier = user.get("tier", "free") or "free"
    tier_config = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    # Validate mood
    mood = request.mood.lower()
    if mood not in JOB_OPINION_PROMPTS:
        mood = "optimistic"

    # Check if nofilter is allowed for this tier
    if mood == "nofilter" and not tier_config["nofilter_allowed"]:
        raise HTTPException(
            status_code=403,
            detail="No Filter mode requires a Pro subscription or higher. Upgrade to unlock unfiltered Sully!"
        )

    # Get user's onboarding preferences
    preferences = db.execute(
        text("""
            SELECT
                specialties, employment_types, shift_preferences,
                locations, desired_salary_min, desired_salary_max,
                certifications, experience_years, nursing_types,
                career_goals, work_environment_prefs
            FROM user_onboarding
            WHERE user_id = :user_id
        """),
        {"user_id": user_id}
    ).first()

    # Get user profile data
    user_profile = db.execute(
        text("""
            SELECT first_name, last_name, email, tier
            FROM users
            WHERE id = :user_id
        """),
        {"user_id": user_id}
    ).first()

    # Get comprehensive facility data if we have the facility
    facility_data = None
    if request.facility_name:
        facility_data = db.execute(
            text("""
                SELECT
                    f.id, f.name, f.city, f.state, f.region, f.system_name,
                    f.bed_count, f.hospital_type,
                    fs.ofs_score, fs.ofs_grade,
                    fs.pci_score, fs.ali_score, fs.csi_score, fs.cci_score,
                    fs.lssi_score, fs.qli_score, fs.pei_score, fs.fsi_score,
                    (SELECT COUNT(*) FROM jobs j WHERE j.facility_id = f.id AND j.is_active = true) as open_jobs
                FROM facilities f
                LEFT JOIN facility_scores fs ON f.id = fs.facility_id
                WHERE LOWER(f.name) LIKE :name
                LIMIT 1
            """),
            {"name": f"%{request.facility_name.lower()}%"}
        ).first()

    # Get job pay info
    job_pay_data = db.execute(
        text("""
            SELECT pay_min, pay_max, pay_disclosed, sign_on_bonus
            FROM jobs
            WHERE id = :job_id
        """),
        {"job_id": request.job_id}
    ).first()

    # Build comprehensive context for Sully
    job_context = f"""
JOB DETAILS:
- Title: {request.job_title}
- Facility: {request.facility_name or 'Not specified'}
- Location: {request.city or 'Not specified'}, Virginia
- Specialty: {request.specialty or 'Not specified'}
- Nursing Type: {request.nursing_type or 'Not specified'}
- Shift: {request.shift_type or 'Not specified'}
- Employment Type: {request.employment_type or 'Not specified'}
"""

    if job_pay_data:
        pay = dict(job_pay_data._mapping)
        if pay.get('pay_min') or pay.get('pay_max'):
            job_context += f"- Pay: ${pay.get('pay_min', '?')}-${pay.get('pay_max', '?')}/hr\n"
        if pay.get('sign_on_bonus'):
            job_context += f"- Sign-On Bonus: ${pay.get('sign_on_bonus'):,.0f}\n"

    if facility_data:
        fac = dict(facility_data._mapping)
        job_context += f"""
FACILITY DETAILS ({fac['name']}):
- Location: {fac['city']}, {fac['state']} ({fac.get('region') or 'Virginia'})
- System: {fac.get('system_name') or 'Independent'}
- Hospital Type: {fac.get('hospital_type') or 'Not specified'}
- Bed Count: {fac.get('bed_count') or 'Not specified'}
- Open Jobs: {fac.get('open_jobs', 0)} positions available

FACILITY SCORES (Overall: {fac.get('ofs_score') or 'N/A'} - Grade {fac.get('ofs_grade') or 'N/A'}):
"""
        if fac.get('pci_score'):
            job_context += f"- Patient Care Index: {fac.get('pci_score')}/100\n"
        if fac.get('ali_score'):
            job_context += f"- Area Livability: {fac.get('ali_score')}/100\n"
        if fac.get('csi_score'):
            job_context += f"- Cost of Living: {fac.get('csi_score')}/100\n"
        if fac.get('cci_score'):
            job_context += f"- Career Opportunity: {fac.get('cci_score')}/100\n"
        if fac.get('qli_score'):
            job_context += f"- Quality of Life: {fac.get('qli_score')}/100\n"
        if fac.get('pei_score'):
            job_context += f"- Professional Environment: {fac.get('pei_score')}/100\n"

    if preferences:
        pref = dict(preferences._mapping)
        job_context += f"""
USER PROFILE PREFERENCES:
- Preferred Nursing Types: {pref.get('nursing_types') or 'Not specified'}
- Preferred Specialties: {pref.get('specialties') or 'Not specified'}
- Preferred Employment: {pref.get('employment_types') or 'Not specified'}
- Preferred Shifts: {pref.get('shift_preferences') or 'Not specified'}
- Preferred Locations/Regions: {pref.get('locations') or 'Not specified'}
- Desired Salary: ${pref.get('desired_salary_min') or '?'} - ${pref.get('desired_salary_max') or '?'}/hr
- Experience Level: {pref.get('experience_years') or '?'} years
- Certifications: {pref.get('certifications') or 'Not specified'}
- Career Goals: {pref.get('career_goals') or 'Not specified'}
- Work Environment Preferences: {pref.get('work_environment_prefs') or 'Not specified'}
"""
    else:
        job_context += "\nUSER PREFERENCES: No profile preferences set yet - recommend they complete their profile for better matching."

    # Build response data for facility score
    facility_score = None
    if facility_data:
        fac = dict(facility_data._mapping)
        facility_score = {
            "name": fac['name'],
            "city": fac['city'],
            "score": fac.get('ofs_score'),
            "grade": fac.get('ofs_grade')
        }

    # Get the mood-specific prompt
    system_prompt = JOB_OPINION_PROMPTS[mood] + """

ADDITIONAL RULES:
- Reference specific details from their preferences when relevant
- DO NOT write long paragraphs or list every detail
- DO NOT make up information not provided"""

    # Call Ollama for the opinion
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": f"Based on this job and the user's preferences, give your quick opinion on whether it's a good match:\n\n{job_context}",
                    "system": system_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.6,
                        "top_p": 0.9,
                        "num_predict": 200
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            opinion = data.get("response", "").strip()

            # Clean up the response
            opinion = opinion.replace("DATASET", "").strip()
            opinion = re.sub(r"[--]", "", opinion)

            if not opinion:
                opinion = "This looks like an interesting opportunity! I'd need to see more details about your preferences to give you a better match assessment."

    except httpx.TimeoutException:
        opinion = "I'm taking too long to analyze this one. Try asking me again in a moment!"
    except httpx.HTTPError:
        opinion = "Having trouble connecting right now. Give me another shot in a few seconds!"
    except Exception as e:
        opinion = "Hmm, something went wrong. Try asking me again!"

    return {
        "opinion": opinion,
        "facility_score": facility_score
    }
