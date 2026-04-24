"""Mux video integration — direct upload + webhook handling."""

import hashlib
import hmac
import time

import httpx

from polar.config import settings

MUX_API_BASE = "https://api.mux.com"


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=MUX_API_BASE,
        auth=(settings.MUX_TOKEN_ID, settings.MUX_TOKEN_SECRET),
        headers={"Content-Type": "application/json"},
        timeout=30,
    )


async def create_direct_upload(cors_origin: str = "*") -> dict:
    """Create a Mux direct upload URL. Returns {upload_id, upload_url}."""
    async with _client() as client:
        resp = await client.post(
            "/video/v1/uploads",
            json={
                "cors_origin": cors_origin,
                "new_asset_settings": {
                    "playback_policy": ["public"],
                    "mp4_support": "none",
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        return {"upload_id": data["id"], "upload_url": data["url"]}


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
    """
    if not settings.MUX_WEBHOOK_SECRET:
        return True  # Skip verification if secret not configured (dev only)
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
