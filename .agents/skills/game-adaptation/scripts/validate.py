"""Check source disposition, experience/action mapping and explicit hard constraints."""
from _validation import run


def validate(bundle, c):
    source = c.obj(bundle.get("source"), "source")
    c.require(source.get("complete") is True, "source.complete: full-story adaptation requires complete=true")
    nodes = c.index(source.get("nodes"), "source.nodes")
    for key, node in nodes.items():
        for field in ("summary", "locator", "invariant"):
            c.text(node.get(field), f"source.nodes.{key}.{field}")
    a = c.obj(bundle.get("adaptation"), "adaptation")
    for field in ("playerRole", "coreExperience", "genre"):
        c.text(a.get(field), f"adaptation.{field}")
    minutes = a.get("targetMinutes")
    c.require(type(minutes) is int and minutes > 0, "adaptation.targetMinutes: expected positive integer")
    preserved = c.refs(a.get("preservedNodeIds"), nodes, "adaptation.preservedNodeIds")
    disposition = {key: "preserve" for key in preserved}
    for field, id_field, required in (("changes", "sourceNodeId", ("change", "reason")),
                                      ("excludedNodeIds", "id", ("reason",))):
        for i, row in enumerate(c.seq(a.get(field), f"adaptation.{field}")):
            path = f"adaptation.{field}[{i}]"
            row = c.obj(row, path)
            key = row.get(id_field)
            if c.identity(key, f"{path}.{id_field}"):
                c.require(key in nodes, f"{path}: unknown source node {key}")
                c.require(key not in disposition, f"{path}: conflicting/duplicate disposition for {key}")
                disposition[key] = field
            for required_field in required:
                c.text(row.get(required_field), f"{path}.{required_field}")
    for key in nodes:
        c.require(key in disposition, f"adaptation: source node {key} has no disposition")
    c.require(any(value != "excludedNodeIds" for value in disposition.values()),
              "adaptation: all source nodes excluded; this is not a source adaptation")
    if "experiences" in a:
        experiences = c.index(a["experiences"], "adaptation.experiences")
        for key, row in experiences.items():
            c.text(row.get("experience"), f"experiences.{key}.experience")
            c.refs(row.get("sourceNodeIds"), nodes, f"experiences.{key}.sourceNodeIds", True)
            actions = c.seq(row.get("playerActions"), f"experiences.{key}.playerActions", True)
            for i, action in enumerate(actions):
                action = c.obj(action, f"experiences.{key}.playerActions[{i}]")
                for field in ("verb", "decision", "consequence"):
                    c.text(action.get(field), f"experiences.{key}.playerActions[{i}].{field}")
    else:
        c.warnings.append("experience-to-player-action details absent; core contract only, design completeness unverified")
    constraints = c.obj(bundle.get("constraints", {}), "constraints")
    for field in ("playerRole", "genre", "platform"):
        if field in constraints:
            c.text(constraints[field], f"constraints.{field}")
            c.require(a.get(field) == constraints[field], f"adaptation.{field}: violates exact user constraint")
    for field, compare in (("minMinutes", lambda x, y: x >= y), ("maxMinutes", lambda x, y: x <= y)):
        if field in constraints:
            value = constraints[field]
            valid = c.require(type(value) is int and value > 0, f"constraints.{field}: expected positive integer")
            if valid and type(minutes) is int:
                c.require(compare(minutes, value), f"adaptation.targetMinutes: violates {field}")
    if "requiredPreservedNodeIds" in constraints:
        required = c.refs(constraints["requiredPreservedNodeIds"], nodes, "constraints.requiredPreservedNodeIds")
        for key in required:
            c.require(key in preserved, f"adaptation: required preserved node {key} was changed or excluded")
    if "inventions" in a:
        for key, row in c.index(a["inventions"], "adaptation.inventions", False).items():
            c.require(key not in nodes, f"inventions.{key}: new content cannot reuse original source ID")
            c.require(row.get("provenance") == "original", f"inventions.{key}: provenance must be original")
            c.text(row.get("reason"), f"inventions.{key}.reason")
            c.text(row.get("summary"), f"inventions.{key}.summary")
    c.warnings.append("Semantic fidelity, feasibility estimates and player appeal require review; this report is structural evidence")


if __name__ == "__main__":
    raise SystemExit(run("game-adaptation", validate))
