# Pendências fora do produto

O que falta além das funções do app: publicação, automação (CI/CD), revisão de código e testes. As etapas do produto
estão em [`roadmap-fase-2.md`](roadmap-fase-2.md); as ideias abertas, em [`roadmap-ideas.md`](roadmap-ideas.md); as já implementadas, no sumário
[`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md).

Legenda: `[x]` feito · `[ ]` a fazer · **(depende de ...)** o que bloqueia o item.

---

## 1. Publicação no GitHub

- [x] Repositório **público** criado em 2026-11-14: <https://github.com/HyakoV3/biblioteca-musical>. Um só e-mail de autor (o `noreply` do GitHub) e sem co-autoria.
- [x] Proteções da `main` (sem exclusão nem *force-push*, PR obrigatória, 4 verificações do CI), *secret scanning* e *push protection* ativos (conferido em 2026-11-23).
- [x] Dependabot (npm, cargo, GitHub Actions e Gradle): `.github/dependabot.yml` com um PR por ecossistema e as majors problemáticas ignoradas (2026-11-24). Alertas e correções automáticas de segurança do Dependabot ligados (conferido em 2026-11-27).
- [x] Arquivos da comunidade: `CONTRIBUTING.md` e `SECURITY.md` (2026-11-23).
- [x] Modelos de *issue* (defeito, melhoria e dúvida) e de *pull request*, e `CODEOWNERS` (`.github/`, PR #228, 2026-11-27).
- [ ] Imagem de pré-visualização do repositório (a descrição e os 8 tópicos já existem). **Configurações ligadas por `gh` em 2026-11-27:** só *squash* no merge, apagar a branch depois do merge, exigir conversas resolvidas na `main`, wiki desligada e o ruleset "Proteger tags de versão" (`v*`: sem apagar, atualizar nem mover).
- [ ] **Regra de ouro:** nada sensível no Git. Conteúdo de hinários e notas locais ficam fora do Git (`content/` e `docs/privado/`, no `.gitignore`).

## 2. CI/CD (GitHub Actions)

- [x] **CI** (`.github/workflows/ci.yml`), a cada *pull request*, a cada *push* na `main` e sob demanda, com cache de npm e
      de cargo. Quatro tarefas: **App** (`npm run check`, `npm test`, os verificadores de tradução, movimento e
      contraste e `pytest tools`); **Conversor** (`cargo test` em `tools/mscx2json`); **Leitor** (`cargo test --lib` em `src-tauri`, com as
      bibliotecas do Tauri instaladas no Ubuntu 24.04); **Karaokê num Chrome de verdade** (`npm run test:e2e`).
- [x] **Limpeza do Rust e verificações no CI** (2026-11-15). O conversor e o `src-tauri` foram formatados (`cargo fmt`), as
      duas sugestões do clippy sobre `if` juntáveis foram aplicadas, e o CI agora roda `cargo fmt --check` e
      `cargo clippy --all-targets -- -D warnings` nos dois. Se uma versão nova do Rust trouxer um aviso novo do clippy, o CI
      vermelho é esperado: corrija o aviso (ou, se for falso positivo, silencie-o no ponto exato com `#[allow(...)]`).
- [x] **Android nas PRs (2026-11-26):** `android-pr.yml` compila o APK arm64 (chave descartável) quando a PR muda `src-tauri/**`, e confere as permissões com `tools/conferir-permissoes-apk.sh`, o mesmo script do release.
- [ ] Se o teste de ponta a ponta ficar lento ou instável, restringi-lo à `main` e ao disparo manual.
- [x] **Workflow de release escrito (2026-11-24)**, em [`release-e-apk-no-github.md`](release-e-apk-no-github.md): tag `v*` gera APK e AAB assinados, `SHA256SUMS` e o GitHub Release (sufixo `-rc1` vira pré-lançamento); sob demanda gera um APK de teste. Assinatura condicional no Gradle (sem chave, o release sai `unsigned` e o fluxo manual dos APKs de teste não muda), conferência de permissões e de tag, `dependabot.yml` agrupado. Testado **localmente**; **não rodou no GitHub ainda**.
- [x] **Release ligado:** a chave de envio e os segredos foram cadastrados, e o release já gerou os pré-lançamentos até a `v0.3.9-rc10` (2026-11-27, APK de 11,4 MiB). O que se fazia: gerar a chave de envio (`keytool`, fora do repositório, com cópia e senha num cofre) e cadastrar `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` **num terminal normal** (comandos em `release-e-apk-no-github.md`); depois rodar o release sob demanda e a tag `v0.3.1-rc1`. Falta só a tag final (sem sufixo) e, se for o caso, o envio à Play Store.
- [ ] **Sem conteúdo embutido além do exemplo:** o `BM_PACOTE` (hinos de terceiros) nunca entra no CI nem em *release* público; o que vai em todo APK é o pacote de exemplo de 5 hinos de domínio público ([`pacote-de-exemplo.md`](pacote-de-exemplo.md)). Só o APK de teste fechado, gerado na máquina do responsável, leva conteúdo (`apk-de-teste.md`).
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
      SHA-256), acessibilidade (alvos de pelo menos 44 px, contraste, movimento reduzido) e dados de terceiros fora do Git.
      O pedido padrão do fluxo é genérico; dá para acrescentar esses pontos ao texto dele.

