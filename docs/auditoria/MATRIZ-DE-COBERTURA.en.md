[Português](MATRIZ-DE-COBERTURA.md) · **English** · [Español](MATRIZ-DE-COBERTURA.es.md)

# Coverage matrix and distribution of fronts

The matrix prevents different personas from opening the **same defect** under different titles. The persona named as **owner** consolidates the technical finding; the others add impact and scenarios.

| Area | Owner | Support | Minimum evidence |
|---|---|---|---|
| Requirements and delivery stage | 01 | 00, 22 | requirement + implementation + documented status |
| Discovery and learning of the app | 02 | 01, 04 | task + user observation or identified heuristic |
| Part-by-part practice flow | 03 | 06, 08 | musical scenario + audible result |
| Navigation and UI states | 04 | 02, 05 | route + action + screenshot/DOM |
| Screen reader and inclusion | 05 | 04, 22 | element + assistive technology + impact |
| Musical structure | 06 | 03, 07, 11 | fixture + musical rule + difference |
| Timing and seek | 07 | 06, 09 | timeline/state + steps + logs/test |
| Sound, synthesis and samples | 08 | 03, 13 | output + note/voice + result |
| Lyrics and karaoke | 09 | 05, 07 | beat + stanza/line/syllable + playback |
| Score display | 10 | 05, 06, 14 | fictional SVG + orientation + result |
| MuseScore conversion | 11 | 06, 12 | fictional MSCX input + expected/actual JSON |
| Import and persistence | 12 | 14, 18 | synthetic input + state before/after |
| Optional offline packages | 13 | 08, 10, 18 | manifest + network/cache + result |
| Application security | 14 | 12, 13, 21 | chain of input → control → impact |
| Privacy, content and rights | 15 | 01, 21 | provable license/authorization + context |
| i18n and translations | 16 | 05, 22 | language + key + visible context |
| Performance | 17 | 07, 13, 18 | device + baseline + measurements |
| Android and lifecycle | 18 | 04, 13, 17 | build + device + reproducible sequence |
| Automation/regression | 19 | All | command/test + output + coverage gap |
| Code quality | 20 | 07, 12, 14 | dependencies and concrete consequence |
| CI/CD and APK | 21 | 14, 15, 19 | workflow + commit + artifact or gap |
| Design and documentation | 22 | 04, 05, 16 | token/screen/doc + divergence |

## Escalation criteria

- **P0/P1:** the coordinator (00) immediately assesses whether the flow/version is blocked.
- **Security:** report through the private channel in `SECURITY.md`, without disclosing the exploit.
- **Content authorization:** involve the owner and legal counsel; do not distribute a real sample for testing.
- **Device-dependent:** leave as `Risco a verificar` until it is run on a suitable Android device.
- **Planned pending item:** record as a future requirement, not a defect.

## Deliverables of the round

1. An independent report per persona.
2. Inventory of risks and tests not run.
3. Deduplicated P0–P3 backlog and regression plan.
4. A reasoned decision of accept, conditional accept, reject or inconclusive.
