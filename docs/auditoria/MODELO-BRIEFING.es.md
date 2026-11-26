[Português](MODELO-BRIEFING.md) · [English](MODELO-BRIEFING.en.md) · **Español**

# Briefing de la ronda de auditoría AAAA-MM

> Modelo: cópielo a `docs/auditoriaAAAAMM/00-briefing.md`, complete lo que está entre `<...>` y entréguelo a **todas** las personas. Cada auditor lee, en este orden: este briefing, su perfil en `docs/auditoria/NN-*.md`, `docs/auditoria/MODELO-RELATORIO.md`, `docs/auditoria/MATRIZ-DE-COBERTURA.md` y las secciones "Regras inegociáveis" (reglas innegociables) y "Classificação padronizada" (clasificación estandarizada) de `docs/auditoria/00-coordenador-geral.md`.

## Qué se audita

- **Copia de trabajo (solo lectura):** `<ruta de la worktree>`, en `main` en el commit **`<sha>`** (app **`<versión>`**).
- **Dónde escribir:** solo **su** informe, en `<ruta absoluta>/docs/auditoriaAAAAMM/NN-<slug>-relatorio.md` (la carpeta de la ronda en el repositorio del responsable; el `<slug>` es el del nombre de su perfil). **Esa carpeta es la ÚNICA excepción a las reglas 1 y 2:** allí usted crea su informe y nada más.
- Los perfiles del kit pueden citar rutas antiguas: **confirme cada una antes de usarla** y registre lo que ya no existe.
- **Alcance de la ronda:** `<completa | reducida: personas NN, NN, NN>`.

## Qué cambió desde la ronda anterior

- `<resumen por área: qué entró, qué se corrigió, qué quedó pendiente (olas, PR, versiones candidatas)>`

Puntos de partida para leer el estado real: `README.md`, `docs/roadmap-pendencias.md`, `docs/roadmap-ideas.md`, `docs/apk-de-teste.md`, `docs/licencas-de-terceiros.md` y el plan y las decisiones de la ronda anterior.

## Entradas listas (no las rehaga)

| Archivo | Qué contiene |
|---|---|
| `docs/auditoriaAAAAMM/00-tzt-tezcat-relatorio.md` | (opcional) Tezcat con el perfil **strict**. Mide **forma**, no es un veredicto de defectos. Use solo lo que sea de su dominio. |
| `docs/auditoriaAAAAMM/evidencias/` | Salida de `npm run check`, `vitest`, los verificadores en Python y (cuando existan) `cargo test` y el e2e, ejecutados **una vez** en este commit. Cítela como evidencia. |

## Reglas de ejecución (valen por encima del perfil)

1. **No altere el código, no haga commit, no cambie de rama, no use `git stash`.** El único archivo que usted crea es su informe.
2. **No toque** la carpeta principal del responsable (salvo para crear su informe en la carpeta de la ronda, indicada arriba). Solo lea la copia de trabajo de arriba.
3. **No ejecute** el e2e, compilaciones, instalaciones, ni nada que abra puertos, use la red o descargue de servidores. Las pruebas y la compilación ya están en `evidencias/`. Se permite una verificación **corta y sin efectos secundarios** (`npx vitest run <archivo>`).
4. **Nada de contenido de terceros:** el repositorio solo tiene datos ficticios. No pegue letras, partituras ni muestras reales.
5. **El repositorio es público.** En hallazgos de seguridad, describa la **clase del problema, la evidencia y la corrección**, sin paso a paso de explotación funcional.
6. **Evidencia de verdad:** `archivo:línea` y el fragmento. Sin evidencia, el hallazgo es `Risco a verificar` (riesgo por verificar), nunca `Confirmado`. Lo que solo se prueba en un aparato Android queda como `Risco a verificar`.
7. **Sin inflar:** si no hay defecto, escriba "ningún hallazgo confirmado".
8. **Sin duplicar:** la matriz dice quién es dueño de cada área. Si el hallazgo es de otra persona, cite su ID en "Persona(s) de apoyo".
9. Escriba en **portugués**, directo, sin adornos.

## Formato del informe

El de `MODELO-RELATORIO.md`, con los hallazgos en el formato del coordinador (`[P0-P3]`, ID `AREA-001`, Estado, Confianza, Evidencia, Esperado, Observado, Impacto, **una** Recomendación, Regresión sugerida, Responsable sugerido). Termine con dos secciones:

- **Pruebas no ejecutadas:** lo que quedó por falta de aparato o de autorización.
- **Para el coordinador (00):** las 5 cosas más importantes, lo que **duplica** con otra persona y lo que **tratar primero**.

## Qué responder al final

Una respuesta corta (hasta 120 palabras): la ruta del informe, el conteo de hallazgos por P0, P1, P2 y P3, y los 3 principales.
