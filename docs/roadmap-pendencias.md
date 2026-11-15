# Pendências fora do produto

O que falta além das funções do app: publicação, automação (CI/CD), revisão de código e testes. As etapas do produto
estão em [`roadmap-fase-2.md`](roadmap-fase-2.md); as ideias, em [`roadmap-ideas.md`](roadmap-ideas.md).

Legenda: `[x]` feito · `[ ]` a fazer · **(depende de ...)** o que bloqueia o item.

---

## 1. Publicação no GitHub

- [x] Repositório **público** criado em 2026-11-14: <https://github.com/HyakoV3/biblioteca-musical-ccb>. Um só e-mail de autor (o `noreply` do GitHub) e sem co-autoria.
- [ ] Proteções: bloquear exclusão e *force-push* da `main`; ativar *secret scanning* e *push protection*;
      Dependabot (npm, cargo e GitHub Actions).
- [ ] Arquivos da comunidade: `CONTRIBUTING.md`, `SECURITY.md`, modelos de *issue* e de *pull request*.
- [ ] Descrição, tópicos e imagem de pré-visualização do repositório.
- [ ] **Regra de ouro:** nada sensível no Git. Conteúdo de hinários e notas locais ficam fora do Git (`content/` e `docs/privado/`, no `.gitignore`).

## 2. CI/CD (GitHub Actions)

- [x] **CI** (`.github/workflows/ci.yml`), a cada *pull request*, a cada *push* na `main` e sob demanda, com cache de npm e
      de cargo. Quatro tarefas: **App** (`npm run check`, `npm test` e os verificadores de tradução, movimento e
      contraste); **Conversor** (`cargo test` em `tools/mscx2json`); **Leitor** (`cargo test --lib` em `src-tauri`, com as
      bibliotecas do Tauri instaladas no Ubuntu 24.04); **Karaokê num Chrome de verdade** (`npm run test:e2e`).
- [ ] **Limpeza do Rust para ligar mais verificações no CI.** Hoje `cargo fmt --check` e `cargo clippy -- -D warnings`
      **falham** no conversor (formatação do `main.rs` e duas sugestões do clippy sobre `if` que podem ser juntados),
      então ficaram de fora do CI para ele não nascer vermelho. Formatar e corrigir num PR à parte, e depois ligar os dois.
- [ ] Se o teste de ponta a ponta ficar lento ou instável, restringi-lo à `main` e ao disparo manual.
- [ ] **APK no GitHub, sob demanda e em release (tag `v*`):** rascunho em
      [`release-e-apk-no-github.md`](release-e-apk-no-github.md), para revisar antes de construir.
- [ ] **APK de teste no GitHub** (Android): JDK 21, SDK e NDK, `npm run tauri android build -- --apk --target aarch64`,
      APK como artefato do *workflow*.
      **Sem conteúdo embutido:** o `BMCCB_PACOTE` (hinos de terceiros) nunca entra no CI nem em *release* público. Só o
      APK de teste fechado, gerado na máquina do responsável, leva conteúdo (`apk-de-teste.md`).
- [ ] **Assinatura:** criar uma chave **própria** (a de depuração só serve para teste fechado) e guardá-la como segredo
      do GitHub (keystore em base64 e senhas). *Release* assinado só em tag `v*`, publicado em *GitHub Releases* com o
      SHA-256. **(depende do responsável: criar e guardar a chave)**
- [ ] Conferir que versão e commit (`__APP_VERSAO__`, `__APP_COMMIT__`) aparecem certos no APK do CI.
- [ ] **iOS:** o GitHub tem máquinas macOS (de graça em repositório público), então o CI consegue **compilar** o app
      iOS sem Mac. Mas **instalar** em iPhone, usar o TestFlight ou publicar na App Store exige uma conta do
      **Apple Developer Program** (cerca de US$ 99 por ano), com certificado e perfil de provisionamento guardados como
      segredos. Sem a conta, só sai build de simulador. Decidir entre iOS e uma versão web instalável (PWA); com PWA, a
      página sai pelo GitHub Pages. Se virar PWA, sincronizar o **modo e o estilo de cor entre abas** (evento `storage`):
      no app Tauri, de janela única, isso não se aplica (revisão do vandame no PR dos estilos, a reavaliar nessa hora). **(depende do responsável)**

## 3. Revisão de código

O **vandame** é um aplicativo do GitHub (`vandame-bot`) que posta as revisões, junto com o `claude-code-action`. É o
mesmo conjunto de fluxos que o responsável já usa em outros projetos.

