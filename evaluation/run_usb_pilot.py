"""Reproducible local pilot. Reads the ignored server key; never prints it.
Run from the repository root: .venv/bin/python -m evaluation.run_usb_pilot
Cached output is preserved. Real calls are Meta-only, with no automatic retries.
"""
import hashlib
import json
import math
import os
from pathlib import Path

from unwritten.client import MetaClient
from unwritten.ranking import evaluate
from unwritten.workflow import BOUNDARY, S, array, obj

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'clips/usb-cable-tests/pilot-nov2'
OUT.mkdir(parents=True,exist_ok=True)

def save(name, data):
    (OUT/name).write_text(json.dumps(data,indent=2),encoding='utf-8')

class LoggedMeta(MetaClient):
    def ask_json(self,prompt,schema,name,video=None):
        # Save actual model input, excluding credentials and uploaded file ID.
        save(name+'.input.json',{'prompt':prompt,'schema':schema,'video_attached':bool(video)})
        result=super().ask_json(prompt,schema,name,video)
        save(name+'.output.json',result)
        return result


def main():
    if (OUT/'report.json').exists():
        raise SystemExit('Report already exists; refusing to overwrite a paid result.')
    if not os.environ.get('MODEL_API_KEY'):
        for line in (ROOT/'web/.env.local').read_text().splitlines():
            if line.startswith('MODEL_API_KEY='):
                os.environ['MODEL_API_KEY']=line.split('=',1)[1].strip()
    ref=json.loads((ROOT/'evaluation/usb-cable-reference.json').read_text())
    video=ROOT/'clips/usb-cable-tests/measurements-only.silent.mp4'
    save('protocol.json',{'reference':ref,'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),
                          'model':'muse-spark-1.3','audio_removed':True,'video_duration_seconds':127})
    client=LoggedMeta(max_retries=0)
    cache=OUT/'usb_measurements.output.json'
    if cache.exists():
        observed=json.loads(cache.read_text())
        print('Reusing cached perception.',flush=True)
    else:
        print('Uploading silent measurements-only clip; no final ranking or transcript.',flush=True)
        file_id=client.upload_video(video)
        print('Observing cable substitutions and signed meter readings.',flush=True)
        observed=client.ask_json(BOUNDARY+
            'This silent video shows a person testing USB cables using a handheld multimeter '
            'and a load. Identify each distinct cable tested in chronological order. '
            'Use IDs c1, c2, ... in order. Do not count supply calibration, no-contact zero '
            'readings, repeated probe touches, or different readings of the same cable as '
            'additional cable tests. Select one stable handheld multimeter voltage reading '
            'per cable, retaining any minus sign. Do not read unrelated displays. '
            'Use null if not legible. Give the selected measurement time in seconds relative '
            'to this clip, visible evidence and uncertainties. Do not infer quality, brand, '
            'preferences or rankings. No audio, captions or external knowledge of the source '
            'should be used. Distinguish edited transitions from actual additional tests.',
            obj({'measurements':array(obj({'id':S,'measurement_time':{'type':'number'},
                'voltage_v':{'anyOf':[{'type':'number'},{'type':'null'}]},
                'visible_evidence':S,'uncertainties':array(S)}))}),
            'usb_measurements',video=file_id)
    measurements=observed['measurements']
    expected=[r['id'] for r in ref['cables']]
    rows=[]
    aligned=[m['id'] for m in measurements]==expected
    if aligned:
        for observed_row, gold in zip(measurements,ref['cables']):
            value=observed_row['voltage_v']; stamp=observed_row['measurement_time']
            valid_value=type(value) in (int,float) and math.isfinite(value)
            valid_time=type(stamp) in (int,float) and math.isfinite(stamp)
            within=valid_time and gold['measurement_window'][0]-2 <= stamp <= gold['measurement_window'][1]+2
            error=abs(abs(value)-gold['label_magnitude_v']) if valid_value else None
            rows.append({'id':gold['id'],'observed_signed_v':value,
                'reference_label_magnitude_v':gold['label_magnitude_v'],
                'absolute_error_v':error,'magnitude_matches':error is not None and error<=ref['reading_tolerance_v'],
                'measurement_time':stamp,'time_window_matches':within})
    report={'kind':'usb_cable_pilot','source':ref['source'],'reference_type':ref['reference_type'],
            'observation':observed,'aligned_cable_count':aligned,
            'perception_checks':rows,'reading_tolerance_v':ref['reading_tolerance_v'],
            'perception_correct':sum(r['magnitude_matches'] and r['time_window_matches'] for r in rows),
            'perception_total':len(expected),'ranking':None}
    if aligned:
        print('Inferring comparator from the first four observed values and training preferences only.',flush=True)
        report['ranking']=evaluate(client,measurements,ref['reference_order'],training_ids=ref['training_ids'])
    save('report.json',report)
    print(json.dumps({'count_aligned':aligned,'perception_correct':report['perception_correct'],
                      'perception_total':report['perception_total'],
                      'ranking_score':report['ranking']['score'] if report['ranking'] else None}),flush=True)

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print('Pilot stopped:',type(exc).__name__,'HTTP status:',getattr(exc,'status_code',None),flush=True)
        raise SystemExit(1)
