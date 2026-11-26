**Português** · [English](CONTRIBUTING.en.md) · [Español](CONTRIBUTING.es.md)

# Como contribuir

Obrigado por querer ajudar. O projeto é pequeno, em português, e está em **teste fechado** com músicos (versão 0.3.x). Antes de abrir uma
*pull request*, leia o [`README.md`](README.md) (o que o app é) e a seção "Desenvolvimento" dele (como rodar).

## Regra de ouro: nada de hinário no Git

Este repositório tem **só código** e dados de teste **fictícios** (`src-tauri/exemplo/`, `tools/mscx2json/tests/fixtures/`, `tests/amostras.ts`).
**Nunca** inclua letras, partituras, áudios ou arquivos `.mscx` de hinos reais, nem capturas de tela com eles: o conteúdo é de terceiros e só
circula com autorização. Conteúdo local fica em `content/` e `docs/privado/`, que o `.gitignore` já ignora. Não coloque no Git chaves, senhas,
keystores nem endereços internos (`docs/apk-de-teste.md` explica como o APK de teste é assinado, sem guardar a chave).

## Antes de abrir a PR

Rode o que o CI roda (só dados fictícios; nada precisa de conteúdo real):

```bash
npm ci                              # (ou npm install)
npm run check                       # tipos (svelte-check, inclui tests/)
npm test                            # testes da lógica (Vitest)
python3 tools/verificar-traducoes.py
python3 tools/verificar-movimento.py
python3 tools/contraste.py
python3 -m pytest tools             # os testes das ferramentas em Python (o gerador de ícone usa o Pillow; use um ambiente virtual)
npm run test:e2e                    # karaokê num Chrome de verdade (precisa de Chrome ou Chromium)
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test    # em tools/mscx2json
npm run build                       # o Tauri exige a pasta build/ para compilar o src-tauri
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib   # em src-tauri (no Linux, com as bibliotecas do Tauri)
```

O teste de ponta a ponta do Gravador já falhou de vez em quando no CI sem erro na tela (ver [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md));
se o job "Karaokê num Chrome de verdade" cair numa PR que não mexe nisso, rode-o de novo antes de procurar o defeito.

O CI (`.github/workflows/ci.yml`) tem **4 verificações obrigatórias** para entrar na `main`: **App** (tipos, testes e verificadores),
**Conversor de partituras (Rust)**, **Leitor do hinário (Rust, src-tauri)** e **Karaokê num Chrome de verdade**. A `main` é protegida: toda
mudança entra por PR, sem *push* direto.

## O que a PR precisa ter

- **Uma coisa por PR**, com título e descrição que digam o que mudou e **como conferir** (no aparelho, quando for o caso).
- **Testes** para a lógica nova (Vitest em `tests/`, Rust ao lado do código). Um bug corrigido ganha o teste que o pegaria.
- **Textos da interface nos três idiomas** (português, inglês e espanhol, em `src/lib/i18n/`): o `npm run check` e o verificador de traduções
  acusam chave faltando. Ver [`docs/TRADUCOES.md`](docs/TRADUCOES.md).
- **Acessibilidade e aparência:** alvos de toque de pelo menos 44 px, contraste conferido nos temas (inclusive Alto contraste), estado nunca só
  por cor e respeito a "reduzir movimento". Ver [`docs/design-tokens.md`](docs/design-tokens.md).
- **Documentação em dia:** se a mudança altera o que o app faz, ajuste o `README.md` e a doc do assunto em `docs/`. Ideia implementada sai de
  [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) para [`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md), e o
  que ficou pendente vai para [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md).
- **Pacotes baixáveis:** se mexer no formato do hinário, nas partituras ou nos sons, siga [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md),
  [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) e [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md). No hinário e nas partituras, um pacote **publicado
  nunca muda de conteúdo**: sobe-se um arquivo com nome novo (o nome leva o início do SHA-256) e refaz-se o manifesto. Os sons gravados seguem a
  regra de [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md) (nomes fixos por instrumento). Antes de colocar um arquivo numa pasta de link do
  servidor, confira que o zip da pasta fica abaixo do teto de download do app (ver [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md), seção 8).

## Revisão

Cada PR do próprio repositório recebe uma **revisão automática** (o job `review`, que comenta no código quando a PR é aberta) e, a cada novo
*push*, um job que ajuda a resolver as conversas (`resolve`). Comentários válidos são corrigidos na mesma branch; os que não procedem recebem uma resposta explicando. Esses dois jobs
dependem de uma chave externa: em PRs vindas de *fork* eles não rodam ou falham por falta dela, e podem falhar também sem relação com o seu
código. Eles **não bloqueiam o *merge***: só as 4 verificações do CI bloqueiam.

## Commits

Seguimos **Conventional Commits** a partir de 2026-11-24: `tipo(escopo): resumo`, em português, com `feat`, `fix`, `docs`, `chore`, `ci`, `build`, `refactor`, `test` ou `perf`, e `!` depois do tipo numa mudança incompatível (ex.: `feat(sons): baixar do GitHub Release`, `ci(release): conferir permissões do APK`). O título da PR segue o mesmo formato (o merge é *squash*, então ele vira o commit). Dizer o **porquê** quando não for óbvio. Commits pequenos e coerentes valem
mais que um grande. Sem atribuição automática de ferramentas nos commits e nas PRs deste repositório.

## Relatar problemas

Bug ou ideia: abra uma *issue* descrevendo o que você esperava e o que aconteceu (versão e commit aparecem no fim da tela **Ajustes**). **Falha de
segurança:** não abra *issue* pública, siga o [`SECURITY.md`](SECURITY.md).

## Licença

Ao contribuir, você concorda que o seu código fica sob a [licença MIT](LICENSE) do projeto. A licença não vale para conteúdo de hinários.
