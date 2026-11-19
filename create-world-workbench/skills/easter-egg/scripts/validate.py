#!/usr/bin/env python3
"""Portable finite-world validation. Python standard library only; no game execution."""
import argparse
from collections import deque
import json
from pathlib import Path
import re
import sys

SKILL = "easter-egg"
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
    eggs = indexed(bundle.get("easterEggs"), "easterEggs")
    source = indexed(obj(bundle.get("source"), "source").get("nodes"), "source.nodes", True)
    all_ids = set()
    for eid, egg in eggs.items():
        need(egg.get("optional") is True, eid + " must be optional=true")
        refs = seq(egg.get("sourceNodeIds"), eid + ".sourceNodeIds", True)
        need(all(isinstance(ref, str) and ref in source for ref in refs), eid + " unknown source node")
        aids = seq(egg.get("interactionIds"), eid + ".interactionIds", True)
        need(all(isinstance(aid, str) and aid in world.actions for aid in aids), eid + " unknown interaction")
        need(len(set(aids)) == len(aids), eid + " duplicate interaction")
        need(not all_ids.intersection(aids), eid + " interaction belongs to multiple eggs")
        all_ids.update(aids)
        text(egg.get("reward"), eid + ".reward")
        guard_check(egg.get("spoilerGuard"), world.variables, eid + ".spoilerGuard")
    graph = world.explore()
    without = world.explore(all_ids)
    errors, warnings, witnesses = [], [], {}
    required = bundle["flow"].get("mainEndingScreenIds")
    if required is not None:
        required = seq(required, "flow.mainEndingScreenIds", True)
        need(all(isinstance(t, str) and t in world.terminals for t in required), "unknown main ending")
        available = {without.states[i][0] for i in without.endings}
        if not set(required) <= available:
            errors.append("removing easter egg actions blocks declared main ending(s): " + ",".join(sorted(set(required)-available)))
    elif not without.endings:
        errors.append("removing easter egg actions blocks every ending")
    else:
        warnings.append("flow.mainEndingScreenIds absent: proves some ending remains, not preservation of intended success endings")
    can_finish = graph.reaches(graph.endings)
    dead = set(range(len(graph.states))) - can_finish
    if dead:
        index = min(dead)
        errors.append("reachable softlock after optional content; trace=" + json.dumps(graph.trace(index)))
    for eid, egg in eggs.items():
        transitions = [(before, aid, after) for before, aid, after in graph.edges if aid in egg["interactionIds"]]
        reached = {aid for _, aid, _ in transitions}
        if reached != set(egg["interactionIds"]):
            errors.append(eid + " has unreachable trigger actions")
        for before, aid, after in transitions:
            if not holds(egg["spoilerGuard"], world.values(graph.states[before])):
                errors.append(eid + " reveals reward before spoilerGuard; trace=" + json.dumps(graph.trace(before)+[aid]))
                break
        if transitions:
            witnesses[eid] = graph.trace(transitions[0][0]) + [transitions[0][1]]
        for aid in egg["interactionIds"]:
            action = world.actions[aid]
            if action["repeat"] == "repeatable" and any(e["op"] == "add" and e["value"] > 0 for e in action["effects"]):
                # A repeatable grant may be bounded by a claim flag; test whether immediate repetition can grant again.
                for before, action_id, after in transitions:
                    if action_id == aid and world.step(graph.states[after], aid)[0] is not None:
                        errors.append(eid + " repeatable reward can be granted twice by " + aid)
                        break
    if graph.rejected:
        errors.append("reachable action violates state bounds/invariants: " + graph.rejected[0][1])
    if not eggs:
        warnings.append("Empty optional pack is valid; no hidden content is claimed.")
    return errors, warnings, {"states":len(graph.states), "statesWithoutEggs":len(without.states),
        "noEggEndingWitness": without.trace(min(without.endings)) if without.endings else None,
        "witnesses":witnesses, "scope":"finite declared model; actual text spoilers and browser behavior require review"}

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
