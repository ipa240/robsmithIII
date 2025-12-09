"""Support API - Help tickets and contact management"""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db

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
async def list_user_tickets(db: Session = Depends(get_db)):
    """Get current user's support tickets"""
    # TODO: Get from user context and database
    mock_tickets = [
        {
            "id": "ticket-001",
            "subject": "Question about facility scores",
            "status": "resolved",
            "created_at": "2025-11-28T14:30:00Z",
            "last_reply_at": "2025-11-29T09:15:00Z"
        },
        {
            "id": "ticket-002",
            "subject": "Billing question",
            "status": "open",
            "created_at": "2025-12-05T11:00:00Z",
            "last_reply_at": None
        }
    ]

    return {"tickets": mock_tickets}


@router.post("/tickets")
async def create_ticket(request: CreateTicketRequest, db: Session = Depends(get_db)):
    """Create a new support ticket"""
    # TODO: Save to database and send email notification

    return {
        "success": True,
        "ticket_id": "ticket-new-001",
        "message": "Your ticket has been submitted. We'll respond within 24 hours."
    }


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Get a specific support ticket with messages"""
    return {
        "id": ticket_id,
        "subject": "Question about facility scores",
        "category": "data",
        "status": "resolved",
        "created_at": "2025-11-28T14:30:00Z",
        "messages": [
            {
                "id": "msg-1",
                "sender": "user",
                "content": "How is the OFS score calculated?",
                "created_at": "2025-11-28T14:30:00Z"
            },
            {
                "id": "msg-2",
                "sender": "support",
                "content": "The OFS score is calculated using 10 different indices including pay competitiveness, employee reviews, patient experience, and more. You can find more details on our Scoring Methodology page.",
                "created_at": "2025-11-29T09:15:00Z"
            }
        ]
    }


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: str,
    message: str,
    db: Session = Depends(get_db)
):
    """Add a reply to a support ticket"""
    return {
        "success": True,
        "message_id": "msg-new-001"
    }


@router.post("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, db: Session = Depends(get_db)):
    """Close a support ticket"""
    return {
        "success": True,
        "ticket_id": ticket_id,
        "status": "closed"
    }
