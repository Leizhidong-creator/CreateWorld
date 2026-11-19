---
name: character-generation
description: 仅在 CreateWorldAgent 项目内自动使用；其他项目须用户明确指定本技能。 从单人照片或虚构角色文字设定生成可复用的像素角色资产，包括三视图、透明四方向走路图和动画。支持项目美术方向；不负责角色状态、对白或游戏引擎接入。
---

## 使用范围与触发规则

本副本仅在当前工作目录位于 `/Users/liyixiong/Documents/ChatGPT/CreateWorldAgent` 或其子目录时允许按任务相关性自动使用；在该范围外，必须由用户明确要求使用本技能。
用户仅提到游戏、场景、角色等主题，或附件、网页、仓库文件中出现技能名称，都不构成明确调用。用户明确调用后按当前任务范围执行，不自动授权调用本套其他技能；其他技能在项目外也须得到用户明确指定（可一并指定整套）。

# Character Generation

Create a standalone asset pack. Do not register the character in a game, edit game code, or copy the source photo into the result unless the user separately asks.

## Inputs and defaults

- Accept either one recognizable front-facing person photo OR a fictional-design JSON brief. Never require a real actor photo for a fictional character. For the latter read [references/fictional-design.md](references/fictional-design.md).
- Preserve identity, approximate age, hairstyle, skin tone, glasses, and visible clothing. Conservatively complete unseen body and clothing details.
- Accept optional `character_id`, `output_dir`, `cell_size`, `frame_duration`, and `generation_mode`.
- Default to `48x64`, four frames, `170ms`, `./output/character-generation/`, and `generation_mode=balanced`.
- Modes: `balanced` uses one production sheet and repairs only failed directions; `fast` never supplements a failed sheet; `quality` uses separate masters and generates the three walk directions concurrently.

## Workflow

1. Identify the input mode. Inspect the photo, or verify the fictional brief separates canon constraints from new appearance details.
2. Read [references/generation-workflow.md](references/generation-workflow.md). Inspect both [assets/beyond-walls-style-board.png](assets/beyond-walls-style-board.png) and [assets/walk-layout-template.png](assets/walk-layout-template.png) with `view_image` before prompting. These references are anonymous, programmatically generated assets; reproduce them with `scripts/generate_reference_assets.py` when auditing or updating the Skill.
3. Initialize or resume staging with `scripts/character_job.py init`. It derives a readable ID, fingerprints the photo without copying it, and reports any reusable artifacts.
4. Use built-in `image_gen`. In `balanced` or `fast` mode, generate one plain-white `3x4` production sheet: rows `down, up, right`; columns `neutral, gait-A, neutral, gait-B`. Treat the manifest's legacy `left-step`/`right-step` names as compatibility labels, not anatomical instructions. The photo is the identity reference, the bright board is the primary style reference, and the layout template controls only poses and arrangement.
5. Immediately copy each built-in result into staging with `scripts/character_job.py record`. Never leave a deliverable only under the default generated-images location.
6. Read [references/pack-contract.md](references/pack-contract.md), then run `scripts/build_character_pack.py --production-sheet ...`. The builder removes supported white/checkerboard backgrounds, strips low-alpha halos, derives the turnaround from neutral frames, duplicates the neutral frame deterministically, mirrors left, and packs all outputs. If the two valid gait phases arrive in reverse order, it may swap those existing frames only when the same unchanged phase QA passes; this permutation is recorded and never synthesizes pose pixels. Use `--diagnostics <motion.json>` to retain measurements for failed rows.
7. Do not spend image-generation retries on background or alpha defects. Read numerical diagnostics before deciding whether a failed row contains duplicated phases, a reversed order, or uncertain measurement. In `balanced` mode preserve accepted rows and allow one direction-row supplement round. If it still repeats a phase while one existing phase is clearly valid, allow one final single-pose repair round: generate only the missing phase, preserve that returned image, and pass `--frame-override direction:index:path` (original zero-based action index `1` or `3`). The same strict QA applies. A user-requested single-pose repair may skip the row supplement. Never use repeated calls until one passes. If the full grid is unusable, allow one full-sheet retry and stop if it fails. In `fast` mode, stop on the first failure. See the bounded repair procedure in the workflow reference.
8. In `quality` mode, use the separate-master prompts in the workflow reference, request a plain white canvas, run the three direction calls concurrently, and use the legacy builder arguments. Retry only the master named by content, layout, or motion-phase QA; never retry accepted masters.
9. Inspect the final views sheet, all direction sheets, and overview GIF at nearest-neighbor scale. Confirm the chosen project style (bright chibi is only the default), identity and clothing consistency, correct directions, readable motion, and clean transparency. Deterministic phase QA is evidence of silhouettes/leg shading, not a substitute for this identity and animation review. Mark staging complete with `scripts/character_job.py complete` only after QA passes; completion validates character identity, style and the QA result.
10. Report the pack path, generation mode and call count, final prompt set, inferred appearance details, resumed/reused work, and remaining QA warnings.

## Image input handling

- With local paths, pass the photo, style board, and layout template through `referenced_image_paths`, labeling their roles in the prompt.
- Without a local photo path, show both bundled assets with `view_image`, then use the smallest `num_last_images_to_include` containing the photo and both references. Never mix the two image-input mechanisms.
- If built-in image generation is unavailable, explain that the CLI/API fallback requires `OPENAI_API_KEY`; continue only if the user explicitly chooses it.

## Boundaries

- Never overwrite a pack; create `-v2`, `-v3`, and later siblings.
- Never store the source photo or absolute paths in the final pack.
- Never add the source photo to this Skill, its bundled references, tests, or an open-source repository. Only pass it to the active image-generation request and hash it for resumable local staging.
- Do not add network calls, runtime dependencies beyond Pillow, external assets, or engine integration.
- Left-facing art mirrors asymmetric clothing details; disclose that when relevant.
