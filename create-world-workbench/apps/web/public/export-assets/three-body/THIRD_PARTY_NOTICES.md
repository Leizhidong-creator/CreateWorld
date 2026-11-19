# Sources and third-party notices

The application runtime and workbench were implemented for this project. No game code, sprites, music, or character assets from Beyond-The-Walls- were copied into the shipped template.

- Reference game: [SSxs-wym/Beyond-The-Walls-](https://github.com/SSxs-wym/Beyond-The-Walls-/tree/93cf4540e8c1d64e0b45844ddb1b14eaf06177d5). Used for architecture research only; upstream package is UNLICENSED and its README describes retained rights.
- Methodology reference: [liiiyiiixiii/Create-World-skills](https://github.com/liiiyiiixiii/Create-World-skills/tree/2bfa0784a6ba6c8507191d5c7174dee10aa7b15d). MIT licensed. The current MVP implements its own reduced stage contracts; it does not claim the full upstream image/character workflows have been integrated.
- Codex CLI: [openai/codex](https://github.com/openai/codex). Apache-2.0. Installed as the unmodified npm dependency `@openai/codex` with its upstream notices; source reference checkout is research only.
- React, Vite, TypeScript, Express, Zod, fflate, tsx and Lucide: see their installed package licenses. Playwright: Apache-2.0; its browser binaries carry their own licenses.

Reference repositories, user source material, credentials, generated projects and browser test artifacts are excluded from version-control staging by `.gitignore`.
