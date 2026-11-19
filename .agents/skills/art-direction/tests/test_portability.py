"""Hash-bound assets must retain exact bytes on every checkout platform."""
import copy
import hashlib
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from visual_decision import validate_decision


class HashPortabilityTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ROOT / "tests/fixtures/visual-decision"
        self.data = yaml.safe_load((self.fixture / "visual-decision.yaml").read_text(encoding="utf-8"))

    def test_bound_fixture_bytes_have_lf_and_match_recorded_hashes(self):
        for candidate in self.data["candidates"]:
            raw = (self.fixture / candidate["board_path"]).read_bytes()
            self.assertNotIn(b"\r\n", raw)
            self.assertEqual(candidate["board_sha256"], hashlib.sha256(raw).hexdigest())

    def test_checkout_conversion_is_detected_not_normalized_by_verifier(self):
        with tempfile.TemporaryDirectory() as tmp:
            copied = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, copied)
            for candidate in self.data["candidates"]:
                board = copied / candidate["board_path"]
                board.write_bytes(board.read_bytes().replace(b"\n", b"\r\n"))
            result = validate_decision(self.data, base_path=copied, check_files=True)
            self.assertEqual(3, sum("board_sha256 does not match" in e for e in result.errors))

    def test_content_tampering_is_detected_with_unchanged_declared_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            copied = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, copied)
            board = copied / self.data["candidates"][0]["board_path"]
            board.write_bytes(board.read_bytes().replace(b"<svg", b"<svg data-tampered='yes'", 1))
            result = validate_decision(self.data, base_path=copied, check_files=True)
            self.assertTrue(any("C-A: board_sha256 does not match" in e for e in result.errors))


if __name__ == "__main__":
    unittest.main()
