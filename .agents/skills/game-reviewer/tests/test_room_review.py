"""Synthetic evidence checks only: this fixture is never browser-execution proof."""
import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from review_room import review_room, CHECKS, SCREENSHOTS


def raw(value):return json.dumps(value,separators=(',',':')).encode()
def sha(value):return hashlib.sha256(value).hexdigest()


class RoomReviewerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.base=Path(self.temp.name);self.artifact=self.base/'candidate';self.artifact.mkdir()
        self.room={'schemaVersion':1,'backend':'canvas-room-v1','player':{'body':{'width':20,'height':12}},'walkable':{'x':0,'y':0,'width':320,'height':320},'obstacles':[],
            'npcs':[{'id':'npc'+str(i),'x':50+i*80,'y':100,'body':{'width':20,'height':12}} for i in range(3)],'hotspots':[{'kind':'egg'},{'kind':'egg'}],
            'media':[{'path':'scene.png','sha256':sha(b'fixture-image')}]}
        self.room_path=self.base/'room.json';self.room_path.write_bytes(raw(self.room));self.fingerprint=sha(self.room_path.read_bytes())
        files={'index.html':b'fixture','runtime.js':b'fixture','style.css':b'fixture','scene.png':b'fixture-image',
               'room-data.js':b'window.__ROOM_DATA__='+raw({**self.room,'fingerprint':self.fingerprint})+b';\n'}
        self.manifest={'schemaVersion':1,'backend':'canvas-room-v1','bundleSha256':self.fingerprint,'status':'candidate','files':[{'path':name,'sha256':sha(value)} for name,value in files.items()]}
        for name,value in files.items():(self.artifact/name).write_bytes(value)
        (self.artifact/'manifest.json').write_bytes(raw(self.manifest));self.evidence_path=self.base/'browser.json'
        self.initial={f:False for f in ('briefed','powerReady','guidanceReady','eggHumor','eggRain','finished')}
        def event(kind,story=None,**other):
            return {'type':kind,**other,'state':{'fingerprint':self.fingerprint,'started':True,'paused':False,'saveOpen':False,'helpOpen':False,'mode':'explore',
                'player':{'x':160,'y':240,'direction':'down'},'story':{**self.initial,**(story or {})},'historyLength':0}}
        events=[event('start')]+[event('interact',id='npc'+str(i)) for i in range(3)]+[
            event('circuit-solved',{'briefed':True,'powerReady':True}),event('guidance-solved',{'briefed':True,'powerReady':True,'guidanceReady':True}),
            event('interact',{'briefed':True,'powerReady':True,'guidanceReady':True,'finished':True},id='exit'),event('complete',{'eggHumor':True,'eggRain':True})]
        images=[]
        for name in SCREENSHOTS:
            path=self.base/name;path.write_bytes(b'\x89PNG\r\n\x1a\nsynthetic-header');images.append({'path':str(path),'sha256':sha(path.read_bytes())})
        self.evidence={'schemaVersion':1,'runner':'playwright-canvas-room-v1','bundleSha256':self.fingerprint,'manifestSha256':sha((self.artifact/'manifest.json').read_bytes()),'status':'passed',
            'checks':{key:True for key in CHECKS},'events':events,'finalState':events[-1]['state'],'pageErrors':[],'consoleErrors':[],'failures':[],'screenshots':images}
    def tearDown(self):self.temp.cleanup()
    def run_review(self):
        self.evidence_path.write_bytes(raw(self.evidence));return review_room(self.room_path,self.artifact,self.evidence_path,True)
    def test_consistent_fixture_is_not_certified_execution_or_release(self):
        result=self.run_review();self.assertTrue(result['passed'],result);self.assertFalse(result['releaseReady']);self.assertEqual(result['evidenceAuthenticity'],'not-authenticated-by-json')
    def test_asset_tamper_rejected(self):
        (self.artifact/'scene.png').write_bytes(b'changed');self.assertFalse(self.run_review()['passed'])
    def test_room_version_mismatch_rejected(self):
        self.room['title']='new version';self.room_path.write_bytes(raw(self.room));self.assertFalse(self.run_review()['passed'])
    def test_missing_runtime_check_and_truthy_integer_rejected(self):
        del self.evidence['checks']['touchHoldRelease'];self.assertFalse(self.run_review()['passed'])
        self.evidence['checks']['touchHoldRelease']=1;self.assertFalse(self.run_review()['passed'])
    def test_error_report_rejected(self):
        for key in ('pageErrors','consoleErrors','failures'):
            self.evidence[key]=['runtime failed'];self.assertFalse(self.run_review()['passed']);self.evidence[key]=[]
    def test_stale_manifest_report_rejected(self):
        self.evidence['manifestSha256']='0'*64;self.assertFalse(self.run_review()['passed'])
    def test_missing_or_illegal_observation_rejected(self):
        del self.evidence['events'][1]['state'];self.assertFalse(self.run_review()['passed'])
    def test_screenshot_tamper_rejected(self):
        Path(self.evidence['screenshots'][0]['path']).write_bytes(b'changed');self.assertFalse(self.run_review()['passed'])
    def test_extra_candidate_file_rejected(self):
        (self.artifact/'unlisted.js').write_text('changed');self.assertFalse(self.run_review()['passed'])
    def test_no_report_is_explicitly_unverified(self):
        result=review_room(self.room_path,self.artifact);self.assertTrue(result['passed']);self.assertEqual(result['runtimeStatus'],'unverified');self.assertFalse(result['releaseReady'])
        self.assertFalse(review_room(self.room_path,self.artifact,require_runtime=True)['passed'])


if __name__=='__main__':unittest.main()
