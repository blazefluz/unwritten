"""Expert-reviewed decision guides, disagreement questions and frozen validation.

Models propose a bounded decision-list language. Code evaluates it, selects
questions, and scores frozen policies. Review is self-attested, not identity or
compliance verification. Test labels are never sent to a model.
"""
from __future__ import annotations
import copy
import hashlib
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from .workflow import BOUNDARY, S, array, obj

VALUE = {"anyOf": [{"type": "number"}, {"type": "string"}, {"type": "boolean"}, {"type": "null"}]}
CONDITION = obj({"feature": S, "op": {"type": "string", "enum": ["eq","ne","gt","gte","lt","lte"]},
                 "value": VALUE, "other_feature": {"anyOf": [S,{"type":"null"}]}, "absolute": {"type":"boolean"}})
RULE = obj({"id": S,"title": S,"reason": S,"evidence_case_ids": array(S),
            "steps": array(obj({"if_all": array(CONDITION),"then": S})),
            "otherwise": {"anyOf": [S,{"type":"null"}]}})


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,allow_nan=False).encode()).hexdigest()


def validate_project(project):
    if not isinstance(project,dict) or not project.get('title','').strip() or not project.get('task','').strip():
        raise ValueError('Name the guide and describe its decision task.')
    outcomes=project.get('outcomes',[])
    if not 2<=len(outcomes)<=12 or len(set(outcomes))!=len(outcomes) or any(not isinstance(v,str) or not v.strip() for v in outcomes):
        raise ValueError('Supply 2–12 unique outcome labels.')
    definitions=project.get('features',[])
    keys=[f['key'] for f in definitions]
    if not 1<=len(keys)<=20 or len(keys)!=len(set(keys)) or any(not k for k in keys):
        raise ValueError('Define 1–20 unique observable features.')
    types={f['key']:f['type'] for f in definitions}
    if any(t not in {'number','text','boolean'} for t in types.values()):
        raise ValueError('Unknown feature type.')
    cases=project.get('cases',[])
    ids=[c['id'] for c in cases]
    if not 3<=len(cases)<=100 or len(ids)!=len(set(ids)) or any(not i for i in ids):
        raise ValueError('Supply 3–100 cases with unique IDs.')
    for c in cases:
        if c.get('split') not in {'train','question','test'} or c.get('outcome') not in [None,*outcomes]:
            raise ValueError('Each case needs a valid role and outcome.')
        if set(c.get('features',{}))!=set(keys):
            raise ValueError('Every case must include each defined feature; use null for unknown values.')
        for key,v in c['features'].items():
            if v is None:continue
            valid={'number':type(v) in (int,float) and math.isfinite(v),
                   'text':isinstance(v,str),'boolean':type(v) is bool}[types[key]]
            if not valid:raise ValueError('Feature value does not match its declared type.')
        if c.get('outcome') is not None and not c.get('label_source','').strip():
            raise ValueError('Attribute each outcome to its reviewer or source.')
    if len([c for c in cases if c['split']=='train'])<2:
        raise ValueError('Label at least two training cases.')
    if any(c.get('outcome') is None for c in cases if c['split']=='train'):
        raise ValueError('Every training case needs an attributed outcome.')
    if not any(c['split']=='question' for c in cases) or not any(c['split']=='test' for c in cases):
        raise ValueError('Keep separate question cases and untouched validation cases.')
    return project


def dataset_fingerprint(project):
    base=copy.deepcopy(project)
    for c in base['cases']:
        if c['split']!='train':
            c['outcome']=None;c['label_source']='';c['expert_reason']=''
    return digest(base)


def validate_rule(rule,project,*,baseline=False):
    keys={f['key'] for f in project['features']};outcomes=set(project['outcomes'])
    training={c['id'] for c in project['cases'] if c['split']=='train'}
    if not rule.get('id') or not rule.get('title') or not rule.get('steps') or len(rule['steps'])>12:
        raise ValueError('Rules need an ID, title and 1–12 decision steps.')
    if not baseline and (not rule.get('evidence_case_ids') or not set(rule['evidence_case_ids'])<=training):
        raise ValueError('Rule evidence may link only to labelled training cases.')
    if rule.get('otherwise') not in [None,*outcomes]:raise ValueError('Unknown fallback outcome.')
    for step in rule['steps']:
        if step['then'] not in outcomes or not 1<=len(step['if_all'])<=8:raise ValueError('Invalid rule step.')
        for c in step['if_all']:
            if c['feature'] not in keys or c.get('other_feature') not in [None,*keys] or c['op'] not in {'eq','ne','gt','gte','lt','lte'} or type(c.get('absolute')) is not bool:
                raise ValueError('Invalid rule condition.')
            value = c.get('value')
            if value is not None and (type(value) not in (str, int, float, bool) or
                    (type(value) in (int, float) and not math.isfinite(value))):
                raise ValueError('Rule literals must be finite scalar values.')
    return rule


