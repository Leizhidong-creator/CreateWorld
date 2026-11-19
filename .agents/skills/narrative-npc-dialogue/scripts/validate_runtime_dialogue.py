#!/usr/bin/env python3
"""Check native canvas-room-v1 dialogue with a separate explicit knowledge audit."""
import argparse
from collections import deque
import json
from pathlib import Path
import sys

FLAGS = ("briefed", "powerReady", "guidanceReady", "eggHumor", "eggRain")
CERTAINTIES = ("observed", "heard", "inferred", "established")


def need(ok, message):
    if not ok:
        raise ValueError(message)


def text(value, path):
    need(isinstance(value, str) and value.strip(), path + " must be nonempty text")


def array(value, path, nonempty=False):
    need(isinstance(value, list) and (not nonempty or value), path + " must be an array")
    return value


def mapping(value, path):
    need(isinstance(value, dict), path + " must be an object")
    return value


def index(values, path):
    result = {}
    for value in array(values, path, True):
        value = mapping(value, path)
        key = value.get("id")
        text(key, path + ".id")
        need(key not in result, path + " duplicate id: " + key)
        result[key] = value
    return result


def when_check(value, path):
    for key, expected in mapping(value, path).items():
        need(key in FLAGS and type(expected) is bool, path + " must use known Boolean flags")


def matches(when, state):
    return all(state[FLAGS.index(key)] is value for key, value in when.items())


def set_flags(state, flags):
    return tuple(True if key in flags else state[i] for i, key in enumerate(FLAGS))


def first_branch(dialogue, state):
    return next((branch for branch in dialogue["branches"] if matches(branch["when"], state)), None)


class Session:
    """The host commits only on advancing beyond the final displayed line."""
    def __init__(self, state, branch, flags):
        self.entry = state
        self.state = state
        self.branch = branch
        self.flags = flags
        self.line = 0
        self.closed = False

    def advance(self):
        need(not self.closed, "session already closed")
        if self.line < len(self.branch["lines"]) - 1:
            self.line += 1
        else:
            self.state = set_flags(self.entry, self.flags)
            self.closed = True
        return self.state

    def cancel(self):
        need(not self.closed, "session already closed")
        self.closed = True
        return self.state


