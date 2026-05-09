"""Mux video integration — direct upload + webhook handling."""

import base64
import hashlib
import hmac
import json
import logging
import time

import httpx

from polar.config import settings

log = logging.getLogger(__name__)

MUX_API_BASE = "https://api.mux.com"
MUX_STREAM_BASE = "https://stream.mux.com"
MUX_IMAGE_BASE = "https://image.mux.com"


def signing_keys_configured() -> bool:
    return bool(settings.MUX_SIGNING_KEY_ID and settings.MUX_SIGNING_KEY_PRIVATE)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=MUX_API_BASE,
        auth=(settings.MUX_TOKEN_ID, settings.MUX_TOKEN_SECRET),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


async def create_direct_upload(cors_origin: str = "*") -> dict:
    """Create a Mux direct upload URL. Returns {upload_id, upload_url}.

    Uses signed playback when signing keys are configured so only the API
    can mint streaming URLs. Falls back to public for backwards-compat.
    """
    playback_policy = "signed" if signing_keys_configured() else "public"
    async with _client() as client:
        resp = await client.post(
            "/video/v1/uploads",
            json={
                "cors_origin": cors_origin,
                "new_asset_settings": {
                    "playback_policy": [playback_policy],
                    "mp4_support": "none",
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"upload_id": data["id"], "upload_url": data["url"]}


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_playback_token(playback_id: str, *, audience: str) -> str | None:
    """Mint a short-lived JWT for a Mux signed playback id.

    audience: 'v' for HLS streams, 't' for thumbnails, 's' for storyboards,
    'g' for gifs (per Mux docs).
    Returns None when signing keys are not configured (callers should treat
    this as "use a public URL").
    """
    if not signing_keys_configured():
        return None
    try:
        from authlib.jose import jwt  # type: ignore[import-not-found]
    except ImportError:  # pragma: no cover - fallback for older deps
        return _sign_token_fallback(playback_id, audience)

    header = {"alg": "RS256", "kid": settings.MUX_SIGNING_KEY_ID, "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": playback_id,
        "aud": audience,
        "exp": now + settings.MUX_SIGNED_URL_TTL_SECONDS,
        "kid": settings.MUX_SIGNING_KEY_ID,
    }
    try:
        token = jwt.encode(header, payload, settings.MUX_SIGNING_KEY_PRIVATE)
    except Exception:  # pragma: no cover - misconfigured key
        log.exception("Failed to sign Mux playback token")
        return None
    return token.decode("ascii") if isinstance(token, bytes) else token


def _sign_token_fallback(playback_id: str, audience: str) -> str | None:
    """Manual RS256 signing fallback used when authlib is unavailable.

    Requires `cryptography`, which is already a transitive dep of httpx[http2]
    and authlib elsewhere in the codebase.
    """
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
    except ImportError:  # pragma: no cover
        return None
    header = {"alg": "RS256", "kid": settings.MUX_SIGNING_KEY_ID, "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": playback_id,
        "aud": audience,
        "exp": now + settings.MUX_SIGNED_URL_TTL_SECONDS,
        "kid": settings.MUX_SIGNING_KEY_ID,
    }
    header_b = _b64url(json.dumps(header, separators=(",", ":")).encode())
    payload_b = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b}.{payload_b}".encode()
    try:
        key = serialization.load_pem_private_key(
            settings.MUX_SIGNING_KEY_PRIVATE.encode(), password=None
        )
        signature = key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
    except Exception:  # pragma: no cover
        log.exception("Failed to sign Mux playback token (fallback)")
        return None
    return f"{header_b}.{payload_b}.{_b64url(signature)}"


def playback_url(playback_id: str | None) -> str | None:
    """Return an HLS URL for a Mux playback id, signed when possible."""
    if not playback_id:
        return None
    token = sign_playback_token(playback_id, audience="v")
    base = f"{MUX_STREAM_BASE}/{playback_id}.m3u8"
    return f"{base}?token={token}" if token else base


def thumbnail_url(playback_id: str | None, *, time_offset: float = 1.0) -> str | None:
    """Return a thumbnail URL for a Mux playback id, signed when possible."""
    if not playback_id:
        return None
    token = sign_playback_token(playback_id, audience="t")
    base = f"{MUX_IMAGE_BASE}/{playback_id}/thumbnail.jpg?time={time_offset}"
    return f"{base}&token={token}" if token else base


async def get_asset_by_upload(upload_id: str) -> dict | None:
    """Poll Mux for an asset created from a direct upload."""
    async with _client() as client:
        resp = await client.get(f"/video/v1/uploads/{upload_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()["data"]
        asset_id = data.get("asset_id")
        if not asset_id:
            return None
        asset_resp = await client.get(f"/video/v1/assets/{asset_id}")
        asset_resp.raise_for_status()
        return asset_resp.json()["data"]


def verify_webhook_signature(body: bytes, signature_header: str) -> bool:
    """Verify Mux webhook HMAC-SHA256 signature.

    signature_header format: "t=<timestamp>,v1=<hex_digest>"

    Outside of development/testing the webhook secret is required: missing
    secret is treated as a hard failure rather than a bypass.
    """
    if not settings.MUX_WEBHOOK_SECRET:
        if settings.is_development() or settings.is_testing():
            return True
        return False
    try:
        parts = dict(p.split("=", 1) for p in signature_header.split(","))
        timestamp = parts["t"]
        expected_sig = parts["v1"]
        # Reject stale webhooks (> 5 minutes)
        if abs(time.time() - int(timestamp)) > 300:
            return False
        mac = hmac.new(
            settings.MUX_WEBHOOK_SECRET.encode(),
            f"{timestamp}.".encode() + body,
            hashlib.sha256,
        )
        return hmac.compare_digest(mac.hexdigest(), expected_sig)
    except Exception:
        return False


async def delete_asset(asset_id: str) -> bool:
    """Delete a Mux video asset. Returns True on success or 404 (already
    gone), False on transient failures so the caller can retry."""
    if not asset_id or not settings.MUX_TOKEN_ID or not settings.MUX_TOKEN_SECRET:
        return False
    async with _client() as client:
        try:
            resp = await client.delete(f"/video/v1/assets/{asset_id}")
        except httpx.HTTPError:
            log.exception("Failed to call Mux delete asset", extra={"asset_id": asset_id})
            return False
    if resp.status_code in (200, 204, 404):
        return True
    log.warning(
        "Mux delete returned non-success status",
        extra={"asset_id": asset_id, "status": resp.status_code},
    )
    return False
