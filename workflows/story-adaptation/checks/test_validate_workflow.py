"""Portable integrity-check regressions; never modify real authority documents.

Run from the repository root:
python -B -m unittest discover -s workflows/story-adaptation/checks -p test_validate_workflow.py -v

Each test copies this workflow into a temporary directory. The copied lock and
its Markdown links point to explicitly created temporary authority fixtures with
matching hashes. Reference snapshots and the actual validator are not replaced.
These tests exercise file-integrity behavior, not the meaning of the documents.
"""

import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
WORKFLOW = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("workflow_validator", WORKFLOW / "checks/validate_workflow.py")
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class WorkflowIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="portable-workflow-check-")
        self.addCleanup(self.temp.cleanup)
        self.temp_root = Path(self.temp.name)
        self.root = self.temp_root / "workflow"
        shutil.copytree(WORKFLOW, self.root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        fixtures = self.temp_root / "authorities"
        fixtures.mkdir()
        lock_path = self.root / "sources.lock.json"
        self.lock = json.loads(lock_path.read_text(encoding="utf-8"))
        replacements = []
        for index, record in enumerate(self.lock["authorities"], 1):
            original = record["path"]
            suffix = ".yaml" if record["role"] == "example-only" else ".md"
            fixture = fixtures / f"authority-{index}{suffix}"
            fixture.write_text(f"Integrity fixture {index}: {record['role']}\n", encoding="utf-8")
            record["path"] = str(fixture)
            record["sha256"] = hashlib.sha256(fixture.read_bytes()).hexdigest()
            replacements.extend([
                (original.replace("\\", "/"), fixture.as_posix()),
                (original, str(fixture)),
            ])
        self.write_lock()
        # Relocate only the copied documents' fixture links. Never read or write
        # the machine-specific real authority paths from the source lock.
        for document in self.root.rglob("*.md"):
            if "third_party" in document.relative_to(self.root).parts:
                continue
            text = document.read_text(encoding="utf-8")
            relocated = text
            for original, replacement in replacements:
                relocated = relocated.replace(original, replacement)
            if relocated != text:
                document.write_text(relocated, encoding="utf-8")

    def write_lock(self):
        (self.root / "sources.lock.json").write_text(
            json.dumps(self.lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    def assert_rejected(self, expected):
        report = validator.validate(self.root)
        self.assertEqual("failed", report["status"])
        self.assertTrue(any(expected in error for error in report["errors"]), report["errors"])

    def test_valid_copy(self):
        for record in self.lock["authorities"]:
            fixture = Path(record["path"])
            self.assertTrue(fixture.is_relative_to(self.temp_root))
            self.assertTrue(fixture.is_file())
            self.assertEqual(record["sha256"], hashlib.sha256(fixture.read_bytes()).hexdigest())
        report = validator.validate(self.root)
        self.assertEqual([], report["errors"])
        self.assertEqual([], report["notes"])
        self.assertEqual("file_integrity_passed_requires_text_review", report["status"])

    def test_missing_method(self):
        (self.root / "methods/script-writing.md").unlink()
        self.assert_rejected("missing_or_empty: methods/script-writing.md")

    def test_missing_reading_checker(self):
        (self.root / "checks/validate_reading.py").unlink()
        self.assert_rejected("missing_or_empty: checks/validate_reading.py")

    def test_method_header_version_mismatch(self):
        for name in validator.VERSIONED:
            with self.subTest(document=name):
                path = self.root / name
                original = path.read_text(encoding="utf-8")
                path.write_text(original.replace(self.lock["method_version"], "999.0.0", 1), encoding="utf-8")
                self.assert_rejected("method_version_mismatch: " + name)
                path.write_text(original, encoding="utf-8")

    def test_missing_method_header_version(self):
        path = self.root / "RUN.md"
        original = path.read_text(encoding="utf-8")
        path.write_text(original.replace(self.lock["method_version"], "not-a-version", 1), encoding="utf-8")
        self.assert_rejected("method_version_missing_or_ambiguous: RUN.md")

    def test_historical_body_versions_do_not_override_header(self):
        for name in validator.VERSIONED:
            with (self.root / name).open("a", encoding="utf-8") as stream:
                stream.write("\n\nHistorical method note\n\n版本0.0.1 · earlier method\n")
        for name in ("UPSTREAM.md", "templates/game-script.md"):
            path = self.root / name
            path.write_text("版本0.0.1 · historical/template context\n" + path.read_text(encoding="utf-8"), encoding="utf-8")
        self.assertEqual([], validator.validate(self.root)["errors"])

    def test_broken_link(self):
        (self.root / "extra.md").write_text("[missing](not-found.md)\n", encoding="utf-8")
        self.assert_rejected("broken_link:")

    def test_broken_anchor(self):
        (self.root / "extra.md").write_text("[missing](RUN.md#not-a-heading)\n", encoding="utf-8")
        self.assert_rejected("broken_anchor:")

    def test_changed_snapshot(self):
        path = self.root / self.lock["snapshots"][0]["local_path"]
        path.write_text("Snapshot intentionally changed by test.\n", encoding="utf-8")
        self.assert_rejected("snapshot_changed_or_missing:")

    def test_changed_authority_hash(self):
        self.lock["authorities"][0]["sha256"] = "0" * 64
        self.write_lock()
        self.assert_rejected("authority_changed_or_missing:")

    def test_unwanted_skill(self):
        (self.root / "SKILL.md").write_text("Unwanted discovery entry.\n", encoding="utf-8")
        self.assert_rejected("unexpected_discovery_entry: SKILL.md")

    def test_escaped_snapshot(self):
        # The outside file exists with the declared hash, so this specifically
        # tests the path boundary instead of merely detecting a missing file.
        outside = self.temp_root / "outside.txt"
        outside.write_text("Outside the workflow reference directory.\n", encoding="utf-8")
        self.lock["snapshots"][0].update(
            local_path="../outside.txt", sha256=hashlib.sha256(outside.read_bytes()).hexdigest()
        )
        self.write_lock()
        self.assert_rejected("snapshot_outside_reference_directory:")


if __name__ == "__main__":
    unittest.main()
