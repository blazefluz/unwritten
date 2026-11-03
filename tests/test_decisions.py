"""Synthetic evaluations: assert scoring and chronological isolation, not model quality."""
import pytest

from tests.test_engine import FakeClient
from unwritten.decisions import evaluate


def sample():
    return {'events': [dict(id=f'e{i}', time_start=i*2, time_end=i*2+1,
        action=f'UNIQUE_ACTION_{i}', visible_evidence=f'UNIQUE_EVIDENCE_{i}',
        observed_result=f'UNIQUE_RESULT_{i}', uncertainties=[]) for i in range(5)]}


def test_no_future_evidence_and_deterministic_score():
    labels = dict(zip([f'e{i}' for i in range(5)], ['inspect', 'inspect', 'adjust', 'adjust', 'inspect']))
    fake = FakeClient([{'rules': ['Synthetic rule']},
        {'action_label': 'adjust', 'reason': 'test', 'uncertainty': 'test'},
        {'action_label': '', 'reason': 'unknown', 'uncertainty': 'insufficient evidence'}])
    result = evaluate(fake, sample(), labels)
    assert 'UNIQUE_ACTION_3' not in fake.prompts[0][1]
    for index, (_, prompt) in zip([3, 4], fake.prompts[1:]):
        assert f'UNIQUE_ACTION_{index}' not in prompt
        assert f'UNIQUE_EVIDENCE_{index}' not in prompt
        assert f'UNIQUE_RESULT_{index}' not in prompt
    assert 'UNIQUE_ACTION_3' in fake.prompts[2][1]
    assert result['score'] == {'correct': 1, 'total': 2, 'abstained': 1, 'baseline_correct': 1}


def test_invalid_labels_and_overlap_fail_before_model_calls():
    fake = FakeClient([])
    with pytest.raises(ValueError):
        evaluate(fake, sample(), {})
    obs = sample()
    obs['events'][0]['time_end'] = 10
    with pytest.raises(ValueError):
        evaluate(fake, obs, {f'e{i}': 'inspect' for i in range(5)})
    assert not fake.prompts


def test_invalid_prediction_is_not_silently_scored():
    fake = FakeClient([{'rules': []},
        {'action_label': 'invented', 'reason': '', 'uncertainty': ''}])
    with pytest.raises(ValueError):
        evaluate(fake, sample(), {f'e{i}': 'inspect' for i in range(5)})
