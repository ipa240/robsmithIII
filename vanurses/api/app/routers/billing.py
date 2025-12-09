"""Billing & Subscription API - Real Stripe Integration"""
import stripe
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..config import get_settings
from ..auth.zitadel import get_current_user_optional, CurrentUser

router = APIRouter(prefix="/api/billing", tags=["billing"])

# Get settings (loaded from .env)
settings = get_settings()

# Stripe configuration
stripe.api_key = settings.stripe_secret_key
STRIPE_WEBHOOK_SECRET = settings.stripe_webhook_secret

# Price ID mapping from settings
PRICE_IDS = {
    "starter": {
        "monthly": settings.stripe_price_starter_monthly,
        "yearly": settings.stripe_price_starter_yearly,
    },
    "pro": {
        "monthly": settings.stripe_price_pro_monthly,
        "yearly": settings.stripe_price_pro_yearly,
    },
    "premium": {
        "monthly": settings.stripe_price_premium_monthly,
        "yearly": settings.stripe_price_premium_yearly,
    },
    "hr_admin": {
        "monthly": settings.stripe_price_hr_monthly,
        "yearly": settings.stripe_price_hr_yearly,
    },
}

TOKEN_PACK_PRICES = {
    "small": settings.stripe_price_tokens_small,
    "medium": settings.stripe_price_tokens_medium,
    "large": settings.stripe_price_tokens_large,
}

TOKEN_PACK_AMOUNTS = {
    "small": 25,
    "medium": 60,
    "large": 150,
}

# Subscription tiers with feature limits
TIERS = {
    "free": {
        "name": "Free",
        "monthly_price": 0,
        "yearly_price": 0,
        "sully_daily_limit": 3,
        "nofilter_limit": 1,  # Free users get 1 NoFilter chat to try it
        "comparison_limit": 0,
        "saved_jobs_limit": 5,
        "pdf_export": False,
        "personalized_results": False,
        "resume_builder": False,
        "features": [
            "Browse all jobs",
            "Basic OFS grades",
            "3 Sully AI chats/day",
            "1 free NoFilter chat",
            "5 saved jobs max"
        ]
    },
    "starter": {
        "name": "Starter",
        "monthly_price": 900,
        "yearly_price": 8600,
        "sully_daily_limit": 10,
        "nofilter_limit": 0,  # No NoFilter in starter
        "comparison_limit": 2,
        "saved_jobs_limit": -1,  # unlimited
        "pdf_export": False,
        "personalized_results": False,
        "resume_builder": False,
        "features": [
            "Full 10-index breakdown",
            "10 Sully AI chats/day",
            "Compare 2 facilities",
            "Unlimited saved jobs",
            "Advanced filters"
        ]
    },
    "pro": {
        "name": "Pro",
        "monthly_price": 1900,
        "yearly_price": 18200,
        "sully_daily_limit": 25,
        "nofilter_limit": -1,  # unlimited
        "comparison_limit": 5,
        "saved_jobs_limit": -1,
        "pdf_export": False,
        "personalized_results": True,
        "resume_builder": False,
        "features": [
            "Everything in Starter",
            "25 Sully AI chats/day",
            "Unlimited NoFilter mode",
            "Personalized job scoring",
            "Compare 5 facilities",
            "Trend alerts"
        ]
    },
    "premium": {
        "name": "Premium",
        "monthly_price": 2900,
        "yearly_price": 27800,
        "sully_daily_limit": -1,  # unlimited
        "nofilter_limit": -1,
        "comparison_limit": -1,
        "saved_jobs_limit": -1,
        "pdf_export": True,
        "personalized_results": True,
        "resume_builder": True,
        "features": [
            "Everything in Pro",
            "Unlimited Sully AI",
            "Resume builder",
            "PDF exports",
            "Unlimited facility compare",
            "Priority support"
        ]
    },
    "hr_admin": {
        "name": "HR/Admin",
        "monthly_price": 9900,
        "yearly_price": 95000,
        "sully_daily_limit": -1,
        "nofilter_limit": -1,
        "comparison_limit": -1,
        "saved_jobs_limit": -1,
        "pdf_export": True,
        "personalized_results": True,
        "resume_builder": True,
        "features": [
            "Everything in Premium",
            "Facility management",
            "Job posting",
            "Analytics dashboard",
            "Team accounts"
        ]
    }
}

