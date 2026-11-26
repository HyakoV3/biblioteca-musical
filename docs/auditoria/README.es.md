[Português](README.md) · [English](README.en.md) · **Español**

# Kit de personas de auditoría — Biblioteca Musical CCB

**Base examinada:** archivo `biblioteca-musical-ccb-main.zip` entregado por el solicitante, versión declarada **0.3.0** (la del primer armado del kit; cada ronda informa la suya en el briefing). Los perfiles se elaboraron a partir del código y la documentación presentes en el archivo. **Este kit NO es una auditoría concluida:** no contiene afirmaciones de pruebas ejecutadas, vulnerabilidades verificadas ni aprobación para publicar.

> Los perfiles de las personas (`00` a `22`) están escritos en portugués, el idioma de trabajo del proyecto. Este README, el modelo de briefing, el modelo de informe y la matriz de cobertura también están disponibles en inglés y español.

## Cómo usar

1. Ponga los archivos `.md` en una carpeta del proyecto, por ejemplo `auditoria/personas/`, o entregue la persona pertinente a cada auditor/asistente.
2. Empiece por el **00 — Coordinador general**, que define alcance, entorno, prioridad y la división del trabajo sin duplicación.
3. Para cada área, entregue el `.md` correspondiente como instrucción de trabajo y dé acceso **solo a los archivos necesarios**, sin credenciales ni contenido protegido.
4. Exija un informe `.md` independiente por persona, según `MODELO-RELATORIO.md`; valide las evidencias y consolide con el coordinador.
5. Vuelva a ejecutar los escenarios de regresión tras las correcciones; solo el equipo responsable decide si se libera una versión.

## Resumen de las personas

| N.º | Persona | Prioridad |
|---|---|---|
| 00 | [Coordinador general de auditoría](00-coordenador-geral.md) | Transversal |
| 01 | [Auditor de producto, requisitos y alcance](01-produto-requisitos.md) | Alta |
| 02 | [Auditor en la persona del músico principiante](02-usuario-musico-iniciante.md) | Alta |
| 03 | [Auditor en la persona del músico experimentado](03-usuario-musico-experiente.md) | Alta |
| 04 | [Auditor de UX, UI y navegación móvil](04-ux-navegacao-mobile.md) | Alta |
| 05 | [Auditor de accesibilidad e inclusión](05-acessibilidade-inclusao.md) | Crítica |
| 06 | [Auditor de teoría musical, tempo y repeticiones](06-teoria-musical-repeticoes.md) | Crítica |
| 07 | [Auditor del motor de reproducción y sincronía](07-motor-reproducao.md) | Crítica |
| 08 | [Auditor de audio, timbres y cuatro voces](08-audio-timbres-quatro-vozes.md) | Alta |
| 09 | [Auditor de letra, estrofas y karaoke](09-letra-karaoke.md) | Alta |
| 10 | [Auditor de partituras SVG y visualización](10-partituras-svg.md) | Crítica |
| 11 | [Auditor del conversor MuseScore → JSON](11-conversor-musescore.md) | Alta |
| 12 | [Auditor de importación, validación y persistencia](12-importacao-dados-persistencia.md) | Crítica |
| 13 | [Auditor de descargas, integridad y operación sin conexión](13-pacotes-download-offline.md) | Crítica |
| 14 | [Auditor de seguridad de la aplicación Tauri](14-seguranca-app-tauri.md) | Crítica |
| 15 | [Auditor de privacidad, derechos de autor y licencias](15-privacidade-direitos-licencas.md) | Crítica |
| 16 | [Auditor de internacionalización y traducciones](16-internacionalizacao-traducoes.md) | Media |
| 17 | [Auditor de rendimiento, memoria y consumo de energía](17-desempenho-memoria-energia.md) | Alta |
| 18 | [Auditor de Android, compatibilidad y ciclo de vida](18-android-compatibilidade-ciclo-vida.md) | Crítica |
| 19 | [Auditor de QA, pruebas y regresión](19-qualidade-testes-regressao.md) | Crítica |
| 20 | [Auditor de arquitectura y calidad de código](20-arquitetura-qualidade-codigo.md) | Alta |
| 21 | [Auditor de CI/CD, APK y cadena de suministro](21-cicd-release-fornecimento.md) | Crítica |
| 22 | [Auditor de diseño visual, temas y documentación de uso](22-design-temas-documentacao.md) | Media |

## Orden recomendado de trabajo

**Primera pasada (código y documentación):** 00, 01, 06, 07, 09, 10, 12, 13, 14, 15, 19, 20, 21.

**Segunda pasada (UX y aparato real):** 02, 03, 04, 05, 08, 16, 17, 18, 22. El resultado de esta fase depende de un APK/entorno y de datos ficticios o autorizados.

