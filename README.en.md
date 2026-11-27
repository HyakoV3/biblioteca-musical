[Português](README.md) · **English** · [Español](README.es.md)

# Biblioteca Musical

A free, open-source app for musicians in training: study hymns by listening to each voice (soprano, alto, tenor and bass) while following the lyrics. Built with **Rust + Tauri 2** and a **Svelte 5 (SvelteKit) + TypeScript** interface. The main target is **Android**; the desktop build works for development.

> **Notice:** **unofficial** project, with no connection to the Christian Congregation in Brazil (Congregação Cristã no Brasil). The app is not sold and cannot be used to sell content.

**Status:** under development, in closed testing with musicians (version 0.3.9). There is no store release yet. Want to help? See [`CONTRIBUTING.en.md`](CONTRIBUTING.en.md); for security flaws, [`SECURITY.en.md`](SECURITY.en.md).

> The in-depth documents under `docs/` are written in Portuguese, the project's working language. The files linked below point to them.

## About the content

This repository contains **code only**. The only exception are the **5 public-domain hymns** of the example package (`src-tauri/exemplo/`, with the provenance of each one in [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md)). No other real hymn is here: lyrics, scores and audio **are not part of the repository** (they stay outside Git, in the ignored `content/` folder) and may only be distributed with permission from whoever holds the rights (the transcriber's, Enéias Ramos, is recorded in [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md); the permission of the authors of the lyrics and music, and of the edition, is not). **The hymnal and the scores are not inside the app either**: the user downloads them once in Settings (the first launch offers the hymnal download) and they stay on the device, checked by size and SHA-256, with a progress bar (90% for the download, the rest for the check and the installation). The packages carry the SHA-256 in their name (`hinario-<sha8>.json`, `partituras-<sha8>.zip`) ([`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md) and [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md)). The test files in `tools/mscx2json/tests/fixtures/` are **fictional**; the example package (`src-tauri/exemplo/`) is **public domain** ([guide, in Portuguese](docs/pacote-de-exemplo.md)). The data format is in [`docs/FORMATO.md`](docs/FORMATO.md).

The code was written from scratch: no code or file from other apps was copied.

## Features

- **Listen:** the whole hymn (introduction, each time through the lyrics and the ending, with a pause between parts) or just one part. The part that is sounding is highlighted. Pause, change the tempo, the key or the instrument, and continue from the same point.
- **Voices:** own volume, mute and choice of instrument for each voice (organs, flute, clarinet, trumpet, sax, trombone, tuba, strings and others).
- **Tempo** in steps of 1 and 5 bpm, and **transposition** in semitones.
- **Recorded sounds (optional):** by default the sound is synthesized on the device. In Settings you can download a pack of recorded instruments (GeneralUser GS, by S. Christian Collins, under its own license that allows redistribution; see [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md)), checked by SHA-256 and used offline afterwards. The pack is neither in the repository nor in the app. Details in [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- **Hymn list** with search by number, title, authorship, verse or key; the **last opened hymn** is marked and there is a **Continue where you left off** shortcut.
- **Lyrics** with the stanzas (chorus and ending in bold), in tabs at the bottom of the screen (at the side, with the phone on its side), with **karaoke** lighting up each syllable.
- **Score** of each hymn (optional, downloaded in Settings), with the measure and the note that is sounding highlighted.
- **Tuner:** gives the pitch (A 440 or another note, with a timer), remembers the last notes used and, in "Which note is this?", listens to the microphone and tells you the note you play, with the cents and the neighbors (and the note that is read on transposing instruments, such as the B♭ trumpet).
- **Recorder:** records your voice or your instrument (keeps recording with the screen locked; the **Reduce noise** choice (Off, Low, Medium or High: the Android filter, RNNoise and GTCRN, which run on the device itself) is off by default), saves on the device, lets you find, filter, rename and favorite recordings, and shares through the system sheet. The recording comes out as **Ogg/Opus (`.ogg`)**, which WhatsApp and Telegram accept as audio ([`docs/ideia-enviar-audio-por-app.md`](docs/ideia-enviar-audio-por-app.md)). With headphones you can record while listening to a hymn.
- **Metronome:** from 30 to 240 bpm, simple (2, 3, 4) and compound (6, 9, 12) time signatures, a pendulum that swings back and forth; keeps going with the screen locked and remembers the last ones used.
- **Audio output:** in Settings, the output in use (speaker, wired headphones, USB-C or Bluetooth) and four modes, **Automatic and high, medium and low buffer**, saved per output, with the measurements of what worked, for those who hear crackling in headphones ([`docs/saida-de-audio.md`](docs/saida-de-audio.md)).
- **Screen on:** a button on the hymn screen (the eye) keeps the screen lit while the hymn plays.
- **Appearance:** automatic, light, dark or high-contrast mode, combined with three color styles (Normal, Parchment and Navy and gold), with checked contrast ([`docs/design-tokens.md`](docs/design-tokens.md)).
- Interface in Portuguese, Spanish and English, ready for new languages ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).
- Accessibility: touch targets of at least 44 px, checked contrast, respect for "reduce motion".

## Score converter

`tools/mscx2json` (Rust) converts MuseScore files (`.mscx`) into the app's format (`hinario.json`). Whoever uses their own content does the conversion on their machine and publishes the file for the app to download (see [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md)).

## Roadmap

[`docs/roadmap-fase-2.md`](docs/roadmap-fase-2.md) (current phase), [`docs/roadmap-uxui-inicial.md`](docs/roadmap-uxui-inicial.md) (phase 1, done), [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md) (publishing, CI/CD, review and tests) and future ideas in [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) (the ones already implemented, in [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md)).

## Development

Requirements: Rust, Node.js and the [Tauri dependencies](https://tauri.app/start/prerequisites/) (on Linux: webkit2gtk and rsvg2).

```bash
npm install
npm run tauri dev            # desktop
npm run tauri android init   # once
npm run tauri android dev    # Android
npm run check                # types (svelte-check, includes tests/)
npm test                     # logic tests (Vitest), fictional or public-domain data only
npm run test:e2e             # karaoke in a real Chrome (needs Chrome or Chromium)
```

The converter and reader tests in Rust: `cargo test` in `tools/mscx2json` and `cargo test --lib` in `src-tauri`.

Closed-test APK: [`docs/apk-de-teste.en.md`](docs/apk-de-teste.en.md) (how to install it; how it is built, signed and delivered is in the Portuguese [`docs/apk-de-teste.md`](docs/apk-de-teste.md)).

To contribute (what a PR needs and what CI demands): [`CONTRIBUTING.en.md`](CONTRIBUTING.en.md).

## License

[MIT](LICENSE): applies to the code. It does not apply to hymnal content. Third-party licenses: [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md).
