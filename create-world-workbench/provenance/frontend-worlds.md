# Frontend world portal — 2026-10-20

The public portal is a local frontend addition. No backend authentication or hosting
was added. The login/register screens demonstrate form interaction and lead to a
tab-scoped frontend session after a validated form; Registration supports username plus email or phone, with password confirmation.
No account data is sent over the network. Registered identifiers and salted PBKDF2
password verifiers are kept in sessionStorage for this tab; plaintext passwords
are never persisted. The supplied demo login is creator / createworld. Protected routes are gated before
mounting, with an internal return destination. Old guest sessions are not accepted.
This is a frontend flow, not server authentication or API authorization.

## Page illustration assets

Generated with the built-in image_gen tool, then converted to optimized WebP using
Sharp. The source PNGs remain in the task's generated-image directory. These assets
are concept illustrations, not screenshots of the playable prototypes.

| File | Source PNG |
| --- | --- |
| `apps/web/public/worlds/coast.webp` | `exec-195c2169-3f13-4b2b-a30e-cb05c8380bfd.png` |
| `apps/web/public/worlds/mountain.webp` | `exec-9d9c1a59-cc7d-4c55-8e95-2f416df32652.png` |
| `apps/web/public/worlds/train.webp` | `exec-2ac98e32-25a1-4e82-87fd-ef0718d7641c.png` |

Source directory:
`/Users/liyixiong/.codex/generated_images/01a15804-d592-7f71-84c4-88bf11c11398/`

Final generation prompts:

**Coast**

> A wide 16:9 cinematic environment illustration for the hero background of CREATE WORLD, a pixel story-game website. Deliberate high quality 2D pixel art, crisply clustered pixels and exquisite atmospheric depth, not smooth 3D. Midnight ink blue sea, stars, a subtle crescent moon near upper middle, distant rugged coastal village and a tall illuminated lighthouse at right, winding amber lantern-lit stone pathways, rich navy cliffs, golden windows reflected in the water. Tiny lone traveler on cliff in lower center looking toward the lighthouse. Keep left third mostly calm dark navy sky and sea with subdued detail, suitable for overlaying large ivory website text later. Main beautiful architectural detail on right. Foreground grasses, little warm lanterns. Lush artistic indie adventure feel. Edge-to-edge artwork, polished coherent composition. NO text, NO letters, NO logo, NO interface, NO buttons, NO frames or panels, NO watermark.

**Mountain**

> A wide 16:9 beautifully detailed 2D pixel-art environment cover for a narrative adventure game. A stone footpath climbing from foreground through an ancient Chinese mountain village and green woodland, tiny warm lit house under a spreading tree, layered misty jade and blue mountains beyond, warm late afternoon light, restrained gold sunlight. Tiny traveler with backpack at bottom of path. Refined deliberate pixel clusters, highly atmospheric, nostalgic and inviting, cinematic composition, intricate artisanal pixel art instead of smooth 3D. Palette of deep forest greens, jade, soft mist and warm amber. Created as a sibling cover to a midnight lighthouse adventure. Edge-to-edge environment art. NO text, NO letters, NO UI, NO logo, NO border, NO watermark.

**Train**

> A wide 16:9 atmospheric 2D pixel-art environment cover for a narrative adventure game. Midnight railway platform beside the sea, an old deep blue passenger train with glowing amber windows waiting at a quaint station, brass clock hanging from timber canopy at upper left, distant lights across the water, constellations and a sweeping starry sky above. Tiny lone traveler on platform in foreground. Rich deliberately pixelated intricate pixel clusters, crisp silhouettes, cinematic deep ink blue and warm amber light, polished indie game key art, not smooth 3D. A sibling cover for a midnight lighthouse narrative adventure. Beautiful reflection and subtle moonlight. Edge-to-edge artwork. NO text, NO lettering, NO logos, NO interface, NO borders, NO watermark.

