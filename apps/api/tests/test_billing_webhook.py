"""
Tests for ``app.routers.billing.stripe_webhook``.

We test the handler body — the part that maps a verified Stripe
event to a Supabase ``update_user_by_id`` call. The signature
verification is Stripe's responsibility (we trust ``stripe.Webhook
.construct_event``) and is patched out in the test fixtures below
so the test is offline-only and doesn't need a webhook secret.

What we exercise:

* ``checkout.session.completed``     → ``user_metadata.plan = "pro"``
* ``customer.subscription.updated``  → same, for ``active`` / ``trialing``
* ``customer.subscription.deleted``  → ``user_metadata.plan = "free"``
* ``invoice.payment_failed``         → ``user_metadata.payment_failed = True``
* any other event type               → 200 OK, no Supabase call
* Supabase call failure              → 500, log included (so Stripe retries)

We use a tiny FastAPI app that mounts just the webhook route, plus
TestClient. The route is the production one — we don't redefine it
in the test, so the test stays in sync with the real route.

Test seam: ``stripe`` is imported lazily inside the handler, so we
patch ``stripe.Webhook.construct_event`` on the global ``stripe``
module (not on the router module). The router looks it up at call
time and finds the patched version.
"""

from __future__ import annotations

import importlib
import sys
from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import stripe
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ─── Fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture
def stripe_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set just enough env vars that ``_stripe_configured()`` returns
    True. The actual Stripe lib is never used because we patch
    ``construct_event`` below."""
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_placeholder")
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly_test")
    monkeypatch.setenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly_test")


@pytest.fixture
def mock_supabase_admin() -> MagicMock:
    """A MagicMock that pretends to be the supabase service-role
    client. Returns the ``update_user_by_id`` mock for fine-grained
    assertions."""
    admin = MagicMock()
    admin.auth.admin.update_user_by_id.return_value = MagicMock(id="user-x")
    return admin


@pytest.fixture
def construct_event_passthrough() -> Iterator[Any]:
    """Patch ``stripe.Webhook.construct_event`` so it returns whatever
    event the test set via ``.return_value``. Yields the patch so
    individual tests can set the per-call return value."""
    with patch.object(stripe.Webhook, "construct_event") as mock_construct:
        def _return_event(payload: bytes, *args: Any, **kwargs: Any) -> dict[str, Any]:
            return mock_construct.event
        mock_construct.side_effect = _return_event
        yield mock_construct


@pytest.fixture
def client(
    stripe_config: None,
    mock_supabase_admin: MagicMock,
    construct_event_passthrough: MagicMock,
) -> Iterator[TestClient]:
    """A TestClient wired to a minimal app that includes the
    production webhook route. We patch the supabase admin client
    builder inside the router module, plus we patch
    ``stripe.Webhook.construct_event`` (at the global stripe module
    level) so we can build fake events without a real signature."""
    if "app.routers.billing" in sys.modules:
        importlib.reload(sys.modules["app.routers.billing"])
    from app.routers import billing as billing_module  # noqa: WPS433

    app = FastAPI()
    app.include_router(billing_module.router, prefix="/api/v1")

    with patch.object(billing_module, "_supabase_admin", return_value=mock_supabase_admin):
        with TestClient(app) as c:
            yield c


def _post_webhook(
    client: TestClient,
    event: dict[str, Any],
    construct_event_passthrough: MagicMock,
) -> Any:
    """Set the event the patched construct_event will return, then
    POST to the webhook route."""
    construct_event_passthrough.event = event
    return client.post(
        "/api/v1/billing/webhook",
        content=b"{}",  # unused — patched out
        headers={"stripe-signature": "t=0,v1=fake"},
    )


# ─── Tests ────────────────────────────────────────────────────────────────
class TestCheckoutSessionCompleted:
    """``checkout.session.completed`` should mark the user as Pro."""

    def test_activates_pro_for_known_user(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_1",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_1",
                    "client_reference_id": "user-abc-123",
                    "metadata": {},
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"received": True}
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-abc-123",
            {"user_metadata": {"plan": "pro"}},
        )

    def test_uses_metadata_user_id_when_no_client_reference_id(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        """Some flows (renewals, customer-portal) won't set
        client_reference_id — the metadata.user_id fallback is what
        carries the link."""
        event = {
            "id": "evt_2",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_2",
                    "metadata": {"user_id": "user-from-meta-456"},
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-from-meta-456",
            {"user_metadata": {"plan": "pro"}},
        )

    def test_missing_user_id_does_not_call_supabase(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_3",
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_test_3", "metadata": {}}},
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_not_called()


class TestSubscriptionUpdated:
    """``customer.subscription.updated`` keeps the user on Pro for
    active / trialing statuses."""

    def test_active_status_activates_pro(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_4",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_1",
                    "status": "active",
                    "metadata": {"user_id": "user-active-1"},
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-active-1",
            {"user_metadata": {"plan": "pro"}},
        )

    def test_trialing_status_activates_pro(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_5",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_2",
                    "status": "trialing",
                    "client_reference_id": "user-trial-2",
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-trial-2",
            {"user_metadata": {"plan": "pro"}},
        )

    def test_past_due_status_does_not_call_supabase(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        """past_due is handled by the invoice.payment_failed path —
        we don't churn the user's plan on a single failed payment."""
        event = {
            "id": "evt_6",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_3",
                    "status": "past_due",
                    "client_reference_id": "user-past-due-3",
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_not_called()


class TestSubscriptionDeleted:
    """``customer.subscription.deleted`` should downgrade to free."""

    def test_deletes_downgrade_to_free(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_7",
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_del",
                    "metadata": {"user_id": "user-cancel-7"},
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-cancel-7",
            {"user_metadata": {"plan": "free"}},
        )


class TestInvoicePaymentFailed:
    """``invoice.payment_failed`` should flag the user, not
    auto-downgrade (Stripe will retry, and the user might pay
    in a few days)."""

    def test_flags_user_for_followup(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_8",
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "id": "in_fail_1",
                    "metadata": {"user_id": "user-fail-8"},
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        mock_supabase_admin.auth.admin.update_user_by_id.assert_called_once_with(
            "user-fail-8",
            {"user_metadata": {"payment_failed": True}},
        )


class TestUnrelatedEvent:
    """Any event we don't handle should return 200 with no Supabase
    call — so Stripe doesn't keep retrying."""

    def test_unknown_event_returns_200_no_supabase_call(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        event = {
            "id": "evt_9",
            "type": "charge.succeeded",
            "data": {"object": {"id": "ch_1"}},
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 200
        assert resp.json() == {"received": True}
        mock_supabase_admin.auth.admin.update_user_by_id.assert_not_called()


class TestSupabaseFailureReturns500:
    """If the Supabase call raises, the handler must NOT swallow
    it — return 500 so Stripe retries the webhook."""

    def test_supabase_failure_yields_500(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
    ) -> None:
        mock_supabase_admin.auth.admin.update_user_by_id.side_effect = RuntimeError(
            "supabase down"
        )
        event = {
            "id": "evt_10",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_x",
                    "client_reference_id": "user-err-10",
                }
            },
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 500
        # The error detail leaks the exception class name (not the
        # message) — confirms the failure surfaced rather than being
        # masked.
        assert "RuntimeError" in resp.json()["detail"]


class TestStripeNotConfigured:
    """When Stripe is not configured, the endpoint should 503 cleanly.
    This is the same path the existing ``_stripe_configured()`` check
    guards. We re-test it here for completeness."""

    def test_503_when_stripe_env_missing(
        self,
        client: TestClient,
        mock_supabase_admin: MagicMock,
        construct_event_passthrough: MagicMock,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
        monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
        monkeypatch.delenv("STRIPE_PRICE_PRO_MONTHLY", raising=False)
        monkeypatch.delenv("STRIPE_PRICE_PRO_YEARLY", raising=False)

        event = {
            "id": "evt_11",
            "type": "checkout.session.completed",
            "data": {"object": {"id": "cs_11", "client_reference_id": "u11"}},
        }
        resp = _post_webhook(client, event, construct_event_passthrough)
        assert resp.status_code == 503
