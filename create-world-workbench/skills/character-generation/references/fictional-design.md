# Fictional design input — project revision 1

This is an alternative input path, not a weaker asset acceptance mode. A JSON brief requires nonempty `character_name`, `role`, `appearance`, `canon_invariants`, `inferred_details`, and `style_profile`. Explicitly separate public fictional character identity from newly invented costume/body details. Do not claim actor-likeness validation.

Run `character_job.py init --brief brief.json --style-profile project-style-v1 --character-id name --output-dir staging`. The raw brief hash, source kind and style all participate in resumability. Changed design or style requires a fresh job. The final asset pack must not embed absolute paths.

Inspect the project's accepted or explicitly provisional style board and bundled `walk-layout-template.png`. In this mode the project board replaces the bundled bright-chibi board and the workflow's fixed anatomy/palette rules. A provisional Art Direction remains provisional; it cannot become player-validated through character creation.

Generate one white-background 3x4 sheet per character using built-in image generation: down/up/right rows; neutral/gait A/neutral/gait B columns. Use image references only for project style and layout, and the brief for identity. Preserve all existing alpha, segmentation, alternating gait, direction, anchoring and bounded retry checks.

Pass the same `--style-profile` to `build_character_pack.py`. Record each generated result before inspecting or retrying. Inspect the final 48x64 output rather than accepting a large attractive master alone. Mirrored left-facing clothing remains a disclosed limitation.
