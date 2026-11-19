import copy
import hashlib
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from room_contract import check_room,geometry_check,power_solution
from build_room import build_room


def png(width,height,color):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    rows=b''.join(b'\0'+bytes(color)*width for _ in range(height))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')


def fixture(directory):
    media=[]
    for path,w,h,color in [('scene.png',320,320,(18,38,48,255)),('sprite.png',192,64,(210,184,122,255))]:
        raw=png(w,h,color);(directory/path).write_bytes(raw);media.append({'path':path,'sha256':hashlib.sha256(raw).hexdigest()})
    power={'size':3,'tiles':[{'mask':m,'rotation':r,'locked':i<6} for i,(m,r) in enumerate([(3,0),(10,0),(9,0),(12,0),(5,0),(6,0),(3,2),(10,1),(9,1)])],'start':{'row':1,'col':0,'port':8},'goal':{'row':1,'col':2,'port':2}}
    return {'schemaVersion':1,'backend':'canvas-room-v1','id':'synthetic-fixture','title':'Synthetic test fixture','subtitle':'Not generated art or a final game','width':320,'height':320,'walkable':{'x':20,'y':20,'width':280,'height':280},'obstacles':[{'id':'desk','x':125,'y':120,'width':65,'height':35}],'spawn':{'x':160,'y':265,'direction':'up'},'player':{'name':'Player','characterId':'test','body':{'width':20,'height':12},'speed':145},'characters':[{'id':'test','cell':{'width':48,'height':64},'footAnchor':{'x':24,'y':61},'scale':1,'frameMs':170,'sheets':{d:'sprite.png' for d in ('down','up','left','right')}}],'npcs':[{'id':f'npc{i}','name':f'NPC{i}','characterId':'test','x':x,'y':y,'direction':'down','body':{'width':20,'height':12},'range':45,'dialogueId':'brief' if i==0 else 'talk'} for i,(x,y) in enumerate([(70,90),(240,90),(250,230)])],'hotspots':[{'id':kind,'kind':kind,'label':kind,'x':x,'y':y,'range':40,'requires':['briefed'] if kind in ('power','guidance') else [],'lockedText':'First read briefing'} for kind,x,y in [('power',65,185),('guidance',250,170),('exit',160,50)]],'dialogues':[{'id':'brief','branches':[{'id':'new','when':{'briefed':False},'lines':[{'speaker':'Scientist','text':'Briefing'}],'setFlags':['briefed']},{'id':'repeat','when':{},'lines':[{'speaker':'Scientist','text':'Good luck'}],'setFlags':[]}]},{'id':'talk','branches':[{'id':'talk','when':{},'lines':[{'speaker':'Crew','text':'Ready'}],'setFlags':[]}]}],'assets':{'background':'scene.png'},'media':media,'modules':{'power':power,'guidance':{'initialAngle':-45,'initialVelocity':0,'targetAngle':0,'thrust':48,'brake':90,'angleTolerance':5,'speedTolerance':4,'holdSeconds':1,'timeLimit':60}},'ending':{'title':'Ready','text':'Test complete'}}


class RoomContractTests(unittest.TestCase):
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name);self.room=fixture(self.path)
    def tearDown(self):self.temp.cleanup()
    def test_valid_room_has_full_body_routes_and_power_solution(self):
        report=check_room(self.room,self.path);self.assertTrue(report['passed'],report);self.assertGreater(report['geometry']['reachablePositions'],0);self.assertIsNotNone(report['powerModel']['solution'])
    def test_build_is_offline_immutable_and_hash_bound(self):
        output=self.path/'output';report=build_room(self.room,'a'*64,self.path,output);self.assertTrue(report['passed']);runtime=(output/'runtime.js').read_text(encoding='utf-8');self.assertNotIn('export function',runtime);self.assertNotIn("from './engine.js'",runtime)
        manifest=json.loads((output/'manifest.json').read_text());self.assertEqual(manifest['backend'],'canvas-room-v1')
        for item in manifest['files']:self.assertEqual(item['sha256'],hashlib.sha256((output/item['path']).read_bytes()).hexdigest())
        with self.assertRaises(ValueError):build_room(self.room,'a'*64,self.path,output)
    def test_body_position_not_footpoint_only(self):
        self.room['spawn']={'x':121,'y':140,'direction':'up'};self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_unreachable_hotspot_detected(self):
        self.room['obstacles'].append({'id':'barrier','x':20,'y':110,'width':280,'height':2});self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_overlapping_npcs_rejected(self):
        self.room['npcs'][1].update(x=70,y=90);self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_unsupported_dialogue_effect_rejected(self):
        self.room['dialogues'][0]['branches'][0]['setFlags']=['powerReady'];self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_egg_cannot_gate_exit(self):
        self.room['hotspots'][-1]['requires']=['eggHumor'];self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_unsolved_and_already_solved_puzzles_rejected(self):
        solved=copy.deepcopy(self.room['modules']['power'])
        for tile in solved['tiles']:tile['rotation']=0
        with self.assertRaises(ValueError):power_solution(solved)
        for tile in self.room['modules']['power']['tiles']:tile['locked']=True
        self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_media_tamper_and_traversal_rejected(self):
        (self.path/'scene.png').write_bytes(b'bad');self.assertFalse(check_room(self.room,self.path)['passed']);self.room['assets']['background']='../scene.png';self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_wrong_sheet_dimensions_rejected(self):
        self.room['characters'][0]['cell']['width']=32;self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_wrapped_angle_and_zero_input_drift_rejected(self):
        self.room['modules']['guidance'].update(initialAngle=179,targetAngle=-179)
        self.assertFalse(check_room(self.room,self.path)['passed'])
        self.room['modules']['guidance'].update(initialAngle=-12,targetAngle=0,initialVelocity=2)
        self.assertFalse(check_room(self.room,self.path)['passed'])
    def test_shadowed_interaction_is_unreachable(self):
        self.room['hotspots'][0].update(x=70,y=90,range=45)
        report=check_room(self.room,self.path)
        self.assertFalse(report['passed']);self.assertIn('power',report['geometry']['unreachableInteractions'])
    def test_cross_kind_ids_and_boolean_ports_rejected(self):
        self.room['hotspots'][0]['id']='npc0';self.assertFalse(check_room(self.room,self.path)['passed'])
        self.room['hotspots'][0]['id']='power';self.room['modules']['power']['start']['port']=True
        self.assertFalse(check_room(self.room,self.path)['passed'])


if __name__=='__main__':unittest.main()
