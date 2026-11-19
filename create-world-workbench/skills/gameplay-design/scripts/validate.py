"""Validate mechanics and optional operational loops without claiming runtime coverage."""
import json
from _validation import run


def validate(bundle, c):
    source = c.obj(bundle.get("source"), "source")
    nodes = c.index(source.get("nodes"), "source.nodes")
    adaptation = c.obj(bundle.get("adaptation"), "adaptation")
    for field in ("playerRole", "coreExperience", "genre"):
        c.text(adaptation.get(field), f"adaptation.{field}")
    mechanics = c.index(bundle.get("mechanics"), "mechanics")
    allowed_inputs = None
    constraints = c.obj(bundle.get("constraints", {}), "constraints")
    if "supportedInputs" in constraints:
        allowed_inputs = c.seq(constraints["supportedInputs"], "constraints.supportedInputs", True)
        for i, value in enumerate(allowed_inputs):
            c.text(value, f"constraints.supportedInputs[{i}]")
    for key, row in mechanics.items():
        for field in ("goal", "feedback", "failure", "recovery"):
            c.text(row.get(field), f"mechanics.{key}.{field}")
        for field in ("inputs", "rules"):
            values = c.seq(row.get(field), f"mechanics.{key}.{field}", True)
            seen = set()
            for i, value in enumerate(values):
                if c.text(value, f"mechanics.{key}.{field}[{i}]"):
                    normalized = value.strip().casefold()
                    c.require(normalized not in seen, f"mechanics.{key}.{field}: duplicate value {value}")
                    seen.add(normalized)
                    if field == "inputs" and allowed_inputs is not None:
                        c.require(value in allowed_inputs, f"mechanics.{key}.inputs: unsupported input {value}")
        c.refs(row.get("sourceNodeIds"), nodes, f"mechanics.{key}.sourceNodeIds")
    actions = None
    if "interactions" in bundle:
        actions = c.index(bundle["interactions"], "interactions", False)
        for key, action in actions.items():
            ref = action.get("mechanicId")
            if c.identity(ref, f"interactions.{key}.mechanicId"):
                c.require(ref in mechanics, f"interactions.{key}: unknown mechanic {ref}")
            if ref in mechanics:
                c.require(action.get("input") in mechanics[ref].get("inputs", []),
                          f"interactions.{key}: input not declared by mechanic {ref}")
    if "mechanicDetails" not in bundle:
        c.warnings.append("mechanicDetails absent: loops, decision tradeoffs and success criteria need design review")
    else:
        details = c.index(bundle["mechanicDetails"], "mechanicDetails")
        c.require(set(details) == set(mechanics), "mechanicDetails must cover every mechanic exactly once using the same ID")
        for key, detail in details.items():
            c.text(detail.get("successCondition"), f"mechanicDetails.{key}.successCondition")
            c.text(detail.get("cancelPolicy"), f"mechanicDetails.{key}.cancelPolicy")
            for field in ("success", "failureRecovery", "alternative"):
                scenarios = c.obj(detail.get("testScenarios"), f"mechanicDetails.{key}.testScenarios")
                c.text(scenarios.get(field), f"mechanicDetails.{key}.testScenarios.{field}")
            loop = c.obj(detail.get("loop"), f"mechanicDetails.{key}.loop")
            steps = c.index(loop.get("steps"), f"mechanicDetails.{key}.loop.steps")
            start = loop.get("startStepId")
            if c.identity(start, f"mechanicDetails.{key}.loop.startStepId"):
                c.require(start in steps, f"mechanicDetails.{key}.loop: unknown start step")
            outgoing = {}
            for step_id, step in steps.items():
                path = f"mechanicDetails.{key}.loop.steps.{step_id}"
                c.text(step.get("playerAction"), f"{path}.playerAction")
                c.text(step.get("feedback"), f"{path}.feedback")
                outgoing[step_id] = c.refs(step.get("nextStepIds"), steps, f"{path}.nextStepIds", True)
            reachable = set()
            pending = [start] if isinstance(start, str) and start in steps else []
            while pending:
                step_id = pending.pop()
                if step_id not in reachable:
                    reachable.add(step_id)
                    pending.extend(outgoing.get(step_id, []))
            c.require(reachable == set(steps), f"mechanicDetails.{key}.loop: unreachable loop steps")
            for step_id in steps:
                reached = set()
                pending = list(outgoing.get(step_id, []))
                while pending:
                    nxt = pending.pop()
                    if nxt not in reached:
                        reached.add(nxt)
                        pending.extend(outgoing.get(nxt, []))
                c.require(start in reached, f"mechanicDetails.{key}.loop: step {step_id} cannot return to start")
            decisions = c.seq(detail.get("decisions"), f"mechanicDetails.{key}.decisions")
            for i, decision in enumerate(decisions):
                decision = c.obj(decision, f"mechanicDetails.{key}.decisions[{i}]")
                c.text(decision.get("information"), f"mechanicDetails.{key}.decisions[{i}].information")
                options = c.index(decision.get("options"), f"mechanicDetails.{key}.decisions[{i}].options")
                c.require(len(options) >= 2, f"mechanicDetails.{key}.decisions[{i}]: needs at least two alternatives")
                signatures = []
                tradeoffs = []
                for option_id, option in options.items():
                    c.text(option.get("tradeoff"), f"decisions[{i}].{option_id}.tradeoff")
                    tradeoffs.append(option.get("tradeoff"))
                    if actions is not None:
                        action_id = option.get("actionId")
                        if c.identity(action_id, f"decisions[{i}].{option_id}.actionId"):
                            c.require(action_id in actions, f"decisions[{i}]: unknown action {action_id}")
                            if action_id in actions:
                                action = actions[action_id]
                                c.require(action.get("mechanicId") == key, f"decisions[{i}]: action {action_id} belongs to another mechanic")
                                effects = sorted(action.get("effects", []), key=lambda effect: json.dumps(effect, sort_keys=True))
                                signatures.append(json.dumps([action.get("targetScreen"), effects], sort_keys=True))
                c.require(len({str(value).strip().casefold() for value in tradeoffs}) >= 2,
                          f"mechanicDetails.{key}.decisions[{i}]: alternatives describe identical tradeoffs")
                if signatures:
                    c.require(len(set(signatures)) >= 2, f"mechanicDetails.{key}.decisions[{i}]: alternatives have identical state/screen outcomes")
    c.warnings.append("Rules and loops are design contracts; balance, continuous physics and real input behavior remain unverified")


if __name__ == "__main__":
    raise SystemExit(run("gameplay-design", validate))
