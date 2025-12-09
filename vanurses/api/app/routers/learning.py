from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/learning", tags=["learning"])

# Mock database
ceu_db = {}

# Sample CEU data
SAMPLE_CEUS = [
    {
        "id": str(uuid.uuid4()),
        "title": "Pharmacology Update 2024",
        "provider": "Nurse.com",
        "hours": 3.0,
        "category": "Pharmacology",
        "completion_date": "2024-10-15",
        "certificate_url": None
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Patient Safety Fundamentals",
        "provider": "Medscape Nursing",
        "hours": 2.0,
        "category": "Patient Safety",
        "completion_date": "2024-09-20",
        "certificate_url": None
    },
    {
        "id": str(uuid.uuid4()),
        "title": "Ethics in Nursing Practice",
        "provider": "NurseCE4Less",
        "hours": 4.0,
        "category": "Ethics",
        "completion_date": "2024-08-10",
        "certificate_url": None
    },
]

# Initialize with sample data
for ceu in SAMPLE_CEUS:
    ceu_db[ceu["id"]] = ceu


class CEUCreate(BaseModel):
    title: str
    provider: str
    hours: float
    category: str
    completion_date: str
    certificate_url: Optional[str] = None


class CEUUpdate(BaseModel):
    title: Optional[str] = None
    provider: Optional[str] = None
    hours: Optional[float] = None
    category: Optional[str] = None
    completion_date: Optional[str] = None
    certificate_url: Optional[str] = None


@router.get("/ceus")
async def list_ceus():
    """List all CEU logs for the current user"""
    ceus = list(ceu_db.values())
    ceus.sort(key=lambda x: x.get("completion_date", ""), reverse=True)
    return ceus


@router.post("/ceus")
async def create_ceu(data: CEUCreate):
    """Log a new CEU"""
    ceu_id = str(uuid.uuid4())
    ceu = {
        "id": ceu_id,
        "title": data.title,
        "provider": data.provider,
        "hours": data.hours,
        "category": data.category,
        "completion_date": data.completion_date,
        "certificate_url": data.certificate_url
    }
    ceu_db[ceu_id] = ceu
    return ceu


@router.get("/ceus/{ceu_id}")
async def get_ceu(ceu_id: str):
    """Get a specific CEU log"""
    if ceu_id not in ceu_db:
        raise HTTPException(status_code=404, detail="CEU not found")
    return ceu_db[ceu_id]


@router.patch("/ceus/{ceu_id}")
async def update_ceu(ceu_id: str, data: CEUUpdate):
    """Update a CEU log"""
    if ceu_id not in ceu_db:
        raise HTTPException(status_code=404, detail="CEU not found")

    ceu = ceu_db[ceu_id]
    update_data = data.model_dump(exclude_unset=True)
    ceu.update(update_data)

    return ceu


@router.delete("/ceus/{ceu_id}")
async def delete_ceu(ceu_id: str):
    """Delete a CEU log"""
    if ceu_id not in ceu_db:
        raise HTTPException(status_code=404, detail="CEU not found")

    del ceu_db[ceu_id]
    return {"status": "deleted"}


@router.get("/ceus/stats/summary")
async def get_ceu_stats():
    """Get CEU statistics"""
    ceus = list(ceu_db.values())
    total_hours = sum(ceu.get("hours", 0) for ceu in ceus)

    # Count by category
    by_category = {}
    for ceu in ceus:
        cat = ceu.get("category", "Other")
        by_category[cat] = by_category.get(cat, 0) + ceu.get("hours", 0)

    return {
        "total_hours": total_hours,
        "required_hours": 30,  # Virginia requirement
        "remaining_hours": max(0, 30 - total_hours),
        "by_category": by_category,
        "courses_completed": len(ceus)
    }


@router.get("/resources")
async def list_resources(category: Optional[str] = None):
    """List learning resources"""
    resources = [
        {"id": "1", "title": "How to Negotiate Your Nursing Salary", "description": "Step-by-step guide to getting paid what you deserve", "category": "Career", "url": "#", "type": "guide", "reads": 2341},
        {"id": "2", "title": "NCLEX Study Tips from Top Performers", "description": "Proven strategies from nurses who aced the exam", "category": "Education", "url": "#", "type": "article", "reads": 5672},
        {"id": "3", "title": "Virginia Compact Nursing License FAQ", "description": "Everything you need to know about the NLC in Virginia", "category": "Licensing", "url": "#", "type": "guide", "reads": 3890},
        {"id": "4", "title": "ICU Interview Questions & Answers", "description": "Common questions and how to answer them confidently", "category": "Career", "url": "#", "type": "article", "reads": 4123},
        {"id": "5", "title": "Understanding Your Benefits Package", "description": "How to evaluate health insurance, PTO, and retirement plans", "category": "Career", "url": "#", "type": "guide", "reads": 1987},
        {"id": "6", "title": "Free CEU Courses for Virginia RNs", "description": "Curated list of free continuing education resources", "category": "Education", "url": "#", "type": "tool", "reads": 8934},
    ]

    if category and category != "All":
        resources = [r for r in resources if r["category"].lower() == category.lower()]

    return resources


@router.get("/salary-data")
async def get_salary_data():
    """Get nursing salary data for Virginia"""
    return [
        {"specialty": "ICU/Critical Care", "avg_hourly": 42.50, "min_hourly": 35.00, "max_hourly": 55.00, "change_pct": 5.2},
        {"specialty": "Emergency Room", "avg_hourly": 40.75, "min_hourly": 33.00, "max_hourly": 52.00, "change_pct": 4.8},
        {"specialty": "OR/Surgical", "avg_hourly": 44.25, "min_hourly": 38.00, "max_hourly": 58.00, "change_pct": 6.1},
        {"specialty": "Med-Surg", "avg_hourly": 35.50, "min_hourly": 28.00, "max_hourly": 45.00, "change_pct": 3.2},
        {"specialty": "Labor & Delivery", "avg_hourly": 41.00, "min_hourly": 34.00, "max_hourly": 52.00, "change_pct": 4.5},
        {"specialty": "NICU", "avg_hourly": 43.00, "min_hourly": 36.00, "max_hourly": 55.00, "change_pct": 5.8},
        {"specialty": "Travel Nursing", "avg_hourly": 65.00, "min_hourly": 50.00, "max_hourly": 95.00, "change_pct": -8.3},
    ]