## 4. Testes automatizados

- [x] **Testes do app no repositório** (`tests/`, executor Vitest): `npm test`. **690 testes em 53 arquivos** (2026-11-27), só com dados
      **fictícios** (`tests/amostras.ts`) ou o pacote de exemplo de domínio público (`tests/exemplo.test.ts`, `tests/titulo.test.ts`; nenhum outro hino real entra no Git): partes e vezes do hino (introdução, final,
      pausas), sintetizador (reagendar na pausa, tempo audível, filtro de abertura dos metais, uma onda por altura),
      timbres por altura (interpolação das medidas, volume preservado; `tests/timbres.test.ts`), karaokê (validação e escolha da sílaba), pacote de
      sons (zips sintéticos adulterados, truncados e "bomba"), catálogo de sons gravados x manifesto, número do hino e
      preferências, créditos e licenças, tamanho e alinhamento da letra e a tradução dos erros do Rust, o envio da gravação (conversão WebM para Ogg: `tests/ogg.test.ts`), a saída de áudio e a barra dos pacotes. Os tipos dos testes
      passam por `npm run check`.
- [x] Regressão do `smplr`: `parar()` tem de esvaziar a fila do agendador (`tests/sintetizador.test.ts`). Conferido: sem
      a correção, o teste falha.
- [x] **Ponta a ponta do karaokê** (`npm run test:e2e`, `tests/e2e/karaoke.mjs`): sobe o Vite e um Chrome mudo, entrega
      um hino fictício por um `invoke` simulado do Tauri e confere sílaba, estrofe, tempo, pausa e o botão. Precisa de
      Chrome ou Chromium (variável `CHROME` indica o executável) e não sobra processo nem pasta temporária.
- [x] O conversor `tools/mscx2json` tem testes em Rust, dentro do repositório (`cargo test`: 142), e o leitor do app também
      (`cargo test --lib` em `src-tauri`: 120, mais 4 que só rodam sob pedido, com conteúdo real). As ferramentas em Python têm os seus (`pytest tools`: 165).
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
- [ ] **I-15 (timbres):** ouvir os sintéticos novos de **flauta transversal e flauta doce (as duas, desde 2026-11-25), violino, clarinete, viola, violoncelo, contrabaixo e trompa** e
      dizer se algum ficou fraco; o teste cego com o gravado (critério de aceitação) não foi feito; **4 vozes de metal ao mesmo
      tempo no celular** (custo de um filtro a mais por nota).
- [ ] **I-21 (slider do miniplayer em cima):** ver no celular: se o **polegar cobre o tempo** ("0:42 / 3:10", que fica na linha de
      baixo) durante o arrasto; se **rolar a página perto do miniplayer** não dispara a busca sem querer; e se o slider ficou
      **bem distinto das abas** (o objetivo do pedido). **Decisão a confirmar:** vale em toda tela (feito assim).
- [ ] **Recentes, no celular:** a interface em `rem` com a **fonte do sistema maior**; toque e arraste no slider de avançar e
      retroceder (faixa de toque do miniplayer e do ponto); o botão de tamanho e alinhamento da letra.
- [x] ~~**I-07:** testar as 4 vozes gravadas ao mesmo tempo no celular~~ e ~~aceitar o tamanho do pacote (36 MB)~~: feitos e aprovados
      pelo responsável em 2026-11-15.