def predict(rule,features):
    """First matching step wins. Unknown or incomparable evidence abstains."""
    for step in rule['steps']:
        states=[]
        for condition in step['if_all']:
            a=features.get(condition['feature'])
            b=features.get(condition['other_feature']) if condition['other_feature'] else condition['value']
            if a is None or b is None:states.append(None);continue
            numeric=type(a) in (int,float) and type(b) in (int,float)
            if condition['absolute']:
                if not numeric:states.append(None);continue
                a,b=abs(a),abs(b)
            if condition['op'] in {'gt','gte','lt','lte'} and not numeric:
                states.append(None);continue
            if not numeric and type(a) is not type(b):states.append(None);continue
            op=condition['op']
            states.append({'eq':lambda:a==b,'ne':lambda:a!=b,'gt':lambda:a>b,
                'gte':lambda:a>=b,'lt':lambda:a<b,'lte':lambda:a<=b}[op]())
        if False in states:continue
        if None in states:return None
        return step['then']
    return rule.get('otherwise')


def consensus(rules,features):
    outputs=[predict(r,features) for r in rules]
    return outputs[0] if outputs and outputs[0] is not None and len(set(outputs))==1 else None


def propose(client,project):
    validate_project(project)
    if any(c['outcome'] is not None for c in project['cases'] if c['split']!='train'):
        raise ValueError('Start a study before labelling question or validation cases. Preserve previous studies as exports.')
    train=[{'id':c['id'],'features':c['features'],'outcome':c['outcome']} for c in project['cases'] if c['split']=='train']
    context={k:project.get(k,'') for k in ['title','task','scope']}
    context.update({'features':project['features'],'outcomes':project['outcomes'],'training_cases':train})
    candidates=client.ask_json(BOUNDARY+
        'Propose 2–6 competing plausible decision lists consistent with ALL training cases. '
        'Prefer simple explanations and expose underdetermination. These are alternatives, '
        'not approved procedures. Return genuinely different possible predictions when the '
        'data allows, not paraphrases. Conditions in if_all are AND; steps are checked in '
        'order; otherwise is the fallback, null means abstain. Missing/incomparable evidence '
        'abstains. other_feature selects a right-hand feature instead of literal value. '
        'absolute applies to BOTH numeric sides. Link evidence only to training IDs. '
        'Do not invent observations, thresholds represented as official guidance, approvals '
        'or held-out outcomes. Only use declared features and outcomes.\n'+json.dumps(context),
        obj({'candidates':array(RULE)}),'training_candidates')['candidates']
    if not 1<=len(candidates)<=6 or len({r['id'] for r in candidates})!=len(candidates):
        raise ValueError('Expected up to six unique candidate rules.')
    for r in candidates:validate_rule(r,project)
    tests=[{'id':c['id'],'features':c['features']} for c in project['cases'] if c['split']=='test']
    direct=client.ask_json(BOUNDARY+
        'Independently predict the outcome for each validation case from the training '
        'examples and your prior knowledge. You have no expert-question answers. Use only '
        'an allowed outcome or null to abstain. Return exactly one row per case ID. '
        'This is a direct Meta baseline, not an approved expert policy.\n'+json.dumps({**context,'validation_cases':tests}),
        obj({'predictions':array(obj({'case_id':S,'outcome':{'anyOf':[{'type':'string','enum':project['outcomes']},{'type':'null'}]},'reason':S}))}),
        'training_direct_baseline')['predictions']
    if {r['case_id'] for r in direct}!={c['id'] for c in tests} or len(direct)!=len(tests) or any(r['outcome'] not in [None,*project['outcomes']] for r in direct):
        raise ValueError('Incomplete direct baseline.')
    return {'kind':'training_study','dataset_fingerprint':dataset_fingerprint(project),
            'created_at':datetime.now(timezone.utc).isoformat(),'candidates':candidates,
            'direct_predictions':direct,'provenance':'MetaClient.ask_json; Muse Spark; no question or validation labels sent to the model'}


