"""
Billing endpoints — Stripe + Razorpay checkout, webhooks.

Dispatches transactional emails on:
- successful checkout (receipt)
- subscription renewal (receipt)
- failed payment (dunning)
- plan upgrade (confirmation)
- plan cancel (goodbye + reactivate nudge)

Email send failures are caught and logged — they never block the
user-facing action.
"""

import os
import secrets
from datetime import datetime
from urllib.parse import urlencode

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.security import AuthUser, get_current_user
from app.services.email import email_service

logger = structlog.get_logger()
router = APIRouter()

# Where customers land after the various flows.
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://app.getpdfpro.com")
BILLING_PORTAL_URL = f"{APP_BASE_URL}/account/billing"
SETTINGS_URL = f"{APP_BASE_URL}/account"


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
    locale: str = "en"


@router.post("/checkout")
async def create_checkout_session(
    req: CheckoutRequest,
    user: AuthUser = Depends(get_current_user),
) -> dict:
    """
    Create a checkout session (Stripe or Razorpay).

    In a real implementation we'd hand off to Stripe/Razorpay SDK
    here. To keep the email wiring testable in dev, we accept the
    request, dispatch a receipt email, and return a fake session
    id. The real provider integration is a TODO.
    """
    plan = next((p for p in await list_plans() if p.id == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan id")
    if req.payment_provider not in ("stripe", "razorpay"):
        raise HTTPException(400, "Invalid payment provider")

    amount = (
        plan.price_usd_monthly if req.payment_provider == "stripe" else plan.price_inr_monthly
    )
    currency = "USD" if req.payment_provider == "stripe" else "INR"
    receipt_id = f"rc_{secrets.token_hex(8)}"

    # Receipt email — never block the response on it.
    try:
        await email_service.send_payment_receipt(
            to=user.email,
            locale=req.locale,
            amount=amount,
            currency=currency,
            plan=plan.name,
            invoice_url=f"{BILLING_PORTAL_URL}/invoices/{receipt_id}",
            receipt_id=receipt_id,
        )
    except Exception as e:
        logger.warning(
            "checkout_receipt_email_failed", email=user.email, error=str(e)
        )

    # TODO: real Stripe / Razorpay checkout session creation.
    return {
        "session_id": f"cs_{secrets.token_hex(8)}",
        "receipt_id": receipt_id,
        "provider": req.payment_provider,
        "plan": plan.id,
        "checkout_url": req.success_url,
    }


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict:
    """
    Handle Stripe webhook events.

    TODO: signature verification, idempotency, and the full event
    catalog. The dispatch calls below are wired so that once the
    SDK integration lands the emails fire automatically.
    """
    # TODO: verify signature
    # TODO: parse event

    # Placeholder — in real life this comes from request.json()
    event = {"type": "invoice.payment_succeeded", "data": {"object": {}}}

    # ─── Renewal succeeded → receipt email
    if event["type"] == "invoice.payment_succeeded":
        obj = event["data"]["object"]
        try:
            await email_service.send_payment_receipt(
                to=obj.get("customer_email", ""),
                locale=obj.get("locale", "en"),
                amount=obj.get("amount_due", 0) / 100,
                currency=obj.get("currency", "USD").upper(),
                plan=obj.get("plan_name", "Pro"),
                invoice_url=obj.get("invoice_pdf", BILLING_PORTAL_URL),
                receipt_id=obj.get("id"),
            )
        except Exception as e:
            logger.warning("renewal_receipt_email_failed", error=str(e))

    # ─── Renewal failed → dunning email
    elif event["type"] == "invoice.payment_failed":
        obj = event["data"]["object"]
        try:
            await email_service.send_payment_failed(
                to=obj.get("customer_email", ""),
                locale=obj.get("locale", "en"),
                amount=obj.get("amount_due", 0) / 100,
                currency=obj.get("currency", "USD").upper(),
                plan=obj.get("plan_name", "Pro"),
                update_payment_url=BILLING_PORTAL_URL,
            )
        except Exception as e:
            logger.warning("payment_failed_email_failed", error=str(e))

    # ─── Plan upgraded
    elif event["type"] == "customer.subscription.updated":
        obj = event["data"]["object"]
        prev = obj.get("previous_plan")
        new = obj.get("plan_name", "Pro")
        if prev and prev != new:
            try:
                await email_service.send_plan_upgraded(
                    to=obj.get("customer_email", ""),
                    locale=obj.get("locale", "en"),
                    plan=new,
                    next_billing_date=datetime.fromtimestamp(
                        obj.get("current_period_end", 0)
                    ),
                    explore_url=f"{APP_BASE_URL}/dashboard",
                )
            except Exception as e:
                logger.warning("plan_upgrade_email_failed", error=str(e))

    # ─── Subscription cancelled
    elif event["type"] == "customer.subscription.deleted":
        obj = event["data"]["object"]
        try:
            await email_service.send_plan_cancelled(
                to=obj.get("customer_email", ""),
                locale=obj.get("locale", "en"),
                plan=obj.get("plan_name", "Pro"),
                period_end=datetime.fromtimestamp(
                    obj.get("current_period_end", 0)
                ),
                reactivate_url=f"{BILLING_PORTAL_URL}/reactivate",
            )
        except Exception as e:
            logger.warning("plan_cancel_email_failed", error=str(e))

    return {"received": True}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request) -> dict:
    """
    Handle Razorpay webhook events.

    TODO: signature verification. Same email dispatch pattern as
    Stripe — keep them in sync.
    """
    # TODO: verify signature
    # TODO: parse event
    return {"received": True}
