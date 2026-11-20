# Pendências fora do produto

O que falta além das funções do app: publicação, automação (CI/CD), revisão de código e testes. As etapas do produto
estão em [`roadmap-fase-2.md`](roadmap-fase-2.md); as ideias abertas, em [`roadmap-ideas.md`](roadmap-ideas.md); as já implementadas, no sumário
[`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md).

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
- [x] **Limpeza do Rust e verificações no CI** (2026-11-15). O conversor e o `src-tauri` foram formatados (`cargo fmt`), as
      duas sugestões do clippy sobre `if` juntáveis foram aplicadas, e o CI agora roda `cargo fmt --check` e
      `cargo clippy --all-targets -- -D warnings` nos dois. Se uma versão nova do Rust trouxer um aviso novo do clippy, o CI
      vermelho é esperado: corrija o aviso (ou, se for falso positivo, silencie-o no ponto exato com `#[allow(...)]`).
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
      1. cadastrar os segredos `VANDAME_APP_ID`, `VANDAME_APP_PRIVATE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN_ENTERPRISE` e
         `CLAUDE_CODE_OAUTH_TOKEN_PESSOAL` (Settings, Secrets and variables, Actions). Os fluxos tentam primeiro o token
         *enterprise* e, se esse passo falhar, repetem com o *pessoal*;
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

- [x] **Testes do app no repositório** (`tests/`, executor Vitest): `npm test`. 95 testes em 12 arquivos, só com dados
      **fictícios** (`tests/amostras.ts`; nenhum hino real entra no Git): partes e vezes do hino (introdução, final,
      pausas), sintetizador (reagendar na pausa, tempo audível, filtro de abertura dos metais, uma onda por altura),
      timbres por altura (interpolação das medidas, volume preservado; `tests/timbres.test.ts`), karaokê (validação e escolha da sílaba), pacote de
      sons (zips sintéticos adulterados, truncados e "bomba"), catálogo de sons gravados x manifesto, número do hino e
      preferências, créditos e licenças, tamanho e alinhamento da letra e a tradução dos erros do Rust. Os tipos dos testes
      passam por `npm run check`.
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

Feito: **karaokê, fase A** (a letra acompanhando a música), os **timbres sintetizados** (I-15), a **troca dos sons
gravados para o GeneralUser GS**, os **créditos e licenças** em Ajustes e o teste das 4 vozes gravadas no celular. Depois:
partitura (I-08) e, por último, o conteúdo completo. Detalhes em
[`roadmap-fase-2.md`](roadmap-fase-2.md).

## 7. Pendências vindas das ideias já implementadas

O que ficou em aberto **dentro** de ideias concluídas (a ideia em si está em [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md)).
Quase tudo é **ver no celular** ou depende de uma resposta do responsável.

- [ ] **I-01 (passada do final):** ouvir o hino 457 (final e introdução) e conferir. Outras estruturas (três casas de volta, D.C.,
      coda) caem em "estrutura não reconhecida" e **precisam de amostra real**. A ligadura que atravessa o corte entre
      passadas não é tratada. Confirmar o que o `*` marca no hinário impresso. **(depende do responsável)**
- [ ] **I-02 e I-14 (estilos de cor):** ver no celular; o quanto o pergaminho é amarelado e os nomes nos três idiomas.
- [ ] **I-04 (letra):** ver no celular; o **justificado com hinos reais** (abre espaços largos nos versos que quebram); alinhamento
      à direita para idiomas da direita para a esquerda (hoje não tratado). Ver também a I-19 (organização da letra), em
      [`roadmap-ideas.md`](roadmap-ideas.md).
- [ ] **I-05 (correções da letra):** escrever o `correcoes.json` dos hinos reais conforme os defeitos aparecem (o documento
      [`correcoes-da-letra.md`](correcoes-da-letra.md) explica); o **hino 283** (versos colados) precisa da **foto do impresso**
      para saber onde quebrar; decidir se vale uma ferramenta que liste os suspeitos (hoje: `aspell -l pt_BR list` e a comparação
      com o impresso). **(depende do responsável)**
- [ ] **I-06 (alto contraste):** ver no celular (Ajustes → Aparência → Alto contraste, com a fonte do sistema grande); **revisão por
      uma pessoa com baixa visão** antes de dar como pronto (cor, espessuras, o grupo Estilo desativado); decidir a **segunda etapa**:
      o Automático seguir `prefers-contrast: more` (depende de a WebView repassar a preferência) e a versão invertida (amarelo sobre preto).
      **(depende do responsável)**
- [ ] **I-07 (sons gravados):** hospedar também no **GitHub Releases** (hoje o pacote está no File Browser do responsável, com
      limite de banda de ~500 KB/s); **flugelhorn e bombardino gravados** (nenhum banco livre tem os dois: hoje só sintetizados);
      registrar o teste de baixar, instalar e remover o pacote (o uso nos zips 004 a 012 é a evidência, sem roteiro).
- [ ] **I-09 e I-10 (partes e pausa):** ver no aparelho; trocar o **instrumento com a música tocando** (hoje os controles ficam
      travados): decisão do responsável.
- [ ] **I-12 (karaokê, fase A):** ver no aparelho; **mudar o andamento na pausa** mantendo o lugar do destaque não tem teste
      automatizado. A fase B (partitura) está feita (ver I-12 fase B e I-26 abaixo).
- [ ] **I-15 (timbres):** ouvir os sintéticos novos de **flauta doce, violino, clarinete, viola, violoncelo, contrabaixo e trompa** e
      dizer se algum ficou fraco; o teste cego com o gravado (critério de aceitação) não foi feito; **4 vozes de metal ao mesmo
      tempo no celular** (custo de um filtro a mais por nota).
- [ ] **I-21 (slider do miniplayer em cima):** ver no celular: se o **polegar cobre o tempo** ("0:42 / 3:10", que fica na linha de
      baixo) durante o arrasto; se **rolar a página perto do miniplayer** não dispara a busca sem querer; e se o slider ficou
      **bem distinto das abas** (o objetivo do pedido). **Decisão a confirmar:** vale em toda tela (feito assim).
- [ ] **Recentes, no celular:** a interface em `rem` com a **fonte do sistema maior**; toque e arraste no slider de avançar e
      retroceder (faixa de toque do miniplayer e do ponto); o botão de tamanho e alinhamento da letra.
- [x] ~~**I-07:** testar as 4 vozes gravadas ao mesmo tempo no celular~~ e ~~aceitar o tamanho do pacote (36 MB)~~: feitos e aprovados
      pelo responsável em 2026-11-15.
- [ ] **I-08 (partitura):** a **autorização do Enéias** para publicar os pacotes; a marca de andamento do autor sai do SVG no pacote 006; coros 1 a 6 não convertidos. **(depende do responsável)**
- [ ] **I-12 (fase B) e I-26 (karaokê por nota):** nenhum teste automático muda o **zoom** com a curva da ligadura acesa (o código refaz a folga; só o celular conferiu); o e2e do **Gravador** falha com frequência no CI (ver I-03).
- [ ] **I-13 (afinador):** a **etapa 2 (ouvir e medir)** é a I-32 em [`roadmap-ideas.md`](roadmap-ideas.md); o Rust não declara `armadura` nem `modo`.
- [ ] **I-19 (letra):** o **negrito** do coro e do final (I-33); os hinos **61, 162, 185 e 238** sem o bloco "Final"; o **283** (versos colados) precisa da foto; vetar os **45 hífens de pronome** dos hinos 1 a 30; letras pendentes do 61, 62, 185, 189, 198, 238 e 475. **(depende do responsável)**
- [ ] **I-22 (tela bloqueada):** MediaSession (controles na tela de bloqueio); o teste longo e o "hino todo" com as pausas de 2 s não foram registrados.
- [ ] **I-24 (Ajustes em cartões):** nada de função.
- [ ] **I-28 (abas da tela inicial):** a rolagem de cada aba não tem teste de ponta a ponta; confirmar a ordem das abas (Hinos primeiro).
