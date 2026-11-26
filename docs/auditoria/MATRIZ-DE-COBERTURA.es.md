[Português](MATRIZ-DE-COBERTURA.md) · [English](MATRIZ-DE-COBERTURA.en.md) · **Español**

# Matriz de cobertura y distribución de los frentes

La matriz evita que distintas personas abran el **mismo defecto** con títulos diferentes. La persona indicada como **dueña** consolida el hallazgo técnico; las demás añaden impacto y escenarios.

| Área | Dueña | Apoyo | Evidencia mínima |
|---|---|---|---|
| Requisitos y etapa de entrega | 01 | 00, 22 | requisito + implementación + situación documentada |
| Descubrimiento y aprendizaje de la app | 02 | 01, 04 | tarea + observación de usuario o heurística identificada |
| Flujo de práctica por voz | 03 | 06, 08 | escenario musical + resultado audible |
| Navegación y estados de la UI | 04 | 02, 05 | ruta + acción + captura/DOM |
| Lector de pantalla e inclusión | 05 | 04, 22 | elemento + tecnología asistiva + impacto |
| Estructura musical | 06 | 03, 07, 11 | fixture + regla musical + diferencia |
| Temporización y seek | 07 | 06, 09 | línea de tiempo/estado + pasos + logs/prueba |
| Sonido, síntesis y samples | 08 | 03, 13 | salida + nota/voz + resultado |
| Letra y karaoke | 09 | 05, 07 | tiempo + estrofa/línea/sílaba + reproducción |
| Visualización de partituras | 10 | 05, 06, 14 | SVG ficticio + orientación + resultado |
| Conversión MuseScore | 11 | 06, 12 | entrada MSCX ficticia + JSON esperado/real |
| Importación y persistencia | 12 | 14, 18 | entrada sintética + estado antes/después |
| Paquetes opcionales sin conexión | 13 | 08, 10, 18 | manifiesto + red/caché + resultado |
| Seguridad de la aplicación | 14 | 12, 13, 21 | cadena de entrada → control → impacto |
| Privacidad, contenido y derechos | 15 | 01, 21 | licencia/autorización demostrable + contexto |
| i18n y traducciones | 16 | 05, 22 | idioma + clave + contexto visible |
| Rendimiento | 17 | 07, 13, 18 | dispositivo + línea base + mediciones |
| Android y ciclo de vida | 18 | 04, 13, 17 | build + aparato + secuencia reproducible |
| Automatización/regresión | 19 | Todas | comando/prueba + salida + brecha de cobertura |
| Calidad de código | 20 | 07, 12, 14 | dependencias y consecuencia concreta |
| CI/CD y APK | 21 | 14, 15, 19 | workflow + commit + artefacto o brecha |
| Diseño y documentación | 22 | 04, 05, 16 | token/pantalla/doc + divergencia |

## Criterio de escalamiento

- **P0/P1:** el coordinador (00) evalúa de inmediato el bloqueo del flujo/versión.
- **Seguridad:** reportar por el canal privado de `SECURITY.md`, sin divulgar la explotación.
- **Autorización de contenido:** involucrar al responsable y a lo jurídico; no distribuir una muestra real para probar.
- **Dependiente de aparato:** dejar como `Risco a verificar` hasta ejecutarlo en un Android apropiado.
- **Pendiente planificado:** registrar como requisito futuro, no como defecto.

## Entregables de la ronda

1. Informe independiente por persona.
2. Inventario de riesgos y pruebas no ejecutadas.
3. Backlog deduplicado P0–P3 y plan de regresión.
4. Decisión fundamentada de aceptación, aceptación condicionada, rechazo o no concluyente.
