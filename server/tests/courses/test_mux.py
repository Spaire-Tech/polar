"""Unit tests for the Mux signed-playback + webhook hardening fixes."""

import hashlib
import hmac
import time
from unittest.mock import patch

from polar.config import Environment
from polar.course import mux as mux_client

# ──────────────────────────────────────────────────────────────────────────
# Webhook signature verification — env-gated bypass
# ──────────────────────────────────────────────────────────────────────────


class TestWebhookSignature:
    def _signed_header(self, secret: str, body: bytes, ts: int | None = None) -> str:
        ts = ts or int(time.time())
        mac = hmac.new(
            secret.encode(),
            f"{ts}.".encode() + body,
            hashlib.sha256,
        )
        return f"t={ts},v1={mac.hexdigest()}"

    def test_valid_signature_passes(self) -> None:
        body = b'{"type":"video.asset.ready"}'
        with patch.object(
            mux_client.settings, "MUX_WEBHOOK_SECRET", "shh"
        ):
            header = self._signed_header("shh", body)
            assert mux_client.verify_webhook_signature(body, header) is True

    def test_wrong_secret_fails(self) -> None:
        body = b'{"type":"video.asset.ready"}'
        with patch.object(
            mux_client.settings, "MUX_WEBHOOK_SECRET", "right"
        ):
            header = self._signed_header("wrong", body)
            assert mux_client.verify_webhook_signature(body, header) is False

    def test_stale_timestamp_fails(self) -> None:
        body = b'{"type":"video.asset.ready"}'
        with patch.object(
            mux_client.settings, "MUX_WEBHOOK_SECRET", "shh"
        ):
            stale = int(time.time()) - 600  # 10 minutes ago
            header = self._signed_header("shh", body, ts=stale)
            assert mux_client.verify_webhook_signature(body, header) is False

    def test_missing_secret_in_dev_passes(self) -> None:
        with patch.object(mux_client.settings, "MUX_WEBHOOK_SECRET", ""):
            with patch.object(
                mux_client.settings, "ENV", Environment.development
            ):
                assert mux_client.verify_webhook_signature(b"any", "") is True

    def test_missing_secret_in_test_passes(self) -> None:
        with patch.object(mux_client.settings, "MUX_WEBHOOK_SECRET", ""):
            with patch.object(
                mux_client.settings, "ENV", Environment.testing
            ):
                assert mux_client.verify_webhook_signature(b"any", "") is True

    def test_missing_secret_in_production_fails(self) -> None:
        with patch.object(mux_client.settings, "MUX_WEBHOOK_SECRET", ""):
            with patch.object(
                mux_client.settings, "ENV", Environment.production
            ):
                assert mux_client.verify_webhook_signature(b"any", "") is False

    def test_malformed_header_fails(self) -> None:
        with patch.object(
            mux_client.settings, "MUX_WEBHOOK_SECRET", "shh"
        ):
            assert mux_client.verify_webhook_signature(b"x", "garbage") is False
            assert mux_client.verify_webhook_signature(b"x", "") is False


# ──────────────────────────────────────────────────────────────────────────
# Signed playback URL minting
# ──────────────────────────────────────────────────────────────────────────


class TestPlaybackUrl:
    def test_returns_none_for_null_id(self) -> None:
        assert mux_client.playback_url(None) is None

    def test_unsigned_when_keys_not_configured(self) -> None:
        with patch.object(mux_client.settings, "MUX_SIGNING_KEY_ID", ""):
            with patch.object(
                mux_client.settings, "MUX_SIGNING_KEY_PRIVATE", ""
            ):
                url = mux_client.playback_url("abc123")
        assert url == "https://stream.mux.com/abc123.m3u8"

    def test_thumbnail_unsigned_when_keys_not_configured(self) -> None:
        with patch.object(mux_client.settings, "MUX_SIGNING_KEY_ID", ""):
            with patch.object(
                mux_client.settings, "MUX_SIGNING_KEY_PRIVATE", ""
            ):
                url = mux_client.thumbnail_url("abc123")
        # Default time_offset=1.0 (audit fix to avoid the time=0 black frame)
        assert url == "https://image.mux.com/abc123/thumbnail.jpg?time=1.0"

    def test_thumbnail_returns_none_for_null_id(self) -> None:
        assert mux_client.thumbnail_url(None) is None
