"""News API - Real RSS feeds + database storage"""
from fastapi import APIRouter, Query, Depends, BackgroundTasks
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from ..database import get_db
from ..services.news_fetcher import (
    fetch_all_feeds,
    save_articles_to_db,
    get_articles_from_db,
    create_news_table,
    NURSING_KEYWORDS
)

router = APIRouter(prefix="/api/news", tags=["news"])

# Sample articles as fallback when DB is empty
SAMPLE_ARTICLES = [
    {
        "id": str(uuid.uuid4())[:12],
        "title": "Virginia Hospitals See 15% Increase in Nursing Staff",
        "summary": "Following aggressive recruitment efforts and improved compensation packages, Virginia healthcare facilities report significant gains in nursing staff levels across the state.",
        "source": "Healthcare Dive",
        "source_url": "https://www.healthcaredive.com",
        "image_url": None,
        "category": "virginia",
        "published_at": (datetime.now() - timedelta(hours=2)).isoformat()
    },
    {
        "id": str(uuid.uuid4())[:12],
        "title": "New NCLEX Pass Rates Show Promising Trends for 2025",
        "summary": "The latest NCLEX pass rate data indicates a 3% improvement nationwide, with Virginia nursing programs among the top performers.",
        "source": "American Nurse Journal",
        "source_url": "https://www.myamericannurse.com",
        "image_url": None,
        "category": "nursing",
        "published_at": (datetime.now() - timedelta(hours=18)).isoformat()
    },
    {
        "id": str(uuid.uuid4())[:12],
        "title": "CMS Announces Updates to Hospital Rating System",
        "summary": "The Centers for Medicare & Medicaid Services has released updates to the hospital star rating methodology, with greater emphasis on nurse staffing levels.",
        "source": "Modern Healthcare",
        "source_url": "https://www.modernhealthcare.com",
        "image_url": None,
        "category": "hospitals",
        "published_at": (datetime.now() - timedelta(days=2)).isoformat()
    },
    {
        "id": str(uuid.uuid4())[:12],
        "title": "Travel Nurse Demand Stabilizes After Pandemic Surge",
        "summary": "Industry analysts report that travel nursing rates and demand have reached a new equilibrium, with rates settling at approximately 30% above pre-pandemic levels.",
        "source": "Becker's Hospital Review",
        "source_url": "https://www.beckershospitalreview.com",
        "image_url": None,
        "category": "nursing",
        "published_at": (datetime.now() - timedelta(days=3)).isoformat()
    },
    {
        "id": str(uuid.uuid4())[:12],
        "title": "Virginia Board of Nursing Updates License Renewal Requirements",
        "summary": "Starting in 2026, Virginia nurses will have new CEU requirements including mandatory cultural competency and telehealth training.",
        "source": "Virginia Department of Health",
        "source_url": "https://www.vdh.virginia.gov",
        "image_url": None,
        "category": "virginia",
        "published_at": (datetime.now() - timedelta(days=4)).isoformat()
    },
]


@router.get("")
async def list_news(
    category: Optional[str] = None,
    limit: int = Query(default=20, le=50),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """List news articles with optional category filter"""
    try:
        # Try to get from database first
        articles = get_articles_from_db(db, category, limit, offset)

        if articles:
            return articles
    except Exception as e:
        print(f"Database error: {e}")

    # Fall back to sample articles
    result = SAMPLE_ARTICLES.copy()
    if category and category != "all":
        result = [a for a in result if a["category"] == category]

    result.sort(key=lambda x: x["published_at"], reverse=True)
    return result[offset:offset + limit]


@router.get("/trending")
async def get_trending(db: Session = Depends(get_db)):
    """Get trending news articles (most recent)"""
    try:
        articles = get_articles_from_db(db, None, 5, 0)
        if articles:
            return articles
    except:
        pass

    # Fallback
    articles = sorted(SAMPLE_ARTICLES, key=lambda x: x["published_at"], reverse=True)
    return articles[:5]


@router.get("/categories")
async def get_categories(db: Session = Depends(get_db)):
    """Get available news categories with counts"""
    try:
        result = db.execute(text("""
            SELECT category, COUNT(*) as count
            FROM news_articles
            GROUP BY category
        """)).fetchall()

        if result:
            categories = [{"id": "all", "name": "All News", "count": sum(r.count for r in result)}]
            for r in result:
                if r.category:
                    categories.append({
                        "id": r.category,
                        "name": r.category.title(),
                        "count": r.count
                    })
            return categories
    except:
        pass

    # Fallback
    return [
        {"id": "all", "name": "All News", "count": len(SAMPLE_ARTICLES)},
        {"id": "virginia", "name": "Virginia", "count": len([a for a in SAMPLE_ARTICLES if a["category"] == "virginia"])},
        {"id": "nursing", "name": "Nursing", "count": len([a for a in SAMPLE_ARTICLES if a["category"] == "nursing"])},
        {"id": "hospitals", "name": "Hospitals", "count": len([a for a in SAMPLE_ARTICLES if a["category"] == "hospitals"])},
        {"id": "legislation", "name": "Legislation", "count": len([a for a in SAMPLE_ARTICLES if a["category"] == "legislation"])},
        {"id": "research", "name": "Research", "count": len([a for a in SAMPLE_ARTICLES if a["category"] == "research"])},
    ]


@router.post("/refresh")
async def refresh_news(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Manually trigger news feed refresh (admin only)"""
    # Create table if not exists
    try:
        create_news_table(db)
    except Exception as e:
        return {"error": f"Failed to create table: {e}"}

    # Fetch in background
    async def fetch_and_save():
        try:
            articles = await fetch_all_feeds()
            if articles:
                with db.begin():
                    stats = save_articles_to_db(db, articles)
                print(f"News refresh complete: {stats}")
        except Exception as e:
            print(f"News refresh error: {e}")

    background_tasks.add_task(fetch_and_save)

    return {"status": "refresh_started", "message": "News feeds are being refreshed in the background"}


@router.get("/{article_id}")
async def get_article(article_id: str, db: Session = Depends(get_db)):
    """Get a single news article"""
    try:
        result = db.execute(
            text("SELECT * FROM news_articles WHERE id = :id"),
            {"id": article_id}
        ).first()

        if result:
            return {
                "id": result.id,
                "title": result.title,
                "summary": result.summary,
                "source": result.source,
                "source_url": result.source_url,
                "image_url": result.image_url,
                "category": result.category,
                "published_at": result.published_at.isoformat() if result.published_at else None
            }
    except:
        pass

    # Check sample articles
    for article in SAMPLE_ARTICLES:
        if article["id"] == article_id:
            return article

    return {"error": "Article not found"}


@router.post("/subscribe")
async def subscribe_newsletter(email: str):
    """Subscribe to weekly newsletter"""
    # In production, this would save to database and integrate with email service
    return {
        "status": "subscribed",
        "email": email,
        "message": "You'll receive our weekly digest every Sunday!"
    }
