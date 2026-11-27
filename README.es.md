[Português](README.md) · [English](README.en.md) · **Español**

# Biblioteca Musical

Aplicación gratuita y de código abierto para músicos en entrenamiento: estudiar himnos escuchando cada voz (soprano, contralto, tenor y bajo) y siguiendo la letra. Hecha con **Rust + Tauri 2** e interfaz en **Svelte 5 (SvelteKit) + TypeScript**. El objetivo principal es **Android**; el escritorio sirve para desarrollar.

> **Aviso:** proyecto **no oficial**, sin vínculo con la Congregación Cristiana en Brasil (Congregação Cristã no Brasil). La app no se vende y no puede usarse para vender contenido.

**Estado:** en desarrollo, en prueba cerrada con músicos (versión 0.3.9). Todavía no hay versión publicada en una tienda. ¿Quiere ayudar? Vea [`CONTRIBUTING.es.md`](CONTRIBUTING.es.md); para fallas de seguridad, [`SECURITY.es.md`](SECURITY.es.md).

> Los documentos detallados de `docs/` están escritos en portugués, el idioma de trabajo del proyecto. Los archivos enlazados abajo apuntan a ellos.

## Sobre el contenido

Este repositorio contiene **solo código**. La única excepción son los **5 himnos de dominio público** del paquete de ejemplo (`src-tauri/exemplo/`, con la procedencia de cada uno en [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md)). Ningún otro himno real está aquí: letras, partituras y audios **no forman parte del repositorio** (quedan fuera de Git, en la carpeta `content/`, que se ignora) y solo deben distribuirse con autorización de quien tiene los derechos (la del transcriptor, Enéias Ramos, está registrada en [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md); la de los autores de las letras y de la música, y la de la edición, no). **El himnario y las partituras tampoco vienen dentro de la app**: la persona los descarga una vez en Ajustes (el primer acceso ofrece la descarga del himnario) y quedan en el aparato, verificados por tamaño y SHA-256, con una barra de avance (90% la descarga, el resto la verificación y la instalación). Los paquetes llevan el SHA-256 en el nombre (`hinario-<sha8>.json`, `partituras-<sha8>.zip`) ([`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md) y [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md)). Los archivos de prueba de `tools/mscx2json/tests/fixtures/` son **ficticios**; el paquete de ejemplo (`src-tauri/exemplo/`) es de **dominio público**. El formato de los datos está en [`docs/FORMATO.md`](docs/FORMATO.md).

El código se escribió desde cero: no se copió código ni archivos de otras aplicaciones.

## Funciones

- **Escuchar:** el himno completo (introducción, cada vez de la letra y el final, con pausa entre las partes) o solo una parte. La parte que está sonando queda resaltada. Pausar, cambiar el tempo, el tono o el instrumento y continuar desde el mismo punto.
- **Voces:** volumen propio, silenciar y elegir el instrumento de cada voz (órganos, flauta, clarinete, trompeta, saxo, trombón, tuba, cuerdas y otros).
- **Tempo** de 1 en 1 y de 5 en 5 bpm, y **transposición** en semitonos.
- **Sonidos grabados (opcional):** por defecto el sonido se sintetiza en el aparato. En Ajustes se puede descargar un paquete de instrumentos grabados (GeneralUser GS, de S. Christian Collins, con licencia propia que permite redistribuir; vea [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md)), verificado por SHA-256 y usado sin conexión después. El paquete no está en el repositorio ni en la app. Detalles en [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- **Lista de himnos** con búsqueda por número, título, autoría, verso o tono; el **último himno abierto** queda marcado y hay el atajo **Continuar donde lo dejaste**.
- **Letra** con las estrofas (el coro y el final en negrita), en pestañas en la parte de abajo de la pantalla (al costado, con el celular acostado), con el **karaoke** encendiendo cada sílaba.
- **Partitura** de cada himno (opcional, descargada en Ajustes), con el compás y la nota que está sonando resaltados.
- **Afinador:** da el tono (La 440 u otra nota, con temporizador), recuerda las últimas notas usadas y, en "¿Qué nota es esta?", escucha el micrófono y dice la nota que usted toca, con los cents y las vecinas (y la nota que se lee en instrumentos que transponen, como la trompeta en Si♭).
- **Grabador:** graba su voz o su instrumento (sigue grabando con la pantalla bloqueada; la opción **Reducir ruido** (Apagado, Bajo, Medio o Alto: el filtro de Android, el RNNoise y el GTCRN, que corren en el propio aparato) viene desactivada por defecto), guarda en el aparato, permite buscar, filtrar, renombrar y marcar como favoritas las grabaciones, y comparte por la hoja del sistema. La grabación sale como **Ogg/Opus (`.ogg`)**, que WhatsApp y Telegram aceptan como audio ([`docs/ideia-enviar-audio-por-app.md`](docs/ideia-enviar-audio-por-app.md)). Con auriculares se puede grabar escuchando un himno.
- **Metrónomo:** de 30 a 240 bpm, compases simples (2, 3, 4) y compuestos (6, 9, 12), péndulo que va y vuelve; sigue con la pantalla bloqueada y recuerda los últimos usados.
- **Salida de audio:** en Ajustes, la salida en uso (altavoz, auriculares con cable, USB-C o Bluetooth) y cuatro modos, **Automático y buffer alto, medio y bajo**, guardados por salida, con las medidas de lo que funcionó, para quien oye chasquidos en los auriculares ([`docs/saida-de-audio.md`](docs/saida-de-audio.md)).
- **Pantalla encendida:** un botón en la pantalla del himno (el ojo) mantiene la pantalla encendida mientras suena el himno.
- **Apariencia:** modo automático, claro, oscuro o de alto contraste, combinado con tres estilos de color (Normal, Pergamino y Marino y oro), con contraste verificado ([`docs/design-tokens.md`](docs/design-tokens.md)).
- Interfaz en portugués, español e inglés, lista para nuevos idiomas ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).
- Accesibilidad: áreas táctiles de al menos 44 px, contraste verificado, respeto por "reducir movimiento".

## Conversor de partituras

`tools/mscx2json` (Rust) convierte archivos de MuseScore (`.mscx`) al formato de la app (`hinario.json`). Quien use contenido propio hace la conversión en su máquina y publica el archivo para que la app lo descargue (vea [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md)).

## Hoja de ruta

[`docs/roadmap-fase-2.md`](docs/roadmap-fase-2.md) (fase actual), [`docs/roadmap-uxui-inicial.md`](docs/roadmap-uxui-inicial.md) (fase 1, concluida), [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md) (publicación, CI/CD, revisión y pruebas) e ideas futuras en [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) (las ya implementadas, en [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md)).

## Desarrollo

Requisitos: Rust, Node.js y las [dependencias de Tauri](https://tauri.app/start/prerequisites/) (en Linux: webkit2gtk y rsvg2).

```bash
npm install
npm run tauri dev            # escritorio
npm run tauri android init   # una vez
npm run tauri android dev    # Android
npm run check                # tipos (svelte-check, incluye tests/)
npm test                     # pruebas de la lógica (Vitest), solo con datos ficticios o de dominio público
npm run test:e2e             # karaoke en un Chrome de verdad (necesita Chrome o Chromium)
```

Las pruebas del conversor y del lector en Rust: `cargo test` en `tools/mscx2json` y `cargo test --lib` en `src-tauri`.

APK de prueba cerrada: [`docs/apk-de-teste.es.md`](docs/apk-de-teste.es.md) (cómo instalarlo; cómo se genera, firma y entrega está en el [`docs/apk-de-teste.md`](docs/apk-de-teste.md) en portugués).

Para contribuir (qué necesita la PR y qué exige el CI): [`CONTRIBUTING.es.md`](CONTRIBUTING.es.md).

## Licencia

[MIT](LICENSE): vale para el código. No se aplica al contenido de himnarios. Licencias de terceros: [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md).