- [ ] **I-08 (partitura):** a autorização do Enéias para publicar os pacotes **já foi dada** (2026-11-26, ver `licencas-de-terceiros.md`); a marca de andamento do autor sai do SVG no pacote 006; coros 1 a 6 não convertidos. **(depende do responsável)**
- [ ] **I-12 (fase B) e I-26 (karaokê por nota):** nenhum teste automático muda o **zoom** com a curva da ligadura acesa (o código refaz a folga; só o celular conferiu); o e2e do **Gravador** falha com frequência no CI (ver I-03).
- [ ] **I-13 (afinador):** a **etapa 2 (ouvir e medir)** é a I-32 em [`roadmap-ideas.md`](roadmap-ideas.md); o Rust não declara `armadura` nem `modo`.
- [ ] **I-19 (letra):** o **negrito** do coro e do final (I-33); os hinos **61, 162, 185 e 238** sem o bloco "Final"; o **283** (versos colados) precisa da foto; vetar os **45 hífens de pronome** dos hinos 1 a 30; letras pendentes do 61, 62, 185, 189, 198, 238 e 475. **(depende do responsável)**
- [ ] **I-22 (tela bloqueada):** MediaSession (controles na tela de bloqueio); o teste longo e o "hino todo" com as pausas de 2 s não foram registrados.
- [ ] **I-24 (Ajustes em cartões):** nada de função.
- [ ] **I-28 (abas da tela inicial):** a rolagem de cada aba não tem teste de ponta a ponta; confirmar a ordem das abas (Hinos primeiro).

- [ ] **Envio da gravação em Ogg (PR #133; funcionou nos dois destinos testados pelo responsável, o WhatsApp e mais um, em 2026-11-22/23; ver [`ideia-enviar-audio-por-app.md`](ideia-enviar-audio-por-app.md)):** testar o `.ogg` em Telegram (deve virar
      nota de voz), Signal, Messages e WhatsApp Business, e com gravações longas (10, 30 e 60 min; acima de ~34 min o arquivo passa de 16 MB).
      Opcional: **`.m4a`/AAC com `MediaCodec`** ("enviar como MP4"), só se algum destino recusar Ogg. **(depende do responsável)**
