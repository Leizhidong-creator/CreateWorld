import json
import tempfile
import unittest
from pathlib import Path
import character_job as jobs

class FictionalJobs(unittest.TestCase):
    def test_resume_tracks_source_kind_and_style(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t); brief=root/'pilot.json'
            data=dict(character_name='Pilot',role='player',appearance='amber suit',canon_invariants=['pilot'],inferred_details=['boots'],style_profile='ship-v1')
            brief.write_text(json.dumps(data))
            args=dict(brief_path=brief,output_dir=root/'out',character_id='pilot',style_profile='ship-v1')
            a,p,_=jobs.init_job(**args)
            b,_,resumed=jobs.init_job(**args)
            self.assertEqual(a,b); self.assertTrue(resumed); self.assertEqual(p['source_kind'],'fictional-design')
            data['appearance']='ivory suit'; brief.write_text(json.dumps(data))
            c,_,resumed=jobs.init_job(**args)
            self.assertNotEqual(a,c); self.assertFalse(resumed)
            with self.assertRaises(jobs.JobStateError): jobs.init_job(**{**args,'style_profile':'other-v1'})

    def test_invalid_and_ambiguous_source_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            p=Path(t)/'brief.json'; p.write_text('{}')
            for args in ({},{'brief_path':p},{'brief_path':p,'photo_path':p}):
                with self.assertRaises(jobs.JobStateError): jobs.init_job(output_dir=Path(t)/'out',**args)

    def test_completion_cannot_accept_empty_or_failed_qa(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t); source=root/'photo.png'; source.write_bytes(b'fixture')
            job,_,_=jobs.init_job(photo_path=source,output_dir=root/'out',character_id='pilot')
            pack=root/'pack'; pack.mkdir()
            (pack/'character.json').write_text(json.dumps(dict(character_id='pilot',style_profile=jobs.STYLE_PROFILE)))
            for qa in ({},dict(character_id='pilot',passed=False),dict(character_id='wrong',passed=True)):
                (pack/'qa-report.json').write_text(json.dumps(qa))
                with self.assertRaises(jobs.JobStateError): jobs.complete_job(job_dir=job,pack_dir=pack)
                self.assertEqual(json.loads((job/'job.json').read_text())['status'],'incomplete')

if __name__=='__main__': unittest.main()
