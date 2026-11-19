"""Portable finite-state contract interpreter. Python standard library only."""
from __future__ import annotations
import hashlib
import json
import re
from collections import deque
from pathlib import Path

ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")
MAX_BYTES = 2 * 1024 * 1024
MAX_STATES = 10000


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def load_bundle(path):
    if Path(path).stat().st_size > MAX_BYTES:
        raise ValueError("bundle exceeds 2 MiB")
    raw = Path(path).read_bytes()
    if len(raw) > MAX_BYTES:
        raise ValueError("bundle exceeds 2 MiB")
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError("duplicate JSON key: " + key)
            out[key] = value
        return out
    bundle = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=unique,
                        parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-finite JSON: " + value)))
    return bundle, hashlib.sha256(raw).hexdigest()


def is_int(value):
    return type(value) is int and abs(value) <= 9007199254740991


def valid_value(variable, value):
    typ = variable["type"]
    if typ == "bool":
        return type(value) is bool
    if typ == "int":
        return is_int(value) and variable["min"] <= value <= variable["max"]
    return type(value) is str and value in variable["values"]


def guard_met(guard, values):
    for condition in guard:
        left, right, op = values[condition["var"]], condition["value"], condition["op"]
        if op == "eq" and not (type(left) is type(right) and left == right): return False
        if op == "ne" and type(left) is type(right) and left == right: return False
        if op == "lt" and not left < right: return False
        if op == "lte" and not left <= right: return False
        if op == "gt" and not left > right: return False
        if op == "gte" and not left >= right: return False
    return True


def invariants_hold(bundle, values):
    return all(not guard_met(item["if"], values) or guard_met(item["then"], values)
               for item in bundle["state"].get("invariants", []))


def initial_state(bundle):
    return {"screenId": bundle["flow"]["startScreen"],
            "values": {v["id"]: v["initial"] for v in bundle["state"]["variables"]},
            "completed": []}


def reduce_action(bundle, state, action_id):
    """Return a new state or raise ValueError; never mutate the input."""
    if state["screenId"] in bundle["flow"]["terminals"]:
        raise ValueError("terminal state rejects ordinary actions")
    action = next((a for a in bundle["interactions"] if a["id"] == action_id), None)
    if action is None: raise ValueError("unknown action: " + str(action_id))
    if action["screenId"] != state["screenId"]: raise ValueError("action belongs to a different screen")
    if action["repeat"] == "once" and action_id in state["completed"]: raise ValueError("once action already completed")
    if not guard_met(action["guard"], state["values"]): raise ValueError("guard not satisfied")
    values = dict(state["values"])
    variables = {v["id"]: v for v in bundle["state"]["variables"]}
    for effect in action["effects"]:
        key = effect["var"]
        value = effect["value"] if effect["op"] == "set" else state["values"][key] + effect["value"]
        if not valid_value(variables[key], value): raise ValueError("effect out of bounds: " + key)
        values[key] = value
    if not invariants_hold(bundle, values): raise ValueError("effect violates state invariant")
    completed = list(state["completed"])
    if action["repeat"] == "once": completed.append(action_id)
    return {"screenId": action["targetScreen"], "values": values, "completed": sorted(completed)}


def replay(bundle, actions):
    if not isinstance(actions, list) or len(actions) > 20000 or any(type(a) is not str for a in actions):
        raise ValueError("trace must be a string array with at most 20000 actions")
    state, observations = initial_state(bundle), []
    observations.append(state)
    for index, action in enumerate(actions):
        try: state = reduce_action(bundle, state, action)
        except ValueError as exc: raise ValueError(f"trace step {index} ({action}): {exc}") from exc
        observations.append(state)
    return state, observations


def checkpoint(bundle, fingerprint, actions):
    state, _ = replay(bundle, actions)
    return {"schemaVersion": 1, "bundleSha256": fingerprint, **state, "trace": actions}


def restore(bundle, fingerprint, saved):
    if not isinstance(saved, dict): raise ValueError("save must be an object")
    if type(saved.get("schemaVersion")) is not int or saved["schemaVersion"] != 1:
        raise ValueError("unsupported save schema")
    if saved.get("bundleSha256") != fingerprint: raise ValueError("save belongs to another bundle revision")
    result, _ = replay(bundle, saved.get("trace"))
    supplied = {key: saved.get(key) for key in ("screenId", "values", "completed")}
    if canonical(result) != canonical(supplied): raise ValueError("save state does not match its replay trace")
    return result


