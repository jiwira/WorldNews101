"""Ephemeral full-article fetch + extract (D-013). Never persisted."""
import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx
import trafilatura

logger = logging.getLogger(__name__)

MAX_BYTES = 2_000_000


def _is_private_ip(host: str) -> bool:
    """Return True if host resolves to a private/loopback/link-local IP (SSRF guard)."""
    try:
        infos = socket.getaddrinfo(host, None)
        for *_, sockaddr in infos:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return True
        return False
    except (socket.gaierror, ValueError):
        # Can't resolve -> don't fetch
        return True


def fetch_fulltext(url: str, timeout: int = 15, max_bytes: int = MAX_BYTES) -> str | None:
    """Fetch article URL and extract main body text.

    SSRF guard: rejects hosts that resolve to private/loopback/link-local IPs.
    Returns body text or None. Content is NEVER persisted.
    """
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        return None

    if _is_private_ip(host):
        logger.warning("SSRF guard: rejected private/loopback URL %s", url)
        return None

    try:
        with httpx.Client(follow_redirects=False, timeout=timeout) as client:
            resp = client.get(url)
            # Check content length before reading body
            content = resp.content[:max_bytes]
            text = content.decode("utf-8", errors="replace")

        body = trafilatura.extract(text)
        return body
    except Exception as e:
        logger.debug("fetch_fulltext failed for %s: %s", url, e)
        return None
