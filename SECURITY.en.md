[Português](SECURITY.md) · **English** · [Español](SECURITY.es.md)

# Security

## How to report a vulnerability

Do not open a public *issue* with details of a security flaw. Use **Security, Report a vulnerability** in this repository (GitHub's private reporting). If that option does not show up, open an *issue* only asking for a private contact, without describing the flaw.

## What the app does with the network and with data

- It has no account or login, and it does not send usage data.
- Over the network, the app only reaches **one address**, for optional packages: the public packages repository on GitHub (**hymnal, scores and recorded sounds**). The owner's server (File Browser) stopped being used by the app on 2026-11-24 and only serves old APKs. That permission is restricted, in `src-tauri/capabilities/default.json`, to a GitHub path (`.../biblioteca-musical-pacotes/releases/download/*`). GitHub redirects the download to its asset storage, and the plugin does not restrict that destination (only the initial URL); the content stays protected by the SHA-256 of each file, checked against the manifest embedded in the app.
- Every downloaded package is checked by **size and SHA-256** against the manifest that ships inside the app (`src/lib/hinario/manifesto.json`, `src/lib/partituras/manifesto.json` and `src/lib/sons/manifesto.json`) before being stored. A tampered, incomplete or absurdly large package (a zip "bomb": the download has a 100 MiB ceiling) is rejected whole; in Rust, each score also goes through an SVG cleaning step (an allow-list of elements). Details in [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md), [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) and [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md) (in Portuguese).
- **Microphone:** only the Recorder and the Tuner's "Which note is this?" use it, with the permission requested only when recording or when tapping Listen (the Tuner records nothing: it reads the sound and discards it); the recording stays on the device and only leaves when the person taps **Send** (the system share sheet). The `FileProvider` that hands the recording to the other app exposes only the `compartilhar/` subfolder of the app's own cache, not all of the storage.
- **Defense in depth for the window:** the app has a restrictive CSP (`app.security.csp` in `src-tauri/tauri.conf.json`: no `unsafe-eval`, no `*`, scripts only from the app itself and `wasm-unsafe-eval` for the noise filters), the window only navigates within the app's origin (`on_navigation` in `src-tauri/src/lib.rs`; the app has no external links) and the `opener` plugin was removed (the app does not open links). Copies of sent recordings stay in `cache/compartilhar/` and are deleted after one hour, when the app opens and on the Recorder's "Delete all". `tests/seguranca.test.ts` pins the CSP, the permissions and the `FileProvider`.
- Hymnal content (lyrics and scores) is **not kept in this repository**: only code and fictional test data.

## Versions

The project is under development (0.x) and there is no store release. Security fixes go into `main`.
