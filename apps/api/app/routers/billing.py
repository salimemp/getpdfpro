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
from typing import Any, Literal

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


def _supabase_admin():
    """Return a service-role Supabase client, or None if it's not
    configured. Imported lazily so the module loads even when the
    service role key is missing (the ``/billing/*`` endpoints then
    503 cleanly via ``_stripe_configured()`` / an explicit check)."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        return None
    from supabase import create_client  # lazy: avoids hard dep on supabase

    return create_client(url, key)


def _resolve_user_id(obj: dict[str, Any]) -> str | None:
    """Pull the Supabase user_id out of a Stripe event payload.

    Stripe event objects don't carry our user_id on every event type
    by default, so we look in two places:

    1. ``client_reference_id`` (checkout sessions — set by us at
       session-create time in ``create_checkout_session``).
    2. ``metadata.user_id`` (subscriptions, invoices — we set this
       in the ``metadata`` block of the checkout session and it
       carries over to the resulting subscription).
    """
    cid = obj.get("client_reference_id")
    if cid:
        return str(cid)
    metadata = obj.get("metadata") or {}
    uid = metadata.get("user_id")
    return str(uid) if uid else None


def _update_user_plan(user_id: str, plan: str) -> None:
    """Set ``user_metadata.plan`` on a Supabase user. Raises if the
    admin client is not configured or the API call fails."""
    admin = _supabase_admin()
    if admin is None:
        raise RuntimeError(
            "Supabase admin client is not configured "
            "(SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)"
        )
    admin.auth.admin.update_user_by_id(
        user_id, {"user_metadata": {"plan": plan}}
    )


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
    event_id = event.get("id")
    logger.info("stripe_webhook", extra={"type": event_type, "id": event_id})

    # ─── Plan-update dispatch ──────────────────────────────────
    # We don't fail the request for events we don't care about —
    # return 200 with no action so Stripe doesn't keep retrying.
    try:
        if event_type == "checkout.session.completed":
            obj = event["data"]["object"]
            user_id = _resolve_user_id(obj)
            if not user_id:
                logger.warning(
                    "checkout.session.completed without user_id; id=%s",
                    event_id,
                )
            else:
                _update_user_plan(user_id, "pro")
                logger.info(
                    "plan_updated", extra={"user_id": user_id, "plan": "pro"}
                )

        elif event_type == "customer.subscription.updated":
            # Map the subscription's status back to a plan string.
            # ``active`` and ``trialing`` keep the user on Pro; the
            # edge cases (past_due, etc.) are handled by the
            # invoice.payment_failed event below.
            obj = event["data"]["object"]
            status_ = obj.get("status")
            user_id = _resolve_user_id(obj)
            if status_ in ("active", "trialing") and user_id:
                _update_user_plan(user_id, "pro")
                logger.info(
                    "plan_updated",
                    extra={"user_id": user_id, "plan": "pro", "status": status_},
                )
            elif user_id:
                logger.info(
                    "subscription_updated_to_non_active",
                    extra={"user_id": user_id, "status": status_},
                )

        elif event_type == "customer.subscription.deleted":
            obj = event["data"]["object"]
            user_id = _resolve_user_id(obj)
            if user_id:
                _update_user_plan(user_id, "free")
                logger.info(
                    "plan_updated", extra={"user_id": user_id, "plan": "free"}
                )

        elif event_type == "invoice.payment_failed":
            # Don't auto-downgrade on a single failed payment — flag
            # the user for follow-up (Stripe will retry, and a future
            # ``customer.subscription.deleted`` will fire if it really
            # cancels). The flag is stored on the user_metadata so
            # the marketing/retention flow can pick it up.
            obj = event["data"]["object"]
            user_id = _resolve_user_id(obj)
            if user_id:
                admin = _supabase_admin()
                if admin is not None:
                    admin.auth.admin.update_user_by_id(
                        user_id,
                        {"user_metadata": {"payment_failed": True}},
                    )
                    logger.info(
                        "payment_failure_flagged",
                        extra={"user_id": user_id},
                    )

        else:
            # Any other event type — acknowledge so Stripe stops
            # retrying. We log it for observability.
            logger.info(
                "stripe_event_ignored",
                extra={"type": event_type, "id": event_id},
            )

    except Exception as exc:  # noqa: BLE001
        # Don't 500 silently — that swallows the real error. Log it
        # and re-raise as 500 so Stripe retries the webhook. We've
        # already verified the signature at this point, so the retry
        # is safe.
        logger.exception(
            "stripe_webhook_handler_failed",
            extra={"type": event_type, "id": event_id},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"handler error: {exc.__class__.__name__}",
        ) from exc

    return {"received": True}
