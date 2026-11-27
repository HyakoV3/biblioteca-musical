[Português](CONTRIBUTING.md) · [English](CONTRIBUTING.en.md) · **Español**

# Cómo contribuir

Gracias por querer ayudar. El proyecto es pequeño, en portugués, y está en **prueba cerrada** con músicos (versión 0.3.x). Antes de abrir una *pull request*, lea el [`README.es.md`](README.es.md) (qué es la app) y su sección "Desarrollo" (cómo ejecutarla). Los documentos de `docs/` están en portugués.

## Regla de oro: nada de himnario en Git

Este repositorio tiene **solo código** y datos de prueba **ficticios** (`tools/mscx2json/tests/fixtures/`, `tests/amostras.ts`), con **una excepción**: el paquete de ejemplo (`src-tauri/exemplo/`) trae 5 himnos de **dominio público**, cuya procedencia está en `docs/licencas-de-terceiros.md` (para cambiar o sumar un himno allí, registre la fuente y la licencia de la edición allí, y regenere con `python3 tools/gerar-exemplo.py`). **Nunca** incluya letras, partituras, audios ni archivos `.mscx` de himnos reales, ni capturas de pantalla con ellos: el contenido es de terceros y solo circula con autorización. El contenido local queda en `content/` y `docs/privado/`, que el `.gitignore` ya ignora. No ponga en Git claves, contraseñas, keystores ni direcciones internas (`docs/apk-de-teste.md` explica cómo se firma el APK de prueba, sin guardar la clave).

## Antes de abrir la PR

Ejecute lo que ejecuta el CI (solo datos ficticios o de dominio público; nada necesita contenido real):

```bash
npm ci                              # (o npm install)
npm run check                       # tipos (svelte-check, incluye tests/)
npm test                            # pruebas de la lógica (Vitest)
python3 tools/verificar-traducoes.py
python3 tools/verificar-movimento.py
python3 tools/contraste.py
python3 -m pytest tools             # pruebas de las herramientas en Python (el generador de ícono usa Pillow; use un entorno virtual)
npm run test:e2e                    # karaoke en un Chrome de verdad (necesita Chrome o Chromium)
npm run tezcat                      # Tezcat con el perfil strict: falla solo si la PR empeora la forma del código (necesita `tzt` instalado)
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test    # en tools/mscx2json
npm run build                       # Tauri exige la carpeta build/ para compilar src-tauri
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib   # en src-tauri (en Linux, con las bibliotecas de Tauri)
```

**Tezcat (forma del código):** el proyecto adopta el perfil `strict` con un trinquete: `tezcat-baseline.json` congela la deuda conocida y `npm run tezcat` falla solo ante una violación **nueva o empeorada** (función más larga, más ramas, más anidamiento). Corre en el computador de quien contribuye (el repositorio de Tezcat es privado, así que no está en el CI). Si su PR **paga** deuda, ejecute `tools/tezcat.sh --baseline` y lleve el archivo más pequeño; su diff solo puede encogerse. El código nuevo debe nacer dentro de la regla.

La prueba de extremo a extremo del Grabador falló de vez en cuando en el CI sin error en pantalla (vea [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md)); si el job "Karaokê num Chrome de verdade" cae en una PR que no toca eso, ejecútelo de nuevo antes de buscar el defecto.

El CI (`.github/workflows/ci.yml`) tiene **4 verificaciones obligatorias** para entrar en `main`: **App** (tipos, pruebas y verificadores), **Conversor de partituras (Rust)**, **Leitor do hinário (Rust, src-tauri)** y **Karaokê num Chrome de verdade**. `main` está protegida: todo cambio entra por PR, sin *push* directo.

## Qué necesita la PR

- **Una cosa por PR**, con título y descripción que digan qué cambió y **cómo comprobarlo** (en el aparato, cuando corresponda).
- **Pruebas** para la lógica nueva (Vitest en `tests/`, Rust junto al código). Un error corregido gana la prueba que lo habría detectado.
- **Textos de la interfaz en los tres idiomas** (portugués, inglés y español, en `src/lib/i18n/`): `npm run check` y el verificador de traducciones señalan una clave faltante. Vea [`docs/TRADUCOES.md`](docs/TRADUCOES.md).
- **Accesibilidad y apariencia:** áreas táctiles de al menos 44 px, contraste verificado en los temas (incluido Alto contraste), estado nunca solo por color y respeto por "reducir movimiento". Vea [`docs/design-tokens.md`](docs/design-tokens.md).
- **Documentación al día:** si el cambio altera lo que hace la app, ajuste el `README.md` y el documento del tema en `docs/`. Una idea implementada sale de [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) a [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md), y lo que quedó pendiente va a [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md).
- **Paquetes descargables:** si toca el formato del himnario, las partituras o los sonidos, siga [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md), [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) y [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md). En el himnario y las partituras, un paquete **publicado nunca cambia de contenido**: se sube un archivo con nombre nuevo (el nombre lleva el inicio del SHA-256) y se rehace el manifiesto. Los sonidos grabados siguen la regla de [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md) (nombres fijos por instrumento). Antes de poner un archivo en una carpeta de enlace del servidor, verifique que el zip de la carpeta quede por debajo del tope de descarga de la app (vea [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md), sección 8).

## Revisión

Cada PR del propio repositorio recibe una **revisión automática** (el job `review`, que comenta en el código cuando se abre la PR) y, en cada nuevo *push*, un job que ayuda a resolver las conversaciones (`resolve`). Los comentarios válidos se corrigen en la misma rama; los que no proceden reciben una respuesta que lo explica. Esos dos jobs dependen de una clave externa: en PR que vienen de un *fork* no se ejecutan o fallan por falta de ella, y también pueden fallar sin relación con su código. **No bloquean el *merge***: solo bloquean las 4 verificaciones del CI.

## Commits

Seguimos **Conventional Commits** desde 2026-11-24: `tipo(alcance): resumen`, en portugués, con `feat`, `fix`, `docs`, `chore`, `ci`, `build`, `refactor`, `test` o `perf`, y `!` después del tipo en un cambio incompatible (ej.: `feat(sons): baixar do GitHub Release`, `ci(release): conferir permissões do APK`). El título de la PR sigue el mismo formato (el merge es *squash*, así que se vuelve el commit). Diga el **porqué** cuando no sea obvio. Commits pequeños y coherentes valen más que uno grande. Sin atribución automática de herramientas en los commits ni en las PR de este repositorio.

## Reportar problemas

Un error o una idea: abra una *issue* describiendo lo que esperaba y lo que pasó (la versión y el commit aparecen al final de la pantalla **Ajustes**). **Falla de seguridad:** no abra una *issue* pública, siga [`SECURITY.es.md`](SECURITY.es.md).

## Licencia

Al contribuir, usted acepta que su código queda bajo la [licencia MIT](LICENSE) del proyecto. La licencia no vale para contenido de himnarios.
