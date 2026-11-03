"""Chronological next-action evaluation against human-labelled workflow events.

No video, references, expert answers or future events reach the predictor.
This tests prediction of recorded actions, not repair correctness.
"""
from collections import Counter
import hashlib
import json
import math

from .workflow import BOUNDARY, S, array, obj, validate_events


def evaluate(client, observation, labels, *, train_fraction=0.6):
    events = validate_events(observation)
    if any(not event['action'].strip() for event in events):
        raise ValueError('Complete every observed action before testing decisions.')
    if (not isinstance(labels, dict) or set(labels) != {e['id'] for e in events}
            or any(not isinstance(v, str) or not v.strip() for v in labels.values())):
        raise ValueError('Labels must map every event ID to a nonempty human action category.')
    if not 0 < train_fraction < 1 or len(events) < 3:
        raise ValueError('Supply at least three events and a training fraction between 0 and 1.')
    # Overlapping events could reveal the action being predicted in prior context.
    if any(a['time_end'] > b['time_start'] for a, b in zip(events, events[1:])):
        raise ValueError('Decision evaluation requires non-overlapping chronological events.')
    split = max(1, min(len(events) - 1, math.floor(len(events) * train_fraction)))
    training = [{**e, 'action_label': labels[e['id']]} for e in events[:split]]
    vocabulary = sorted(set(labels.values()))
    principles = client.ask_json(
        BOUNDARY + 'Infer tentative decision rules from this training prefix only. '
        'Each rule must name its triggering evidence, next action, and uncertainty. '
        'Do not claim causality or repair correctness.\n' + json.dumps(training),
        obj({'rules': array(S)}), 'decision_rules')
    baseline = Counter(labels[e['id']] for e in events[:split]).most_common(1)[0][0]
    rows = []
    for index in range(split, len(events)):
        # The target event and its label are deliberately excluded.
        past = [{**e, 'action_label': labels[e['id']]} for e in events[:index]]
        prediction = client.ask_json(
            BOUNDARY + 'Predict the next action using these frozen rules and past events. '
            'Choose one allowed action label or abstain with an empty string. '
            'Allowed labels are a human-defined task vocabulary, not evidence of order.\n'
            + json.dumps({'rules': principles['rules'], 'past_events': past,
                          'allowed_labels': vocabulary}),
            obj({'action_label': S, 'reason': S, 'uncertainty': S}), 'decision_prediction')
        label = prediction['action_label']
        if label and label not in vocabulary:
            raise ValueError('Prediction used an action outside the supplied vocabulary.')
        target = events[index]
        rows.append({'event_id': target['id'], 'time_start': target['time_start'],
                     'prediction': label, 'actual': labels[target['id']],
                     'correct': label == labels[target['id']],
                     'reason': prediction['reason'], 'uncertainty': prediction['uncertainty'],
                     'baseline_prediction': baseline,
                     'baseline_correct': baseline == labels[target['id']]})
    fingerprint = hashlib.sha256(json.dumps({'events': events, 'labels': labels,
        'train_fraction': train_fraction}, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {'kind': 'workflow_decision_evaluation', 'input_sha256': fingerprint,
            'source': observation.get('source', ''), 'task': observation.get('task', ''),
            'train_fraction': train_fraction, 'training_event_ids':
            [e['id'] for e in events[:split]], 'frozen_rules': principles['rules'],
            'predictions': rows, 'score': {
                'correct': sum(r['correct'] for r in rows), 'total': len(rows),
                'abstained': sum(not r['prediction'] for r in rows),
                'baseline_correct': sum(r['baseline_correct'] for r in rows)},
            'limitations': 'Human labels are required. Observations may contain errors. '
            'Rules stay frozen, but each prediction sees previous held-out events after they occur. '
            'Action prediction does not establish manufacturer compliance or repair success.'}
