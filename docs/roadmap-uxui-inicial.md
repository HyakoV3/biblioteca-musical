# Roadmap

Projeto **não oficial**, gratuito e de código aberto (MIT). Sem vínculo com a Congregação Cristã no Brasil.
Este documento é a referência de prioridades. Atualize-o ao concluir uma etapa ou mudar uma decisão.

Legenda: `[x]` feito · `[ ]` a fazer · **(a validar)** decisão ainda não confirmada pelo responsável.

Ideias e pedidos que ainda não entraram no plano: [`roadmap-ideas.md`](roadmap-ideas.md).
A fase 1 (UX) está **concluída**; a continuação está em [`roadmap-fase-2.md`](roadmap-fase-2.md).

---

## 1. Já feito

- [x] Esqueleto Tauri 2 + SvelteKit (SPA) + Svelte 5, licença MIT.
- [x] Leitor do pacote de dados `hinario.json` em Rust, com validação e testes (`docs/FORMATO.md`).
- [x] Importador de conteúdo (gravação atômica, remoção, limite de tamanho).
- [x] Lista de hinos com busca por número ou título (sem diferenciar acentos).
- [x] Player por **síntese** (Web Audio), sem gravações: notas por voz, andamento, transposição.
- [x] Quatro vozes (Soprano, Contralto, Tenor, Baixo) com volume, silenciar ao vivo e instrumento por voz
      (3 órgãos e 16 instrumentos sintetizados). Preferências por voz lembradas no aparelho.
- [x] `tools/mscx2json`: converte partituras MuseScore (`.mscx`, versões 2 e 3) em notas, letra e vozes.
- [x] Letra por estrofe, ordenada pelo tempo das notas.
- [x] Interface em português, espanhol e inglês, pronta para novos idiomas (`docs/TRADUCOES.md`).
- [x] Projeto Android gerado; app instalado e testado no emulador (importar, tocar, voltar).

## 2. Redesenho de UX/UI

Princípio: a pessoa deve achar um hino, ler a letra ou ouvi-lo sem entender como o app foi feito.

### Diagnóstico (resumo)

| Prio. | Problema | Direção |
|---|---|---|
| P0 | A letra fica abaixo de todo o player | Letra como área principal, em aba própria |
| P0 | Leitura, mixer e ajustes na mesma rolagem | Separar **Letra** e **Ouvir** no mesmo hino |
| P1 | Importar e remover na tela inicial | Mover para **Ajustes → Biblioteca** |
| P1 | Idioma ocupa a tela inicial | Mover para **Ajustes** |
| P1 | Cabeçalho alto (título, aviso e idioma) | Barra de topo de uma linha |
| P1 | Tema único, cores soltas | Tokens semânticos; Claro, Escuro e Sistema |
| P2 | Número "1." gravado dentro da primeira linha da estrofe | Letra estruturada em estrofes |

### Mapa de navegação alvo

```
Biblioteca ──[engrenagem]──▶ Ajustes
   │                           ├─ Aparência: Sistema | Claro | Escuro
   ▼                           ├─ Idioma da interface
Detalhe do hino                ├─ Leitura: tamanho da letra
  ├─ aba Letra                 ├─ Biblioteca: importar .json / remover
  ├─ aba Ouvir (player+mixer)  └─ Sobre: aviso de não vínculo, créditos
  └─ aba Partitura (se houver)
  + miniplayer fixo (se houver áudio)
```

### Etapas

**Etapa 1 — Navegação e separação das funções** (sem mexer em cores) — *implementada em 2026-11-14; falta validar no aparelho*
- [x] Barra de topo de uma linha; Biblioteca enxuta (busca com botão limpar + lista).
- [x] Tela **Ajustes** com idioma, importar e remover (confirmação explicando o impacto) e Sobre.
- [x] Detalhe do hino (rota `/hino/<número>`) com abas **Ouvir** e **Letra**; a aba padrão é **Ouvir** (decisão do
      responsável, 2026-11-14); aba Letra sem nenhum controle de áudio. Hino sem notas mostra só a Letra.
