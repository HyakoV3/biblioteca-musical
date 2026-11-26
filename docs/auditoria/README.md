**Português** · [English](README.en.md) · [Español](README.es.md)

# Kit de personas de auditoria — Biblioteca Musical CCB

**Base examinada:** arquivo `biblioteca-musical-ccb-main.zip` fornecido pelo solicitante, versão declarada **0.3.0** (a da primeira montagem do kit; cada rodada informa a sua no briefing). Perfis elaborados a partir de código e documentação presentes no arquivo. **Este kit NÃO é uma auditoria concluída:** não contém alegações de testes executados, vulnerabilidades verificadas ou aprovação para publicação.

## Como usar

1. Os perfis `.md` ficam em `docs/auditoria/` (não os mova: os caminhos dos briefings dependem disso). Entregue a persona pertinente a cada auditor/assistente; os relatórios vão para `docs/auditoriaAAAAMM/` (ignorado pelo Git).
2. Inicie pelo **00 — Coordenador geral**, que define escopo, ambiente, prioridade e divisão sem duplicação.
3. Para cada área, entregue o respectivo `.md` como instrução de trabalho e forneça acesso **somente aos arquivos necessários**, sem credenciais ou conteúdo protegido.
4. Exija um relatório `.md` independente por persona, obedecendo ao `MODELO-RELATORIO.md`; valide evidências e consolide com o coordenador.
5. Reexecute cenários de regressão após as correções; só a equipe responsável decide se libera uma versão.

## Sumário das personas

| Nº | Persona | Prioridade |
|---|---|---|
| 00 | [Coordenador geral de auditoria](00-coordenador-geral.md) | Transversal |
| 01 | [Auditor de produto, requisitos e escopo](01-produto-requisitos.md) | Alta |
| 02 | [Auditor na persona do músico iniciante](02-usuario-musico-iniciante.md) | Alta |
| 03 | [Auditor na persona do músico experiente](03-usuario-musico-experiente.md) | Alta |
| 04 | [Auditor UX, UI e navegação mobile](04-ux-navegacao-mobile.md) | Alta |
| 05 | [Auditor de acessibilidade e inclusão](05-acessibilidade-inclusao.md) | Crítica |
| 06 | [Auditor de teoria musical, andamento e repetições](06-teoria-musical-repeticoes.md) | Crítica |
| 07 | [Auditor do motor de reprodução e sincronismo](07-motor-reproducao.md) | Crítica |
| 08 | [Auditor de áudio, timbres e quatro vozes](08-audio-timbres-quatro-vozes.md) | Alta |
| 09 | [Auditor de letra, estrofes e karaokê](09-letra-karaoke.md) | Alta |
| 10 | [Auditor de partituras SVG e visualização](10-partituras-svg.md) | Crítica |
| 11 | [Auditor do conversor MuseScore → JSON](11-conversor-musescore.md) | Alta |
| 12 | [Auditor de importação, validação e persistência](12-importacao-dados-persistencia.md) | Crítica |
| 13 | [Auditor de downloads, integridade e operação offline](13-pacotes-download-offline.md) | Crítica |
| 14 | [Auditor de segurança da aplicação Tauri](14-seguranca-app-tauri.md) | Crítica |
| 15 | [Auditor de privacidade, direitos autorais e licenças](15-privacidade-direitos-licencas.md) | Crítica |
| 16 | [Auditor de internacionalização e traduções](16-internacionalizacao-traducoes.md) | Média |
| 17 | [Auditor de desempenho, memória e consumo de energia](17-desempenho-memoria-energia.md) | Alta |
| 18 | [Auditor Android, compatibilidade e ciclo de vida](18-android-compatibilidade-ciclo-vida.md) | Crítica |
| 19 | [Auditor de QA, testes e regressão](19-qualidade-testes-regressao.md) | Crítica |
| 20 | [Auditor de arquitetura e qualidade de código](20-arquitetura-qualidade-codigo.md) | Alta |
| 21 | [Auditor de CI/CD, APK e cadeia de fornecimento](21-cicd-release-fornecimento.md) | Crítica |
| 22 | [Auditor de design visual, temas e documentação de uso](22-design-temas-documentacao.md) | Média |

## Ordem recomendada de trabalho

**Primeira passagem (código e documentação):** 00, 01, 06, 07, 09, 10, 11, 12, 13, 14, 15, 19, 20, 21.

**Segunda passagem (UX e aparelho real):** 02, 03, 04, 05, 08, 16, 17, 18, 22. O resultado desta fase depende de APK/ambiente e dados fictícios ou autorizados.

