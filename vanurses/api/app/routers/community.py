"""Community Forum API - Persisted to PostgreSQL"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..auth.zitadel import get_current_user_optional, get_current_user, CurrentUser
import uuid

router = APIRouter(prefix="/api/community", tags=["community"])


class PostCreate(BaseModel):
    category_id: str
    title: str
    content: str
    is_anonymous: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class ReplyCreate(BaseModel):
    content: str
    is_anonymous: bool = False
    parent_reply_id: Optional[str] = None


class ReplyUpdate(BaseModel):
    content: str


class VoteRequest(BaseModel):
    direction: str  # 'up' or 'down'


class CategorySuggest(BaseModel):
    name: str
    description: Optional[str] = None
    icon: str = "MessageSquare"


def get_user_from_token(current_user: Optional[CurrentUser], db: Session) -> Optional[dict]:
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


def get_category_name(category_id: str, db: Session) -> str:
    """Get category name from database by ID"""
    result = db.execute(
        text("SELECT name FROM community_categories WHERE id = :id AND is_approved = TRUE AND is_active = TRUE"),
        {"id": category_id}
    ).first()
    return result.name if result else "General"


@router.get("/categories")
async def list_categories(db: Session = Depends(get_db)):
    """Get all approved forum categories with post counts"""
    # Query categories from database
    result = db.execute(
        text("""
            SELECT id, name, slug, description, icon, sort_order
            FROM community_categories
            WHERE is_approved = TRUE AND is_active = TRUE
            ORDER BY sort_order ASC, name ASC
        """)
    )
    categories = [dict(row._mapping) for row in result]

    # Get actual post counts
    counts = db.execute(
        text("SELECT category_id, COUNT(*) as count FROM community_posts GROUP BY category_id")
    ).fetchall()

    count_map = {str(row.category_id): row.count for row in counts}

    for cat in categories:
        cat["id"] = str(cat["id"])
        cat["post_count"] = count_map.get(cat["id"], 0)

    return categories


@router.post("/categories/suggest")
async def suggest_category(
    data: CategorySuggest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Suggest a new category (requires authentication, pending admin approval)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Create slug from name
    slug = data.name.lower().replace(" ", "-").replace("&", "and")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")

    # Check if category name or slug already exists
    existing = db.execute(
        text("SELECT id FROM community_categories WHERE LOWER(name) = LOWER(:name) OR slug = :slug"),
        {"name": data.name, "slug": slug}
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="A category with this name already exists")

    category_id = str(uuid.uuid4())

    db.execute(
        text("""
            INSERT INTO community_categories
                (id, name, slug, description, icon, is_approved, created_by)
            VALUES
                (:id, :name, :slug, :description, :icon, FALSE, :created_by)
        """),
        {
            "id": category_id,
            "name": data.name,
            "slug": slug,
            "description": data.description,
            "icon": data.icon,
            "created_by": user["id"]
        }
    )
    db.commit()

    return {
        "success": True,
        "message": "Category suggestion submitted for admin approval",
        "id": category_id
    }


@router.get("/posts")
async def list_posts(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """List all posts, optionally filtered by category"""
    user = get_user_from_token(current_user, db)
    user_id = str(user["id"]) if user else None

    query = """
        SELECT
            p.id, p.category_id, p.category_name, p.title, p.content,
            p.is_anonymous, p.is_pinned, p.is_locked,
            p.upvotes, p.reply_count, p.view_count, p.created_at,
            CASE WHEN p.is_anonymous THEN 'Anonymous'
                 ELSE COALESCE(u.first_name || ' ' || u.last_name, u.email, 'User')
            END as author_name,
            p.user_id as author_id
    """

    if user_id:
        query += """,
            v.direction as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN community_votes v ON v.post_id = p.id AND v.user_id = :user_id
        """
    else:
        query += """,
            NULL as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        """

    params = {"user_id": user_id} if user_id else {}

    if category:
        query += " WHERE (LOWER(p.category_name) = LOWER(:category) OR LOWER(REPLACE(p.category_name, ' ', '-')) = LOWER(:category) OR p.category_id = :category)"
        params["category"] = category

    query += " ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 50"

    result = db.execute(text(query), params)
    posts = [dict(row._mapping) for row in result]

    return posts


@router.get("/posts/trending")
async def get_trending(
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Get trending posts based on upvotes and views"""
    user = get_user_from_token(current_user, db)
    user_id = str(user["id"]) if user else None

    query = """
        SELECT
            p.id, p.category_id, p.category_name, p.title, p.content,
            p.is_anonymous, p.is_pinned, p.is_locked,
            p.upvotes, p.reply_count, p.view_count, p.created_at,
            CASE WHEN p.is_anonymous THEN 'Anonymous'
                 ELSE COALESCE(u.first_name || ' ' || u.last_name, u.email, 'User')
            END as author_name,
            p.user_id as author_id,
            (p.upvotes * 2 + p.view_count * 0.1 + p.reply_count * 3) as trending_score
    """

    if user_id:
        query += """,
            v.direction as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN community_votes v ON v.post_id = p.id AND v.user_id = :user_id
        """
    else:
        query += """,
            NULL as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        """

    query += " ORDER BY trending_score DESC LIMIT 10"

    params = {"user_id": user_id} if user_id else {}
    result = db.execute(text(query), params)
    posts = [dict(row._mapping) for row in result]

    # Remove the trending_score from response
    for post in posts:
        post.pop("trending_score", None)

    return posts


