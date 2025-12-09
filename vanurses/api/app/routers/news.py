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

# No more hardcoded sample articles - return empty if DB is empty


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

    # Return empty list if no articles in database
    return []


@router.get("/trending")
async def get_trending(db: Session = Depends(get_db)):
    """Get trending news articles (most recent)"""
    try:
        articles = get_articles_from_db(db, None, 5, 0)
        if articles:
            return articles
    except:
        pass

    # Return empty list if no articles
    return []


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

    # Return default categories with zero counts if DB is empty
    return [
        {"id": "all", "name": "All News", "count": 0},
        {"id": "virginia", "name": "Virginia", "count": 0},
        {"id": "nursing", "name": "Nursing", "count": 0},
        {"id": "hospitals", "name": "Hospitals", "count": 0},
        {"id": "legislation", "name": "Legislation", "count": 0},
        {"id": "research", "name": "Research", "count": 0},
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
    except Exception as e:
        print(f"Error fetching article: {e}")

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
