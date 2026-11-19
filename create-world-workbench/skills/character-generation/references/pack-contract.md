# Character Pack Contract

## Resumable staging

Initialize a job before image generation:

```powershell
python scripts/character_job.py init `
  --photo <photo.png> `
  --output-dir <output-root> `
  --generation-mode balanced `
  --cell-size 48x64 `
  --frame-duration 170
```

Copy every built-in image result immediately, leaving the original in place:

```powershell
python scripts/character_job.py record `
  --job-dir <job-dir> `
  --artifact production-sheet `
  --source <generated.png>
```

The state stores the photo filename and SHA-256, never the photo or its absolute path. An incomplete job with the same photo hash, style profile, mode, cell, and duration is resumed. Mark it complete only after the pack passes QA.

## Default builder command

```powershell
python scripts/build_character_pack.py `
  --character-id <id> `
  --production-sheet <production-sheet.png> `
  --output-dir <output-root> `
  --cell-size 48x64 `
  --frame-duration 170
```

The production sheet contains three rows ordered `down`, `up`, `right` and four columns ordered `neutral`, `gait-A`, `neutral`, `gait-B`. The schema retains `left-step`/`right-step` as compatibility labels only. The builder derives views from the first column and makes column three an exact copy of column one.

If the generated action frames contain both valid phases in reverse order, the builder tests the existing frames in order `[0,3,2,1]` using exactly the same motion QA. It uses that permutation only if it passes; thresholds and pose pixels remain unchanged. A same-leg repeat, indistinct motion, or uncertain side classification still fails. `motion_phase_normalization` records original QA, attempted reverse QA and zero-based original source indices (`[0,3,0,1]` after neutral duplication). The input master stays unchanged; packaged direction masters use canonical order.

When only a direction row failed, pass its replacement without discarding valid production rows:

```powershell
python scripts/build_character_pack.py `
  --character-id <id> `
  --production-sheet <production-sheet.png> `
  --walk-up <replacement-up.png> `
  --output-dir <output-root>
```

`--walk-down`, `--walk-up`, `--walk-right`, and `--turnaround` are optional overrides with `--production-sheet`.

If a generated row repeats one phase, preserve its valid phase and replace only the other with a genuinely generated single full-body pose:

```powershell
python scripts/build_character_pack.py `
  --character-id <id> `
  --production-sheet <original-production-sheet.png> `
  --frame-override "right:3:<generated-missing-phase.png>" `
  --diagnostics <attempt-motion.json> `
  --output-dir <output-root>
```

`--frame-override` is repeatable and is applied after direction overrides, before neutral duplication, normalization and strict QA. Its `direction:index:path` syntax accepts only `down/up/right` and original zero-based action indices `1` or `3`; it preserves a Windows drive colon in the path. Duplicate targets, neutral frames, empty/multiple figures and repeated-phase repairs are rejected. A multi-pose generation may be split deterministically with `split_subjects`, recording the original SHA, exact crop boxes, and derivative SHAs; add transparent margins only. Never paint, deform, mirror a front/back pose, or recolor a leg to manufacture missing motion.

`qa-report.json` and failed diagnostic reports include `source_inputs` (file names and raw-byte SHA-256), `frame_overrides` (source slot, independent crop/cleanup lineage), and phase-normalization mappings. Source master bytes remain unchanged. `input_segmentation` describes base/row master segmentation; overridden frame geometry comes from `frame_overrides`, and `source_frame_indices` addresses that layered input before temporal reordering.

## Legacy builder command

The v1 interface remains supported for quality mode and existing callers:

```powershell
python scripts/build_character_pack.py `
  --character-id <id> `
  --turnaround <turnaround.png> `
  --walk-down <down.png> `
  --walk-up <up.png> `
  --walk-right <right.png> `
  --output-dir <output-root>
```

`character-id` uses lowercase ASCII letters or digits separated by `-`, `_`, or `.`. Existing pack directories receive `-v2`, `-v3`, and later siblings.

## Accepted generated backgrounds

- Genuine RGBA transparency is thresholded to binary alpha; low-alpha halos are removed.
- Opaque RGB or RGBA masters may use a flat white or light neutral checkerboard canvas. The builder removes only light-neutral pixels connected to the canvas edge, preserving enclosed white clothing and eye details.
- Complex, dark, colored, low-confidence, or subject-touching backgrounds are rejected rather than destructively guessed.
- A production sheet must resolve to three rows and each retained row to four separated figures. Direction overrides may replace invalid rows.

## Output layout and normalization

The output layout remains compatible with schema version 1:

```text
<character-id>/
|-- masters/                cleaned high-resolution turnaround and direction masters
|-- sprites/png/            views plus down/up/right/left PNG sheets
|-- sprites/webp/           lossless WebP equivalents
|-- animations/             four APNG files plus overview GIF
|-- character.json
`-- qa-report.json
```

- Default cell: `48x64`; views sheet: `144x64`; direction sheet: `192x64`; foot anchor: `(24, 61)`.
- Poses are fitted without stretching, centered, and aligned to one foot baseline.
- Final alpha is `0` or `255`; one shared non-dithered palette contains at most 64 opaque colors.
- Left is a per-frame horizontal mirror of right without reversing frame order.
- PNG/WebP are lossless; APNG has four native frames; the overview GIF is a nearest-neighbor `2x2` direction grid.

## Metadata and QA

`character.json` remains `schema_version: 1` and uses `style_profile: create-world-bright-chibi-v1`. All artifact paths are relative. This profile change intentionally prevents unfinished jobs created for an older visual profile from being resumed.

`qa-report.json` records master preprocessing, background confidence, production-grid rows, segmentation boxes, motion differences and structural phase evidence. Front/back action frames must put the dominant shoe on opposite screen sides: the unchanged bottom-band offset threshold is 0.015 of subject width; alternatively both supported sole heights must differ by at least 0.03 of subject height, with opposite signs. The sole test uses the upper head axis, excludes the narrow center overlap corridor, and requires at least two pixels of sole support, preventing an arm's width or a single shoe-edge pixel from deciding which foot is lower.

Right-profile phase requires the requested lighter near leg to change screen side. On rows from 70% through 88% of subject height, identify exactly two separated limbs, omit each outline edge, and compare median interior luminance. Each action needs at least `max(3, ceil(height*0.06))` usable rows, median contrast at least 0.15, and at least 75% same-sign row agreement. Phase A has the lighter near leg at screen-right; B at screen-left. The old 24x24 template distances remain diagnostic only: resemblance to an anonymous silhouette can both reject correct clothing proportions and falsely accept repeated depth phases. A tiny patch, global recolor, or arm swing cannot establish limb alternation.

These tests measure a constrained biped sprite convention, not anatomy or character identity. Ambiguous/uniformly shaded legs fail for review; do not lower thresholds to fit one output. A pack passes only when dimensions, binary alpha, palette, clipping, baseline, animations, exact neutral repetition, and deterministic leg alternation all pass. Neither JSON file stores the source photo or an absolute path. Final visual acceptance remains required.

The builder runs motion-phase QA before creating a final output directory. A failure is reported as `MOTION_PHASE_FAILED directions=down,up` (directions vary), allowing `balanced` callers to supplement only those rows and `fast` callers to stop immediately.

Add `--diagnostics <motion.json>` to persist preprocessing, segmentation, phase-order decisions and numerical row QA even on failure. This file is explicitly motion diagnostic evidence, not successful pack QA. Keep it with the failed candidate; use a new path for another attempt.