def validate_structure(bundle):
    errors = []
    def bad(message): errors.append(message)
    def identifier(value): return type(value) is str and ID.fullmatch(value) is not None
    def indexed(items, label, maximum):
        if not isinstance(items, list) or len(items) > maximum:
            bad(f"{label} must be an array of at most {maximum}"); return {}
        result = {}
        for item in items:
            if not isinstance(item, dict) or not identifier(item.get("id")):
                bad(f"{label} entry needs a valid id"); continue
            key = item["id"]
            if key in result: bad(f"duplicate {label} id: {key}")
            result[key] = item
        return result
    if not isinstance(bundle, dict): return ["bundle must be an object"]
    if type(bundle.get("schemaVersion")) is not int or bundle["schemaVersion"] != 1: bad("schemaVersion must be 1")
    if not identifier(bundle.get("id")): bad("bundle id is invalid")
    if not isinstance(bundle.get("title"), str) or not bundle["title"].strip(): bad("title must be nonempty text")
    spec = bundle.get("state")
    if not isinstance(spec, dict): return errors + ["state section is required"]
    variables = indexed(spec.get("variables"), "variables", 64)
    for key, var in variables.items():
        typ = var.get("type")
        if typ not in ("bool", "int", "enum"): bad(f"{key}: unsupported type"); continue
        if typ == "int":
            if not all(is_int(var.get(f)) for f in ("min", "max")) or var["min"] > var["max"]:
                bad(f"{key}: integer bounds invalid"); continue
            if min(var["min"], var["max"]) < -1000000 or max(var["min"], var["max"]) > 1000000:
                bad(f"{key}: bounds exceed supported +/-1000000"); continue
        if typ == "enum":
            vals = var.get("values")
            if (not isinstance(vals, list) or not 1 <= len(vals) <= 128
                or any(type(v) is not str or not v for v in vals) or len(set(vals)) != len(vals)):
                bad(f"{key}: enum values must be unique nonempty strings"); continue
        if not valid_value(var, var.get("initial")): bad(f"{key}: initial value has wrong type or bounds")
    if errors: return errors
    def check_guard(guard, label):
        if not isinstance(guard, list) or len(guard) > 64: bad(label + ": guard must be an array, at most 64 conditions"); return
        for condition in guard:
            if not isinstance(condition, dict) or condition.get("var") not in variables:
                bad(label + ": guard references unknown variable"); continue
            var = variables[condition["var"]]
            op = condition.get("op")
            if op not in ("eq", "ne", "lt", "lte", "gt", "gte"): bad(label + ": unknown comparison")
            elif var["type"] != "int" and op not in ("eq", "ne"): bad(label + ": ordering requires int")
            value = condition.get("value")
            if not valid_value(var, value): bad(label + ": guard literal invalid for variable type/range")
    invariants = indexed(spec.get("invariants"), "invariants", 128)
    for key, invariant in invariants.items():
        check_guard(invariant.get("if"), key + ".if")
        check_guard(invariant.get("then"), key + ".then")
    flow = bundle.get("flow")
    if not isinstance(flow, dict): return errors + ["flow section is required"]
    screens = indexed(flow.get("screens"), "screens", 128)
    if not screens: bad("at least one screen is required")
    for key, screen in screens.items():
        if screen.get("kind") not in ("title", "world", "dialogue", "puzzle", "journal", "pause", "ending"):
            bad(key + ": unsupported screen kind")
        if not isinstance(screen.get("title"), str) or not screen["title"].strip(): bad(key + ": screen title required")
    if flow.get("startScreen") not in screens: bad("startScreen does not exist")
    terminals = flow.get("terminals")
    if not isinstance(terminals, list) or not terminals or any(type(t) is not str for t in terminals):
        bad("terminals must be a nonempty string array"); terminals = []
    if len(set(terminals)) != len(terminals): bad("duplicate terminal")
    if "mainEndingScreenIds" in flow:
        main = flow["mainEndingScreenIds"]
        if not isinstance(main, list) or not main or any(type(t) is not str or t not in terminals for t in main):
            bad("mainEndingScreenIds must be a nonempty terminal subset")
        elif len(set(main)) != len(main): bad("duplicate main ending")
    for terminal in terminals:
        if terminal not in screens or screens[terminal].get("kind") != "ending": bad("terminal must reference an ending screen")
    for key, screen in screens.items():
        if screen.get("kind") == "ending" and key not in terminals: bad(key + ": ending screen must be terminal")
    actions = indexed(bundle.get("interactions"), "interactions", 512)
    if not actions: bad("at least one interaction is required")
    for key, action in actions.items():
        if action.get("screenId") not in screens or action.get("targetScreen") not in screens: bad(key + ": screen reference missing")
        if action.get("screenId") in terminals: bad(key + ": terminal cannot contain ordinary actions")
        if action.get("repeat") not in ("once", "repeatable"): bad(key + ": repeat must be once or repeatable")
        for field in ("label", "input", "feedback", "failure", "cancel"):
            if not isinstance(action.get(field), str) or not action[field].strip(): bad(key + ": " + field + " required")
        check_guard(action.get("guard"), key)
        effects = action.get("effects")
        if not isinstance(effects, list) or len(effects) > 64: bad(key + ": effects must be array, at most 64"); continue
        written = set()
        for effect in effects:
            if not isinstance(effect, dict) or effect.get("var") not in variables:
                bad(key + ": effect references unknown variable"); continue
            name, op, value = effect["var"], effect.get("op"), effect.get("value")
            var = variables[name]
            if name in written: bad(key + ": duplicate write: " + name)
            written.add(name)
            if op == "set":
                if not valid_value(var, value): bad(key + ": set value invalid")
            elif op == "add":
                if var["type"] != "int" or not is_int(value): bad(key + ": add requires integer variable and value")
            else: bad(key + ": unsupported effect operation")
    edges = indexed(flow.get("edges"), "edges", 512)
    counts = {key: 0 for key in actions}
    for key, edge in edges.items():
        action = actions.get(edge.get("actionId"))
        if action is None: bad(key + ": edge references unknown action"); continue
        counts[action["id"]] += 1
        if edge.get("from") != action.get("screenId") or edge.get("to") != action.get("targetScreen"):
            bad(key + ": edge/action endpoints disagree")
    for key, count in counts.items():
        if count != 1: bad(key + ": requires exactly one flow edge")
    if not errors and not invariants_hold(bundle, initial_state(bundle)["values"]): bad("initial state violates invariant")
    return errors