**Cierre:** 00 integra los hallazgos, asigna responsables y hace la triaje de P0/P1. La matriz de frentes está en `MATRIZ-DE-COBERTURA.md`.

## Particularidades importantes del proyecto

- Aplicación **no oficial**, gratuita y todavía en prueba cerrada; Android es el objetivo principal, el escritorio se usa para desarrollo.
- Stack: **Rust / Tauri 2**, **Svelte 5 / SvelteKit** y **TypeScript**.
- Cuatro voces musicales, control de BPM/tono, introducción, repeticiones, última vez especial y miniplayer.
- Recursos opcionales: **sonidos grabados** y **partituras SVG**, con descarga y verificación de integridad.
- Interfaz pt/es/en, temas, preferencias locales y accesibilidad declarada.
- El repositorio declara contener **solo código y datos ficticios**; no use contenido real de himnarios como evidencia.
- La documentación registra puntos abiertos de prueba en Android y derechos sobre las partituras; considere esos ítems en los criterios de liberación, sin suponer automáticamente un defecto ni una autorización.

## Comandos de verificación existentes en el proyecto

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

**Atención:** estos son comandos encontrados en el proyecto, **no** resultados de ejecución. Algunos exigen Chrome/Chromium, Rust, las bibliotecas de Tauri, un entorno Android y dependencias instaladas.

## Pauta de conducta

Exija trazabilidad de archivo:línea o prueba, y un estado epistémicamente correcto: `Confirmado`, `Provável` (probable), `Risco a verificar` (riesgo por verificar) o `Não reproduzido` (no reproducido). **No confunda la ausencia de prueba con un error, ni lo planificado con lo entregado.** No ejecute acciones destructivas ni contacte servicios externos sin autorización. Los reportes de vulnerabilidades deben seguir `SECURITY.md` por un canal privado.

## En este repositorio

- **Quién hace esta auditoría:** el kit y las rondas se conducen con **Claude (Anthropic)**, en hasta 22 perspectivas (una por persona), con la herramienta de análisis estático **Tezcat** como entrada de apoyo. El responsable del proyecto define el alcance, decide qué aceptar, revisa y aprueba cada corrección y responde por la app. La auditoría **lee código y ejecuta pruebas**: lo que solo se prueba en un aparato Android (servicio en primer plano, WebView, audio real, lector de pantalla) queda como **riesgo por verificar** y entra en el guion de prueba manual (`docs/teste-de-uso.md`). Una auditoría hecha por IA no sustituye la prueba con personas.
- **Dónde están los perfiles:** en esta carpeta, `docs/auditoria/`. No traen versión fija: `MODELO-BRIEFING.md` se completa en cada ronda con el commit y la versión auditados.
- **Dónde están los resultados:** cada ronda se convierte en una carpeta `docs/auditoriaAAAAMM/` (`AAAA` año, `MM` mes; una segunda ronda en el mismo mes lleva `-2`), con un informe por persona, el informe del coordinador (00), el plan de ajustes y las decisiones del responsable. **Los resultados NO se versionan:** el `.gitignore` ignora `docs/auditoria[0-9]*/`, porque los informes describen riesgos de un repositorio público. Lo que el responsable quiera guardar más allá de la máquina va en `docs/privado/`, también fuera de Git.
- **El repositorio es público:** los perfiles y este README siguen la regla del kit (nada de himnos, letras, partituras ni audio reales, datos personales, tokens ni material de prueba cerrada).

## Volver a ejecutar (periodicidad)

Una ronda completa da trabajo. Sugerencia: **cada trimestre** y **antes de cada versión pública** (RC final o publicación en la tienda); una ronda **reducida** (solo las personas del área tocada) después de un cambio grande en el audio, el conversor, el release o la seguridad.

1. Copie `MODELO-BRIEFING.md` a `docs/auditoriaAAAAMM/00-briefing.md` y complete el commit, la versión y lo que cambió desde la ronda anterior.
2. (Opcional) ejecute Tezcat con el perfil `strict` y ponga el informe en `docs/auditoriaAAAAMM/` como entrada lista.
3. Ejecute `npm run check`, `npm test`, los verificadores en Python y `cargo test`, y guarde las salidas en `docs/auditoriaAAAAMM/evidencias/`.
4. Lance las personas (orden en "Orden recomendado de trabajo"), un informe cada una, sobre una copia de trabajo **de solo lectura**.
5. La persona 00 consolida: `00-coordenador-relatorio.md`, `00-plano-de-ajustes.md` y `00-decisoes-do-responsavel.md`.
6. Trate el plan en olas, **cada ola un commit y un PR**, con validación manual en el aparato para lo que el plan marque así.
