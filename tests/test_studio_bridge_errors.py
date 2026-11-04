from unittest.mock import patch
import pytest
from unwritten.web_bridge import run

@pytest.mark.parametrize('exc,category', [
    (ValueError('private provider response'), 'invalid_response'),
    (type('APITimeoutError', (Exception,), {})(), 'timeout'),
    (type('AuthError', (Exception,), {'status_code': 401})(), 'authentication'),
    (type('RateError', (Exception,), {'status_code': 429})(), 'rate_limit'),
    (type('ProviderError', (Exception,), {'status_code': 503})(), 'provider_unavailable'),
])
def test_studio_failure_exposes_only_category(exc, category):
    with patch('unwritten.web_bridge.MetaClient'), patch('unwritten.studio.propose', side_effect=exc):
        assert run({'operation': 'studio'}) == {'bridge_error': category}