- [x] Voltar preserva busca e posição da lista (estado da biblioteca compartilhado entre telas).
- [x] Estrofes com rótulo "Estrofe N" (o número sai do verso; sem mudar o formato dos dados).
- [x] Abas acessíveis (papéis tablist/tab/tabpanel, estado selecionado, setas do teclado).
- [x] Os dois painéis ficam montados: trocar de aba não interrompe o som (sair do hino ainda interrompe; etapa 2).
- [x] **Teste no emulador** dos critérios abaixo: validado pelo responsável em 2026-11-14.
- Aceitação: da tela inicial à letra em no máximo 2 toques · nenhuma ação destrutiva na tela inicial ·
  o botão voltar do Android continua fechando o hino e não o app · voltar da letra devolve a lista com a
  busca e a posição de rolagem.

**Etapa 2 — Player global e miniplayer** — *implementada em 2026-11-14; falta validar no aparelho*
- [x] Sintetizador em módulo único (`reproducao.svelte.ts`): a música continua ao trocar de aba, voltar à
      lista ou abrir Ajustes.
- [x] Pausar/continuar (suspende o relógio do áudio), parar, e progresso (tempo decorrido/total, sem arrastar).
- [x] Miniplayer global (play/pause, título que leva ao hino, parar, barra de progresso). Some quando o painel
      Ouvir do próprio hino está aberto, para não duplicar controles.
- [x] Andamento e transposição como valores numéricos com − e + (andamento de 5 em 5 bpm, de 40 a 160;
      tom de −6 a +6) e botão "Restaurar padrão".
- [x] Instrumento, volume e silenciar continuam valendo ao vivo (instrumento, andamento e tom só com a música parada).
- [x] **Teste no emulador** dos critérios abaixo: validado pelo responsável em 2026-11-14.
- Aceitação: trocar de aba ou voltar à lista não interrompe a reprodução · miniplayer correto após
  parar/pausar/terminar · pausar e continuar retoma do mesmo ponto · tocar outro hino substitui o atual.
- Limites conhecidos: alterar andamento, tom ou instrumento exige parar antes (mudar ao vivo exigiria reagendar
  as notas a partir da posição atual); não é possível arrastar o progresso; áudio com a tela apagada não foi
  validado (ver seção 4).

**Etapa 3 — Componentes e tema** — *implementada em 2026-11-14; falta validar no aparelho*
- [x] Tokens semânticos (`src/lib/tema.css`); temas Claro, Escuro e Seguir o sistema (padrão), escolhidos em
      **Ajustes → Aparência** e lembrados no aparelho; o tema salvo é aplicado antes da primeira pintura.
- [x] Nenhuma cor fixa nos componentes (conferido por busca no código).
- [x] Contraste medido por `tools/contraste.py` (15 pares, nos dois temas, todos dentro da meta); o verificador
      foi testado com cores ruins e reprova como esperado. Tabela em `docs/design-tokens.md`.
- [x] Bordas: criado `--borda-controle` (3,7:1 a 4,7:1), separado da borda decorativa; resolve a falha da paleta de partida.
- [x] Estados: carregando (indicador, parado com movimento reduzido), vazio/sem resultado, erro, sucesso e
      informação (aviso com ícone ✓ ! i, não só cor), sem letra, **sem notas para tocar** e **falha ao iniciar o áudio**.
- [x] Mixer compacto: por voz, interruptor liga/desliga, volume (com percentual ou "silenciada") e, numa seção
      **recolhida**, o instrumento. Silenciar aparece por rótulo, texto riscado e interruptor tracejado.
- [x] Botão principal com cor de acento; foco visível (3 px) em todos os controles.
- [x] **Teste no emulador** dos critérios abaixo: validado pelo responsável em 2026-11-14 (o item sobre a barra de
      status do Android, no fim desta etapa, continua marcado "a verificar").
- Aceitação: contraste AA verificado em todos os estados · silenciar não depende só de cor · trocar o tema em
  Ajustes muda o app inteiro na hora e a escolha sobrevive ao fechar o app · "Seguir o sistema" acompanha o
  aparelho · nenhuma tela fica ilegível no escuro.
- Limites conhecidos: o contraste foi medido nos tokens, não na tela renderizada. **A verificar no aparelho:** se a
  barra de status e a barra de gestos do Android acompanham o tema escolhido no app (pode ser preciso ajustar o
  tema nativo do Android, em `src-tauri/gen/android`).

