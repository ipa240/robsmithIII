"""Support API - Help tickets and contact management - Database Integrated"""
from typing import Optional
from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..auth.zitadel import get_current_user_with_db, CurrentUser

router = APIRouter(prefix="/api/support", tags=["support"])


class CreateTicketRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"


class TicketResponse(BaseModel):
    id: str
    subject: str
    message: str
    category: str
    status: str
    created_at: datetime
    last_reply_at: Optional[datetime] = None


@router.get("/tickets")
async def list_user_tickets(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user_with_db)
):
    """Get current user's support tickets from database"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(text("""
        SELECT
            st.id, st.subject, st.status, st.created_at,
            (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = st.id) as last_reply_at
        FROM support_tickets st
        WHERE st.user_id = :user_id
        ORDER BY st.created_at DESC
    """), {"user_id": current_user.user_id})

    tickets = []
    for row in result:
        tickets.append({
            "id": str(row.id),
            "subject": row.subject,
            "status": row.status or "open",
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "last_reply_at": row.last_reply_at.isoformat() if row.last_reply_at else None
        })

    return {"tickets": tickets}


@router.post("/tickets")
async def create_ticket(
    request: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user_with_db)
):
    """Create a new support ticket"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    ticket_id = str(uuid.uuid4())

    # Get user email
    user_result = db.execute(
        text("SELECT email FROM users WHERE id = :user_id"),
        {"user_id": current_user.user_id}
    ).first()

    user_email = user_result.email if user_result else current_user.email or "unknown@vanurses.net"

    db.execute(text("""
        INSERT INTO support_tickets (id, user_id, user_email, subject, message, status, priority)
        VALUES (:id, :user_id, :user_email, :subject, :message, 'open', 'normal')
    """), {
        "id": ticket_id,
        "user_id": current_user.user_id,
        "user_email": user_email,
        "subject": request.subject,
        "message": request.message
    })

    # Add the initial message
    db.execute(text("""
        INSERT INTO ticket_messages (ticket_id, sender_type, message)
        VALUES (:ticket_id, 'user', :message)
    """), {"ticket_id": ticket_id, "message": request.message})

    db.commit()

    return {
        "success": True,
        "ticket_id": ticket_id,
        "message": "Your ticket has been submitted. We'll respond within 24 hours."
    }


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user_with_db)
):
    """Get a specific support ticket with messages"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Get ticket
    ticket = db.execute(text("""
        SELECT id, subject, message, status, priority, created_at
        FROM support_tickets
        WHERE id = :ticket_id AND user_id = :user_id
    """), {"ticket_id": ticket_id, "user_id": current_user.user_id}).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Get messages
    messages_result = db.execute(text("""
        SELECT id, sender_type, message, created_at
        FROM ticket_messages
        WHERE ticket_id = :ticket_id
        ORDER BY created_at ASC
    """), {"ticket_id": ticket_id})

    messages = []
    for row in messages_result:
        messages.append({
            "id": str(row.id),
            "sender": row.sender_type,
            "content": row.message,
            "created_at": row.created_at.isoformat() if row.created_at else None
        })

    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "category": "general",
        "status": ticket.status or "open",
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "messages": messages
    }


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    message: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user_with_db)
):
    """Add a reply to a support ticket"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Verify ticket belongs to user
    ticket = db.execute(text("""
        SELECT id FROM support_tickets
        WHERE id = :ticket_id AND user_id = :user_id
    """), {"ticket_id": ticket_id, "user_id": current_user.user_id}).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message_id = str(uuid.uuid4())

    db.execute(text("""
        INSERT INTO ticket_messages (id, ticket_id, sender_type, message)
        VALUES (:id, :ticket_id, 'user', :message)
    """), {"id": message_id, "ticket_id": ticket_id, "message": message})

    # Reopen ticket if it was closed
    db.execute(text("""
        UPDATE support_tickets SET status = 'open', updated_at = NOW()
        WHERE id = :ticket_id
    """), {"ticket_id": ticket_id})

    db.commit()

    return {
        "success": True,
        "message_id": message_id
    }


@router.post("/tickets/{ticket_id}/close")
async def close_ticket(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user_with_db)
):
    """Close a support ticket"""
    if not current_user or not current_user.user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    result = db.execute(text("""
        UPDATE support_tickets SET status = 'closed', updated_at = NOW()
        WHERE id = :ticket_id AND user_id = :user_id
        RETURNING id
    """), {"ticket_id": ticket_id, "user_id": current_user.user_id}).first()

    if not result:
        raise HTTPException(status_code=404, detail="Ticket not found")

    db.commit()

    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": "closed"
    }
