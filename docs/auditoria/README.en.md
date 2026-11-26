[Português](README.md) · **English** · [Español](README.es.md)

# Audit persona kit — Biblioteca Musical CCB

**Base examined:** file `biblioteca-musical-ccb-main.zip` supplied by the requester, declared version **0.3.0** (the one from the kit's first assembly; each round states its own in the briefing). Profiles were drawn up from the code and documentation in that file. **This kit is NOT a completed audit:** it makes no claims about tests that were run, vulnerabilities that were verified, or approval for release.

> The persona profiles (`00` to `22`) are written in Portuguese, the working language of the project. This README, the briefing template, the report template and the coverage matrix are also available in English and Spanish.

## How to use

1. The `.md` profiles live in `docs/auditoria/` (do not move them: the briefings' paths depend on it). Hand the relevant persona to each auditor/assistant; the reports go to `docs/auditoriaYYYYMM/` (ignored by Git).
2. Start with **00 — General coordinator**, which defines scope, environment, priority and the split of work without duplication.
3. For each area, hand over the matching `.md` as the work instruction and give access **only to the files that are needed**, with no credentials or protected content.
4. Require an independent `.md` report per persona, following `MODELO-RELATORIO.md`; validate the evidence and consolidate with the coordinator.
5. Re-run the regression scenarios after the fixes; only the responsible team decides whether to release a version.

## Persona summary

| No. | Persona | Priority |
|---|---|---|
| 00 | [General audit coordinator](00-coordenador-geral.md) | Cross-cutting |
| 01 | [Product, requirements and scope auditor](01-produto-requisitos.md) | High |
| 02 | [Auditor as the beginner musician](02-usuario-musico-iniciante.md) | High |
| 03 | [Auditor as the experienced musician](03-usuario-musico-experiente.md) | High |
| 04 | [UX, UI and mobile navigation auditor](04-ux-navegacao-mobile.md) | High |
| 05 | [Accessibility and inclusion auditor](05-acessibilidade-inclusao.md) | Critical |
| 06 | [Music theory, tempo and repeats auditor](06-teoria-musical-repeticoes.md) | Critical |
| 07 | [Playback engine and synchronization auditor](07-motor-reproducao.md) | Critical |
| 08 | [Audio, timbres and four-voice auditor](08-audio-timbres-quatro-vozes.md) | High |
| 09 | [Lyrics, stanzas and karaoke auditor](09-letra-karaoke.md) | High |
| 10 | [SVG score and display auditor](10-partituras-svg.md) | Critical |
| 11 | [MuseScore → JSON converter auditor](11-conversor-musescore.md) | High |
| 12 | [Import, validation and persistence auditor](12-importacao-dados-persistencia.md) | Critical |
| 13 | [Downloads, integrity and offline operation auditor](13-pacotes-download-offline.md) | Critical |
| 14 | [Tauri application security auditor](14-seguranca-app-tauri.md) | Critical |
| 15 | [Privacy, copyright and licensing auditor](15-privacidade-direitos-licencas.md) | Critical |
| 16 | [Internationalization and translation auditor](16-internacionalizacao-traducoes.md) | Medium |
| 17 | [Performance, memory and power consumption auditor](17-desempenho-memoria-energia.md) | High |
| 18 | [Android, compatibility and lifecycle auditor](18-android-compatibilidade-ciclo-vida.md) | Critical |
| 19 | [QA, testing and regression auditor](19-qualidade-testes-regressao.md) | Critical |
| 20 | [Architecture and code quality auditor](20-arquitetura-qualidade-codigo.md) | High |
| 21 | [CI/CD, APK and supply chain auditor](21-cicd-release-fornecimento.md) | Critical |
| 22 | [Visual design, themes and usage documentation auditor](22-design-temas-documentacao.md) | Medium |

## Recommended order of work

**First pass (code and documentation):** 00, 01, 06, 07, 09, 10, 11, 12, 13, 14, 15, 19, 20, 21.

**Second pass (UX and real device):** 02, 03, 04, 05, 08, 16, 17, 18, 22. The outcome of this phase depends on an APK/environment and on fictional or authorized data.

**Closing:** 00 integrates the findings, assigns owners and triages P0/P1. The coverage matrix is in `MATRIZ-DE-COBERTURA.md`.

## Important particularities of the project

- **Unofficial** app, free of charge and still in closed testing; Android is the main target, desktop is used for development.
- Stack: **Rust / Tauri 2**, **Svelte 5 / SvelteKit** and **TypeScript**.
- Four musical voices, BPM/key control, introduction, repeats, special last time and mini-player.
- Optional features: **recorded sounds** and **SVG scores**, with download and integrity checking.
- pt/es/en interface, themes, local preferences and declared accessibility.
- The repository declares that it contains **only code and fictional data**; do not use real hymnal content as evidence.
- The documentation records open Android test points and open rights over the scores; take such items into account in the release criteria, without automatically assuming a defect or an authorization.

## Existing verification commands in the project

```sh
npm ci
npm run check
npm test
npm run test:e2e
cargo test --manifest-path tools/mscx2json/Cargo.toml
cargo test --lib --manifest-path src-tauri/Cargo.toml
python3 tools/verificar-traducoes.py
python3 tools/verificar-movimento.py
python3 tools/contraste.py
```

**Note:** these are commands found in the project, **not** execution results. Some need Chrome/Chromium, Rust, the Tauri libraries, an Android environment and installed dependencies.

## Code of conduct

Demand traceability to a file:line or a test, and an epistemically correct status: `Confirmado` (confirmed), `Provável` (probable), `Risco a verificar` (risk to verify) or `Não reproduzido` (not reproduced). **Do not confuse the absence of a test with a bug, nor something planned with something delivered.** Do not run destructive actions or contact external services without authorization. Vulnerability reports must follow `SECURITY.md` through a private channel.

## In this repository

- **Who runs this audit:** the kit and the rounds are conducted with **Claude (Anthropic)**, across 23 perspectives (22 specialists and coordinator 00), with the static-analysis tool **Tezcat** as a supporting input. The project owner defines the scope, decides what to accept, reviews and approves every fix, and answers for the app. The audit **reads code and runs tests**: whatever can only be proven on an Android device (foreground service, WebView, real audio, screen reader) stays as a **risk to verify** and goes into the manual test script (`docs/teste-de-uso.md`). An audit done by AI does not replace testing with people.
- **Where the profiles live:** in this folder, `docs/auditoria/`. They carry no fixed version: `MODELO-BRIEFING.md` is filled in each round with the audited commit and version.
- **Where the results live:** each round becomes a folder `docs/auditoriaYYYYMM/` (`YYYY` year, `MM` month; a second round in the same month gets `-2`), with one report per persona, the coordinator's report (00), the adjustment plan and the owner's decisions. **The results are NOT versioned:** `.gitignore` ignores `docs/auditoria[0-9]*/`, because the reports describe risks of a public repository. Whatever the owner wants to keep beyond the machine goes in `docs/privado/`, also outside Git.
- **The repository is public:** the profiles and this README follow the kit's rule (no real hymns, lyrics, scores or audio, personal data, tokens or closed-test material).

## Running it again (cadence)

A full round is a lot of work. Suggestion: **every quarter** and **before each public version** (final RC or store release); a **reduced** round (only the personas of the area touched) after a big change to audio, the converter, the release or security.

1. Copy `MODELO-BRIEFING.md` to `docs/auditoriaYYYYMM/00-briefing.md` and fill in the commit, the version and what changed since the previous round.
2. Run Tezcat with the `strict` profile: `tools/tezcat.sh --tudo` shows everything; put the output in `docs/auditoriaYYYYMM/` as a ready-made input. Day to day it is `npm run tezcat`, the ratchet with `tezcat-baseline.json`.
3. Run `npm run check`, `npm test`, the Python verifiers and `cargo test`, and keep the outputs in `docs/auditoriaYYYYMM/evidencias/`.
4. Launch the personas (order in "Recommended order of work"), one report each, on a **read-only** working copy.
5. Persona 00 consolidates: `00-coordenador-relatorio.md`, `00-plano-de-ajustes.md` and `00-decisoes-do-responsavel.md`.
6. Handle the plan in waves, **one commit and one PR per wave**, with manual on-device validation for whatever the plan marks that way.
