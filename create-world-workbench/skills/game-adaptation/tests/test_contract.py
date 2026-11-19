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

    def test_missing_source_disposition(self):
        self.b['adaptation']['preservedNodeIds'].pop();self.assertTrue(self.check().errors)
    def test_conflicting_disposition(self):
        self.b['adaptation']['excludedNodeIds'].append({'id':'flood','reason':'test'});self.assertTrue(self.check().errors)
    def test_incomplete_source(self):
        self.b['source']['complete']=False;self.assertTrue(self.check().errors)
    def test_boolean_duration(self):
        self.b['adaptation']['targetMinutes']=True;self.assertTrue(self.check().errors)
    def test_user_role_constraint(self):
        self.b['constraints']={'playerRole':'passenger'};self.assertTrue(self.check().errors)
    def test_duration_constraint(self):
        self.b['constraints']={'maxMinutes':2};self.assertTrue(self.check().errors)
    def test_required_preserved_constraint(self):
        self.b['constraints']={'requiredPreservedNodeIds':['reserve']};self.assertTrue(self.check().errors)
    def test_invention_cannot_be_source(self):
        self.b['adaptation']['inventions']=[{'id':'flood','provenance':'original','summary':'new','reason':'test'}];self.assertTrue(self.check().errors)
    def test_no_player_action(self):
        self.b['adaptation']['experiences'][0]['playerActions']=[];self.assertTrue(self.check().errors)
    def test_unknown_experience_source(self):
        self.b['adaptation']['experiences'][0]['sourceNodeIds']=['unknown'];self.assertTrue(self.check().errors)
    def test_omitted_details_are_warning_not_quality_pass(self):
        del self.b['adaptation']['experiences'];c=self.check();self.assertFalse(c.errors);self.assertTrue(c.warnings)

if __name__=='__main__':unittest.main()