def explore(bundle, max_states=MAX_STATES, excluded_actions=None):
    if not is_int(max_states) or not 1 <= max_states <= 100000: raise ValueError("max_states must be 1..100000")
    excluded = set(excluded_actions or [])
    initial = initial_state(bundle)
    first = canonical(initial)
    states, parent, reverse = {first: initial}, {first: None}, {first: set()}
    queue, ends, reached_screens = deque([first]), {}, set()
    invalid, truncated, transitions = [], False, 0
    while queue and not truncated:
        key = queue.popleft()
        state = states[key]
        reached_screens.add(state["screenId"])
        if state["screenId"] in bundle["flow"]["terminals"]:
            ends.setdefault(state["screenId"], key); continue
        for action in bundle["interactions"]:
            if (action["id"] in excluded or action["screenId"] != state["screenId"]
                or (action["repeat"] == "once" and action["id"] in state["completed"])
                or not guard_met(action["guard"], state["values"])): continue
            try: next_state = reduce_action(bundle, state, action["id"])
            except ValueError as exc:
                item = {"actionId": action["id"], "reason": str(exc)}
                if item not in invalid: invalid.append(item)
                continue
            new_key = canonical(next_state)
            transitions += 1
            if new_key not in states:
                if len(states) >= max_states: truncated = True; break
                states[new_key], parent[new_key], reverse[new_key] = next_state, (key, action["id"]), set()
                queue.append(new_key)
            reverse[new_key].add(key)
    ending_keys = [key for key, state in states.items() if state["screenId"] in bundle["flow"]["terminals"]]
    viable, backwards = set(ending_keys), deque(ending_keys)
    while backwards:
        for previous in reverse[backwards.popleft()]:
            if previous not in viable: viable.add(previous); backwards.append(previous)
    def trace(key):
        out = []
        while parent[key] is not None:
            key, action = parent[key]; out.append(action)
        return list(reversed(out))
    witnesses = {screen: trace(key) for screen, key in ends.items()}
    return {"status": "unknown" if truncated else "complete", "states": len(states),
            "transitions": transitions, "reachableScreens": sorted(reached_screens),
            "endingWitnesses": witnesses, "invalidTransitions": invalid,
            "softlockCount": None if truncated else len(states) - len(viable),
            "softlockWitness": None if truncated or len(viable) == len(states) else trace(next(key for key in states if key not in viable))}


def validate(bundle, max_states=MAX_STATES):
    errors, warnings = validate_structure(bundle), []
    result = None
    if not errors:
        result = explore(bundle, max_states)
        if result["status"] == "unknown": errors.append("reachability unknown: state budget exhausted")
        if result["invalidTransitions"]: errors.append("reachable transition violates bounds/invariants")
        if result["softlockCount"]: errors.append("reachable states cannot reach any ending: " + str(result["softlockCount"]))
        for terminal in bundle["flow"]["terminals"]:
            if terminal not in result["endingWitnesses"]: errors.append("terminal not proven reachable: " + terminal)
        missing = set(s["id"] for s in bundle["flow"]["screens"]) - set(result["reachableScreens"])
        if missing: errors.append("screens not proven reachable: " + ",".join(sorted(missing)))
    return {"passed": not errors, "errors": errors, "warnings": warnings, "modelCheck": result}


def emit_report(result, input_path, report_path=None):
    if report_path:
        try:
            target = Path(report_path)
            if target.resolve() == Path(input_path).resolve():
                raise ValueError("report path must not overwrite input")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except (OSError, ValueError) as exc:
            result["passed"] = False
            result["errors"].append("report failure: " + str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1