def inspect(project,study):
    validate_project(project)
    if dataset_fingerprint(project)!=study['dataset_fingerprint']:
        raise ValueError('Cases, training labels or scope changed. Start a new study; previous rules cannot be reused.')
    rules=study['candidates']
    if len({r['id'] for r in rules})!=len(rules):raise ValueError('Duplicate candidate IDs.')
    for rule in rules:validate_rule(rule,project)
    known=[c for c in project['cases'] if c['split']!='test' and c['outcome'] is not None]
    statuses=[];active=[]
    for rule in rules:
        misses=[c['id'] for c in known if predict(rule,c['features'])!=c['outcome']]
        statuses.append({'id':rule['id'],'consistent':not misses,'counterexample_ids':misses})
        if not misses:active.append(rule)
    questions=[]
    for c in project['cases']:
        if c['split']!='question' or c['outcome'] is not None:continue
        predictions=[{'rule_id':r['id'],'outcome':predict(r,c['features'])} for r in active]
        counts=Counter(r['outcome'] for r in predictions)
        if len(counts)<2:continue
        score=1-sum((n/len(predictions))**2 for n in counts.values())
        questions.append({'case_id':c['id'],'score':score,'predictions':predictions,
            'question':f"For {c['summary'] or c['id']}, which outcome is correct, and which observable detail makes it correct? The remaining rules disagree."})
    questions.sort(key=lambda q:(-q['score'],q['case_id']))
    return {'active_rule_ids':[r['id'] for r in active],'statuses':statuses,'questions':questions,
            'answered_questions':len([c for c in project['cases'] if c['split']=='question' and c['outcome'] is not None])}


def freeze(project,study,rule_id,reviewer,review_note,approval_type='demo',*,store):
    analysis=inspect(project,study)
    if rule_id not in analysis['active_rule_ids']:raise ValueError('Select a rule consistent with all known outcomes.')
    if any(c['outcome'] is not None for c in project['cases'] if c['split']=='test'):
        raise ValueError('Freeze the guide BEFORE entering validation outcomes.')
    if not reviewer.strip() or not review_note.strip() or approval_type not in {'demo','expert_attestation'}:
        raise ValueError('Record a reviewer, scope/limitations note and approval type.')
    chosen=next(r for r in study['candidates'] if r['id']==rule_id)
    initial_project=copy.deepcopy(project)
    for c in initial_project['cases']:
        if c['split']=='question':c['outcome']=None;c['label_source']='';c['expert_reason']=''
    initial=inspect(initial_project,study)
    before=[r for r in study['candidates'] if r['id'] in initial['active_rule_ids']]
    after=[r for r in study['candidates'] if r['id'] in analysis['active_rule_ids']]
    tests=[c for c in project['cases'] if c['split']=='test']
    majority=Counter(c['outcome'] for c in project['cases'] if c['split']=='train').most_common(1)[0][0]
    baseline_rule=project.get('baseline_rule')
    if baseline_rule:validate_rule(baseline_rule,project,baseline=True)
    direct={r['case_id']:r['outcome'] for r in study['direct_predictions']}
    if set(direct)!={c['id'] for c in tests}:raise ValueError('Incomplete baseline; start a new study.')
    rows=[{'case_id':c['id'],'prediction':predict(chosen,c['features']),
           'consensus_before':consensus(before,c['features']),'consensus_after':consensus(after,c['features']),
           'direct_meta':direct[c['id']],'majority':majority,
           'declared_baseline':predict(baseline_rule,c['features']) if baseline_rule else None} for c in tests]
    frozen={'kind':'frozen_training_guide','id':str(uuid4()),'frozen_at':datetime.now(timezone.utc).isoformat(),
        'project':copy.deepcopy(project),'study':copy.deepcopy(study),'analysis':analysis,'selected_rule':chosen,
        'reviewer':reviewer.strip(),'review_note':review_note.strip(),'approval_type':approval_type,
        'approval_notice':'Self-attestation only; identity, expertise, operating safety and compliance are not verified.',
        'predictions':rows,'consistent_before':len(before),'consistent_after':len(after)}
    frozen['fingerprint']=digest(frozen)
    store=Path(store);store.mkdir(parents=True,exist_ok=True)
    with (store/(frozen['id']+'.json')).open('x',encoding='utf-8') as f:json.dump(frozen,f,indent=2)
    return frozen


