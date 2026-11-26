**Português** · [English](MODELO-BRIEFING.en.md) · [Español](MODELO-BRIEFING.es.md)

# Briefing da rodada de auditoria AAAA-MM

> Modelo: copie para `docs/auditoriaAAAAMM/00-briefing.md`, preencha o que está entre `<...>` e entregue a **todas** as personas. Cada auditor lê, nesta ordem: este briefing, o seu perfil em `docs/auditoria/NN-*.md`, `docs/auditoria/MODELO-RELATORIO.md`, `docs/auditoria/MATRIZ-DE-COBERTURA.md` e as seções "Regras inegociáveis" e "Classificação padronizada" de `docs/auditoria/00-coordenador-geral.md`.

## O que se audita

- **Cópia de trabalho (somente leitura):** `<caminho da worktree>`, na `main` no commit **`<sha>`** (app **`<versão>`**).
- **Onde escrever:** só o **seu** relatório, em `<caminho absoluto>/docs/auditoriaAAAAMM/NN-<slug>-relatorio.md` (a pasta da rodada no repositório do responsável; o `<slug>` é o do nome do seu perfil). **Essa pasta é a ÚNICA exceção às regras 1 e 2:** nela você cria o seu relatório e mais nada.
- Os perfis do kit podem citar caminhos antigos: **confirme cada um antes de usar** e registre o que não existe mais.
- **Escopo da rodada:** `<completa | reduzida: personas NN, NN, NN>`.

## O que mudou desde a rodada anterior

- `<resumo por área: o que entrou, o que foi corrigido, o que ficou como pendência (ondas, PRs, versões candidatas)>`

Pontos de partida para ler o estado real: `README.md`, `docs/roadmap-pendencias.md`, `docs/roadmap-ideas.md`, `docs/apk-de-teste.md`, `docs/licencas-de-terceiros.md` e o plano e as decisões da rodada anterior.

## Entradas prontas (não refaça)

| Arquivo | O que tem |
|---|---|
| `docs/auditoriaAAAAMM/00-tzt-tezcat-relatorio.md` | (opcional) Tezcat no perfil **strict**. Mede **forma**, não é veredito de defeito. Use só o que for do seu domínio. |
| `docs/auditoriaAAAAMM/evidencias/` | Saída de `npm run check`, `vitest`, dos verificadores em Python e (quando existirem) do `cargo test` e do e2e, rodados **uma vez** neste commit. Cite como evidência. |

## Regras de execução (valem acima do perfil)

1. **Não altere o código, não faça commit, não troque de branch, não use `git stash`.** O único arquivo que você cria é o seu relatório.
2. **Não toque** na pasta principal do responsável (exceto criar o seu relatório na pasta da rodada, indicada acima). Só leia a cópia de trabalho acima.
3. **Não rode** o e2e, builds, instalações, nem nada que abra portas, use a rede ou baixe de servidores. Os testes e o build já estão em `evidencias/`. Uma verificação **curta e sem efeito colateral** (`npx vitest run <arquivo>`) é permitida.
4. **Nada de conteúdo de terceiros:** o repositório só tem dados fictícios. Não cole letra, partitura ou amostra real.
5. **O repositório é público.** Em achados de segurança, descreva a **classe do problema, a evidência e a correção**, sem passo a passo de exploração funcional.
6. **Evidência de verdade:** `arquivo:linha` e o trecho. Sem evidência, o achado é `Risco a verificar` (nunca `Confirmado`). O que só se prova num aparelho Android fica como `Risco a verificar`.
7. **Sem inflar:** se não há defeito, escreva "nenhum achado confirmado".
8. **Sem duplicar:** a matriz diz quem é dono de cada área. Se o achado é de outra persona, cite o ID dela em "Persona(s) de apoio".
9. Escreva em **português**, direto, sem enfeite.

## Formato do relatório

O de `MODELO-RELATORIO.md`, com os achados no formato do coordenador (`[P0-P3]`, ID `AREA-001`, Status, Confiança, Evidência, Esperado, Observado, Impacto, **uma** Recomendação, Regressão sugerida, Responsável sugerido). Termine com duas seções:

- **Testes não executados:** o que ficou por falta de aparelho ou de autorização.
- **Para o coordenador (00):** as 5 coisas mais importantes, o que **duplica** com outra persona e o que **tratar primeiro**.

## O que responder ao final

Uma resposta curta (até 120 palavras): o caminho do relatório, a contagem de achados por P0, P1, P2 e P3, e os 3 principais.
