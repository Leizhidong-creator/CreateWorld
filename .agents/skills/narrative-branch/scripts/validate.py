#!/usr/bin/env python3
"""Portable finite-world validation. Python standard library only; no game execution."""
import argparse
from collections import deque
import json
from pathlib import Path
import re
import sys

SKILL = "narrative-branch"
LIMIT = 20000
EDGE_LIMIT = 250000
ID = re.compile(r"^[a-z][a-z0-9_-]{0,63}$")


class Invalid(Exception):
    pass


def need(ok, message):
    if not ok:
        raise Invalid(message)


def obj(value, path):
    need(isinstance(value, dict), path + " must be an object")
    return value


def seq(value, path, nonempty=False):
    need(isinstance(value, list), path + " must be an array")
    need(not nonempty or bool(value), path + " must not be empty")
    return value


def text(value, path):
    need(isinstance(value, str) and bool(value.strip()), path + " must be nonempty text")
    return value


def identifier(value, path):
    need(isinstance(value, str) and bool(ID.fullmatch(value)), path + " invalid ID")
    return value


def indexed(values, path, nonempty=False):
    result = {}
    for i, item in enumerate(seq(values, path, nonempty)):
        item = obj(item, f"{path}[{i}]")
        key = identifier(item.get("id"), f"{path}[{i}].id")
        need(key not in result, path + " duplicate ID " + key)
        result[key] = item
    return result


def integer(value):
    return type(value) is int and abs(value) <= 9007199254740991


def valid_value(variable, value):
    kind = variable["type"]
    if kind == "bool":
        return type(value) is bool
    if kind == "int":
        return integer(value) and variable["min"] <= value <= variable["max"]
    return isinstance(value, str) and value in variable["values"]


def guard_check(guard, variables, path):
    for i, condition in enumerate(seq(guard, path)):
        condition = obj(condition, f"{path}[{i}]")
        var = condition.get("var")
        need(isinstance(var, str) and var in variables, path + " references unknown variable")
        operation = condition.get("op")
        need(operation in ("eq", "ne", "lt", "lte", "gt", "gte"), path + " invalid comparison")
        spec = variables[var]
        need(spec["type"] == "int" or operation in ("eq", "ne"), path + " numeric comparison on non-int")
        # Guard thresholds may sit outside an int domain; reachability detects impossible thresholds.
        need(integer(condition.get("value")) if spec["type"] == "int" else valid_value(spec, condition.get("value")), path + " invalid comparison value type")


def holds(guard, values):
    for c in guard:
        lhs, rhs, op = values[c["var"]], c["value"], c["op"]
        if not {"eq": lambda: lhs == rhs, "ne": lambda: lhs != rhs,
                "lt": lambda: lhs < rhs, "lte": lambda: lhs <= rhs,
                "gt": lambda: lhs > rhs, "gte": lambda: lhs >= rhs}[op]():
            return False
    return True


