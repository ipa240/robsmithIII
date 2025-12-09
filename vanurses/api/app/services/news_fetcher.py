"""News RSS Feed Fetcher Service for VANurses"""
import feedparser
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import hashlib
from sqlalchemy import text
from sqlalchemy.orm import Session

# RSS Feed sources for nursing/healthcare news
RSS_FEEDS = [
    {
        "name": "Becker's Hospital Review",
        "url": "https://www.beckershospitalreview.com/rss/nursing.xml",
        "category": "nursing"
    },
    {
        "name": "Modern Healthcare",
        "url": "https://www.modernhealthcare.com/rss/news",
        "category": "hospitals"
    },
    {
        "name": "Healthcare Dive",
        "url": "https://www.healthcaredive.com/feeds/news/",
        "category": "hospitals"
    },
    {
        "name": "Fierce Healthcare",
        "url": "https://www.fiercehealthcare.com/rss/xml",
        "category": "hospitals"
    },
]

# Keywords to filter nursing-relevant articles
NURSING_KEYWORDS = [
    'nurse', 'nursing', 'staffing', 'patient care', 'hospital',
    'healthcare worker', 'medical staff', 'clinical', 'bedside',
    'rn ', 'lpn', 'cna', 'nicu', 'icu ', 'er ', 'emergency',
    'patient safety', 'nclex', 'telehealth', 'travel nurse',
    'nurse practitioner', 'np ', 'virginia', 'va hospital',
    'cms', 'medicare', 'medicaid', 'jcaho', 'magnet'
]


def is_nursing_relevant(title: str, summary: str) -> bool:
    """Check if article is relevant to nursing"""
    text = (title + ' ' + summary).lower()
    return any(keyword in text for keyword in NURSING_KEYWORDS)


def generate_article_id(url: str) -> str:
    """Generate a consistent ID from URL"""
    return hashlib.md5(url.encode()).hexdigest()[:12]


def parse_feed_date(entry) -> Optional[datetime]:
    """Parse date from feed entry"""
    if hasattr(entry, 'published_parsed') and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6])
        except:
            pass
    if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
        try:
            return datetime(*entry.updated_parsed[:6])
        except:
            pass
    return datetime.now()


async def fetch_rss_feed(feed_config: Dict) -> List[Dict]:
    """Fetch and parse a single RSS feed"""
    articles = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(feed_config["url"])
            response.raise_for_status()
            feed = feedparser.parse(response.text)

            for entry in feed.entries[:20]:  # Limit per feed
                title = entry.get('title', '')
                summary = entry.get('summary', entry.get('description', ''))
                link = entry.get('link', '')

                # Filter for nursing relevance
                if not is_nursing_relevant(title, summary):
                    continue

                # Clean up summary (remove HTML)
                if summary:
                    import re
                    summary = re.sub('<[^<]+?>', '', summary)
                    summary = summary[:500] + '...' if len(summary) > 500 else summary

                article = {
                    "id": generate_article_id(link),
                    "title": title[:300],
                    "summary": summary,
                    "source": feed_config["name"],
                    "source_url": link,
                    "image_url": entry.get('media_content', [{}])[0].get('url') if entry.get('media_content') else None,
                    "category": feed_config["category"],
                    "published_at": parse_feed_date(entry),
                    "fetched_at": datetime.now()
                }
                articles.append(article)

    except Exception as e:
        print(f"Error fetching {feed_config['name']}: {e}")

    return articles


async def fetch_all_feeds() -> List[Dict]:
    """Fetch articles from all RSS feeds"""
    all_articles = []

    for feed_config in RSS_FEEDS:
        articles = await fetch_rss_feed(feed_config)
        all_articles.extend(articles)
        print(f"Fetched {len(articles)} articles from {feed_config['name']}")

    # Sort by date
    all_articles.sort(key=lambda x: x['published_at'], reverse=True)

    return all_articles


def save_articles_to_db(db: Session, articles: List[Dict]) -> Dict:
    """Save articles to database, avoiding duplicates"""
    stats = {"new": 0, "updated": 0, "skipped": 0}

    for article in articles:
        try:
            # Check if article exists
            existing = db.execute(
                text("SELECT id FROM news_articles WHERE id = :id"),
                {"id": article["id"]}
            ).first()

            if existing:
                stats["skipped"] += 1
                continue

            # Insert new article
            db.execute(
                text("""
                    INSERT INTO news_articles (id, title, summary, source, source_url, image_url, category, published_at, fetched_at)
                    VALUES (:id, :title, :summary, :source, :source_url, :image_url, :category, :published_at, :fetched_at)
                """),
                {
                    "id": article["id"],
                    "title": article["title"],
                    "summary": article["summary"],
                    "source": article["source"],
                    "source_url": article["source_url"],
                    "image_url": article["image_url"],
                    "category": article["category"],
                    "published_at": article["published_at"],
                    "fetched_at": article["fetched_at"]
                }
            )
            stats["new"] += 1

        except Exception as e:
            print(f"Error saving article: {e}")
            stats["skipped"] += 1

    db.commit()
    return stats


def get_articles_from_db(
    db: Session,
    category: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
) -> List[Dict]:
    """Get articles from database"""
    query = """
        SELECT id, title, summary, source, source_url, image_url, category, published_at
        FROM news_articles
        WHERE 1=1
    """
    params = {"limit": limit, "offset": offset}

    if category and category != "all":
        query += " AND category = :category"
        params["category"] = category

    query += " ORDER BY published_at DESC LIMIT :limit OFFSET :offset"

    results = db.execute(text(query), params).fetchall()

    return [
        {
            "id": r.id,
            "title": r.title,
            "summary": r.summary,
            "source": r.source,
            "source_url": r.source_url,
            "image_url": r.image_url,
            "category": r.category,
            "published_at": r.published_at.isoformat() if r.published_at else None
        }
        for r in results
    ]


def create_news_table(db: Session):
    """Create news_articles table if not exists"""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS news_articles (
            id VARCHAR(20) PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            summary TEXT,
            source VARCHAR(100),
            source_url VARCHAR(500),
            image_url VARCHAR(500),
            category VARCHAR(50),
            published_at TIMESTAMP,
            fetched_at TIMESTAMP DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC)
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category)
    """))
    db.commit()
