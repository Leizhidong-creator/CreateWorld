import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from runtime_core import load_bundle,validate,replay
from validate import review

class ReviewTests(unittest.TestCase):
    def setUp(self):self.b,self.h=load_bundle(ROOT/'examples/station.json')
    def evidence(self,d):
        root=Path(d);files=[]
        # Synthetic verifier fixture, never presented as a real browser execution.
        for name in ['index.html','runtime.js','style.css','game-data.js']:
            data=('synthetic-'+name).encode();(root/name).write_bytes(data);files.append({'path':name,'sha256':hashlib.sha256(data).hexdigest()})
        manifest={'schemaVersion':1,'bundleSha256':self.h,'runtimeVersion':'test-fixture','status':'candidate','files':files}
        raw=json.dumps(manifest).encode();(root/'manifest.json').write_bytes(raw)
        journeys=[]
        for end,path in validate(self.b)['modelCheck']['endingWitnesses'].items():
            _,obs=replay(self.b,path);journeys.append({'id':end,'actions':path,'observations':obs,'terminalScreenId':end})
        return {'schemaVersion':1,'runner':'playwright-real-input-v1','bundleSha256':self.h,'manifestSha256':hashlib.sha256(raw).hexdigest(),'journeys':journeys,'pageErrors':[],'consoleErrors':[],'checks':dict.fromkeys(['saveRestore','restart','mobileLayout','guardRejected','pause','invalidSave','keyboard','touch'],True),'status':'passed'}
    def run_evidence(self,mutate=None):
        with tempfile.TemporaryDirectory() as d,tempfile.TemporaryDirectory() as e:
            ev=self.evidence(d)
            if mutate:mutate(ev,Path(d))
            p=Path(e)/'evidence.json';p.write_text(json.dumps(ev),encoding='utf-8')
            return review(self.b,self.h,d,p,True)
    def test_static_is_not_runtime(self):
        r=review(self.b,self.h);self.assertTrue(r['passed']);self.assertEqual('unverified',r['runtimeStatus']);self.assertFalse(r['releaseReady'])
    def test_missing_evidence_fails_when_required(self):self.assertFalse(review(self.b,self.h,require_runtime=True)['passed'])
    def test_failed_dependency_is_not_passed(self):
        self.b['assembly']['requiredArtifactIds']=['scene'];self.b['assembly']['artifactStatus']={'scene':'failed'}
        self.assertFalse(review(self.b,self.h)['passed'])
    def test_missing_assembly_is_not_passed(self):
        del self.b['assembly'];self.assertFalse(review(self.b,self.h)['passed'])
    def test_unknown_main_ending_is_not_passed(self):
        self.b['flow']['mainEndingScreenIds']=['missing'];self.assertFalse(review(self.b,self.h)['passed'])
    def test_coherent_evidence_still_not_authenticated(self):
        r=self.run_evidence();self.assertTrue(r['passed'],r);self.assertEqual('evidence-consistent',r['runtimeStatus']);self.assertFalse(r['releaseReady']);self.assertTrue(r['warnings'])
    def test_stale_fingerprint(self):self.assertFalse(self.run_evidence(lambda e,p:e.update(bundleSha256='0'*64))['passed'])
    def test_missing_observation(self):self.assertFalse(self.run_evidence(lambda e,p:e['journeys'][0]['observations'].pop())['passed'])
    def test_forged_state(self):self.assertFalse(self.run_evidence(lambda e,p:e['journeys'][0]['observations'][0]['values'].update(trust=True))['passed'])
    def test_uncovered_ending(self):self.assertFalse(self.run_evidence(lambda e,p:e['journeys'].pop())['passed'])
    def test_truthy_strings_rejected(self):self.assertFalse(self.run_evidence(lambda e,p:e['checks'].update(restart='true'))['passed'])
    def test_tampered_build(self):self.assertFalse(self.run_evidence(lambda e,p:(p/'runtime.js').write_text('tampered'))['passed'])
    def test_unexpected_file(self):self.assertFalse(self.run_evidence(lambda e,p:(p/'extra.js').write_text('extra'))['passed'])
    def test_browser_error(self):self.assertFalse(self.run_evidence(lambda e,p:e['pageErrors'].append('exception'))['passed'])
    def test_additional_failed_check_rejected(self):self.assertFalse(self.run_evidence(lambda e,p:e['checks'].update(assetLoaded=False))['passed'])
    def test_boolean_manifest_version_rejected(self):
        def mutate(e,p):
            m=json.loads((p/'manifest.json').read_bytes());m['schemaVersion']=True
            raw=json.dumps(m).encode();(p/'manifest.json').write_bytes(raw)
            e['manifestSha256']=hashlib.sha256(raw).hexdigest()
        self.assertFalse(self.run_evidence(mutate)['passed'])

if __name__=='__main__':unittest.main()
