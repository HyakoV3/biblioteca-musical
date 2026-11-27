[Português](CONTRIBUTING.md) · **English** · [Español](CONTRIBUTING.es.md)

# How to contribute

Thank you for wanting to help. The project is small, in Portuguese, and in **closed testing** with musicians (version 0.3.x). Before opening a *pull request*, read the [`README.en.md`](README.en.md) (what the app is) and its "Development" section (how to run it). The documents under `docs/` are in Portuguese.

## Golden rule: no hymnal content in Git

This repository has **code only** and **fictional** test data (`tools/mscx2json/tests/fixtures/`, `tests/amostras.ts`), with **one exception**: the example package (`src-tauri/exemplo/`) carries 5 **public-domain** hymns whose provenance is in `docs/licencas-de-terceiros.md` (to replace or add a hymn there, record the source and the edition's license there, and regenerate with `python3 tools/gerar-exemplo.py`). **Never** include lyrics, scores, audio or `.mscx` files of real hymns, nor screenshots showing them: the content belongs to third parties and only circulates with permission. Local content stays in `content/` and `docs/privado/`, which `.gitignore` already ignores. Do not put keys, passwords, keystores or internal addresses in Git (`docs/apk-de-teste.md` explains how the test APK is signed, without keeping the key).

## Before opening the PR

Run what CI runs (fictional or public-domain data only; nothing needs real content):

```bash
npm ci                              # (or npm install)
npm run check                       # types (svelte-check, includes tests/)
npm test                            # logic tests (Vitest)
python3 tools/verificar-traducoes.py
python3 tools/verificar-movimento.py
python3 tools/contraste.py
python3 -m pytest tools             # the Python tools' tests (the icon generator uses Pillow; use a virtual env)
npm run test:e2e                    # karaoke in a real Chrome (needs Chrome or Chromium)
npm run tezcat                      # Tezcat with the strict profile: fails only if the PR makes the code's shape worse (needs `tzt` installed)
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test    # in tools/mscx2json
npm run build                       # Tauri requires the build/ folder to compile src-tauri
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib   # in src-tauri (on Linux, with the Tauri libraries)
```

**Tezcat (code shape):** the project adopts the `strict` profile with a ratchet: `tezcat-baseline.json` freezes the known debt and `npm run tezcat` fails only on a **new or worsened** violation (a longer function, more branches, deeper nesting). It runs on the contributor's own machine (Tezcat's repository is private, so it is not in CI). If your PR **pays down** debt, run `tools/tezcat.sh --baseline` and ship the smaller file with it; its diff can only shrink. New code should be born within the ruler.

The Recorder's end-to-end test has failed now and then in CI with no error on screen (see [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md)); if the "Karaokê num Chrome de verdade" job fails on a PR that does not touch that, run it again before hunting for the defect.

CI (`.github/workflows/ci.yml`) has **4 required checks** to get into `main`: **App** (types, tests and verifiers), **Conversor de partituras (Rust)**, **Leitor do hinário (Rust, src-tauri)** and **Karaokê num Chrome de verdade**. `main` is protected: every change goes in through a PR, with no direct *push*.

## What the PR needs

- **One thing per PR**, with a title and description that say what changed and **how to check it** (on the device, when relevant).
- **Tests** for new logic (Vitest in `tests/`, Rust next to the code). A fixed bug gets the test that would have caught it.
- **Interface texts in the three languages** (Portuguese, English and Spanish, in `src/lib/i18n/`): `npm run check` and the translation verifier flag a missing key. See [`docs/TRADUCOES.md`](docs/TRADUCOES.md).
- **Accessibility and appearance:** touch targets of at least 44 px, contrast checked in the themes (including High contrast), state never by color alone and respect for "reduce motion". See [`docs/design-tokens.md`](docs/design-tokens.md).
- **Up-to-date documentation:** if the change alters what the app does, adjust the `README.md` and the topic's doc in `docs/`. An implemented idea moves from [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) to [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md), and whatever stayed pending goes to [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md).
- **Downloadable packages:** if you touch the hymnal format, the scores or the sounds, follow [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md), [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) and [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md). For the hymnal and the scores, a **published package never changes content**: you upload a file with a new name (the name carries the start of the SHA-256) and rebuild the manifest. The recorded sounds follow the rule in [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md) (fixed names per instrument). Before putting a file in a server link folder, check that the folder's zip stays below the app's download ceiling (see [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md), section 8).

## Review

Each PR from the repository itself gets an **automatic review** (the `review` job, which comments on the code when the PR is opened) and, on every new *push*, a job that helps resolve the conversations (`resolve`). Valid comments are fixed on the same branch; those that do not hold get a reply explaining why. These two jobs depend on an external key: on PRs from a *fork* they do not run or fail for lack of it, and they may also fail with no relation to your code. They **do not block the *merge***: only the 4 CI checks block.

## Commits

We follow **Conventional Commits** since 2026-11-24: `type(scope): summary`, in Portuguese, with `feat`, `fix`, `docs`, `chore`, `ci`, `build`, `refactor`, `test` or `perf`, and `!` after the type for a breaking change (e.g. `feat(sons): baixar do GitHub Release`, `ci(release): conferir permissões do APK`). The PR title follows the same format (the merge is a *squash*, so it becomes the commit). Say the **why** when it is not obvious. Small, coherent commits are worth more than one big one. No automatic tool attribution in this repository's commits and PRs.

## Reporting problems

A bug or an idea: open an *issue* describing what you expected and what happened (the version and commit appear at the bottom of the **Settings** screen). **Security flaw:** do not open a public *issue*, follow [`SECURITY.en.md`](SECURITY.en.md).

## License

By contributing, you agree that your code is under the project's [MIT license](LICENSE). The license does not apply to hymnal content.
