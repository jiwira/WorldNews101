"""Test the SSRF guard in fulltext.py (Addendum A2)."""
from worldnews.fulltext import fetch_fulltext, _is_private_ip


def test_ssrf_guard_loopback_returns_none():
    """127.0.0.1 is loopback — must return None."""
    result = fetch_fulltext("http://127.0.0.1/some-article")
    assert result is None


def test_ssrf_guard_private_ip_class_a():
    """192.168.x.x is private — must return None."""
    result = fetch_fulltext("http://192.168.1.1/article")
    assert result is None


def test_is_private_ip_loopback():
    assert _is_private_ip("127.0.0.1") is True


def test_is_private_ip_localhost():
    assert _is_private_ip("localhost") is True


def test_is_private_ip_public():
    # A real public IP — should NOT be private
    # We use a known public IP to avoid DNS resolution
    assert _is_private_ip("1.1.1.1") is False
