import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from validate_runtime_dialogue import Session, first_branch, load, validate


class RuntimeDialogueTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ROOT / "tests/fixtures"
        self.room = load(self.fixture / "room.json")
        self.audit = load(self.fixture / "audit.json")

    def test_native_dialogue_and_knowledge_positive(self):
        report = validate(self.room, self.audit)
        self.assertTrue(report["passed"], report["errors"])
        self.assertEqual("unverified", report["runtimeEvidence"])
        self.assertGreater(report["metrics"]["reachableStates"], 8)
        self.assertGreater(report["metrics"]["cancellationProbes"], 20)

    def test_knowledge_leak_detected_in_reachable_state(self):
        self.audit["facts"][0]["knowledge"]["Navigator"]["when"] = {"guidanceReady": True}
        report = validate(self.room, self.audit)
        self.assertFalse(report["passed"])
        self.assertTrue(any("knowledge leak" in error for error in report["errors"]))

    def test_fact_speaker_identity_matters(self):
        self.audit["facts"][0]["knowledge"] = {"Officer": {"when": {"powerReady": True}, "certainty": "observed"}}
        report = validate(self.room, self.audit)
        self.assertTrue(any("cannot know" in error for error in report["errors"]))

    def test_hearsay_cannot_be_upgraded(self):
        self.audit["facts"][0]["knowledge"]["Navigator"]["certainty"] = "heard"
        report = validate(self.room, self.audit)
        self.assertTrue(any("certainty mismatch" in error for error in report["errors"]))

    def test_shadowed_branch_detected(self):
        branches = self.room["dialogues"][1]["branches"]
        branches.insert(0, branches.pop())
        report = validate(self.room, self.audit)
        self.assertTrue(any("shadowed" in error for error in report["errors"]))

    def test_missing_fallback_detected(self):
        self.room["dialogues"][1]["branches"][-1]["when"] = {"eggRain": True}
        report = validate(self.room, self.audit)
        self.assertTrue(any("no matching" in error for error in report["errors"]))

    def test_unknown_flag_and_string_bool_rejected(self):
        for wrong in ({"typo": True}, {"briefed": "false"}):
            room = copy.deepcopy(self.room)
            room["dialogues"][0]["branches"][0]["when"] = wrong
            with self.assertRaisesRegex(ValueError, "Boolean"):
                validate(room, self.audit)

    def test_non_briefing_npc_cannot_grant_briefing(self):
        self.room["dialogues"][1]["branches"][0]["setFlags"] = ["briefed"]
        with self.assertRaisesRegex(ValueError, "reserved"):
            validate(self.room, self.audit)

    def test_dialogue_cannot_complete_device(self):
        self.room["dialogues"][0]["branches"][0]["setFlags"] = ["powerReady"]
        with self.assertRaisesRegex(ValueError, "only set briefed"):
            validate(self.room, self.audit)

    def test_line_annotations_cannot_be_omitted_or_duplicated(self):
        self.audit["lineClaims"].pop()
        with self.assertRaisesRegex(ValueError, "every dialogue line"):
            validate(self.room, self.audit)
        self.audit["lineClaims"].append(copy.deepcopy(self.audit["lineClaims"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate line claim"):
            validate(self.room, self.audit)

    def test_cancel_each_line_is_transactional(self):
        state = (False, False, False, False, False)
        branch = self.room["dialogues"][0]["branches"][0]
        for count in range(len(branch["lines"])):
            session = Session(state, branch, ["briefed"])
            for _ in range(count):
                self.assertEqual(state, session.advance())
            self.assertEqual(state, session.cancel())
            with self.assertRaisesRegex(ValueError, "closed"):
                session.advance()

    def test_last_line_requires_another_confirm_before_commit(self):
        state = (False, False, False, False, False)
        branch = self.room["dialogues"][0]["branches"][0]
        session = Session(state, branch, ["briefed"])
        for _ in range(len(branch["lines"]) - 1):
            self.assertEqual(state, session.advance())
        self.assertFalse(session.closed)
        self.assertEqual((True, False, False, False, False), session.advance())
        self.assertTrue(session.closed)

    def test_reentry_selects_new_state_branch(self):
        dialogue = self.room["dialogues"][0]
        self.assertEqual("brief", first_branch(dialogue, (False,) * 5)["id"])
        self.assertEqual("again", first_branch(dialogue, (True, False, False, False, False))["id"])
        self.assertEqual([], first_branch(dialogue, (True, False, False, False, False))["setFlags"])

    def test_egg_cannot_be_mainline_gate(self):
        self.room["hotspots"][-1]["requires"].append("eggHumor")
        with self.assertRaisesRegex(ValueError, "must not require eggs"):
            validate(self.room, self.audit)

    def test_too_long_line_rejected(self):
        self.room["dialogues"][0]["branches"][0]["lines"][0]["text"] = "x" * 81
        with self.assertRaisesRegex(ValueError, "rendering budget"):
            validate(self.room, self.audit)

    def test_cli_report_matches_stdout(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "report.json"
            command = [sys.executable, "-B", str(ROOT / "scripts/validate_runtime_dialogue.py"), str(self.fixture / "room.json"), str(self.fixture / "audit.json"), "--report", str(output)]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), json.loads(result.stdout))

    def test_cli_bad_json_is_structured_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "bad.json"
            bad.write_text('{"broken":', encoding="utf-8")
            command = [sys.executable, "-B", str(ROOT / "scripts/validate_runtime_dialogue.py"), str(bad), str(self.fixture / "audit.json")]
            result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(1, result.returncode)
            self.assertFalse(json.loads(result.stdout)["passed"])


if __name__ == "__main__":
    unittest.main()