**Etapa 4 — Acessibilidade e internacionalização** — *implementada em 2026-11-14; falta validar no aparelho*
- [x] Nome, papel e valor nos controles (interruptor de voz, volume com "80 por cento", abas, progresso, − e +),
      todos traduzidos nos três idiomas. Conferido lendo o código; **não** testado com leitor de tela.
- [x] Abas com estado anunciado, setas e **Home/End**; abas dentro da barra fixa, então a altura se ajusta a fonte
      ampliada ou título longo (antes dependia de um valor fixo de 56 px).
- [x] Miniplayer mede a própria altura para não cobrir o conteúdo; textos longos quebram em vez de cortar.
- [x] Áreas de toque: botão secundário e controle de volume subiram de 44/32 px para 48 (conferido no CSS, não medido
      no aparelho).
- [x] Título do documento por tela (é o que o leitor de tela anuncia ao navegar); `lang` em cada opção de idioma.
- [x] **Plurais** por regra da língua (`Intl.PluralRules`): "1 hino", "2 hinos", "0 semitons" (em português o zero é
      singular no padrão CLDR, por isso existe a forma `.zero`). Verificador novo: `python3 tools/verificar-traducoes.py`
      (chaves, parâmetros e `.outros` obrigatório; testado com dicionários quebrados de propósito).
- [x] **Idioma da interface separado do idioma do conteúdo:** o hinário pode declarar `hinario.idioma`; título e letra
      são marcados com esse `lang`. O conversor ganhou `--idioma`.
- [x] Fora do plano original, a pedido do responsável: **título e autoria** dos hinos agora são lidos da partitura
      (texto de moldura `Title`, `Lyricist` e `Composer`) e mostrados no hino e na lista.
- [ ] **Teste com TalkBack no emulador/aparelho** (a árvore de acessibilidade lida por `uiautomator` sem TalkBack só
      expõe o WebView inteiro, então não serve para auditar).
- [ ] **Fonte ampliada** (Configurações → Acessibilidade → Tamanho da fonte) sem cortes ou sobreposições.
- [ ] Idiomas da direita para a esquerda (RTL): não tratado; ao incluir um, trocar margens e alinhamentos fixos por
      propriedades lógicas e testar o espelhamento.
- Aceitação: nada cortado nem sobreposto com a fonte no máximo · TalkBack anuncia nome, estado e valor de cada
  controle e o título da tela ao navegar · "1 hino" no singular em português, espanhol e inglês · hino com título
  e autoria aparece na lista e no cabeçalho.
- **Esta etapa mexe no Rust** (campos `idioma` e `autoria`): é preciso parar e rodar de novo o `tauri android dev`.
  Hinários já importados continuam válidos (os campos são opcionais), mas só ganham título e autoria reais se
  forem **regenerados e importados de novo**.

**Etapa 5 — Polimento** — *fechada em 2026-11-14 (animações validadas pelo responsável; sobram duas decisões visuais, abaixo)*
- [x] **Ícone** (a versão plana, ver `design/icone/README.md`): gerado com o comando oficial `tauri icon` e ajustado
      por `tools/ajustar-icones.py` (ícone adaptativo do Android com fundo e primeiro plano separados; ícones do iOS
      sem canal alfa). Verificado em arquivo e em prévia sob máscaras redonda, arredondada e "squircle". Favicon trocado.
- [ ] **Ver o ícone no emulador** (o lançador e a lista de apps): falta reinstalar o app para o ícone novo aparecer.
- [x] **Identidade visual: dourado adotado** (decisão do responsável, 2026-11-14). O azul fica para **ações** e o
      dourado do ícone (`#f8b000`) marca **onde se está na música**: parte que toca (Intro, 1ª, 2ª...), barra de
      progresso, aba selecionada e ⚑ do final. Tokens `--ouro`, `--ouro-sobre` e `--ouro-linha` em `tema.css`; no
      claro as linhas usam `#946200`, porque o `#f8b000` tem só 1,8:1 sobre o fundo. Contraste conferido por
      `tools/contraste.py` (18 pares ok). Prévia: `design/identidade/previa-dourado.png`. **Falta ver no emulador.**
