[Português](MODELO-BRIEFING.md) · **English** · [Español](MODELO-BRIEFING.es.md)

# Audit round briefing YYYY-MM

> Template: copy it to `docs/auditoriaYYYYMM/00-briefing.md`, fill in what is between `<...>` and hand it to **all** the personas. Each auditor reads, in this order: this briefing, their profile in `docs/auditoria/NN-*.md`, `docs/auditoria/MODELO-RELATORIO.md`, `docs/auditoria/MATRIZ-DE-COBERTURA.md` and the "Regras inegociáveis" (non-negotiable rules) and "Classificação padronizada" (standard classification) sections of `docs/auditoria/00-coordenador-geral.md`.

## What is audited

- **Working copy (read-only):** `<worktree path>`, on `main` at commit **`<sha>`** (app **`<version>`**).
- **Where to write:** only **your** report, in `docs/auditoriaYYYYMM/NN-<slug>-relatorio.md` (the `<slug>` is the one in your profile's name).
- The kit's profiles may cite old paths: **confirm each one before using it** and record what no longer exists.
- **Scope of the round:** `<full | reduced: personas NN, NN, NN>`.

## What changed since the previous round

- `<summary per area: what came in, what was fixed, what remains pending (waves, PRs, release candidates)>`

Starting points for reading the real state: `README.md`, `docs/roadmap-pendencias.md`, `docs/roadmap-ideas.md`, `docs/apk-de-teste.md`, `docs/licencas-de-terceiros.md` and the plan and decisions of the previous round.

## Ready-made inputs (do not redo)

| File | What it has |
|---|---|
| `docs/auditoriaYYYYMM/00-tzt-tezcat-relatorio.md` | (optional) Tezcat with the **strict** profile. It measures **form**, it is not a verdict on defects. Use only what belongs to your domain. |
| `docs/auditoriaYYYYMM/evidencias/` | Output of `npm run check`, `vitest`, the Python verifiers and (when they exist) `cargo test` and the e2e, run **once** on this commit. Cite it as evidence. |

## Execution rules (they override the profile)

1. **Do not change the code, do not commit, do not switch branches, do not use `git stash`.** The only file you create is your report.
2. **Do not touch** the owner's main folder. Only read the working copy above.
3. **Do not run** the e2e, builds, installs, or anything that opens ports, uses the network or downloads from servers. The tests and the build are already in `evidencias/`. One **short check with no side effects** (`npx vitest run <file>`) is allowed.
4. **No third-party content:** the repository only has fictional data. Do not paste real lyrics, scores or samples.
5. **The repository is public.** For security findings, describe the **class of problem, the evidence and the fix**, with no step-by-step working exploit.
6. **Real evidence:** `file:line` and the excerpt. Without evidence, the finding is `Risco a verificar` (risk to verify), never `Confirmado`. Whatever can only be proven on an Android device stays as `Risco a verificar`.
7. **No inflating:** if there is no defect, write "no confirmed finding".
8. **No duplicating:** the matrix says who owns each area. If the finding belongs to another persona, cite their ID under "Supporting persona(s)".
9. Write in **Portuguese**, direct, with no embellishment.

## Report format

That of `MODELO-RELATORIO.md`, with the findings in the coordinator's format (`[P0-P3]`, ID `AREA-001`, Status, Confidence, Evidence, Expected, Observed, Impact, **one** Recommendation, Suggested regression, Suggested owner). End with two sections:

- **Tests not run:** what was left out for lack of a device or authorization.
- **For the coordinator (00):** the 5 most important things, what **duplicates** another persona, and what to **handle first**.

## What to answer at the end

A short answer (up to 120 words): the report's path, the count of findings by P0, P1, P2 and P3, and the top 3.
