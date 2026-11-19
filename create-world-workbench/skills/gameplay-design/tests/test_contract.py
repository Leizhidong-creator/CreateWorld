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

    def test_no_rules(self):
        self.b['mechanics'][0]['rules']=[];self.assertTrue(self.check().errors)
    def test_missing_recovery(self):
        self.b['mechanics'][0]['recovery']='';self.assertTrue(self.check().errors)
    def test_unsupported_input(self):
        self.b['constraints']={'supportedInputs':['voice']};self.assertTrue(self.check().errors)
    def test_duplicate_input(self):
        self.b['mechanics'][0]['inputs']*=2;self.assertTrue(self.check().errors)
    def test_unknown_action_mechanic(self):
        self.b['interactions'][0]['mechanicId']='unknown';self.assertTrue(self.check().errors)
    def test_unclosed_loop(self):
        self.b['mechanicDetails'][0]['loop']['steps'][-1]['nextStepIds']=[];self.assertTrue(self.check().errors)
    def test_orphan_loop_step(self):
        self.b['mechanicDetails'][0]['loop']['steps'].append({'id':'orphan','playerAction':'x','feedback':'x','nextStepIds':['orphan']});self.assertTrue(self.check().errors)
    def test_identical_choice_outcomes(self):
        opts=self.b['mechanicDetails'][1]['decisions'][0]['options'];opts[1]['actionId']=opts[0]['actionId'];self.assertTrue(self.check().errors)
    def test_identical_tradeoffs(self):
        opts=self.b['mechanicDetails'][1]['decisions'][0]['options'];opts[1]['tradeoff']=opts[0]['tradeoff'];self.assertTrue(self.check().errors)
    def test_missing_mechanic_details(self):
        self.b['mechanicDetails'].pop();self.assertTrue(self.check().errors)
    def test_missing_scenario(self):
        self.b['mechanicDetails'][0]['testScenarios']['failureRecovery']='';self.assertTrue(self.check().errors)
    def test_omitted_details_are_warning(self):
        del self.b['mechanicDetails'];c=self.check();self.assertFalse(c.errors);self.assertTrue(c.warnings)

if __name__=='__main__':unittest.main()
