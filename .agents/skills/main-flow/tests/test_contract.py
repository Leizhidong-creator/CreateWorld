import copy
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from _validation import Check,top
from validate import validate

class ContractTests(unittest.TestCase):
    def setUp(self):
        self.b=json.loads((ROOT/'examples/station.json').read_text(encoding='utf-8'))
    def check(self):
        c=Check();validate(top(self.b,c),c);return c
    def test_complete_example(self):self.assertEqual([],self.check().errors)
    def test_boolean_schema_rejected(self):
        self.b['schemaVersion']=True;self.assertTrue(self.check().errors)

    def test_missing_action_edge(self):
        self.b['flow']['edges'].pop();self.assertTrue(self.check().errors)
    def test_duplicate_action_edge(self):
        edge=copy.deepcopy(self.b['flow']['edges'][0]);edge['id']='duplicate';self.b['flow']['edges'].append(edge);self.assertTrue(self.check().errors)
    def test_edge_target_mismatch(self):
        self.b['flow']['edges'][0]['to']='journal';self.assertTrue(self.check().errors)
    def test_orphan_screen(self):
        self.b['flow']['screens'].append({'id':'orphan','kind':'world','title':'orphan'});self.assertTrue(self.check().errors)
    def test_start_at_terminal(self):
        self.b['flow']['startScreen']=self.b['flow']['terminals'][0];self.assertTrue(self.check().errors)
    def test_unlisted_ending(self):
        self.b['flow']['terminals'].pop();self.assertTrue(self.check().errors)
    def test_overlay_returns_to_wrong_owner(self):
        row=next(x for x in self.b['flowDetails']['screens'] if x['id']=='journal');row['returnToScreenIds']=['supply'];self.assertTrue(self.check().errors)
    def test_overlay_duplicate_world(self):
        row=next(x for x in self.b['flowDetails']['screens'] if x['id']=='journal');row['stateOwner']='local';self.assertTrue(self.check().errors)
    def test_advanced_before_tutorial(self):
        self.b['flowDetails']['tutorialScreenIds']=['journal'];self.assertTrue(self.check().errors)
    def test_invalid_restart(self):
        self.b['flowDetails']['restartPolicy']='keep-all';self.assertTrue(self.check().errors)
    def test_unimplemented_recovery(self):
        self.b['flowDetails']['failureRecovery']=[{'from':'failure','to':'journal'}];self.assertTrue(self.check().errors)
    def test_omitted_details_warn(self):
        del self.b['flowDetails'];c=self.check();self.assertFalse(c.errors);self.assertTrue(c.warnings)

if __name__=='__main__':unittest.main()
