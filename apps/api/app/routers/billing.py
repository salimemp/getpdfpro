"""Billing endpoints — Stripe checkout + webhook handler.

These endpoints are wired up but inert until Stripe credentials are
set in the environment. The web client checks for the
NEXT_PUBLIC_STRIPE_ENABLED flag before calling /billing/*.

Endpoints:
- POST /api/v1/billing/create-checkout-session
    Body: { interval: "monthly" | "yearly", plan: "pro" }
    Returns: { url: "https://checkout.stripe.com/..." } on success,
             503 with a helpful message if Stripe isn't configured.
- POST /api/v1/billing/webhook
    Stripe sends subscription events here. We verify the signature,
    then update the user's plan in Supabase.
"""

from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Pydantic schemas ──────────────────────────────────────────
class CheckoutRequest(BaseModel):
    interval: Literal["monthly", "yearly"] = "yearly"
    plan: Literal["pro"] = "pro"


class CheckoutResponse(BaseModel):
    url: str = Field(..., description="Stripe Checkout URL to redirect to")
    session_id: str = Field(..., description="Stripe session ID for tracking")


# ─── Helpers ────────────────────────────────────────────────────
def _stripe_configured() -> bool:
    """True iff both STRIPE_SECRET_KEY and the price IDs are set."""
    return bool(
        os.getenv("STRIPE_SECRET_KEY")
        and os.getenv("STRIPE_PRICE_PRO_MONTHLY")
        and os.getenv("STRIPE_PRICE_PRO_YEARLY")
        and os.getenv("STRIPE_WEBHOOK_SECRET")
    )


def _price_id_for(interval: str) -> str:
    if interval == "monthly":
        return os.environ["STRIPE_PRICE_PRO_MONTHLY"]
    return os.environ["STRIPE_PRICE_PRO_YEARLY"]


# ─── Endpoints ──────────────────────────────────────────────────
@router.post(
    "/billing/create-checkout-session",
    response_model=CheckoutResponse,
    summary="Create a Stripe Checkout session for Pro",
)
async def create_checkout_session(
    req: CheckoutRequest,
    request: Request,
) -> CheckoutResponse:
    """Create a Stripe Checkout session and return the redirect URL.

    The web client calls this when the user clicks 'Upgrade to Pro',
    then redirects them to the returned URL. The actual payment
    happens on Stripe's hosted page; on success the user lands
    back on /account and the webhook has updated their plan in
    Supabase.
    """
    if not _stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Stripe isn't configured yet. Until it is, claim a "
                "free beta spot at /beta to get 6 months of Pro."
            ),
        )

    # We need the user's email + Supabase user ID. The client sends
    # them in a header so we don't have to re-verify the JWT here
    # (the Supabase JWT verification requires the JWKS endpoint,
    # which we'll wire up once the project is configured).
    user_id = request.headers.get("X-User-Id")
    user_email = request.headers.get("X-User-Email")
    if not user_id or not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id / X-User-Email headers. Sign in first.",
        )

    import stripe  # imported lazily so the module loads even when STRIPE_SECRET_KEY is missing

    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

    origin = request.headers.get("Origin") or "https://app.getpdfpro.com"

    try:
        checkout = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": _price_id_for(req.interval), "quantity": 1}],
            customer_email=user_email,
            client_reference_id=user_id,
            success_url=f"{origin}/account?checkout=success",
            cancel_url=f"{origin}/pricing?checkout=cancelled",
            metadata={
                "user_id": user_id,
                "plan": req.plan,
                "interval": req.interval,
            },
            subscription_data={
                "metadata": {
                    "user_id": user_id,
                    "plan": req.plan,
                },
            },
            allow_promotion_codes=True,
        )
    except Exception as exc:
        logger.exception("Stripe checkout session creation failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe error: {exc.__class__.__name__}",
        ) from exc

    return CheckoutResponse(url=checkout.url, session_id=checkout.id)


@router.post(
    "/billing/webhook",
    summary="Stripe webhook receiver",
    include_in_schema=False,  # Stripe doesn't care about our OpenAPI
)
async def stripe_webhook(request: Request) -> dict:
    """Handle Stripe webhook events.

    Subscribes to:
      - checkout.session.completed   → activate Pro
      - customer.subscription.updated → update plan tier
      - customer.subscription.deleted → downgrade to free
      - invoice.payment_failed        → flag the user

    Verifies the signature with STRIPE_WEBHOOK_SECRET before doing
    anything. Returns 200 on success, 4xx on bad signatures.
    """
    if not _stripe_configured():
        raise HTTPException(503, "Stripe not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ["STRIPE_WEBHOOK_SECRET"]

    import stripe

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid signature: {exc}",
        ) from exc

    event_type = event.get("type")
    logger.info("stripe_webhook", extra={"type": event_type})

    # TODO: update Supabase user_metadata.plan based on the event.
    # Requires a Supabase admin client (service-role key) on the API
    # side. The pattern is:
    #
    #   from supabase import create_client
    #   supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    #
    #   if event_type == "checkout.session.completed":
    #       sub = event["data"]["object"]
    #       user_id = sub["client_reference_id"]
    #       supabase_admin.auth.admin.update_user_by_id(
    #           user_id, {"user_metadata": {"plan": "pro"}}
    #       )
    #   elif event_type == "customer.subscription.deleted":
    #       ... plan: "free" ...
    #
    # We add this once the Supabase project is live and we have the
    # service role key in the env. For now, log the event and return
    # 200 so Stripe doesn't retry.
    logger.info(
        "stripe_event_received",
        extra={"type": event_type, "id": event.get("id")},
    )

    return {"received": True}
