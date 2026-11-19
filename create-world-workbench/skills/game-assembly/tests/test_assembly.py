import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from runtime_core import load_bundle
from assembly_core import build, validate_assembly, safe_relative

class AssemblyTests(unittest.TestCase):
    def setUp(self): self.b,self.h=load_bundle(ROOT/'examples/station.json')
    def test_real_build_manifest(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'game';r=build(self.b,self.h,ROOT/'examples',p)
            for f in r['manifest']['files']:self.assertEqual(f['sha256'],hashlib.sha256((p/f['path']).read_bytes()).hexdigest())
            self.assertEqual('candidate',r['manifest']['status'])
    def test_build_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            a=build(self.b,self.h,ROOT/'examples',Path(d)/'a');b=build(self.b,self.h,ROOT/'examples',Path(d)/'b')
            self.assertEqual(a['manifest'],b['manifest'])
    def test_immutable_output(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'game';build(self.b,self.h,ROOT/'examples',p);before=(p/'manifest.json').read_bytes()
            with self.assertRaises(ValueError):build(self.b,self.h,ROOT/'examples',p)
            self.assertEqual(before,(p/'manifest.json').read_bytes())
    def test_failed_dependency(self):
        self.b['assembly']['requiredArtifactIds']=['scene'];self.b['assembly']['artifactStatus']={'scene':'failed'}
        self.assertFalse(validate_assembly(self.b,ROOT)['passed'])
    def test_unimplemented_hold_module_rejected(self):
        self.b['interactions'][0]['inputSpec']={'gesture':'hold','devices':['pointer'],'durationMs':1000,'bindings':{'pointer':'hold'}}
        self.assertFalse(validate_assembly(self.b,ROOT)['passed'])
    def test_unimplemented_gamepad_rejected(self):
        self.b['interactions'][0]['inputSpec']={'gesture':'press','devices':['gamepad'],'bindings':{'gamepad':'A'}}
        self.assertFalse(validate_assembly(self.b,ROOT)['passed'])
    def test_unimplemented_keyboard_binding_rejected(self):
        self.b['interactions'][0]['inputSpec']={'gesture':'press','devices':['keyboard'],'bindings':{'keyboard':'E'}}
        self.assertFalse(validate_assembly(self.b,ROOT)['passed'])
    def test_unsafe_javascript_integer_rejected(self):
        v=next(v for v in self.b['state']['variables'] if v['type']=='int');v['max']=9007199254740992
        self.assertFalse(validate_assembly(self.b,ROOT)['passed'])
    def test_paths(self):
        for path in ['../x.png','C:/secret.png','/tmp/a.png','a\\b.png','a//b.png','con.png','a/%2e.png']:
            with self.subTest(path=path),self.assertRaises(ValueError):safe_relative(path)
    def test_invalid_root_diagnostic(self):self.assertFalse(validate_assembly([],ROOT)['passed'])
    def test_invalid_nested_shape_diagnostic(self):
        for key in ('flow','state','interactions'):
            with self.subTest(key=key):
                b=copy.deepcopy(self.b);b[key]=None
                self.assertFalse(validate_assembly(b,ROOT)['passed'])
    def test_disguised_script_asset(self):
        with tempfile.TemporaryDirectory() as d:
            content=b'<script>alert(1)</script>';Path(d,'fake.png').write_bytes(content)
            self.b['assembly']['assets']=[{'id':'fake','path':'fake.png','sha256':hashlib.sha256(content).hexdigest()}]
            self.assertFalse(validate_assembly(self.b,d)['passed'])
    def test_data_is_escaped(self):
        self.b['title']='</script><script>alert(1)</script>'
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'game';build(self.b,self.h,ROOT/'examples',p)
            self.assertNotIn('</script>',(p/'game-data.js').read_text(encoding='utf-8'))

if __name__=='__main__':unittest.main()
