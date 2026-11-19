import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from prototype_production import export_contract, load, validate


class PrototypeProductionTests(unittest.TestCase):
    def setUp(self):
        self.fixture = ROOT / "tests/fixtures/prototype"
        self.data = load(self.fixture / "prototype-direction.yaml")

    def test_visible_fixture_validates(self):
        self.assertEqual(self.fixture.resolve() / "sample.svg", validate(self.data, self.fixture))

    def test_player_support_claim_rejected(self):
        data = copy.deepcopy(self.data)
        data["status"] = "player_supported"
        with self.assertRaisesRegex(ValueError, "cannot claim"):
            validate(data, self.fixture)

    def test_invented_player_evidence_rejected(self):
        data = copy.deepcopy(self.data)
        data["player_evidence"] = {"participants": 8}
        with self.assertRaisesRegex(ValueError, "cannot contain"):
            validate(data, self.fixture)

    def test_missing_sample_rejected(self):
        data = copy.deepcopy(self.data)
        data["sample"]["path"] = "missing.png"
        with self.assertRaisesRegex(ValueError, "missing"):
            validate(data, self.fixture)

    def test_raw_hash_tamper_rejected(self):
        data = copy.deepcopy(self.data)
        data["sample"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "actual bytes"):
            validate(data, self.fixture)

    def test_decoded_dimensions_checked(self):
        data = copy.deepcopy(self.data)
        data["sample"]["width"] += 1
        with self.assertRaisesRegex(ValueError, "decoded image"):
            validate(data, self.fixture)

    def test_missing_native_character_panel_rejected(self):
        data = copy.deepcopy(self.data)
        data["sample"]["panels"] = ["gameplay_scene", "ui_hud"]
        with self.assertRaisesRegex(ValueError, "character"):
            validate(data, self.fixture)

    def test_pending_craft_check_rejected(self):
        data = copy.deepcopy(self.data)
        data["checks"][0]["status"] = "pending"
        with self.assertRaisesRegex(ValueError, "must pass"):
            validate(data, self.fixture)

    def test_duplicate_craft_check_rejected(self):
        data = copy.deepcopy(self.data)
        data["checks"][0]["category"] = data["checks"][1]["category"]
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate(data, self.fixture)

    def test_parent_traversal_rejected(self):
        data = copy.deepcopy(self.data)
        data["sample"]["path"] = "../sample.svg"
        with self.assertRaisesRegex(ValueError, "safe relative"):
            validate(data, self.fixture)

    def test_boolean_geometry_rejected(self):
        data = copy.deepcopy(self.data)
        data["brief"]["tile_size"] = True
        with self.assertRaisesRegex(ValueError, "tile_size"):
            validate(data, self.fixture)

    def test_style_fields_cannot_override_evidence_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, folder)
            data = load(folder / "prototype-direction.yaml")
            data["style_system"]["decision_status"] = "player_supported"
            data["style_system"]["player_evidence"] = {"faked": True}
            (folder / "prototype-direction.yaml").write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")
            contract = export_contract(data, folder / "prototype-direction.yaml", folder / "style-contract.yaml")
            self.assertEqual("prototype_selected_unvalidated", contract["decision_status"])
            self.assertIsNone(contract["player_evidence"])

    def test_contract_export_preserves_actual_hash_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, folder)
            decision, output = folder / "prototype-direction.yaml", folder / "style-contract.yaml"
            contract = export_contract(load(decision), decision, output)
            self.assertEqual("prototype-1.0", contract["schema_version"])
            self.assertEqual(hashlib.sha256(decision.read_bytes()).hexdigest(), contract["provenance"]["prototype_decision_sha256"])
            first = output.read_bytes()
            with self.assertRaisesRegex(ValueError, "overwrite"):
                export_contract(load(decision), decision, output)
            self.assertEqual(first, output.read_bytes())

    def test_export_provenance_requires_saved_input_to_match_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, folder)
            data = load(folder / "prototype-direction.yaml")
            data["brief"]["scope"] = "A different unsaved scope"
            with self.assertRaisesRegex(ValueError, "differs from the saved"):
                export_contract(data, folder / "prototype-direction.yaml", folder / "style-contract.yaml")

    def test_png_must_decode_not_just_have_filename(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "fixture"
            shutil.copytree(self.fixture, folder)
            bad = b"\x89PNG\r\n\x1a\nnot a real image"
            (folder / "broken.png").write_bytes(bad)
            data = copy.deepcopy(self.data)
            data["sample"].update(path="broken.png", sha256=hashlib.sha256(bad).hexdigest())
            with self.assertRaises(OSError):
                validate(data, folder)

    def test_cli_json_and_exit_code(self):
        result = subprocess.run([sys.executable, "-B", str(ROOT / "scripts/prototype_production.py"), "validate", str(self.fixture / "prototype-direction.yaml")], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertTrue(json.loads(result.stdout)["passed"])


if __name__ == "__main__":
    unittest.main()
