"""Portable fixture tests: python -B -m unittest discover -s checks -v."""

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name("validate_reading.py")
SPEC = importlib.util.spec_from_file_location("reading_validator", SCRIPT)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class ReadingValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="reading-validator-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "source/sections").mkdir(parents=True)
        (self.root / "work/readings").mkdir(parents=True)
        self.source = self.root / "source/sections/01.md"
        self.source.write_text("# Source\nP001 one\nP002 two\nP003 three\n", encoding="utf-8")
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.manifest = {"units": [{"id": "S01", "path": "source/sections/01.md",
                                     "sha256": digest, "paragraphs": 3}]}
        self.records = [{"id": "S01", "sha256": digest, "paragraphs_read": [[1, 3]],
                         "read_status": "read", "note_anchor": "part.md#s01"}]
        self.note = self.root / "work/readings/part.md"
        self.note.write_text("# Notes\n## S01\nConcise factual note.\n", encoding="utf-8")

    def write_inputs(self):
        (self.root / "source/manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")
        (self.root / "work/readings/part.json").write_text(json.dumps(self.records), encoding="utf-8")

    def run_check(self):
        self.write_inputs()
        return validator.check(self.root)

    def assert_error(self, text):
        result = self.run_check()
        self.assertEqual("failed", result["status"])
        self.assertTrue(any(text in e for e in result["errors"]), result)
        return result

    def test_valid_ledger(self):
        result = self.run_check()
        self.assertEqual([], result["errors"])
        self.assertEqual(1, result["units"])
        self.assertEqual(1, result["ledger_entries"])
        self.assertEqual("recorded_coverage_complete_requires_semantic_review", result["status"])
        self.assertIn("cannot prove actual reading", result["limitation"])

    def test_valid_root_relative_note(self):
        self.records[0]["note_anchor"] = "work/readings/part.md#s01"
        self.assertEqual([], self.run_check()["errors"])

    def test_valid_companion_anchor(self):
        self.records[0]["note_anchor"] = "s01"
        self.assertEqual([], self.run_check()["errors"])

    def test_valid_explicit_html_anchor(self):
        self.records[0]["note_anchor"] = "part.md#S01"
        self.note.write_text('<a id="S01"></a>\n## S01: scene description\n', encoding="utf-8")
        self.assertEqual([], self.run_check()["errors"])

    def test_valid_split_ranges_across_records(self):
        self.records[0]["paragraphs_read"] = [[1, 1]]
        second = copy.deepcopy(self.records[0])
        second["paragraphs_read"] = [[2, 3]]
        self.records.append(second)
        self.assertEqual([], self.run_check()["errors"])

    def test_missing_middle_paragraph(self):
        self.records[0]["paragraphs_read"] = [[1, 1], [3, 3]]
        self.assert_error("unread_range: S01 2..2 (1)")

    def test_no_ledger_is_not_complete(self):
        self.records = []
        self.assert_error("unread_range: S01 1..3 (3)")

    def test_duplicate_source_id(self):
        self.manifest["units"].append(copy.deepcopy(self.manifest["units"][0]))
        self.assert_error("duplicate_source: S01")

    def test_unknown_source_reference(self):
        self.records[0]["id"] = "S99"
        result = self.assert_error("unknown_unit: S99")
        self.assertTrue(any("unread_range: S01" in e for e in result["errors"]))

    def test_missing_note_file(self):
        self.records[0]["note_anchor"] = "absent.md#s01"
        self.assert_error("missing_note: S01")

    def test_missing_note_anchor(self):
        self.records[0]["note_anchor"] = "part.md#unknown"
        self.assert_error("missing_note_anchor: S01")

    def test_code_block_is_not_a_note_anchor(self):
        self.note.write_text("# Notes\n```markdown\n## S01\n```\n", encoding="utf-8")
        self.assert_error("missing_note_anchor: S01")

    def test_missing_note_anchor_field(self):
        del self.records[0]["note_anchor"]
        self.assert_error("missing_note_anchor")

    def test_note_without_fragment_is_rejected(self):
        self.records[0]["note_anchor"] = "part.md"
        self.assert_error("missing_note_anchor")

    def test_stale_reading_hash(self):
        self.records[0]["sha256"] = "0" * 64
        self.assert_error("stale_reading: S01")

    def test_source_content_changed(self):
        self.source.write_text("P001 changed\nP002 two\nP003 three\n", encoding="utf-8")
        self.assert_error("source_hash: S01")

    def test_source_missing(self):
        self.manifest["units"][0]["path"] = "source/sections/missing.md"
        self.assert_error("source_hash: S01")

    def test_source_paragraph_sequence_changed_even_with_matching_hash(self):
        self.source.write_text("P001 one\nP003 three\nP003 duplicate\n", encoding="utf-8")
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.manifest["units"][0]["sha256"] = digest
        self.records[0]["sha256"] = digest
        self.assert_error("paragraph_sequence: S01")

    def test_source_path_escape(self):
        self.manifest["units"][0]["path"] = "../outside.md"
        self.assert_error("path_outside_work")

    def test_note_path_escape(self):
        self.records[0]["note_anchor"] = "../../../outside.md#s01"
        self.assert_error("path_outside_work")

    def test_windows_path_escape(self):
        self.records[0]["note_anchor"] = "..\\..\\..\\outside.md#s01"
        self.assert_error("path_outside_work")

    def test_absolute_and_drive_relative_paths_rejected(self):
        for target in (str(self.source), "C:outside.md", "C:\\outside.md", "//host/share/file.md"):
            with self.subTest(target=target):
                self.manifest["units"][0]["path"] = target
                self.assert_error("absolute_path")

    def test_illegal_ranges(self):
        for span in ([0, 3], [2, 1], [1, 4], [True, 3], [1.0, 3], ["1", 3], [1], "1..3", None):
            with self.subTest(span=span):
                self.records[0]["paragraphs_read"] = [span]
                self.assert_error("invalid_range: S01")

    def test_missing_ranges(self):
        for spans in ([], None, "1..3"):
            with self.subTest(spans=spans):
                self.records[0]["paragraphs_read"] = spans
                self.assert_error("missing_ranges: S01")

    def test_invalid_paragraph_count_does_not_crash(self):
        for paragraphs in (None, "3", True, 0, -1):
            with self.subTest(paragraphs=paragraphs):
                self.manifest["units"][0]["paragraphs"] = paragraphs
                self.assert_error("invalid_paragraph_count")

    def test_partial_status_is_not_read(self):
        self.records[0]["read_status"] = "partial"
        self.assert_error("not_read: S01")

    def test_malformed_record_does_not_hide_later_records(self):
        self.records.insert(0, None)
        result = self.assert_error("record_not_object")
        self.assertEqual(2, result["ledger_entries"])
        self.assertFalse(any("unread_range" in e for e in result["errors"]))

    def test_nonlist_ledger(self):
        self.records = {"id": "S01"}
        self.assert_error("ledger_not_list")

    def test_duplicate_json_key_rejected(self):
        self.write_inputs()
        (self.root / "source/manifest.json").write_text('{"units":[],"units":[]}', encoding="utf-8")
        result = validator.check(self.root)
        self.assertEqual("failed", result["status"])
        self.assertTrue(any("duplicate_json_key: units" in e for e in result["errors"]))

    def test_empty_source_rejected(self):
        self.manifest["units"] = []
        self.assert_error("empty_source")

    def test_cli_success_and_failure_exit_codes(self):
        self.write_inputs()
        good = subprocess.run([sys.executable, "-B", str(SCRIPT), str(self.root)], capture_output=True, text=True)
        self.assertEqual(0, good.returncode, good.stderr)
        self.assertEqual([], json.loads(good.stdout)["errors"])
        self.records[0]["paragraphs_read"] = [[1, 1]]
        self.write_inputs()
        bad = subprocess.run([sys.executable, "-B", str(SCRIPT), str(self.root)], capture_output=True, text=True)
        self.assertEqual(1, bad.returncode, bad.stderr)
        self.assertEqual("failed", json.loads(bad.stdout)["status"])


if __name__ == "__main__":
    unittest.main()
