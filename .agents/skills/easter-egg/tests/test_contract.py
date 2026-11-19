import copy
import json
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import validate as module

class ContractTests(unittest.TestCase):
    def setUp(self):
        self.b=json.loads((ROOT/'examples/station.json').read_text(encoding='utf-8'))
    def rejected(self):
        try:errors,_,_=module.validate(self.b);return bool(errors)
        except module.Invalid:return True
    def action(self,id):return next(a for a in self.b['interactions'] if a['id']==id)
    def test_complete_example(self):self.assertFalse(self.rejected())
    def test_boolean_schema_rejected(self):
        self.b['schemaVersion']=True;self.assertTrue(self.rejected())
    def test_budget_is_not_pass(self):
        old=module.LIMIT;module.LIMIT=1
        try:
            with self.assertRaisesRegex(module.Invalid,'verification incomplete'):module.validate(self.b)
        finally:module.LIMIT=old
    def test_terminal_rejects_ordinary_action(self):
        a=copy.deepcopy(self.action('start'));a.update(id='post_end',screenId='together',targetScreen='together',effects=[])
        self.b['interactions'].append(a);self.b['flow']['edges'].append({'id':'post_end','from':'together','to':'together','actionId':'post_end'})
        self.assertTrue(self.rejected())

    def test_empty_pack_valid(self):
        self.b['easterEggs']=[];errors,warnings,_=module.validate(self.b);self.assertFalse(errors);self.assertTrue(warnings)
    def test_truthy_optional_rejected(self):
        self.b['easterEggs'][0]['optional']='true';self.assertTrue(self.rejected())
    def test_spoiler_before_knowledge(self):
        self.b['easterEggs'][0]['spoilerGuard']=[{'var':'trust','op':'eq','value':True}];self.assertTrue(self.rejected())
    def test_main_success_not_failure_must_survive(self):
        self.action('leave_together')['guard'].append({'var':'egg','op':'eq','value':True});self.assertTrue(self.rejected())
    def test_duplicate_ownership(self):
        egg=copy.deepcopy(self.b['easterEggs'][0]);egg['id']='second';self.b['easterEggs'].append(egg);self.assertTrue(self.rejected())
    def test_unreachable_trigger(self):
        self.action('old_sign')['guard']=[{'var':'circuit','op':'gt','value':10}];self.assertTrue(self.rejected())
    def test_repeated_reward(self):
        self.b['state']['variables'].append({'id':'coins','type':'int','min':0,'max':2,'initial':0})
        a=self.action('old_sign');a['repeat']='repeatable';a['effects']=[{'var':'coins','op':'add','value':1}]
        a['guard']=[{'var':'coins','op':'lt','value':2}];self.assertTrue(self.rejected())
    def test_no_egg_witness_omits_all_egg_actions(self):
        _,_,m=module.validate(self.b);self.assertIsNotNone(m['noEggEndingWitness']);self.assertNotIn('old_sign',m['noEggEndingWitness'])

if __name__=='__main__':unittest.main()