def validate(room, audit):
    room, audit = mapping(room, "room"), mapping(audit, "audit")
    need(type(audit.get("schemaVersion")) is int and audit["schemaVersion"] == 1 and audit.get("profile") == "canvas-room-v1", "unsupported audit profile/version")
    speakers = array(audit.get("speakers"), "audit.speakers", True)
    need(all(isinstance(s, str) and s.strip() for s in speakers) and len(set(speakers)) == len(speakers), "invalid/duplicate speakers")
    limit = audit.get("maxLineChars")
    need(type(limit) is int and 1 <= limit <= 1000, "maxLineChars must be an integer 1..1000")
    npcs = index(room.get("npcs"), "npcs")
    briefing_id = audit.get("briefingNpcId")
    need(isinstance(briefing_id, str) and briefing_id in npcs, "briefingNpcId missing")
    hotspots = index(room.get("hotspots"), "hotspots")
    dialogues = index(room.get("dialogues"), "dialogues")
    bindings = []
    for npc in npcs.values():
        text(npc.get("name"), "npc.name")
        did = npc.get("dialogueId")
        need(isinstance(did, str) and did in dialogues, "NPC references missing dialogue")
        bindings.append(("npc", npc["id"], did, (), ()))
    module_kinds = set()
    for hotspot in hotspots.values():
        kind = hotspot.get("kind")
        need(kind in ("power", "guidance", "egg", "exit"), "unknown hotspot kind")
        requires = array(hotspot.get("requires", []), "hotspot.requires")
        need(all(isinstance(flag, str) and flag in FLAGS for flag in requires) and len(set(requires)) == len(requires), "invalid hotspot requirements")
        if kind == "egg":
            did, flag = hotspot.get("dialogueId"), hotspot.get("eggFlag")
            need(isinstance(did, str) and did in dialogues, "egg references missing dialogue")
            need(flag in ("eggHumor", "eggRain"), "invalid eggFlag")
            bindings.append(("egg", hotspot["id"], did, tuple(requires), (flag,)))
        else:
            module_kinds.add(kind)
            if kind in ("power", "guidance"):
                need(set(requires) == {"briefed"}, "device hotspot must require only briefing in this profile")
            if kind == "exit":
                need(set(requires) == {"briefed", "powerReady", "guidanceReady"}, "exit must require preparation and must not require eggs")
    all_lines, all_branches = {}, set()
    for did, dialogue in dialogues.items():
        branches = index(dialogue.get("branches"), did + ".branches")
        for bid, branch in branches.items():
            all_branches.add((did, bid))
            when_check(branch.get("when"), did + "/" + bid + ".when")
            flags = array(branch.get("setFlags", []), bid + ".setFlags")
            need(all(flag == "briefed" for flag in flags) and len(flags) <= 1, "dialogue may only set briefed; module and egg flags belong to their events")
            if flags:
                owners = [b for b in bindings if b[2] == did]
                need(owners and all(owner[0] == "npc" and owner[1] == briefing_id for owner in owners), "briefed write is reserved for briefing NPC")
            for i, line in enumerate(array(branch.get("lines"), bid + ".lines", True)):
                line = mapping(line, "line")
                need(line.get("speaker") in speakers, "unknown line speaker")
                text(line.get("text"), "line.text")
                need(len(line["text"]) <= limit, "line exceeds declared rendering budget")
                all_lines[(did, bid, i)] = line
    facts = {}
    for fact in array(audit.get("facts"), "facts"):
        fact = mapping(fact, "fact")
        fid = fact.get("id")
        text(fid, "fact.id")
        need(fid not in facts, "duplicate fact id")
        text(fact.get("source"), "fact.source")
        knowledge = mapping(fact.get("knowledge"), "fact.knowledge")
        for speaker, entry in knowledge.items():
            need(speaker in speakers, "fact knowledge has unknown speaker")
            entry = mapping(entry, "knowledge entry")
            when_check(entry.get("when"), "knowledge.when")
            need(entry.get("certainty") in CERTAINTIES, "invalid knowledge certainty")
        facts[fid] = fact
    annotations = {}
    for annotation in array(audit.get("lineClaims"), "lineClaims"):
        annotation = mapping(annotation, "line claim")
        key = (annotation.get("dialogueId"), annotation.get("branchId"), annotation.get("lineIndex"))
        need(isinstance(key[0], str) and isinstance(key[1], str) and type(key[2]) is int, "invalid line claim identity")
        need(key in all_lines and key not in annotations, "stale or duplicate line claim")
        claims = array(annotation.get("claims"), "line claims")
        for claim in claims:
            claim = mapping(claim, "claim")
            need(isinstance(claim.get("factId"), str) and claim["factId"] in facts, "claim references missing fact")
            need(claim.get("certainty") in CERTAINTIES, "invalid claim certainty")
        annotations[key] = claims
    need(set(annotations) == set(all_lines), "every dialogue line requires an explicit knowledge annotation (claims=[] allowed)")

    initial = tuple(False for _ in FLAGS)
    states, queue, parents = {initial}, deque([initial]), {initial: []}
    selected, occurrences, errors = set(), [], []
    while queue:
        state = queue.popleft()
        next_events = []
        for kind, eid, did, requires, egg_flags in bindings:
            if not all(state[FLAGS.index(flag)] for flag in requires):
                continue
            branch = first_branch(dialogues[did], state)
            if branch is None:
                errors.append(f"{eid} has no matching dialogue branch at {dict(zip(FLAGS,state))}")
                continue
            selected.add((did, branch["id"]))
            flags = egg_flags if kind == "egg" else tuple(branch.get("setFlags", []))
            occurrences.append((state, did, branch, flags))
            next_events.append((set_flags(state, flags), kind + ":" + eid + "/" + branch["id"]))
        if state[0]:
            for kind, flag in (("power", "powerReady"), ("guidance", "guidanceReady")):
                if kind in module_kinds:
                    next_events.append((set_flags(state, [flag]), "external-success:" + kind))
        for after, event in next_events:
            if after not in states:
                states.add(after)
                parents[after] = parents[state] + [event]
                queue.append(after)
    for did, bid in sorted(all_branches - selected):
        errors.append(f"{did}/{bid} is unreachable or shadowed by an earlier branch")
    cancellation_probes = completion_probes = repeat_probes = 0
    for state, did, branch, flags in occurrences:
        for i, line in enumerate(branch["lines"]):
            for claim in annotations[(did, branch["id"], i)]:
                fact = facts[claim["factId"]]
                knowledge = fact["knowledge"].get(line["speaker"])
                if knowledge is None or not matches(knowledge["when"], state):
                    errors.append(f"knowledge leak: {did}/{branch['id']} line {i} speaker {line['speaker']} cannot know {claim['factId']}; trace={parents[state]}")
                elif knowledge["certainty"] != claim["certainty"]:
                    errors.append(f"certainty mismatch: {did}/{branch['id']} line {i} upgrades or changes source certainty")
            session = Session(state, branch, flags)
            for _ in range(i):
                need(session.advance() == state, "partial playback committed state")
            need(session.cancel() == state, "cancellation committed state")
            cancellation_probes += 1
        session = Session(state, branch, flags)
        for _ in branch["lines"]:
            session.advance()
        need(session.closed and session.state == set_flags(state, flags), "completion effect mismatch")
        completion_probes += 1
        need(set_flags(session.state, flags) == session.state, "repeated completion grants extra state")
        repeat_probes += 1
    need(any(state[0] for state in states), "briefing can never complete")
    return {"skill": "narrative-npc-dialogue", "passed": not errors, "errors": list(dict.fromkeys(errors)),
            "warnings": ["Declared facts do not prove every prose claim was annotated faithfully.", "Module success is abstracted; spatial reach, real UI interruption and gesture delivery need independent runtime tests."],
            "metrics": {"reachableStates": len(states), "selectedBranches": len(selected), "annotatedLines": len(annotations), "cancellationProbes": cancellation_probes, "completionProbes": completion_probes, "repeatProbes": repeat_probes},
            "runtimeEvidence": "unverified"}


def pairs_no_duplicates(pairs):
    value = {}
    for key, item in pairs:
        need(key not in value, "duplicate JSON key: " + key)
        value[key] = item
    return value


def load(path):
    path = Path(path)
    need(path.stat().st_size <= 2 * 1024 * 1024, "input exceeds 2 MiB")
    return json.loads(path.read_text(encoding="utf-8-sig"), object_pairs_hook=pairs_no_duplicates)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("room")
    parser.add_argument("audit")
    parser.add_argument("--report")
    args = parser.parse_args()
    try:
        report = validate(load(args.room), load(args.audit))
    except (ValueError, TypeError, KeyError, OSError, RecursionError) as exc:
        report = {"skill": "narrative-npc-dialogue", "passed": False, "errors": [str(exc)], "warnings": [], "runtimeEvidence": "unverified"}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        try:
            path = Path(args.report)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(output + "\n", encoding="utf-8")
        except OSError as exc:
            report["passed"] = False
            report["errors"].append(str(exc))
            output = json.dumps(report, ensure_ascii=False, indent=2)
    print(output)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
