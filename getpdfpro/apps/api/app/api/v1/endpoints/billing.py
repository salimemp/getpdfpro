"""
Billing endpoints — Stripe + Razorpay checkout, webhooks.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.security import AuthUser, get_current_user

logger = structlog.get_logger()
router = APIRouter()


class PlanInfo(BaseModel):
    id: str
    name: str
    price_usd_monthly: float
    price_inr_monthly: float
    features: list[str]
    max_file_size_mb: int
    ai_credits_per_month: int


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans() -> list[PlanInfo]:
    """List available subscription plans."""
    return [
        PlanInfo(
            id="free",
            name="Free",
            price_usd_monthly=0.0,
            price_inr_monthly=0.0,
            features=[
                "All 25+ PDF tools",
                "100MB max file size",
                "50 tasks/day",
                "50 AI prompts/month",
                "Community support",
            ],
            max_file_size_mb=100,
            ai_credits_per_month=50,
        ),
        PlanInfo(
            id="pro",
            name="Pro",
            price_usd_monthly=4.99,
            price_inr_monthly=399.0,
            features=[
                "All 25+ PDF tools",
                "4GB max file size",
                "Unlimited tasks",
                "1,000 AI prompts/month",
                "Voice read-aloud",
                "OCR included",
                "Priority support",
                "Ad-free",
            ],
            max_file_size_mb=4096,
            ai_credits_per_month=1000,
        ),
        PlanInfo(
            id="team",
            name="Team",
            price_usd_monthly=12.0,
            price_inr_monthly=999.0,
            features=[
                "Everything in Pro",
                "Shared workspaces",
                "Admin controls",
                "Team analytics",
                "SSO-ready",
                "Dedicated support",
            ],
            max_file_size_mb=4096,
            ai_credits_per_month=1000,
        ),
    ]


class CheckoutRequest(BaseModel):
    plan_id: str
    payment_provider: str  # "stripe" or "razorpay"
    success_url: str
    cancel_url: str


@router.post("/checkout")
async def create_checkout_session(
    req: CheckoutRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict:
    """Create a checkout session (Stripe or Razorpay)."""
    if req.payment_provider == "stripe":
        # TODO: implement Stripe Checkout
        raise HTTPException(501, "Stripe checkout not yet implemented")
    elif req.payment_provider == "razorpay":
        # TODO: implement Razorpay Checkout
        raise HTTPException(501, "Razorpay checkout not yet implemented")
    else:
        raise HTTPException(400, "Invalid payment provider")


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict:
    """Handle Stripe webhook events."""
    # TODO: verify signature, handle subscription.created, etc.
    return {"received": True}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request) -> dict:
    """Handle Razorpay webhook events."""
    # TODO: verify signature, handle subscription events
    return {"received": True}