**Fechamento:** 00 integra achados, atribui responsáveis e faz triagem de P0/P1. A matriz de frentes está em `MATRIZ-DE-COBERTURA.md`.

## Particularidades importantes do projeto

- Aplicativo **não oficial**, gratuito e ainda em teste fechado; Android é o alvo principal, desktop é usado para desenvolvimento.
- Stack: **Rust / Tauri 2**, **Svelte 5 / SvelteKit** e **TypeScript**.
- Quatro vozes musicais, controle de BPM/tom, introdução, repetições, última vez especial e mini-player.
- Recursos opcionais: **sons gravados** e **partituras SVG**, com download e conferência de integridade.
- Interface pt/es/en, temas, preferências locais e acessibilidade declarada.
- O repositório declara conter **somente código e dados fictícios**; não usar conteúdo real de hinários nas evidências.
- A documentação registra pontos em aberto de teste em Android e direitos sobre partituras; considerar tais itens nos critérios de liberação, sem assumir automaticamente defeito ou autorização.

## Comandos de verificação existentes no projeto

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

**Atenção:** estes são comandos encontrados no projeto, **não** resultados de execução. Alguns exigem Chrome/Chromium, Rust, bibliotecas do Tauri, ambiente Android e dependências instaladas.

## Padrão de conduta

Exija rastreabilidade de arquivo:linha ou teste e status epistemicamente correto: `Confirmado`, `Provável`, `Risco a verificar` ou `Não reproduzido`. **Não confunda ausência de teste com bug, nem planejado com entregue**. Não execute ações destrutivas ou contate serviços externos sem autorização. Relatos de vulnerabilidade devem seguir `SECURITY.md` por canal privado.

## Neste repositório

- **Quem faz esta auditoria:** o kit e as rodadas são conduzidos com o **Claude (Anthropic)**, em 23 perspectivas (22 especialistas e o coordenador 00), com a ferramenta de análise estática **Tezcat** como entrada de apoio. O responsável do projeto define o escopo, decide o que aceitar, revisa e aprova cada correção e responde pelo app. A auditoria **lê código e roda testes**: o que só se prova num aparelho Android (serviço em primeiro plano, WebView, áudio real, leitor de tela) fica como **risco a verificar** e entra no roteiro de teste manual (`docs/teste-de-uso.md`). Auditoria feita por IA não substitui o teste com pessoas.
- **Onde ficam os perfis:** nesta pasta, `docs/auditoria/`. Eles não trazem versão fixa: o `MODELO-BRIEFING.md` é preenchido a cada rodada com o commit e a versão auditados.
- **Onde ficam os resultados:** cada rodada vira uma pasta `docs/auditoriaAAAAMM/` (`AAAA` ano, `MM` mês; uma segunda rodada no mesmo mês leva `-2`), com um relatório por persona, o relatório do coordenador (00), o plano de ajustes e as decisões do responsável. **Os resultados NÃO são versionados:** o `.gitignore` ignora `docs/auditoria[0-9]*/`, porque os relatórios descrevem riscos de um repositório público. O que o responsável quiser guardar além da máquina fica em `docs/privado/`, também fora do Git.
- **O repositório é público:** os perfis e este README seguem a regra do kit (nada de hino, letra, partitura ou áudio reais, dados pessoais, tokens ou material de teste fechado).

## Rodar de novo (periodicidade)

Uma rodada completa dá trabalho. Sugestão: **a cada trimestre** e **antes de cada versão pública** (RC final ou publicação na loja); uma rodada **reduzida** (só as personas da área mexida) depois de uma mudança grande no áudio, no conversor, no release ou na segurança.

1. Copie `MODELO-BRIEFING.md` para `docs/auditoriaAAAAMM/00-briefing.md` e preencha o commit, a versão e o que mudou desde a rodada anterior.
2. (Opcional) rode o Tezcat no perfil `strict` e ponha o relatório em `docs/auditoriaAAAAMM/` como entrada pronta.
3. Rode `npm run check`, `npm test`, os verificadores em Python e `cargo test`, e guarde as saídas em `docs/auditoriaAAAAMM/evidencias/`.
4. Dispare as personas (ordem de "Ordem recomendada de trabalho"), uma por relatório, em cópia de trabalho **somente leitura**.
5. A persona 00 consolida: `00-coordenador-relatorio.md`, `00-plano-de-ajustes.md` e `00-decisoes-do-responsavel.md`.
6. Trate o plano em ondas, **cada onda um commit e uma PR**, com validação manual no aparelho para o que o plano marcar assim.