@router.post("/posts")
async def create_post(
    data: PostCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a new post (requires authentication)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    post_id = str(uuid.uuid4())
    category_name = get_category_name(data.category_id, db)

    db.execute(
        text("""
            INSERT INTO community_posts
                (id, user_id, category_id, category_name, title, content, is_anonymous)
            VALUES
                (:id, :user_id, :category_id, :category_name, :title, :content, :is_anonymous)
        """),
        {
            "id": post_id,
            "user_id": user["id"],
            "category_id": data.category_id,
            "category_name": category_name,
            "title": data.title,
            "content": data.content,
            "is_anonymous": data.is_anonymous
        }
    )
    db.commit()

    # Return the created post
    result = db.execute(
        text("""
            SELECT p.*,
                CASE WHEN p.is_anonymous THEN 'Anonymous'
                     ELSE COALESCE(u.first_name || ' ' || u.last_name, u.email, 'User')
                END as author_name
            FROM community_posts p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = :id
        """),
        {"id": post_id}
    ).first()

    return dict(result._mapping) if result else {"id": post_id}


@router.get("/posts/{post_id}")
async def get_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Get a specific post and increment view count"""
    user = get_user_from_token(current_user, db)
    user_id = str(user["id"]) if user else None

    # Increment view count
    db.execute(
        text("UPDATE community_posts SET view_count = view_count + 1 WHERE id = :id"),
        {"id": post_id}
    )
    db.commit()

    query = """
        SELECT
            p.id, p.category_id, p.category_name, p.title, p.content,
            p.is_anonymous, p.is_pinned, p.is_locked,
            p.upvotes, p.reply_count, p.view_count, p.created_at,
            p.user_id as author_id,
            CASE WHEN p.is_anonymous THEN 'Anonymous'
                 ELSE COALESCE(u.first_name || ' ' || u.last_name, u.email, 'User')
            END as author_name
    """

    if user_id:
        query += """,
            v.direction as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN community_votes v ON v.post_id = p.id AND v.user_id = :user_id
        WHERE p.id = :post_id
        """
    else:
        query += """,
            NULL as user_voted
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = :post_id
        """

    params = {"post_id": post_id}
    if user_id:
        params["user_id"] = user_id

    result = db.execute(text(query), params).first()

    if not result:
        raise HTTPException(status_code=404, detail="Post not found")

    return dict(result._mapping)


@router.put("/posts/{post_id}")
async def update_post(
    post_id: str,
    data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a post (only by author)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check ownership
    result = db.execute(
        text("SELECT user_id FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(result.user_id) != str(user["id"]):
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    updates = []
    params = {"id": post_id}

    if data.title:
        updates.append("title = :title")
        params["title"] = data.title
    if data.content:
        updates.append("content = :content")
        params["content"] = data.content

    updates.append("updated_at = NOW()")

    if updates:
        db.execute(
            text(f"UPDATE community_posts SET {', '.join(updates)} WHERE id = :id"),
            params
        )
        db.commit()

    return {"success": True, "message": "Post updated"}


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a post (only by author)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check ownership
    result = db.execute(
        text("SELECT user_id FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Post not found")

    if str(result.user_id) != str(user["id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    db.execute(text("DELETE FROM community_posts WHERE id = :id"), {"id": post_id})
    db.commit()

    return {"success": True, "message": "Post deleted"}


@router.get("/posts/{post_id}/replies")
async def get_replies(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    """Get replies for a post"""
    user = get_user_from_token(current_user, db)
    user_id = str(user["id"]) if user else None

    # Check post exists
    post = db.execute(
        text("SELECT id FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    query = """
        SELECT
            r.id, r.post_id, r.content, r.is_anonymous,
            r.upvotes, r.created_at, r.parent_reply_id,
            r.user_id as author_id,
            CASE WHEN r.is_anonymous THEN 'Anonymous'
                 ELSE COALESCE(u.first_name || ' ' || u.last_name, u.email, 'User')
            END as author_name
    """

    if user_id:
        query += """,
            v.direction as user_voted
        FROM community_replies r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN community_votes v ON v.reply_id = r.id AND v.user_id = :user_id
        WHERE r.post_id = :post_id
        ORDER BY r.upvotes DESC, r.created_at ASC
        """
    else:
        query += """,
            NULL as user_voted
        FROM community_replies r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.post_id = :post_id
        ORDER BY r.upvotes DESC, r.created_at ASC
        """

    params = {"post_id": post_id}
    if user_id:
        params["user_id"] = user_id

    result = db.execute(text(query), params)
    replies = [dict(row._mapping) for row in result]

    return replies


@router.post("/posts/{post_id}/replies")
async def create_reply(
    post_id: str,
    data: ReplyCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Create a reply to a post (requires authentication)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check post exists and is not locked
    post = db.execute(
        text("SELECT id, is_locked FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.is_locked:
        raise HTTPException(status_code=403, detail="Post is locked")

    reply_id = str(uuid.uuid4())

    db.execute(
        text("""
            INSERT INTO community_replies
                (id, post_id, user_id, content, is_anonymous, parent_reply_id)
            VALUES
                (:id, :post_id, :user_id, :content, :is_anonymous, :parent_reply_id)
        """),
        {
            "id": reply_id,
            "post_id": post_id,
            "user_id": user["id"],
            "content": data.content,
            "is_anonymous": data.is_anonymous,
            "parent_reply_id": data.parent_reply_id
        }
    )

    # Update reply count
    db.execute(
        text("UPDATE community_posts SET reply_count = reply_count + 1 WHERE id = :id"),
        {"id": post_id}
    )
    db.commit()

    return {"id": reply_id, "success": True}


@router.post("/posts/{post_id}/vote")
async def vote_post(
    post_id: str,
    data: VoteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Vote on a post (requires authentication)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = str(user["id"])

    # Check post exists
    post = db.execute(
        text("SELECT id, upvotes FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check existing vote
    existing = db.execute(
        text("SELECT direction FROM community_votes WHERE user_id = :user_id AND post_id = :post_id"),
        {"user_id": user_id, "post_id": post_id}
    ).first()

    if existing:
        if existing.direction == data.direction:
            # Remove vote
            db.execute(
                text("DELETE FROM community_votes WHERE user_id = :user_id AND post_id = :post_id"),
                {"user_id": user_id, "post_id": post_id}
            )
            if data.direction == "up":
                db.execute(
                    text("UPDATE community_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = :id"),
                    {"id": post_id}
                )
            user_voted = None
        else:
            # Change vote
            db.execute(
                text("UPDATE community_votes SET direction = :direction WHERE user_id = :user_id AND post_id = :post_id"),
                {"direction": data.direction, "user_id": user_id, "post_id": post_id}
            )
            if data.direction == "up":
                db.execute(
                    text("UPDATE community_posts SET upvotes = upvotes + 2 WHERE id = :id"),
                    {"id": post_id}
                )
            else:
                db.execute(
                    text("UPDATE community_posts SET upvotes = GREATEST(0, upvotes - 2) WHERE id = :id"),
                    {"id": post_id}
                )
            user_voted = data.direction
    else:
        # New vote
        db.execute(
            text("""
                INSERT INTO community_votes (user_id, post_id, direction)
                VALUES (:user_id, :post_id, :direction)
            """),
            {"user_id": user_id, "post_id": post_id, "direction": data.direction}
        )
        if data.direction == "up":
            db.execute(
                text("UPDATE community_posts SET upvotes = upvotes + 1 WHERE id = :id"),
                {"id": post_id}
            )
        else:
            db.execute(
                text("UPDATE community_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = :id"),
                {"id": post_id}
            )
        user_voted = data.direction

    db.commit()

    # Get updated count
    result = db.execute(
        text("SELECT upvotes FROM community_posts WHERE id = :id"),
        {"id": post_id}
    ).first()

    return {"upvotes": result.upvotes, "user_voted": user_voted}


@router.post("/replies/{reply_id}/vote")
async def vote_reply(
    reply_id: str,
    data: VoteRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Vote on a reply (requires authentication)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = str(user["id"])

    # Check reply exists
    reply = db.execute(
        text("SELECT id, upvotes FROM community_replies WHERE id = :id"),
        {"id": reply_id}
    ).first()

    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Similar vote logic as posts
    existing = db.execute(
        text("SELECT direction FROM community_votes WHERE user_id = :user_id AND reply_id = :reply_id"),
        {"user_id": user_id, "reply_id": reply_id}
    ).first()

    if existing:
        if existing.direction == data.direction:
            db.execute(
                text("DELETE FROM community_votes WHERE user_id = :user_id AND reply_id = :reply_id"),
                {"user_id": user_id, "reply_id": reply_id}
            )
            if data.direction == "up":
                db.execute(
                    text("UPDATE community_replies SET upvotes = GREATEST(0, upvotes - 1) WHERE id = :id"),
                    {"id": reply_id}
                )
            user_voted = None
        else:
            db.execute(
                text("UPDATE community_votes SET direction = :direction WHERE user_id = :user_id AND reply_id = :reply_id"),
                {"direction": data.direction, "user_id": user_id, "reply_id": reply_id}
            )
            if data.direction == "up":
                db.execute(
                    text("UPDATE community_replies SET upvotes = upvotes + 2 WHERE id = :id"),
                    {"id": reply_id}
                )
            else:
                db.execute(
                    text("UPDATE community_replies SET upvotes = GREATEST(0, upvotes - 2) WHERE id = :id"),
                    {"id": reply_id}
                )
            user_voted = data.direction
    else:
        db.execute(
            text("""
                INSERT INTO community_votes (user_id, reply_id, direction)
                VALUES (:user_id, :reply_id, :direction)
            """),
            {"user_id": user_id, "reply_id": reply_id, "direction": data.direction}
        )
        if data.direction == "up":
            db.execute(
                text("UPDATE community_replies SET upvotes = upvotes + 1 WHERE id = :id"),
                {"id": reply_id}
            )
        else:
            db.execute(
                text("UPDATE community_replies SET upvotes = GREATEST(0, upvotes - 1) WHERE id = :id"),
                {"id": reply_id}
            )
        user_voted = data.direction

    db.commit()

    result = db.execute(
        text("SELECT upvotes FROM community_replies WHERE id = :id"),
        {"id": reply_id}
    ).first()

    return {"upvotes": result.upvotes, "user_voted": user_voted}


@router.put("/replies/{reply_id}")
async def update_reply(
    reply_id: str,
    data: ReplyUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Update a reply (only by author)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("SELECT user_id FROM community_replies WHERE id = :id"),
        {"id": reply_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Reply not found")

    if str(result.user_id) != str(user["id"]):
        raise HTTPException(status_code=403, detail="You can only edit your own replies")

    db.execute(
        text("UPDATE community_replies SET content = :content, updated_at = NOW() WHERE id = :id"),
        {"id": reply_id, "content": data.content}
    )
    db.commit()

    return {"success": True, "message": "Reply updated"}


@router.delete("/replies/{reply_id}")
async def delete_reply(
    reply_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a reply (only by author)"""
    user = get_user_from_token(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(
        text("SELECT user_id, post_id FROM community_replies WHERE id = :id"),
        {"id": reply_id}
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="Reply not found")

    if str(result.user_id) != str(user["id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own replies")

    db.execute(text("DELETE FROM community_replies WHERE id = :id"), {"id": reply_id})

    # Update reply count
    db.execute(
        text("UPDATE community_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = :id"),
        {"id": result.post_id}
    )
    db.commit()

    return {"success": True, "message": "Reply deleted"}