class World:
    def __init__(self, bundle):
        self.bundle = obj(bundle, "bundle")
        need(type(bundle.get("schemaVersion")) is int and bundle["schemaVersion"] == 1, "schemaVersion must be 1")
        identifier(bundle.get("id"), "bundle.id")
        text(bundle.get("title"), "bundle.title")
        state = obj(bundle.get("state"), "state")
        self.variables = indexed(state.get("variables"), "state.variables")
        for key, var in self.variables.items():
            need(var.get("type") in ("bool", "int", "enum"), key + " invalid variable type")
            if var["type"] == "int":
                need(integer(var.get("min")) and integer(var.get("max")) and var["min"] <= var["max"], key + " invalid integer range")
            if var["type"] == "enum":
                vals = seq(var.get("values"), key + ".values", True)
                need(all(isinstance(v, str) and v for v in vals), key + " invalid enum values")
                need(len(set(vals)) == len(vals), key + " duplicate enum values")
            need(valid_value(var, var.get("initial")), key + " invalid initial value")
        self.keys = tuple(self.variables)
        self.invariants = list(indexed(state.get("invariants"), "state.invariants").values())
        for invariant in self.invariants:
            guard_check(invariant.get("if"), self.variables, "invariant.if")
            guard_check(invariant.get("then"), self.variables, "invariant.then")
        flow = obj(bundle.get("flow"), "flow")
        self.screens = indexed(flow.get("screens"), "flow.screens", True)
        for key, screen in self.screens.items():
            need(screen.get("kind") in ("title", "world", "dialogue", "puzzle", "journal", "pause", "ending"), key + " invalid screen kind")
            text(screen.get("title"), key + ".title")
        start = flow.get("startScreen")
        need(isinstance(start, str) and start in self.screens, "flow.startScreen missing")
        terminals = seq(flow.get("terminals"), "flow.terminals", True)
        need(all(isinstance(t, str) and t in self.screens and self.screens[t]["kind"] == "ending" for t in terminals), "terminal must reference an ending screen")
        need(len(set(terminals)) == len(terminals), "duplicate terminal")
        self.terminals = set(terminals)
        self.actions = indexed(bundle.get("interactions"), "interactions", True)
        self.by_screen = {key: [] for key in self.screens}
        for key, action in self.actions.items():
            need(isinstance(action.get("screenId"), str) and action["screenId"] in self.screens, key + " unknown screenId")
            need(isinstance(action.get("targetScreen"), str) and action["targetScreen"] in self.screens, key + " unknown targetScreen")
            need(action.get("repeat") in ("once", "repeatable"), key + " invalid repeat policy")
            guard_check(action.get("guard"), self.variables, key + ".guard")
            written = set()
            for effect in seq(action.get("effects"), key + ".effects"):
                effect = obj(effect, key + ".effect")
                var = effect.get("var")
                need(isinstance(var, str) and var in self.variables, key + " effect references unknown variable")
                need(var not in written, key + " duplicates effect variable")
                written.add(var)
                spec, op, value = self.variables[var], effect.get("op"), effect.get("value")
                need(op in ("set", "add"), key + " invalid effect operation")
                if op == "add":
                    need(spec["type"] == "int" and integer(value), key + " add requires int variable and value")
                else:
                    need(valid_value(spec, value), key + " invalid set effect value")
            need(action["screenId"] not in self.terminals, key + " terminal rejects ordinary actions")
            self.by_screen[action["screenId"]].append(key)
        edges = indexed(flow.get("edges"), "flow.edges", True)
        seen = set()
        for edge in edges.values():
            aid = edge.get("actionId")
            need(isinstance(aid, str) and aid in self.actions, "edge references unknown action")
            need(aid not in seen, "multiple edges for action " + aid)
            seen.add(aid)
            action = self.actions[aid]
            need(edge.get("from") == action["screenId"] and edge.get("to") == action["targetScreen"], "edge disagrees with action " + aid)
        need(seen == set(self.actions), "each action requires exactly one flow edge")
        initial = {key: spec["initial"] for key, spec in self.variables.items()}
        need(self.invariant_ok(initial), "initial state violates invariant")
        self.initial = self.pack(start, initial, frozenset())

    def pack(self, screen, values, completed):
        return (screen, tuple(values[key] for key in self.keys), frozenset(completed))

    def values(self, state):
        return dict(zip(self.keys, state[1]))

    def invariant_ok(self, values):
        return all(not holds(inv["if"], values) or holds(inv["then"], values) for inv in self.invariants)

    def step(self, state, aid):
        action = self.actions[aid]
        values = self.values(state)
        if state[0] in self.terminals or state[0] != action["screenId"] or aid in state[2] or not holds(action["guard"], values):
            return None, "unavailable"
        updated = dict(values)
        for effect in action["effects"]:
            key = effect["var"]
            updated[key] = effect["value"] if effect["op"] == "set" else values[key] + effect["value"]
        if not all(valid_value(self.variables[key], val) for key, val in updated.items()) or not self.invariant_ok(updated):
            return None, "atomic_rejection"
        completed = state[2] | {aid} if action["repeat"] == "once" else state[2]
        return self.pack(action["targetScreen"], updated, completed), None

    def explore(self, excluded=frozenset()):
        states = [self.initial]
        known = {self.initial: 0}
        edges = []
        rejected = []
        parents = {0: None}
        queue = deque([0])
        while queue:
            index = queue.popleft()
            state = states[index]
            if state[0] in self.terminals:
                continue
            for aid in self.by_screen[state[0]]:
                if aid in excluded:
                    continue
                after, reason = self.step(state, aid)
                if reason == "atomic_rejection":
                    rejected.append((index, aid))
                if after is None:
                    continue
                if after not in known:
                    need(len(states) < LIMIT, f"verification incomplete: state limit {LIMIT} exceeded")
                    known[after] = len(states)
                    parents[len(states)] = (index, aid)
                    states.append(after)
                    queue.append(known[after])
                edges.append((index, aid, known[after]))
                need(len(edges) <= EDGE_LIMIT, f"verification incomplete: edge limit {EDGE_LIMIT} exceeded")
        return Graph(self, states, edges, rejected, parents)


