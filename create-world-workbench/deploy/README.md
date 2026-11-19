# createworld.games frontend deployment

Deployed 2026-10-20 via the existing `codex-server` SSH alias.

- Public URL: https://createworld.games (HTTP and www redirect here).
- Release: `/var/www/createworld-releases/20261020-frontend`
- Active symlink: `/var/www/createworld-current`
- Nginx: `/etc/nginx/sites-available/createworld.games`
- Pre-deployment Nginx backup: `/var/backups/createworld/nginx-before-20261020.tgz`
- Certificate: `/etc/letsencrypt/live/createworld.games/`; Certbot timer enabled.
- Renewal reload hook: `/etc/letsencrypt/renewal-hooks/deploy/createworld-reload-nginx`.

Only `dist/web` was uploaded, excluding source maps. No SSH keys, source stories,
project records or local workbench server were copied. Built-in demos, including
尘埃之外, are bundled; the local 潮汐检修站 candidate is not a published game.

This remains the frontend experience: demo login and tab-local registration,
browser-local uploaded files, no cloud accounts or shared storage. Nginx returns
empty project/bootstrap data so the frontend library and uploads work without a
backend. Other API requests return an explicit 503 frontend-experience message.
The game-generation workbench is not running on the public server.

For an update, build locally, transfer `dist/web` without `*.map` into a new dated
release directory, then atomically switch `createworld-current`. Retain the
previous release for rollback. Run `nginx -t` before any Nginx reload.
First-deployment rollback: unlink only the createworld.games site from
`sites-enabled`, test and reload Nginx; other virtual hosts remain untouched.
Do not restore the entire shared Nginx backup over unrelated later changes.

Verification: HTTPS root and assets returned 200, www and HTTP returned 301,
certificate SAN covers both hostnames, Nginx config test passed. Browser checks
confirmed homepage, demo login redirect and game library. The online dust demo
encountered a character-image timeout and remained in asset loading after retry;
full online gameplay has not been confirmed. Direct asset HTTP checks passed.

Update 2026-10-20: removed the visible demo credentials from the login form.
Active release is now `/var/www/createworld-releases/20261020-hide-demo`;
previous frontend release remains available for rollback. Demo sign-in logic
is unchanged; hiding the UI text does not implement server authentication.

Update 2026-10-20: `20261020-dust-load-fix` streams optional audio on demand,
limits image loads to two 20-second attempts, aborts sibling requests on failure,
and uses WebP scene/character assets (about 700 KB combined). Original game
assets remain unchanged; the web wrapper selects the optimized variants.

Final release: `/var/www/createworld-releases/20261020-dust-final`.
All six required images are embedded in the lazy game module; scene art is
encoded at the actual game scene dimensions and the compressed module is about
237 KB. Optional audio is not part of the startup barrier. Original HTTP/2
Nginx transport configuration was retained after investigation. 49 game tests
passed, plus web type checking and production build. Browser verification on
the public domain reached the farm scene and successfully talked to Murph.
Final public-domain browser verification also passed on the final release:
reload, start, resume saved farm scene, open/close map, and talk to Murph.
Screenshot: `../output/dust-live-fixed.jpg` from the parent workspace. Cold-load
speed remains dependent on network throughput; startup no longer waits on audio
or separate scene/character network requests.

2026-10-20 persistent-login release: active directory is now
`/var/www/createworld-releases/20261020-persistent-login`. Frontend sign-in and
salted account verifiers persist in localStorage, migrating available legacy
tab data. Sign-out clears the remembered session and broadcasts across tabs.
No plaintext passwords are persisted. Eight auth/session tests, type checking
and build passed. Browser testing confirmed sign-in survives closing its tab
and opening a fresh login URL (automatically redirected to the requested page).
This is still frontend demo authentication, not server authentication.