- [ ] **I-17 (último hino):** a posição (retomar de onde estava tocando) não foi feita; guardar andamento, tom e instrumentos; ver no celular o anel da lista e o atalho **Continuar de onde parou**.
- [ ] **I-33 (negrito):** ver no celular o contraste do negrito no coro e no final (Alto contraste) e se atrapalha o destaque da sílaba.
- [x] **I-29 (Reduzir ruído):** testado no aparelho em 2026-11-27: o AudioWorklet roda, a gravação não sai muda, o Alto filtra mais forte que o Médio, e o Médio e o Alto cortam notas longas (o Baixo, levemente); CPU e bateria **não foram medidos** (sem problema percebido). Falta só suavizar o Médio e o Alto: ver a **I-51** (escala interna, ajuste de compilação; rascunho na PR #234).
- [ ] **I-03 (Gravador):** renomear a gravação e ligá-la a um hino; o fone Bluetooth (atraso); confirmar no aparelho a gravação em segundo plano e com o hino no fone.
- [ ] **I-20 (Metrônomo), como futuro:** o gauge de ponteiro e os compassos irregulares 5 e 7, com agrupamentos.
- [ ] **Outras ideias soltas:** botão **"Atualizar"** do hinário (ver a **I-25** em [`roadmap-ideas.md`](roadmap-ideas.md)); o estalo ao bloquear a tela e o hino 86 estão na seção 8.

## 8. Operação: servidor dos pacotes, entrega do APK e testes no aparelho

Itens de rotina que não são ideias de produto e que só a conversa tinha (conferidos em 2026-11-23).

- [ ] **Limite de 100 MiB do link das partituras (frágil).** O link público entrega a **pasta inteira em zip** e o app recusa zip acima de 100 MiB
      (`LIMITE_ZIP` em `src/lib/sons/extrair.ts`, aplicado em `src/lib/sons/baixar.ts`, que também baixa o hinário; 100 MiB = 104.857.600 bytes). Cada pacote novo de partituras (~19 MB) aproxima do teto, e a falha só aparece no aparelho: em
      2026-11-22 a pasta chegou a 117 MB (112 MiB) e o download quebrou. Hoje ela tem ~39 MB (os antigos estão em `BibliotecaMusicalPartituras-archive/`).
      **Regra até haver guarda:** antes de copiar um arquivo para uma pasta de link, somar os arquivos da pasta (`du -sb` no servidor) e conferir
      também `curl -sI <link>`, se o servidor mandar `Content-Length` (a pasta tem de ficar abaixo de ~80 MiB, com folga). Possível guarda: um passo em `tools/montar-manifesto-*.py` que avise quando o zip da pasta passar de 80% do teto.
- [ ] **Barra de instalação das partituras no Android (PR #144):** o andamento real vem por um canal do Tauri, nunca testado no aparelho. Confirmar
      que a barra sobe de ~94% a 100% e que o botão Baixar volta ao normal; anotar quanto tempo leva a instalação. Hinário e sons gravados seguem
      **sem andamento real** (a barra fica em ~94% nessa fase).
- [ ] **Estalo ao bloquear e desbloquear a tela (PR #142):** sem o religamento da WebView o estalo diminuiu; falta conferir que o hino, o metrônomo e a
      gravação seguem por vários minutos com a tela bloqueada (se o som cair, o religamento volta só quando a janela perde o foco).
- [ ] **Hino 86:** o destaque da partitura segue notas sem som depois da introdução; falta o responsável dizer em qual compasso começa.
- [ ] **Branches locais sem dono (conferido em 2026-11-24):** `apk-070` e `apk-071-som` só têm um commit de *merge* (nenhum conteúdo próprio);
      `som-sem-religar-webview` só difere da `main` em comentários (o código entrou pela PR #142); `conversor-refrao` (4 *patches*),
      `worktree-card-i30-eneas` (2, os mesmos do `conversor-refrao`) e `docs-auditoria-perfis` (1) têm conteúdo próprio. O responsável decide quais apagar.

## 9. Pacote de exemplo (5 hinos de domínio público) e a rodada de 2026-11-27

O que ficou em aberto depois da #225 e do `v0.3.9-rc10`. O guia do pacote é [`pacote-de-exemplo.md`](pacote-de-exemplo.md); a procedência, [`licencas-de-terceiros.md`](licencas-de-terceiros.md).

- [ ] **Ver e ouvir os 5 hinos no celular** (aba Partitura em retrato e paisagem, o compasso e as notas acendendo com o karaokê, as ligaduras, a letra no idioma original). Só o hino 2 e a lista foram vistos, no emulador. **(depende do responsável)**
- [ ] **Comparar a partitura desenhada com o PDF do Mutopia.** As notas foram conferidas contra o `.mid`; o desenho, só a olho em dois hinos.
- [ ] **Harmonizadores sem crédito.** As páginas do Mutopia não dizem quem harmonizou cada edição (a fonte citada é o cyberhymnal.org, não conferido). O CPDL não abriu (desafio anti-robô do Cloudflare); as edições dele ficam como alternativa, com a licença conferida.
- [ ] **Andamentos lentos** nos hinos 2 e 4 (50, os do `.mid` do Mutopia): decidir se o exemplo adota um andamento mais usual. **(depende do responsável)**
- [ ] **Isolar o peso do exemplo no APK** (o `main` puro contra o `main` com o exemplo) e decidir a ideia **I-45**. As letras em português são a **I-44**; os créditos no app, a **I-46**.
- [ ] **Tezcat:** o baseline cresceu em **57 avisos (WARN)**, todos em `tools/exemplo/`, `tools/gerar-exemplo.py`, `src-tauri/src/exemplo.rs` e nos testes do `hinario.rs`; nenhum FAIL. Vale reduzi-los aos poucos (o baseline só deve encolher).
- [ ] **`gerar-partituras.py`: `achar_musescore` aceitar uma lista** em vez de uma string (comentário do Vandame na #225: caminho com espaço e Windows com `shlex`). Hoje o gerador do exemplo monta o comando com `shlex.join`, o que cobre o Linux.
- [ ] **e2e do Ajustes:** na rodada da #225 houve uma falha "depois de confirmar a remoção o foco não se perde no `<body>`" que não se repetiu; acompanhar se volta (junto do e2e do Gravador, que já oscila).
- [ ] **Release final:** a `v0.3.9-rc10` é pré-lançamento; falta a tag sem sufixo e, se for o caso, `ENVIAR_PLAY_STORE=true` (ver [`release-e-apk-no-github.md`](release-e-apk-no-github.md)). A automação de bump e RC é a **I-42**.
- [ ] **Imagem de pré-visualização do repositório** (seção 1) e o que continuar da seção 7.