class Graph:
    def __init__(self, world, states, edges, rejected, parents):
        self.world, self.states, self.edges = world, states, edges
        self.rejected, self.parents = rejected, parents
        self.forward = [[] for _ in states]
        self.reverse = [[] for _ in states]
        for before, aid, after in edges:
            self.forward[before].append((aid, after))
            self.reverse[after].append(before)
        self.endings = {i for i, s in enumerate(states) if s[0] in world.terminals}

    def reaches(self, target_indices):
        reached = set(target_indices)
        queue = deque(reached)
        while queue:
            for parent in self.reverse[queue.popleft()]:
                if parent not in reached:
                    reached.add(parent)
                    queue.append(parent)
        return reached

    def trace(self, index):
        path = []
        while self.parents[index] is not None:
            index, aid = self.parents[index]
            path.append(aid)
        return list(reversed(path))


def validate(bundle):
    world = World(bundle)
    branches = indexed(bundle.get("branches"), "branches")
    graph = world.explore()
    errors, warnings = [], []
    witnesses = {}
    if not branches:
        warnings.append("No branches requested; this is valid for a fixed narrative, not evidence of branching capability.")
    for bid, branch in branches.items():
        screen = branch.get("decisionScreenId")
        need(isinstance(screen, str) and screen in world.screens, bid + " unknown decisionScreenId")
        options = indexed(branch.get("options"), bid + ".options", True)
        need(len(options) >= 2, bid + " requires at least two options")
        terminals = seq(branch.get("endingScreenIds"), bid + ".endingScreenIds", True)
        need(all(isinstance(t, str) and t in world.terminals for t in terminals), bid + " unknown endingScreenId")
        targets = {i for i in graph.endings if graph.states[i][0] in terminals}
        reaches = graph.reaches(targets)
        actions, signatures, target_union = set(), set(), set()
        for oid, option in options.items():
            aid = option.get("actionId")
            need(isinstance(aid, str) and aid in world.actions, oid + " unknown actionId")
            need(aid not in actions, bid + " duplicates option action")
            actions.add(aid)
            action = world.actions[aid]
            need(action["screenId"] == screen, oid + " action does not start at decision screen")
            text(option.get("consequence"), oid + ".consequence")
            transitions = [(before, after) for before, action_id, after in graph.edges if action_id == aid]
            if not transitions:
                errors.append(oid + " option is unreachable")
                continue
            signatures.add(json.dumps([action["guard"], action["effects"], action["targetScreen"]], sort_keys=True))
            if any(after not in reaches for _, after in transitions):
                bad = next(after for _, after in transitions if after not in reaches)
                errors.append(oid + " consequence cannot reach a declared ending; trace=" + json.dumps(graph.trace(bad)))
            witnesses[oid] = graph.trace(transitions[0][0]) + [aid]
            reachable_from_option = {after for _, after in transitions}
            queue = deque(reachable_from_option)
            while queue:
                for _, dest in graph.forward[queue.popleft()]:
                    if dest not in reachable_from_option:
                        reachable_from_option.add(dest)
                        queue.append(dest)
            target_union |= {graph.states[i][0] for i in reachable_from_option & graph.endings}
        # Equal effects and target, even with different guards, are identical outcome choices.
        outcomes = {(world.actions[a]["targetScreen"], json.dumps(world.actions[a]["effects"], sort_keys=True)) for a in actions}
        if len(outcomes) < len(actions):
            errors.append(bid + " options have identical executable consequences")
        if not set(terminals) <= target_union:
            errors.append(bid + " declares endings unreachable from its options")
    if graph.rejected:
        errors.append("reachable action violates state bounds/invariants: " + graph.rejected[0][1])
    return errors, warnings, {"states": len(graph.states), "transitions": len(graph.edges), "witnesses": witnesses,
                              "scope": "finite declared model; browser input, prose fidelity and fun are unverified"}


def duplicate_safe(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, "duplicate JSON key: " + key)
        result[key] = value
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle")
    parser.add_argument("--report")
    args = parser.parse_args()
    report = {"skill": SKILL, "passed": False, "errors": [], "warnings": []}
    try:
        source = Path(args.bundle)
        need(source.stat().st_size <= 2 * 1024 * 1024, "input exceeds 2 MiB")
        bundle = json.loads(source.read_text(encoding="utf-8-sig"), object_pairs_hook=duplicate_safe,
                            parse_constant=lambda value: (_ for _ in ()).throw(Invalid("nonfinite JSON number: " + value)))
        errors, warnings, metrics = validate(bundle)
        report.update(errors=errors, warnings=warnings, metrics=metrics, passed=not errors)
    except (Invalid, ValueError, TypeError, KeyError, OSError, RecursionError) as exc:
        report["errors"].append(str(exc))
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        try:
            target = Path(args.report)
            if target.resolve() == source.resolve():
                raise ValueError("report path must not overwrite input")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(output + "\n", encoding="utf-8")
        except (OSError, ValueError) as exc:
            report["errors"].append("cannot write report: " + str(exc))
            report["passed"] = False
            output = json.dumps(report, ensure_ascii=False, indent=2)
    print(output)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