- [ ] Ícone **monocromático** do Android 13+ (ícones temáticos).
- [x] **Animações discretas** (até 200 ms), todas em `src/lib/movimento.css`: troca de tela com leve fade, avisos que
      entram, miniplayer que sobe, barra de progresso suave, resposta ao toque e transições de cor. Com "reduzir
      movimento" ligado no sistema **nada se move** (as cores mudam sem transição). `tools/verificar-movimento.py`
      confere isso no código e foi testado contra violações de propósito. Validado pelo responsável no emulador.
- [x] **Roteiro de teste de uso** com músicos: `docs/teste-de-uso.md` (12 tarefas, perguntas finais, como classificar).
- [ ] **Aplicar o teste** com 3 a 5 músicos reais (depende do responsável).

### Decisões a validar

| # | Decisão | Proposta atual | Situação |
|---|---|---|---|
| D1 | Abas **Letra \| Ouvir** no hino, ou tela única com mixer em painel inferior | Abas (abre em Ouvir, a pedido do responsável) | **Validada** (2026-11-14) |
| D2 | Miniplayer só no hino ou global (continua ao voltar à lista) | Global, na etapa 2 | **Validada** (2026-11-14) |
| D3 | Letra estruturada em estrofes (`{numero, linhas}`) no formato e no conversor | Sim; invalida JSONs já gerados, que são regeneráveis | **Validada** (2026-11-14) |
| D4 | Favoritos e histórico | Fora da fase 1; **entra no planejamento da fase 2** | **Validada** (2026-11-14) |

## 3. Conteúdo e direitos (bloqueia distribuição)

- [ ] **Autorização do autor das transcrições** para usar as transcrições `.mscx` do Hinário 5. Pedido feito em 2026-11-14; aguardando
      resposta. **Não baixar mais arquivos dele enquanto isso.**
- [ ] Se autorizado: converter os 480 hinos (e decidir sobre os coros 1–6, hoje ignorados pelo conversor).
- [ ] Decidir se o conteúdo entra no repositório ou só no app (padrão atual: **fora do Git**, em `content/`).
- [ ] Hinários 1 a 4: nenhuma fonte encontrada.
- [ ] Validar com arquivo real o que só foi testado com partituras fictícias: ligaduras, repetições, quiálteras.
- [ ] Letras e partituras: confirmar direitos com a CCB ou os titulares antes de distribuir.

## 4. Plataformas e distribuição

- [x] Desktop (Linux) e Android (emulador).
- [ ] Teste em celular Android real; gerar APK (`npm run tauri android build`).
- [ ] Verificar comportamento do áudio com a tela apagada (Android). **Não prometer** áudio em segundo plano
      sem validar.
- [ ] iOS: exige Mac com Xcode (ou CI com macOS); distribuição exige Apple Developer Program.
      Alternativa a avaliar: versão web instalável (PWA).
- [ ] Publicar o código no GitHub (repositório ainda sem remote).
- [ ] Mensagens de erro da importação vêm do Rust em português; trocar por códigos traduzidos pela interface.

## 5. Melhorias de áudio (depois do redesenho)

- [ ] Ajustar níveis de volume entre instrumentos (ajuste fino por ouvido).
- [ ] SoundFont opcional para timbres mais realistas (aumenta o tamanho do app).
- [ ] Editar notas dentro do app (hoje: editar o `hinario.json` e importar de novo).

## 6. Registro de decisões

| Data | Decisão |
|---|---|
| 2026-11-14 | App novo, escrito do zero (clean room), em Rust + Tauri 2 + Svelte; licença MIT. |
| 2026-11-14 | Áudio por síntese a partir de notas, sem gravações, como o app de referência. |
| 2026-11-14 | Conteúdo de hinos fora do repositório público até haver autorização. |
| 2026-11-14 | Vozes nomeadas Soprano, Contralto, Tenor e Baixo (de "Parte I a IV"). |
| 2026-11-14 | Redesenho começa por navegação e separação de funções, antes de cores. |
| 2026-11-14 | D1 a D4 aprovados como propostos (abas, miniplayer global, letra em estrofes, favoritos depois). |
| 2026-11-14 | Ao abrir um hino a aba padrão é **Ouvir**, e ela vem antes de **Letra** (a letra fica a um toque). |