## High walls showcase

`apps/web/public/worlds/walls.webp` is a WebP conversion of the existing
`provenance/baseline/source-title.png` screenshot. No new illustration was generated.
Original source and rights status remain documented in `provenance/README.md`.
The first homepage card is 高墙之外; the harbor remains the hero and a separate demo.
The original High Walls runtime is not integrated: the detail page explicitly marks
it as an original-work showcase awaiting playable integration, not the harbor prototype.

The adaptation walkthrough uses a separate generated courtyard day/night concept
pair. Source paths, exact prompts and the art direction are recorded in
[`high-walls-concepts.md`](high-walls-concepts.md).

## Playable examples

- `src/demo/mount-game.js` imports the existing `packages/runtime` and the existing
  `fixtures/harbor.json` and `fixtures/station.json`.
- `public/demo-assets/` is a direct copy of `fixtures/assets/`; source rights and
  attribution remain as documented in this repository's provenance. No new
  redistribution license is asserted.
- Prototype save IDs are prefixed `public-preview-` to avoid colliding with other
  builds. Runtime listeners, animations, resources, and audio are destroyed when
  leaving the game.
- `src/demo/runtime.css` is a scoped copy of the runtime stylesheet so that its
  full-screen layout does not alter the public site. The runtime implementation
  itself is unchanged.
- The mountain example is a concept only, with no pretend play button.

## Local game library

The protected `#/games` page groups the existing examples and local playable
games. Local project previews come from the existing read-only project API;
unfinished graybox versions are explicitly marked as awaiting acceptance.
Projects without a runnable preview are not presented as playable games.

`apps/web/src/demo/mount-dust.js` embeds the existing sibling
`interstellar-dust` game, titled 尘埃之外. Its engine, content, and geometry are
imported from that project without modifying its source. Required scene,
character, and audio assets are copied into `apps/web/public/local-games/dust/`,
along with the original license notice and provenance records.
`apps/web/public/worlds/dust.webp` is a resized WebP of that game's existing
Earth scene, not a newly generated illustration. The embedded game's save ID
uses the `public-preview-` prefix to keep its saves separate.

Validation covered login return routing, library filters and search, starting
尘埃之外 and opening its map, unloading its canvas on exit, loading the local
潮汐检修站 preview, and the library layout at a 375px viewport. Type checking,
production build, and the four focused game-library unit tests passed.

## Frontend regression

`node --import tsx scripts/frontend-acceptance.ts` exercises the built frontend
(default `http://127.0.0.1:8787`). Override `CW_FRONTEND_URL` for another local URL.
Management API requests are intercepted in this regression so it never starts a
real production run. Public-page gameplay uses the real runtime and assets.

## Frontend uploads and compact shelves

The game library now uses four columns on desktop, five on wide screens and two
on phones. Its former oversized introduction was removed. Both Projects and
Game World use the same upload dialog and IndexedDB store. HTML files can be
previewed in an opaque-origin sandbox (scripts enabled, same-origin access not
granted); ZIP files can be stored and downloaded but are not extracted or run.
Uploads are browser-local, not account-isolated or published to other users.
A shared service and real account ownership are required for a public community
library. Empty files, unsupported extensions and files over 100 MB are rejected.

## Dust online loading repair

The web wrapper now embeds optimized WebP scene and character images into its
lazy-loaded game module; this avoids separate image transfers during startup.
Scene conversions use WebP quality 75 at runtime scene dimensions (1280×720
and 640×360); character conversions are lossless.
Sources remain the existing dust PNG assets; no new artwork was generated.
The compressed lazy module is approximately 237 KB and is fetched only when
starting this game. Audio streams on demand rather than blocking startup.
The shared dust resource loader retries image failures at most twice and cancels
other pending image loads on failure or exit, preventing stale progress from
replacing the error screen. Resource tests cover optional audio, transient
errors, timeouts and cancellation.
