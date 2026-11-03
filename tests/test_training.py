"""Synthetic rule/feedback/approval tests. No real business or expert claims."""
import copy
import pytest
from tests.test_engine import FakeClient
from unwritten.training import (dataset_fingerprint, freeze, guide_markdown, inspect,
    predict, propose, validate_frozen, validate_project)


def rule(id,feature,value):
    return {'id':id,'title':f'Synthetic {id}','reason':'Scripted test rule',
        'evidence_case_ids':['t1','t2'],'steps':[{'if_all':[{'feature':feature,'op':'eq',
        'value':value,'other_feature':None,'absolute':False}],'then':'accept'}],'otherwise':'reject'}


def project():
    def case(id,v,s,split,label=None):
        return {'id':id,'summary':f'SYNTHETIC {id}','source':'Synthetic fixture',
            'time_start':None,'features':{'voltage':v,'scratch':s},'split':split,
            'outcome':label,'label_source':'Scripted fixture' if label else '', 'expert_reason':''}
    return {'version':1,'title':'SYNTHETIC training test','task':'Scripted decisions',
        'scope':'Not a real operating procedure','outcomes':['accept','reject'],
        'features':[{'key':'voltage','label':'Voltage','type':'number'},
                    {'key':'scratch','label':'Scratch visible','type':'boolean'}],
        'cases':[case('t1',5,False,'train','accept'),case('t2',3,True,'train','reject'),
            case('q1',5,True,'question'),case('x1',5,True,'test'),
            case('x2',3,False,'test'),case('x3',5,False,'test')], 'baseline_rule':None}


def study(p):
    return {'kind':'training_study','dataset_fingerprint':dataset_fingerprint(p),
        'created_at':'synthetic','provenance':'Synthetic fake client',
        'candidates':[rule('voltage','voltage',5),rule('scratch','scratch',False)],
        'direct_predictions':[{'case_id':f'x{i}','outcome':'accept','reason':'Synthetic'} for i in range(1,4)]}


def test_disagreement_question_uses_no_test_labels():
    p=project();s=study(p)
    initial=inspect(p,s)
    assert initial['active_rule_ids']==['voltage','scratch']
    assert [q['case_id'] for q in initial['questions']]==['q1']
    p['cases'][3]['outcome']='reject';p['cases'][3]['label_source']='Test reference'
    assert inspect(p,s)==initial
    p['cases'][2].update(outcome='reject',label_source='Synthetic expert',expert_reason='Scratch policy')
    updated=inspect(p,s)
    assert updated['active_rule_ids']==['scratch']
    assert updated['statuses'][0]['counterexample_ids']==['q1']


def test_missing_evidence_abstains_and_false_boolean_is_not_zero():
    r=rule('s','scratch',False)
    assert predict(r,{'scratch':None}) is None
    assert predict(r,{'scratch':0}) is None
    assert predict(r,{'scratch':False})=='accept'


def test_freeze_then_score_and_refuse_dataset_mutation(tmp_path):
    p=project();s=study(p)
    p['cases'][2].update(outcome='reject',label_source='Synthetic expert',expert_reason='Scratch policy')
    frozen=freeze(p,s,'scratch','Scripted test reviewer','SYNTHETIC ONLY','demo',store=tmp_path)
    assert frozen['consistent_before']==2 and frozen['consistent_after']==1
    assert 'DEMONSTRATION ONLY' in guide_markdown(frozen)
    with pytest.raises(ValueError):validate_frozen(frozen['id'],p,store=tmp_path)
    for c,label in zip(p['cases'][3:],['reject','accept','accept']):
        c.update(outcome=label,label_source='Scripted held-out reference')
    scored=validate_frozen(frozen['id'],p,store=tmp_path)
    assert scored['scores']['prediction']['correct']==3
    assert scored['scores']['consensus_before']['abstained']==2
    assert scored['scores']['consensus_after']['abstained']==0
    assert scored['scores']['direct_meta']['correct']==2
    assert validate_frozen(frozen['id'],p,store=tmp_path)==scored
    corrected=copy.deepcopy(p);corrected['cases'][3]['outcome']='accept'
    with pytest.raises(ValueError):validate_frozen(frozen['id'],corrected,store=tmp_path)
    p['cases'][3]['features']['voltage']=4
    with pytest.raises(ValueError):validate_frozen(frozen['id'],p,store=tmp_path)


def test_labels_before_freeze_and_false_approval_are_rejected(tmp_path):
    p=project();s=study(p)
    p['cases'][3].update(outcome='reject',label_source='Premature reference')
    with pytest.raises(ValueError):freeze(p,s,'scratch','Reviewer','Note',store=tmp_path)
    p['cases'][3].update(outcome=None,label_source='')
    with pytest.raises(ValueError):freeze(p,s,'scratch','','',store=tmp_path)


def test_actual_proposer_and_direct_baseline_are_isolated():
    p=project();rules=study(p)['candidates']
    p['cases'][2]['summary']='QUESTION_DESCRIPTION_SECRET'
    fake=FakeClient([{'candidates':rules},{'predictions':study(p)['direct_predictions']}])
    result=propose(fake,p)
    assert result['kind']=='training_study'
    assert 'QUESTION_DESCRIPTION_SECRET' not in fake.prompts[0][1]
    assert '"x1"' not in fake.prompts[0][1]
    assert '"x1"' in fake.prompts[1][1]
    assert 'QUESTION_DESCRIPTION_SECRET' not in fake.prompts[1][1]
    p['cases'][3].update(outcome='reject',label_source='Premature')
    with pytest.raises(ValueError):propose(FakeClient([]),p)


def test_training_or_scope_changes_invalidate_the_study():
    p=project();s=study(p);p['scope']='Changed site'
    with pytest.raises(ValueError):inspect(p,s)
    p=project();p['cases'][0]['features']['voltage']=float('nan')
    with pytest.raises(ValueError):validate_project(p)