# Trial limits (more restricted than Pro)
TRIAL_LIMITS = {
    "sully_daily_limit": 5,
    "nofilter_limit": 0,  # No NoFilter during trial
    "comparison_limit": 2,
    "saved_jobs_limit": 10,
    "personalized_results": False,  # No personalized results in trial
    "resume_builder": False,
    "pdf_export": False,
}


class SubscriptionStatus(BaseModel):
    tier: str
    tier_name: str
    is_active: bool
    expires_at: Optional[datetime]
    sully_daily_limit: int
    sully_questions_today: int
    nofilter_limit: int
    nofilter_used: int
    tokens_remaining: int
    saved_jobs_limit: int
    comparison_limit: int
    features: list
    trial_ends_at: Optional[datetime]
    is_trial: bool
    can_access_personalized: bool
    can_access_resume_builder: bool
    can_export_pdf: bool


class CheckoutRequest(BaseModel):
    tier: str
    billing_period: str = "monthly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class TokenPurchaseRequest(BaseModel):
    pack: str  # small, medium, large
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


async def get_user_from_zitadel(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get database user from Zitadel JWT token"""
    if not current_user:
        return None
    
    try:
        # Look up user by email (primary) or oauth_id (fallback)
        user = db.execute(
            text("""
                SELECT * FROM users 
                WHERE email = :email 
                   OR (oauth_provider = 'zitadel' AND oauth_provider_id = :oauth_id)
                LIMIT 1
            """),
            {"email": current_user.email, "oauth_id": current_user.zitadel_id}
        ).first()
        return user
    except Exception as e:
        print(f"Error looking up user: {e}")
        return None



def count_sully_today(user_id: str, db: Session) -> int:
    """Count user's Sully interactions today"""
    result = db.execute(
        text("""
            SELECT COUNT(*) FROM sully_interactions
            WHERE user_id = :user_id
            AND created_at >= CURRENT_DATE
        """),
        {"user_id": user_id}
    ).scalar()
    return result or 0


def get_nofilter_used(user_id: str, db: Session) -> int:
    """Get total NoFilter chats used by user"""
    result = db.execute(
        text("""
            SELECT COALESCE(nofilter_used, 0) FROM users WHERE id = :user_id
        """),
        {"user_id": user_id}
    ).scalar()
    return result or 0


@router.get("/status")
async def get_subscription_status(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get current user's subscription status"""
    user = await get_user_from_zitadel(current_user, db)

    if not user:
        # Return free tier for unauthenticated users
        return SubscriptionStatus(
            tier="free",
            tier_name="Free",
            is_active=True,
            expires_at=None,
            sully_daily_limit=TIERS["free"]["sully_daily_limit"],
            sully_questions_today=0,
            nofilter_limit=TIERS["free"]["nofilter_limit"],
            nofilter_used=0,
            tokens_remaining=0,
            saved_jobs_limit=TIERS["free"]["saved_jobs_limit"],
            comparison_limit=TIERS["free"]["comparison_limit"],
            features=TIERS["free"]["features"],
            trial_ends_at=None,
            is_trial=False,
            can_access_personalized=False,
            can_access_resume_builder=False,
            can_export_pdf=False
        )

    user_dict = dict(user._mapping)
    user_id = str(user_dict["id"])
    tier = user_dict.get("tier", "free")
    trial_ends = user_dict.get("trial_ends_at")
    period_ends = user_dict.get("current_period_ends_at")
    ai_credits = user_dict.get("ai_credits", 0) or 0

    # Check if in trial
    is_trial = False
    if trial_ends and trial_ends > datetime.now():
        is_trial = True

    # Get tier config
    tier_config = TIERS.get(tier, TIERS["free"])

    # If in trial, apply trial limits
    if is_trial:
        sully_limit = TRIAL_LIMITS["sully_daily_limit"]
        nofilter_limit = TRIAL_LIMITS["nofilter_limit"]
        comparison_limit = TRIAL_LIMITS["comparison_limit"]
        saved_limit = TRIAL_LIMITS["saved_jobs_limit"]
        can_personalized = TRIAL_LIMITS["personalized_results"]
        can_resume = TRIAL_LIMITS["resume_builder"]
        can_pdf = TRIAL_LIMITS["pdf_export"]
    else:
        sully_limit = tier_config["sully_daily_limit"]
        nofilter_limit = tier_config["nofilter_limit"]
        comparison_limit = tier_config["comparison_limit"]
        saved_limit = tier_config["saved_jobs_limit"]
        can_personalized = tier_config["personalized_results"]
        can_resume = tier_config["resume_builder"]
        can_pdf = tier_config["pdf_export"]

    sully_today = count_sully_today(user_id, db)
    nofilter_used = get_nofilter_used(user_id, db)

    return SubscriptionStatus(
        tier=tier,
        tier_name=tier_config["name"],
        is_active=True,
        expires_at=period_ends,
        sully_daily_limit=sully_limit,
        sully_questions_today=sully_today,
        nofilter_limit=nofilter_limit,
        nofilter_used=nofilter_used,
        tokens_remaining=ai_credits,
        saved_jobs_limit=saved_limit,
        comparison_limit=comparison_limit,
        features=tier_config["features"],
        trial_ends_at=trial_ends,
        is_trial=is_trial,
        can_access_personalized=can_personalized,
        can_access_resume_builder=can_resume,
        can_export_pdf=can_pdf
    )


@router.get("/tiers")
async def get_tiers():
    """Get all available subscription tiers - includes free for display"""
    # Define order for display
    tier_order = ["free", "starter", "pro", "premium", "hr_admin"]
    tiers = []
    for tier_id in tier_order:
        if tier_id in TIERS:
            tier_data = TIERS[tier_id]
            tiers.append({
                "id": tier_id,
                "name": tier_data["name"],
                "monthly_price": tier_data.get("monthly_price", 0),
                "yearly_price": tier_data.get("yearly_price", 0),
                "features": tier_data["features"],
                "popular": tier_id == "pro"
            })
    return {"tiers": tiers}


@router.get("/token-packs")
async def get_token_packs():
    """Get available token packs"""
    return {
        "packs": [
            {"id": "small", "name": "Small Pack", "tokens": 25, "price": 500},
            {"id": "medium", "name": "Medium Pack", "tokens": 60, "price": 1000, "bonus": "20% bonus!"},
            {"id": "large", "name": "Large Pack", "tokens": 150, "price": 2000, "bonus": "50% bonus!"},
        ]
    }


@router.post("/checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Create Stripe checkout session for subscription"""
    if request.tier not in PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    price_id = PRICE_IDS[request.tier].get(request.billing_period)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid billing period")

    user = await get_user_from_zitadel(current_user, db)

    # For subscriptions, we need a customer - create one for the user
    customer_id = None
    user_email = None
    user_id = None

    if user:
        user_dict = dict(user._mapping)
        user_email = user_dict.get("email")
        user_id = str(user_dict["id"])
        customer_id = user_dict.get("stripe_customer_id")

        if not customer_id and user_email:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"user_id": user_id}
            )
            customer_id = customer.id

            # Save customer ID to user
            db.execute(
                text("UPDATE users SET stripe_customer_id = :cid WHERE id = :uid"),
                {"cid": customer_id, "uid": user_dict["id"]}
            )
            db.commit()

    # Default URLs
    base_url = "https://vanurses.net"
    success_url = request.success_url or f"{base_url}/billing?success=true"
    cancel_url = request.cancel_url or f"{base_url}/billing?cancelled=true"

    # Create checkout session
    session_params = {
        "mode": "subscription",
        "payment_method_types": ["card"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "tier": request.tier,
            "billing_period": request.billing_period,
        },
        "subscription_data": {
            "metadata": {"tier": request.tier}
        },
        "allow_promotion_codes": True,
    }

    if customer_id:
        # Use existing customer
        session_params["customer"] = customer_id
    elif user_email:
        # Pre-fill email for new customer
        session_params["customer_email"] = user_email
    # If no user, Stripe will collect email during checkout

    if user_id:
        session_params["metadata"]["user_id"] = user_id
        session_params["subscription_data"]["metadata"]["user_id"] = user_id

    try:
        session = stripe.checkout.Session.create(**session_params)
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "tier": request.tier,
            "billing_period": request.billing_period
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/tokens")
async def purchase_tokens(
    request: TokenPurchaseRequest,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Purchase token pack (one-time payment)"""
    if request.pack not in TOKEN_PACK_PRICES:
        raise HTTPException(status_code=400, detail="Invalid token pack")

    price_id = TOKEN_PACK_PRICES[request.pack]
    if not price_id:
        raise HTTPException(status_code=400, detail="Token pack not configured")

    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    customer_id = user_dict.get("stripe_customer_id")

    if not customer_id:
        # Create Stripe customer
        customer = stripe.Customer.create(
            email=user_dict.get("email"),
            metadata={"user_id": str(user_dict["id"])}
        )
        customer_id = customer.id
        db.execute(
            text("UPDATE users SET stripe_customer_id = :cid WHERE id = :uid"),
            {"cid": customer_id, "uid": user_dict["id"]}
        )
        db.commit()

    base_url = "https://vanurses.net"
    success_url = request.success_url or f"{base_url}/billing?tokens=success"
    cancel_url = request.cancel_url or f"{base_url}/billing?cancelled=true"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": str(user_dict["id"]),
                "pack": request.pack,
                "tokens": TOKEN_PACK_AMOUNTS[request.pack],
                "type": "token_purchase"
            }
        )
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "pack": request.pack,
            "tokens": TOKEN_PACK_AMOUNTS[request.pack]
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal")
async def create_billing_portal(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Create Stripe billing portal session for managing subscription"""
    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    customer_id = user_dict.get("stripe_customer_id")

    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing history found")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="https://vanurses.net/billing"
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Verify webhook signature
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        else:
            # For testing without webhook secret
            import json
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event.type
    data = event.data.object

    # Handle subscription events
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.created":
        await handle_subscription_created(data, db)
    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data, db)
    elif event_type == "invoice.payment_succeeded":
        await handle_payment_succeeded(data, db)
    elif event_type == "invoice.payment_failed":
        await handle_payment_failed(data, db)

    return {"received": True}


async def handle_checkout_completed(session, db: Session):
    """Handle successful checkout"""
    metadata = session.get("metadata", {})

    # Handle token purchase
    if metadata.get("type") == "token_purchase":
        user_id = metadata.get("user_id")
        tokens = int(metadata.get("tokens", 0))
        pack = metadata.get("pack")

        if user_id and tokens:
            # Add tokens to user
            db.execute(
                text("""
                    UPDATE users
                    SET ai_credits = COALESCE(ai_credits, 0) + :tokens
                    WHERE id = :user_id
                """),
                {"tokens": tokens, "user_id": user_id}
            )
            db.commit()

    # Subscription checkout - subscription.created will handle the rest


async def handle_subscription_created(subscription, db: Session):
    """Handle new subscription created"""
    customer_id = subscription.get("customer")
    tier = subscription.get("metadata", {}).get("tier", "starter")
    subscription_id = subscription.get("id")
    status = subscription.get("status")
    current_period_end = subscription.get("current_period_end")

    if current_period_end:
        period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
    else:
        period_end = None

    # Find user by stripe customer ID
    result = db.execute(
        text("SELECT id FROM users WHERE stripe_customer_id = :cid"),
        {"cid": customer_id}
    ).first()

    if result:
        user_id = result.id
        db.execute(
            text("""
                UPDATE users SET
                    tier = :tier,
                    subscription_status = :status,
                    stripe_subscription_id = :sub_id,
                    current_period_ends_at = :period_end
                WHERE id = :user_id
            """),
            {
                "tier": tier,
                "status": status,
                "sub_id": subscription_id,
                "period_end": period_end,
                "user_id": user_id
            }
        )

        # Also insert into subscriptions table
        db.execute(
            text("""
                INSERT INTO subscriptions (user_id, stripe_subscription_id, tier, status, current_period_end)
                VALUES (:user_id, :sub_id, :tier, :status, :period_end)
                ON CONFLICT (stripe_subscription_id) DO UPDATE SET
                    tier = :tier,
                    status = :status,
                    current_period_end = :period_end,
                    updated_at = NOW()
            """),
            {
                "user_id": user_id,
                "sub_id": subscription_id,
                "tier": tier,
                "status": status,
                "period_end": period_end
            }
        )
        db.commit()


async def handle_subscription_updated(subscription, db: Session):
    """Handle subscription update (upgrade/downgrade/renewal)"""
    subscription_id = subscription.get("id")
    status = subscription.get("status")
    tier = subscription.get("metadata", {}).get("tier")
    current_period_end = subscription.get("current_period_end")
    cancel_at_period_end = subscription.get("cancel_at_period_end", False)

    if current_period_end:
        period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
    else:
        period_end = None

    # Update user by subscription ID
    update_fields = {
        "status": status,
        "sub_id": subscription_id,
        "period_end": period_end
    }

    sql = """
        UPDATE users SET
            subscription_status = :status,
            current_period_ends_at = :period_end
    """

    if tier:
        sql += ", tier = :tier"
        update_fields["tier"] = tier

    sql += " WHERE stripe_subscription_id = :sub_id"

    db.execute(text(sql), update_fields)

    # Update subscriptions table
    db.execute(
        text("""
            UPDATE subscriptions SET
                status = :status,
                current_period_end = :period_end,
                cancel_at_period_end = :cancel,
                updated_at = NOW()
            WHERE stripe_subscription_id = :sub_id
        """),
        {
            "status": status,
            "period_end": period_end,
            "cancel": cancel_at_period_end,
            "sub_id": subscription_id
        }
    )
    db.commit()


async def handle_subscription_deleted(subscription, db: Session):
    """Handle subscription cancellation"""
    subscription_id = subscription.get("id")

    # Downgrade user to free tier
    db.execute(
        text("""
            UPDATE users SET
                tier = 'free',
                subscription_status = 'cancelled',
                current_period_ends_at = NULL
            WHERE stripe_subscription_id = :sub_id
        """),
        {"sub_id": subscription_id}
    )

    db.execute(
        text("""
            UPDATE subscriptions SET
                status = 'cancelled',
                canceled_at = NOW(),
                updated_at = NOW()
            WHERE stripe_subscription_id = :sub_id
        """),
        {"sub_id": subscription_id}
    )
    db.commit()


async def handle_payment_succeeded(invoice, db: Session):
    """Handle successful payment"""
    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    # Reactivate subscription if it was past_due
    db.execute(
        text("""
            UPDATE users SET subscription_status = 'active'
            WHERE stripe_subscription_id = :sub_id AND subscription_status = 'past_due'
        """),
        {"sub_id": subscription_id}
    )
    db.commit()


async def handle_payment_failed(invoice, db: Session):
    """Handle failed payment"""
    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    # Mark subscription as past_due
    db.execute(
        text("""
            UPDATE users SET subscription_status = 'past_due'
            WHERE stripe_subscription_id = :sub_id
        """),
        {"sub_id": subscription_id}
    )
    db.commit()


@router.get("/history")
async def get_billing_history(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get user's billing history from Stripe"""
    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    customer_id = user_dict.get("stripe_customer_id")

    if not customer_id:
        return {"transactions": []}

    try:
        # Get invoices from Stripe
        invoices = stripe.Invoice.list(customer=customer_id, limit=20)

        transactions = []
        for invoice in invoices.data:
            transactions.append({
                "id": invoice.id,
                "date": datetime.fromtimestamp(invoice.created).isoformat(),
                "description": invoice.lines.data[0].description if invoice.lines.data else "Subscription",
                "amount": invoice.amount_paid,
                "status": invoice.status,
                "invoice_url": invoice.hosted_invoice_url
            })

        return {"transactions": transactions}
    except stripe.error.StripeError:
        return {"transactions": []}


@router.post("/cancel")
async def cancel_subscription(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Cancel user's subscription at period end"""
    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    subscription_id = user_dict.get("stripe_subscription_id")

    if not subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    try:
        # Cancel at period end (don't immediately cancel)
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )

        return {
            "cancelled": True,
            "effective_date": datetime.fromtimestamp(subscription.current_period_end).isoformat(),
            "message": "Your subscription will remain active until the end of your billing period."
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reactivate")
async def reactivate_subscription(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Reactivate a subscription that was set to cancel"""
    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    subscription_id = user_dict.get("stripe_subscription_id")

    if not subscription_id:
        raise HTTPException(status_code=400, detail="No subscription to reactivate")

    try:
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=False
        )

        return {
            "reactivated": True,
            "message": "Your subscription has been reactivated."
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/sync")
async def sync_subscription(
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Sync subscription status from Stripe.
    Call this after returning from Stripe checkout to ensure tier is updated.
    """
    user = await get_user_from_zitadel(current_user, db)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_dict = dict(user._mapping)
    user_id = user_dict["id"]
    user_email = user_dict.get("email")
    current_customer_id = user_dict.get("stripe_customer_id")

    if not user_email:
        raise HTTPException(status_code=400, detail="User email not found")

    try:
        # First try to find customer by existing customer ID
        customer_id = current_customer_id

        # If no customer ID stored, search by email
        if not customer_id:
            customers = stripe.Customer.list(email=user_email, limit=1)
            if customers.data:
                customer_id = customers.data[0].id
                # Store the customer ID
                db.execute(
                    text("UPDATE users SET stripe_customer_id = :cid WHERE id = :uid"),
                    {"cid": customer_id, "uid": user_id}
                )
                db.commit()

        if not customer_id:
            return {
                "synced": False,
                "tier": "free",
                "message": "No Stripe customer found for this email"
            }

        # Get active subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=customer_id,
            status="active",
            limit=1
        )

        if not subscriptions.data:
            # Check for trialing subscriptions too
            subscriptions = stripe.Subscription.list(
                customer=customer_id,
                status="trialing",
                limit=1
            )

        if subscriptions.data:
            sub = subscriptions.data[0]
            tier = sub.metadata.get("tier", "starter")
            subscription_id = sub.id
            status = sub.status
            current_period_end = sub.current_period_end

            if current_period_end:
                period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
            else:
                period_end = None

            # Update user in database
            db.execute(
                text("""
                    UPDATE users SET
                        tier = :tier,
                        stripe_customer_id = :cid,
                        stripe_subscription_id = :sub_id,
                        subscription_status = :status,
                        current_period_ends_at = :period_end
                    WHERE id = :user_id
                """),
                {
                    "tier": tier,
                    "cid": customer_id,
                    "sub_id": subscription_id,
                    "status": status,
                    "period_end": period_end,
                    "user_id": user_id
                }
            )
            db.commit()

            return {
                "synced": True,
                "tier": tier,
                "tier_name": TIERS.get(tier, TIERS["free"])["name"],
                "status": status,
                "expires_at": period_end.isoformat() if period_end else None,
                "message": f"Subscription synced! You are now on the {TIERS.get(tier, TIERS['free'])['name']} plan."
            }
        else:
            # No active subscription found - ensure user is on free tier
            db.execute(
                text("""
                    UPDATE users SET
                        tier = 'free',
                        stripe_customer_id = :cid
                    WHERE id = :user_id
                """),
                {"cid": customer_id, "user_id": user_id}
            )
            db.commit()

            return {
                "synced": True,
                "tier": "free",
                "tier_name": "Free",
                "message": "No active subscription found"
            }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
