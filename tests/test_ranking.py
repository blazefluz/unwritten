"""Synthetic checks of leakage boundaries, fixed denominators and baselines."""
import pytest
from tests.test_engine import FakeClient
from unwritten.ranking import evaluate, winner


def test_rule_sees_only_training_values_and_preferences():
    data=[{'id':'a','voltage_v':4.48},{'id':'b','voltage_v':-4.51},
          {'id':'c','voltage_v':3.501234},{'id':'d','voltage_v':None}]
    fake=FakeClient([{'transform':'absolute','direction':'higher','reason':'synthetic','limitations':''}])
    result=evaluate(fake,data,['b','a','c','d'],training_ids=['a','b'])
    prompt=fake.prompts[0][1]
    assert '3.501234' not in prompt and '"id": "c"' not in prompt
    assert result['score']=={'correct':2,'total':4,'abstained':2,'baseline_correct':2}
    assert result['held_out_ids']==['c','d']


def test_signed_and_magnitude_comparators_differ_and_ties_abstain():
    a={'id':'a','voltage_v':-4.51};b={'id':'b','voltage_v':4.48}
    assert winner(a,b,{'transform':'absolute','direction':'higher'})=='a'
    assert winner(a,b,{'transform':'identity','direction':'higher'})=='b'
    assert winner(a,a,{'transform':'absolute','direction':'higher'}) is None
    assert winner({'id':'n','voltage_v':float('nan')},b,{'transform':'absolute','direction':'higher'}) is None


def test_incomplete_reference_cannot_silently_drop_predictions():
    fake=FakeClient([])
    with pytest.raises(ValueError):
        evaluate(fake,[{'id':'a','voltage_v':1},{'id':'b','voltage_v':2}],['a'],training_ids=['a'])
    assert not fake.prompts