def validate_frozen(freeze_id,project,*,store):
    # Only server-recorded snapshots can be validated. Client-supplied scores or
    # frozen predictions are ignored, and the immutable file is never replaced.
    if str(UUID(freeze_id))!=freeze_id:raise ValueError('Invalid guide ID.')
    frozen=json.loads((Path(store)/(freeze_id+'.json')).read_text())
    if digest({k:v for k,v in frozen.items() if k!='fingerprint'})!=frozen['fingerprint']:
        raise ValueError('Frozen guide integrity check failed.')
    validate_project(project)
    def without_test_labels(p):
        p=copy.deepcopy(p)
        for c in p['cases']:
            if c['split']=='test':c['outcome']=None;c['label_source']='';c['expert_reason']=''
        return p
    if without_test_labels(project)!=without_test_labels(frozen['project']):
        raise ValueError('Guide inputs changed after freezing. Only validation outcomes and their attribution may be added.')
    tests={c['id']:c for c in project['cases'] if c['split']=='test'}
    if any(c['outcome'] is None or not c['label_source'].strip() for c in tests.values()):
        raise ValueError('Add an attributed outcome for every frozen validation case.')
    rows=[{**r,'actual':tests[r['case_id']]['outcome'],'label_source':tests[r['case_id']]['label_source']} for r in frozen['predictions']]
    labels_digest=digest([{'id':c['id'],'outcome':c['outcome'],'source':c['label_source']}
                         for c in project['cases'] if c['split']=='test'])
    recorded=Path(store)/(freeze_id+'.validation.json')
    if recorded.exists():
        previous=json.loads(recorded.read_text())
        if previous.get('labels_fingerprint')!=labels_digest:
            raise ValueError('Validation outcomes were already recorded for this guide. Preserve that result; corrections require a new, explicitly documented study.')
        return previous
    systems=['prediction','consensus_before','consensus_after','direct_meta','majority']
    if frozen['project'].get('baseline_rule'):systems.append('declared_baseline')
    scores={key:{'correct':sum(r[key]==r['actual'] for r in rows),'total':len(rows),
                 'abstained':sum(r[key] is None for r in rows),'answered':sum(r[key] is not None for r in rows)} for key in systems}
    result={'kind':'training_validation','guide_id':freeze_id,'guide_fingerprint':frozen['fingerprint'],
            'labels_fingerprint':labels_digest,'recorded_at':datetime.now(timezone.utc).isoformat(),
            'scores':scores,'cases':rows,'consistent_before':frozen['consistent_before'],
            'consistent_after':frozen['consistent_after'],
            'questions_answered':frozen['analysis']['answered_questions'],
            'limitations':'This is a local pilot with attributed labels, not independently verified ground truth. '
            'Expert approval is self-attested. Agreement, coverage and baseline comparisons do not establish '
            'business ROI, compliance or performance on a different operator, site or task.'}
    with recorded.open('x',encoding='utf-8') as stream:json.dump(result,stream,indent=2)
    return result


def condition_text(c,labels):
    left=labels.get(c['feature'],c['feature'])
    right=labels.get(c['other_feature'],c['other_feature']) if c['other_feature'] else str(c['value'])
    if c['absolute']:left=f'magnitude of {left}';right=f'magnitude of {right}'
    return f"{left} {dict(eq='equals',ne='does not equal',gt='is greater than',gte='is at least',lt='is less than',lte='is at most')[c['op']]} {right}"


def guide_markdown(frozen):
    p=frozen['project'];r=frozen['selected_rule'];labels={f['key']:f['label'] for f in p['features']}
    lines=[f"# {p['title']}",f"Status: {'DEMONSTRATION ONLY' if frozen['approval_type']=='demo' else 'Reviewer self-attestation recorded'}",
           f"Task: {p['task']}",f"Scope: {p.get('scope','Unspecified')}",
           f"Reviewer: {frozen['reviewer']}",f"Review note: {frozen['review_note']}",
           frozen['approval_notice'],'','## Decision guide']
    for i,step in enumerate(r['steps'],1):
        lines.append(f"{i}. If {' AND '.join(condition_text(c,labels) for c in step['if_all'])}: **{step['then']}**.")
    lines.extend([f"Otherwise: {r.get('otherwise') or 'Ask the expert; no prediction'}.",
        'Unknown or incomparable evidence: ask the expert.','', '## Evidence and limitations',
        f"Training cases: {', '.join(r['evidence_case_ids'])}",
        f"Model proposal: {r['reason']}",f"Guide version: {frozen['id']}",f"Fingerprint: {frozen['fingerprint']}",
        'This captures reviewed practice for the stated scope; it is not manufacturer authorization or a compliance finding.'])
    return '\n\n'.join(lines)+'\n'
