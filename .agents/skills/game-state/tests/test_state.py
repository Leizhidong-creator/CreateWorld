import copy
import json
import sys
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from runtime_core import load_bundle, validate, initial_state, reduce_action, replay, checkpoint, restore

class StateTests(unittest.TestCase):
    def setUp(self): self.b,self.h=load_bundle(ROOT/'examples/station.json')
    def test_all_endings_reachable(self):
        r=validate(self.b); self.assertTrue(r['passed'],r); self.assertEqual(set(r['modelCheck']['endingWitnesses']),set(self.b['flow']['terminals']))
    def test_budget_unknown_never_passes(self):
        r=validate(self.b,1); self.assertFalse(r['passed']); self.assertEqual('unknown',r['modelCheck']['status'])
    def test_guard_rejects_without_mutation(self):
        s,_=replay(self.b,['start','to_platform']); before=copy.deepcopy(s)
        with self.assertRaises(ValueError): reduce_action(self.b,s,'rescue')
        self.assertEqual(before,s)
    def test_atomic_effect_failure(self):
        a=self.b['interactions'][0]; a['effects']=[{'var':'clue','op':'set','value':True},{'var':'circuit','op':'add','value':9}]
        s=initial_state(self.b)
        with self.assertRaises(ValueError): reduce_action(self.b,s,a['id'])
        self.assertFalse(s['values']['clue']); self.assertEqual(0,s['values']['circuit'])
    def test_once_does_not_repeat(self):
        s,_=replay(self.b,['start','to_office','inspect'])
        with self.assertRaises(ValueError): reduce_action(self.b,s,'inspect')
    def test_initial_invariant_rejected(self):
        next(v for v in self.b['state']['variables'] if v['id']=='trust')['initial']=True
        self.assertFalse(validate(self.b)['passed'])
    def test_boolean_not_integer(self):
        next(v for v in self.b['state']['variables'] if v['id']=='circuit')['initial']=True
        self.assertFalse(validate(self.b)['passed'])
    def test_checkpoint_roundtrip(self):
        cp=checkpoint(self.b,self.h,['start','to_office','inspect']); s=restore(self.b,self.h,cp)
        self.assertTrue(s['values']['clue']); self.assertEqual('office',s['screenId'])
    def test_checkpoint_tamper_rejected(self):
        cp=checkpoint(self.b,self.h,['start']); cp['values']['trust']=True
        with self.assertRaises(ValueError): restore(self.b,self.h,cp)
    def test_checkpoint_revision_rejected(self):
        cp=checkpoint(self.b,self.h,['start'])
        with self.assertRaises(ValueError): restore(self.b,'0'*64,cp)
    def test_terminal_rejects_actions(self):
        s,_=replay(self.b,['start','to_platform','leave_tunnel'])
        with self.assertRaises(ValueError): reduce_action(self.b,s,'start')
    def test_invariant_effect_rejected(self):
        self.b['interactions'][0]['effects']=[{'var':'trust','op':'set','value':True}]
        self.assertFalse(validate(self.b)['passed'])

if __name__=='__main__':unittest.main()
