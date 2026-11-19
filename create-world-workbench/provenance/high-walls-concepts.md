# 高墙之外：改编过程概念图

Date: 2026-10-20. The user identified 高墙之外 as a game adapted from
the film 《肖申克的救赎》 and requested two game concept images for
the second and third columns of the adaptation walkthrough.

Generated with the built-in `image_gen` tool; no CLI/API fallback was used.
Both assets were inspected at their original 1672 × 941 dimensions and converted
to WebP with Sharp at quality 88, without cropping or changing their composition.

| Purpose | Project asset | Generated source |
| --- | --- | --- |
| 02 世界与玩法：夕光下的监狱院落 | `apps/web/public/worlds/walls-courtyard-day.webp` | `exec-801fdd1b-46bf-4eb0-a3b3-383bd276676a.png` |
| 03 试玩后修改：同场景夜色版本 | `apps/web/public/worlds/walls-courtyard-night.webp` | `exec-232b0eb8-7b7a-4c83-bd51-3a894513db1c.png` |

Source directory:
`/Users/liyixiong/.codex/generated_images/01a15804-d592-7f71-84c4-88bf11c11398/`

## Scope and art direction

These are illustrative concepts, not runtime maps, gameplay screenshots or movie
stills. They establish no claim of playable implementation or adaptation rights.
The original title screenshot and the other worlds remain unchanged.

Use the existing hybrid-pixel direction: worn limestone and iron, muted blue-gray
prison clothes, readable human figures, charcoal/stone colors and restrained warm
gold as the accent for hope. The webpage presents the full wide composition rather
than cropping it or obscuring it with the previous diagram. The day/night pair
preserves the courtyard layout, characters and camera. The comparison now changes
between actual concept files, without applying an additional CSS color filter.

## Exact generation prompts

### Day — stylized-concept

Use case: stylized-concept. Asset type: game concept illustration for the 'World and gameplay' panel of a Chinese pixel narrative adventure called 高墙之外, adapted from the movie The Shawshank Redemption. Create one landscape 16:9 full-bleed illustration, with NO text or UI. Show an inviting-to-explore but oppressive mid-century American stone prison courtyard from a readable high oblique three-quarter game camera, a polished 2D hybrid pixel-art scene. Tall weathered gray-brown limestone perimeter walls and a guard tower rise in the background; barred cell windows, a heavy iron gate, a modest library doorway with softly glowing windows on the right; stone benches and a narrow path through the spacious courtyard. Two small clearly readable pixel characters in muted blue-gray prison work clothes stand near a stone bench, suggesting a quiet friendship and a conversation, no recognizable actor portraits. A few books visible near the library, natural restrained detail. Late-afternoon overcast light, subdued blue-gray shadows with a slender amber shaft of sunlight entering the enclosed yard, emotional theme hope and friendship inside confinement. Strong coherent navigable spatial layout with clear paths from foreground to gate and library, human proportions consistent with stylized pixel figures, grounded 20th-century architecture, NOT medieval fantasy. Restrained charcoal, aged limestone, desaturated blue and old gold palette. Crisp deliberate pixel clusters with cinematic depth, no smooth 3D render, no blurry painterly look. Composition must remain legible at small website-card scale, and will later have a matching night-lighting variant with the exact same geometry. No captions, no logos, no words, no dialogue balloons, no menu, no HUD, no collage, no border, no watermarks. This is an original game environment concept, not a movie still or a gameplay screenshot.

### Night — lighting-weather

Edit target: the generated day PNG above, with `transparent_background: false`.

Use case: lighting-weather. Edit target: the supplied original game concept illustration for 高墙之外, a narrative prison adventure adapted from The Shawshank Redemption. Produce a second 16:9 concept image showing a targeted artistic revision: deepen the courtyard into night while keeping the library warmly lit. Change ONLY time of day, lighting and sky atmosphere. Keep the EXACT same camera, framing, stone walls, watchtower, door and window placement, courtyard paths, benches, books, every character position/pose/clothing and scale. Do NOT recompose or add characters. Replace the sunset sky with deep desaturated midnight indigo, subtle clouds and a small amount of cool moonlight from the same upper-left direction; remove golden sunlight on the yard. Keep the courtyard legible, not crushed black, with rich blue-slate shadows, clearly visible character silhouettes and stone texture. Make the library door and its windows a gentle warm amber focal point that spills inviting gold across a small patch of paving, and keep a muted warm light in the guard tower. Preserve the original's crisp high-detail hybrid-pixel-game concept rendering, physical texture and emotional sense of friendship and hope; avoid a generic photographic color filter. This must read as the same scene with a carefully directed night lighting pass, suitable for a before/after game art comparison. No new text, no captions, no logos, no HUD, no UI, no border, no watermarks.
