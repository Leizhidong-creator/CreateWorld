"""Check the screen/action graph; state-guard reachability is a separate test."""
from _validation import run


KINDS = {"title", "world", "dialogue", "puzzle", "journal", "pause", "ending"}


def walk(start, outgoing):
    reached, pending = set(), [start]
    while pending:
        node = pending.pop()
        if node not in reached:
            reached.add(node)
            pending.extend(outgoing.get(node, []))
    return reached


def validate(bundle, c):
    flow = c.obj(bundle.get("flow"), "flow")
    screens = c.index(flow.get("screens"), "flow.screens")
    for key, screen in screens.items():
        c.text(screen.get("title"), f"flow.screens.{key}.title")
        c.require(isinstance(screen.get("kind"), str) and screen["kind"] in KINDS,
                  f"flow.screens.{key}.kind: unknown screen kind")
    start = flow.get("startScreen")
    start_valid = c.identity(start, "flow.startScreen")
    if start_valid:
        c.require(start in screens, "flow.startScreen: unknown screen")
    terminals = c.refs(flow.get("terminals"), screens, "flow.terminals", True)
    for key in terminals:
        if key in screens:
            c.require(screens[key].get("kind") == "ending", f"terminal {key}: must have kind=ending")
    for key, screen in screens.items():
        if screen.get("kind") == "ending":
            c.require(key in terminals, f"ending screen {key} missing from terminals")
    c.require(not isinstance(start, str) or start not in terminals, "flow: game cannot start at a terminal")
    actions = c.index(bundle.get("interactions"), "interactions")
    edges = c.index(flow.get("edges"), "flow.edges")
    outgoing = {key: [] for key in screens}
    edge_actions = {}
    for edge_id, edge in edges.items():
        edge_refs = {}
        for field, known in (("from", screens), ("to", screens), ("actionId", actions)):
            value = edge.get(field)
            if c.identity(value, f"flow.edges.{edge_id}.{field}"):
                c.require(value in known, f"flow.edges.{edge_id}.{field}: unknown {value}")
                edge_refs[field] = value
        if "actionId" in edge_refs:
            action_id = edge_refs["actionId"]
            c.require(action_id not in edge_actions, f"flow.edges: action {action_id} has more than one edge")
            edge_actions[action_id] = edge
            if action_id in actions:
                c.require(edge.get("from") == actions[action_id].get("screenId"), f"edge {edge_id}: from differs from interaction screenId")
                c.require(edge.get("to") == actions[action_id].get("targetScreen"), f"edge {edge_id}: to differs from interaction targetScreen")
        if "from" in edge_refs and "to" in edge_refs:
            outgoing.setdefault(edge_refs["from"], []).append(edge_refs["to"])
            c.require(edge_refs["from"] not in terminals, f"terminal {edge_refs['from']}: gameplay actions after ending are forbidden; restart belongs to runtime")
    for action_id, action in actions.items():
        c.require(action_id in edge_actions, f"interaction {action_id}: missing corresponding flow edge")
        for field in ("screenId", "targetScreen"):
            value = action.get(field)
            if c.identity(value, f"interactions.{action_id}.{field}"):
                c.require(value in screens, f"interactions.{action_id}.{field}: unknown screen {value}")
    if start_valid and start in screens:
        reached = walk(start, outgoing)
        for key in screens:
            c.require(key in reached, f"flow: screen {key} unreachable from start")
        for key in screens:
            c.require(bool(walk(key, outgoing).intersection(terminals)), f"flow: screen {key} has no route to an ending")
        egg_actions = set()
        for egg in c.seq(bundle.get("easterEggs", []), "easterEggs"):
            egg = c.obj(egg, "easterEggs.item")
            egg_actions.update(c.refs(egg.get("interactionIds"), actions, "easterEggs.interactionIds"))
        if egg_actions:
            main = {key: [] for key in screens}
            for edge in edges.values():
                if edge.get("actionId") not in egg_actions and edge.get("from") in screens:
                    main[edge["from"]].append(edge.get("to"))
            c.require(bool(walk(start, main).intersection(terminals)), "flow: optional-content actions are structurally required for every ending")
    if "flowDetails" in bundle:
        details = c.obj(bundle["flowDetails"], "flowDetails")
        c.require(details.get("restartPolicy") == "reset-all", "flowDetails.restartPolicy: runtime must reset all state")
        descriptions = c.index(details.get("screens"), "flowDetails.screens")
        c.require(set(descriptions) == set(screens), "flowDetails.screens must cover flow screens exactly")
        for key, row in descriptions.items():
            for field in ("playerGoal", "entryFeedback", "completionFeedback"):
                c.text(row.get(field), f"flowDetails.screens.{key}.{field}")
            c.require(type(row.get("overlay")) is bool, f"flowDetails.screens.{key}.overlay: expected boolean")
            if row.get("overlay") is True:
                owners = c.refs(row.get("returnToScreenIds"), screens, f"flowDetails.screens.{key}.returnToScreenIds", True)
                for owner in owners:
                    c.require(owner != key and owner in outgoing.get(key, []), f"overlay {key}: missing direct return to {owner}")
                c.require(row.get("stateOwner") == "world", f"overlay {key}: requires shared world state")
                c.require(type(row.get("pausesWorld")) is bool, f"overlay {key}: pausesWorld must be boolean")
        for item in c.seq(details.get("failureRecovery"), "flowDetails.failureRecovery"):
            item = c.obj(item, "flowDetails.failureRecovery.item")
            source, target = item.get("from"), item.get("to")
            if c.identity(source, "failureRecovery.from") and c.identity(target, "failureRecovery.to"):
                c.require(source in screens and target in screens, "failureRecovery: unknown screen")
                c.require(target in outgoing.get(source, []), f"failureRecovery: missing direct recovery from {source} to {target}")
        tutorials = c.refs(details.get("tutorialScreenIds"), screens, "flowDetails.tutorialScreenIds", True)
        advanced = c.refs(details.get("advancedScreenIds"), screens, "flowDetails.advancedScreenIds")
        # Removing all tutorial nodes must make advanced screens unreachable.
        skipped = {key: [target for target in values if target not in tutorials]
                   for key, values in outgoing.items() if key not in tutorials}
        reached_without_teaching = walk(start, skipped) if start_valid and start not in tutorials else set()
        for key in advanced:
            c.require(key not in reached_without_teaching, f"flow: advanced screen {key} reachable before any tutorial")
    else:
        c.warnings.append("flowDetails absent: teaching, overlay lifecycle, failure recovery and restart semantics require review")
    c.warnings.append("Topology only: guards may make graph routes impossible; State and real-input Reviewer checks are still required")


if __name__ == "__main__":
    raise SystemExit(run("main-flow", validate))
