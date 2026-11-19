import unittest
from PIL import Image,ImageDraw
from body_clearance import check_body

class BodyClearanceTests(unittest.TestCase):
    def world(self,gap):
        m=Image.new('L',(80,80),255);d=ImageDraw.Draw(m)
        d.rectangle((38,0,42,40-gap/2),fill=0);d.rectangle((38,40+gap/2,42,79),fill=0)
        return m
    def anchors(self):return [dict(id='spawn',kind='spawn',x=20,y=44),dict(id='exit',kind='exit',x=60,y=44)]
    def test_point_gap_rejected_for_body(self):
        r=check_body(self.world(8),self.anchors(),dict(width=12,height=12))
        self.assertFalse(r['passed']);self.assertIn('exit',r['unreachableAnchors'])
    def test_wide_gap_passes(self):
        self.assertTrue(check_body(self.world(32),self.anchors(),dict(width=12,height=12))['passed'])
    def test_thin_wall_between_grid_nodes_blocks(self):
        m=Image.new('L',(80,80),255);ImageDraw.Draw(m).line((41,0,41,79),fill=0)
        self.assertFalse(check_body(m,self.anchors(),dict(width=1,height=1))['passed'])
    def test_spawn_foot_center_is_not_enough(self):
        m=Image.new('L',(80,80),255)
        r=check_body(m,[dict(id='spawn',x=3,y=10)],dict(width=12,height=12))
        self.assertEqual(r['blockedAnchors'],['spawn'])
    def test_invalid_dimensions_rejected(self):
        for v in (0,-1,float('nan'),True,129):
            with self.assertRaises(ValueError):check_body(Image.new('L',(16,16)),[],dict(width=v,height=8))
    def test_bad_anchor_input_is_structured(self):
        from scene_collision import validate
        spec=dict(version=1,coordinate_space=dict(width=80,height=80),walkable=[dict(points=[[0,0],[79,0],[79,79],[0,79]])],foot_body=dict(width=12,height=12))
        for anchor in (dict(id='spawn',x='20',y=20),dict(x=0,y=0),dict(id='spawn',x=True,y=20)):
            result=validate({**spec,'anchors':[anchor]})
            self.assertFalse(result['ok']);self.assertTrue(result['errors'])
            with self.assertRaises(ValueError):check_body(Image.new('L',(80,80),255),[anchor],dict(width=12,height=12))

if __name__=='__main__':unittest.main()