- [x] **Fluxos trazidos** (`.github/workflows/`): `claude-code-review.yml` revisa cada *pull request* novo, com um
      comentário por problema, linha a linha e com sugestões que o GitHub aplica no botão "Commit suggestion";
      `claude-resolve-threads.yml`, a cada *push* no PR, confere se os pedidos do vandame-bot foram atendidos e resolve
      essas conversas. Nenhum deles tem nada específico de outro projeto.
- [ ] **Para funcionar neste repositório, só o responsável pode fazer:**
      1. cadastrar os segredos `VANDAME_APP_ID`, `VANDAME_APP_PRIVATE_KEY` e `CLAUDE_CODE_OAUTH_TOKEN_ENTERPRISE`
         (Settings, Secrets and variables, Actions);
      2. instalar o aplicativo vandame neste repositório (Settings, Applications, vandame, Configure, Repository access).
      Fazer as duas coisas **antes do primeiro pull request**: sem os segredos o job de revisão falha.
- [ ] A revisão só roda em **pull requests**. Para ter revisão, o fluxo passa a ser ramo, PR em rascunho e *merge*, em
      vez de enviar direto para a `main`.
- [ ] Repositório público: os fluxos rodam em `pull_request`, então PRs de *forks* não recebem os segredos, e o de
      resolver conversas só roda em PR do próprio repositório. Ativar também "exigir aprovação para primeiros
      colaboradores" nas configurações de Actions.
- [ ] Pontos que a revisão deve cobrir neste projeto: segurança (rede só para o servidor de sons, conferência de
      SHA-256), acessibilidade (alvos de 48 px, contraste, movimento reduzido) e dados de terceiros fora do Git.
      O pedido padrão do fluxo é genérico; dá para acrescentar esses pontos ao texto dele.

## 4. Testes automatizados

- [x] **Testes do app no repositório** (`tests/`, executor Vitest): `npm test`. 48 testes em 7 arquivos, só com dados
      **fictícios** (`tests/amostras.ts`; nenhum hino real entra no Git): partes e vezes do hino (introdução, final,
      pausas), sintetizador (reagendar na pausa, tempo audível), karaokê (validação e escolha da sílaba), pacote de
      sons (zips sintéticos adulterados, truncados e "bomba"), catálogo de sons gravados x manifesto, número do hino e
      preferências. Os tipos dos testes passam por `npm run check`.
- [x] Regressão do `smplr`: `parar()` tem de esvaziar a fila do agendador (`tests/sintetizador.test.ts`). Conferido: sem
      a correção, o teste falha.
- [x] **Ponta a ponta do karaokê** (`npm run test:e2e`, `tests/e2e/karaoke.mjs`): sobe o Vite e um Chrome mudo, entrega
      um hino fictício por um `invoke` simulado do Tauri e confere sílaba, estrofe, tempo, pausa e o botão. Precisa de
      Chrome ou Chromium (variável `CHROME` indica o executável) e não sobra processo nem pasta temporária.
- [x] O conversor `tools/mscx2json` tem testes em Rust, dentro do repositório (`cargo test`), e o leitor do app também
      (`cargo test --lib` em `src-tauri`).
- [x] Tudo isso roda no **CI** (seção 2), inclusive o teste de ponta a ponta.
- [ ] Testes de componentes Svelte e do store (`reproducao.svelte.ts`), que dependem do compilador do Svelte no
      Vitest: ficam de fora por enquanto (a lógica pura já está coberta).

## 5. Ambiente de teste (emulador)

- [ ] O emulador mostra diálogos de "não está respondendo". Investigação de 2026-11-14 (só leitura): o log do sistema
      **não tem nenhum ANR do nosso app**; o DropBox do Android tem só 8 quedas nativas desde as 16h, **todas da
      pilha de Bluetooth do emulador**; o app instalado ali é uma compilação de **depuração x86_64 de 201 MB** (a do
      `tauri android dev`), bem mais pesada que o APK de teste de ~10 MB; a imagem é Android 17 com 4 GB de RAM.
      Para melhorar: testar com uma compilação de release para x86_64, aumentar a memória do emulador, e preferir uma
      imagem sem Play Store. Falta o texto exato do diálogo e de qual app ele vem. **(depende do responsável)**

## 6. Produto (resumo)

Feito: **karaokê, fase A** (a letra acompanhando a música), a validar no celular. Depois: créditos do
FluidR3, teste das 4 vozes gravadas no celular, partitura (I-08) e, por último, o conteúdo completo. Detalhes em
[`roadmap-fase-2.md`](roadmap-fase-2.md).
