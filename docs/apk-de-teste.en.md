[Português](apk-de-teste.md) · **English** · [Español](apk-de-teste.es.md)

# Closed-test APK

> This page translates only the guide for testers and a summary for publishers. The full record (how the APK is built and signed, the release history and the checks after each merge) is in Portuguese in [`apk-de-teste.md`](apk-de-teste.md).

## For testers

The app is **independent and unofficial** (it has no connection with the Christian Congregation in Brazil) and is in **closed testing**: it can still make mistakes. To install it:

1. **Download the newest version** from the project's [Releases](https://github.com/HyakoV3/biblioteca-musical/releases) page (the one at the top of the list).
2. **Download the file that ends in `.apk`** (for example `bibliotecamusical-0.3.9.apk`). Ignore the `.aab` and the `SHA256SUMS`: they are not for installing.
3. **Allow installation from outside the store** when Android asks (the "Install unknown apps" option of the browser or the file manager) and tap the file to install it.
4. **When updating, install over the top**: do not uninstall. **Uninstalling deletes the saved recordings and the downloaded packages** (the app does not back up recordings). If you must uninstall, first share, with the Recorder's **Share** button, the recordings you want to keep.
5. **Check the version** in Settings, "About the app", and say which one it is when reporting a problem.
6. **To report:** tell the person who gave you the link what you did, what you expected and what happened, and the version. Do not send personal data.

On the first launch the app offers to **download the hymnal** (about 4 MB); the scores and the recorded sounds are optional, in Settings, "Content". Once downloaded, everything works offline.

## For publishers

APKs are published through the GitHub Release. The content (hymnal and scores) **does not ship inside the APK**: the app downloads it from the `HyakoV3/biblioteca-musical-pacotes` repository. The transcriber's permission to distribute that content is recorded in [`licencas-de-terceiros.md`](licencas-de-terceiros.md); it **does not cover** the authors of the lyrics and music or the edition of the hymnal. Before any open publication (store or final tag), those rights have to be settled.

A build can, if needed, carry a `hinario.json` **inside the binary** (the history in the Portuguese page covers how). The content **never goes into Git**: only the file's path is given at build time.
