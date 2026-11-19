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
        self.b['branches']=[];errors,warnings,_=module.validate(self.b);self.assertFalse(errors);self.assertTrue(warnings)
    def test_duplicate_choice(self):
        b=self.b['branches'][0];b['options'][1]['actionId']=b['options'][0]['actionId'];self.assertTrue(self.rejected())
    def test_unknown_decision_screen(self):
        self.b['branches'][0]['decisionScreenId']='unknown';self.assertTrue(self.rejected())
    def test_impossible_choice(self):
        self.action('leave_together')['guard']=[{'var':'circuit','op':'gt','value':10}];self.assertTrue(self.rejected())
    def test_same_outcome_is_not_choice(self):
        a=self.action('leave_alone');b=self.action('leave_together');a['effects']=copy.deepcopy(b['effects']);a['targetScreen']=b['targetScreen']
        next(e for e in self.b['flow']['edges'] if e['actionId']==a['id'])['to']=a['targetScreen'];self.assertTrue(self.rejected())
    def test_wrong_declared_ending(self):
        self.b['branches'][0]['endingScreenIds']=['flood'];self.assertTrue(self.rejected())
    def test_witness_really_replays(self):
        _,_,metrics=module.validate(self.b);world=module.World(self.b)
        for path in metrics['witnesses'].values():
            state=world.initial
            for aid in path:state,reason=world.step(state,aid);self.assertIsNone(reason)
            self.assertIsNotNone(state)

if __name__=='__main__':unittest.main()
