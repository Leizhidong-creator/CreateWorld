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

    def test_missing_failure_feedback(self):
        self.action('inspect')['failure']='';self.assertTrue(self.rejected())
    def test_unknown_mechanic(self):
        self.action('inspect')['mechanicId']='unknown';self.assertTrue(self.rejected())
    def test_guard_strict_boolean(self):
        self.action('convince')['guard'][0]['value']='true';self.assertTrue(self.rejected())
    def test_duplicate_effect(self):
        a=self.action('inspect');a['effects']*=2;self.assertTrue(self.rejected())
    def test_invalid_device(self):
        self.action('inspect')['inputSpec']={'devices':['telepathy'],'gesture':'press','bindings':{'telepathy':'think'}};self.assertTrue(self.rejected())
    def test_hold_needs_duration(self):
        self.action('inspect')['inputSpec']={'devices':['pointer'],'gesture':'hold','bindings':{'pointer':'hold'}};self.assertTrue(self.rejected())
    def test_drag_needs_module(self):
        self.action('inspect')['inputSpec']={'devices':['pointer'],'gesture':'drag','bindings':{'pointer':'drag'}};self.assertTrue(self.rejected())
    def test_cancel_cannot_reward(self):
        a=self.action('inspect');a['outcomes']={k:{'effects':[],'targetScreen':'office','feedback':'unchanged'} for k in ('failure','cancel')}
        a['outcomes']['cancel']['effects']=copy.deepcopy(a['effects']);self.assertTrue(self.rejected())
    def test_replay_and_rejection(self):
        self.b['interactionTests']=[{'actions':['start','to_office','inspect'],'expect':{'screenId':'office','values':{'clue':True}},'rejectedActions':['inspect']}]
        self.assertFalse(self.rejected())
    def test_wrong_expected_value(self):
        self.b['interactionTests']=[{'actions':['start'],'expect':{'values':{'clue':True}}}];self.assertTrue(self.rejected())
    def test_real_guard_and_once_probes(self):
        _,_,m=module.validate(self.b);self.assertGreater(m['guardRejectionProbes'],0);self.assertGreater(m['onceRejectionProbes'],0)

if __name__=='__main__':unittest.main()
