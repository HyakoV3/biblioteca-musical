# Ideias e pedidos para o futuro

Este arquivo guarda ideias, reclamações e pedidos que ainda **não** entraram no plano das etapas
([`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md)). Ele existe para nada se perder. Uma ideia só vira
trabalho depois de ser avaliada e priorizada.

Como usar: cada ideia tem um código (`I-01`, `I-02`…), a origem, o problema, o que se deseja e as perguntas
em aberto. Ao implementar, mude o status e aponte para a etapa ou o commit.

Status possíveis: **anotada** · **em análise** · **planejada** · **feita** · **descartada**.

**As ideias já implementadas saíram deste arquivo** (2026-11-16): o sumário, com onde está cada uma, é
[`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md); os textos originais completos estão em
[`archive/ideias-implementadas.md`](archive/ideias-implementadas.md); e o que ficou pendente dentro delas está na seção 7 de
[`roadmap-pendencias.md`](roadmap-pendencias.md). Quando uma ideia daqui for implementada, mova-a do mesmo jeito.

---

## I-03 — Gravador de áudio para estudo e envio aos instrutores

- **Status:** **em implementação (2026-11-17; atualizado em 2026-11-20: o teste de ponta a ponta do Gravador falha com frequência no CI, sem erro na tela; a causa não foi achada).** Feito: a aba **Gravador** (só microfone; formato Opus/webm a 64 kbps; permissão pedida só ao gravar; microfone devolvido ao parar, ao sair da aba e ao esconder o app; **medidor de som no botão** e aviso de "sem som"; **gravações guardadas** no armazenamento do app, **sem limite**, em lista paginada (10 por vez, carrega mais quando o fim chega perto da tela), com nome de data e hora, resumo de quantidade e espaço usado, "Ouvir" e "Apagar" com confirmação e "Apagar todas"). **Testado no aparelho do responsável:** a gravação e o medidor (a gravação funcionou). **Enviar o áudio** já funciona (botão **Enviar**, folha de compartilhamento do Android, PR #77; testado no WhatsApp do responsável em 2026-11-18). **Gravar em segundo plano (2026-11-20, a confirmar no aparelho):** a gravação seguia só até a tela bloquear (~30 s) porque o app a parava ao esconder a página e o Android corta o microfone de quem sai da tela; agora o serviço em primeiro plano ganha o tipo microfone (`FOREGROUND_SERVICE_MICROPHONE`, notificação "Gravando" com "Parar") e a gravação segue até a pessoa parar. **Gravar com o hino no fone (2026-11-20, a confirmar):** a ponte `temFone` (AudioManager: fone com fio, USB, Bluetooth) deixa o hino tocar durante a gravação só com fone; sem fone segue um som de cada vez. **Falta:** renomear a gravação e ligá-la a um hino, e o fone Bluetooth (atraso).
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir
- **Nota (2026-11-17):** o responsável quer o Gravador como uma **aba da tela inicial** (`Hinos | Afinador | Gravador | …`): ver a **I-28** (feita e arquivada). A permissão de microfone e a detecção de fone se decidem **junto com o afinador** (I-13, etapas 2 e 3): a pesquisa de 2026-11-17 está lá.

### O que se deseja (nas palavras do responsável)

Um **gravador de áudio** para gravar os hinos **enquanto o celular toca** e **enviar os áudios para os instrutores
pelo WhatsApp**.

### Ideia de comportamento (a validar)

Na aba **Ouvir**, um botão **Gravar** que grava enquanto o hino toca (por exemplo, a pessoa tocando ou cantando junto),
com **parar**, **ouvir de volta**, **descartar** e **enviar**. Ao enviar, abre a folha de compartilhamento do sistema
para escolher o WhatsApp e o instrutor; o app não precisa conhecer contatos.

**Com fone ou sem fone (ideia do responsável, 2026-11-14):** o app percebe se há **fone de ouvido conectado**.
- **Sem fone:** o app **só grava** o microfone. Não toca o hino, porque o som do alto-falante entraria no microfone
  (eco e mistura ruim).
- **Com fone:** o app **toca o hino no ouvido da pessoa** e **grava no mesmo celular**, na mesma hora. A pessoa toca ou
  canta acompanhando a música, e o microfone não capta o hino.

### Perguntas em aberto

1. **O que gravar?** Com a ideia acima, o hino no fone não vaza para o microfone, então a gravação pode levar **só a
   voz ou o instrumento da pessoa**. Falta decidir se, **com fone**, o arquivo enviado deve levar também **o hino
   misturado** (como o som do hino é gerado dentro do app, dá para mixar o microfone com a saída do sintetizador direto,
   sem passar pelo ar) ou só o microfone. O instrutor talvez prefira ouvir os dois juntos. Precisa de decisão do
   responsável.
   **Cuidado com fone Bluetooth:** ele atrasa o som em 100 a 300 ms, e a pessoa tocaria **atrasada** em relação ao
   hino que está gravado junto. Medir o atraso e compensar, ou avisar que o fone com fio é melhor (a I-13 tem a mesma
   questão).
2. **Formato do arquivo.** Preferência do responsável (2026-11-14): gravar num formato **compacto, que não ocupe
   espaço**, como o **Opus** (`.opus`/OGG). O responsável lembra que WhatsApp e Telegram costumam **reconverter** o áudio
   de qualquer forma ao enviar; **a confirmar**, porque pode valer só para mensagem de voz e não para áudio anexado
   como arquivo. O WhatsApp precisa conseguir tocar o áudio recebido; o formato gerado pelo navegador
   (por exemplo WebM/Opus) pode não ser aceito, e talvez seja preciso converter (por exemplo para M4A ou OGG/Opus).
   Não verificado: o que `MediaRecorder` produz no WebView do Android, e como o WhatsApp e o Telegram tratam o arquivo
   enviado. Testar com um contato real, olhando o tamanho e se o áudio toca.
3. **Onde ficam as gravações** e por quanto tempo; apagar depois de enviar?
4. **Quem grava.** Há jovens e menores entre os músicos: definir o aviso de privacidade (as gravações ficam só no
   aparelho; o app não envia nada sozinho).
5. **Iniciar a gravação junto com o hino** ou separado (a pessoa aperta Gravar e depois Tocar)? Sem fone não há hino
   tocando, então só vale a segunda forma.
6. **Como saber que há fone?** O navegador não diz com segurança: `enumerateDevices()` lista as saídas e o evento
   `devicechange` avisa das trocas, mas num WebView pode ser preciso código nativo (no Android, `AudioManager`).
   Não verificado. Ver também a I-13, que precisa da mesma detecção.

### Impacto técnico (hipóteses, não verificadas)

- **Permissão de microfone** no Android (`RECORD_AUDIO`) e no iOS (`NSMicrophoneUsageDescription`). Num WebView, o
  acesso ao microfone (`getUserMedia`) depende de o aplicativo nativo conceder a permissão; precisa ser testado no
  Tauri Mobile e pode exigir um plugin ou código nativo.
- **Gravação:** a API padrão do navegador é `MediaRecorder`. Para mixar microfone e sintetizador, ligar as duas
  fontes a um `MediaStreamAudioDestinationNode` do mesmo `AudioContext` que o sintetizador já usa
  (`src/lib/sintetizador.ts`).
- **Envio:** o caminho consolidado é a **folha de compartilhamento do sistema** (Android `ACTION_SEND` com
  `FileProvider`; iOS `UIActivityViewController`), em vez de integrar com a API do WhatsApp. Verificar se existe
  plugin do Tauri 2 para compartilhar arquivos antes de escrever código nativo.
- **Armazenamento:** arquivos no diretório de dados do app, pela API do Tauri.
- **Segundo plano:** gravar com a tela apagada não está garantido num WebView (mesma ressalva do áudio em segundo
  plano na seção 4 do roadmap).

### Critérios de aceitação (propostos)

- Gravar um hino de ponta a ponta, ouvir de volta no app e enviar pelo WhatsApp a um contato de teste, que
  consegue tocar o áudio.
- A permissão de microfone é pedida só ao gravar, com explicação, e o app funciona normalmente se for negada.
- Nenhuma gravação sai do aparelho sem a pessoa escolher enviar.

---

## I-16 — Repetir um trecho em laço

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-15, ao fazer a barra de progresso que avança e retrocede.
- **Prioridade:** a definir

### O problema
Para estudar uma parte difícil, a pessoa tem de reposicionar a música à mão toda vez que ela passa.

### O que se deseja
Marcar um **início** e um **fim** na barra de progresso e a música repetir só esse trecho, até a pessoa desligar.

### Perguntas em aberto
1. Como marcar? (toque longo na barra, dois botões "A" e "B", ou arrastar uma faixa?)
2. O laço vale só para aquele hino e some ao parar, ou fica lembrado?

### Impacto técnico (hipóteses, não verificadas)
- Reaproveita `reproducao.irPara()` e o componente `Busca.svelte` (marcadores sobre a barra).
- O ponto delicado é a **emenda**: reagendar o trecho de novo leva ~0,1 s (`ATRASO_INICIAL` do sintetizador) e poderia deixar
  um vazio entre o fim e o começo; o ideal é agendar a repetição **antes** do fim, em vez de reagendar ao chegar nele.

### Critérios de aceitação (propostos)
- O trecho repete sem estalo nem silêncio perceptível na emenda, tocando ou, depois de pausar, ao continuar.

---

## I-17 — Lembrar o último hino e a posição

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-15.
- **Prioridade:** a definir

### O que se deseja
Ao reabrir o app, oferecer "continuar de onde parou": o último hino aberto e, se estava tocando, a posição.

### Perguntas em aberto
1. Só **mostrar** o atalho ou já abrir o hino? (nunca tocar sozinho, por causa do áudio inesperado)
2. Guardar também o andamento, o tom e os instrumentos escolhidos (hoje só os instrumentos e volumes por voz são lembrados)?

### Impacto técnico (hipóteses)
- Preferência no aparelho (`src/lib/preferencias.ts`), como a do karaokê e a da letra; nada sai do aparelho.

---

## I-18 — Pular uma parte inteira no miniplayer

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-15.
- **Prioridade:** a definir

### O que se deseja
Botões "parte anterior" e "próxima parte" (Intro, 1ª, 2ª...) no miniplayer e no player, em vez de arrastar a barra.

### Perguntas em aberto
1. Só no "hino todo" (onde há várias partes) ou também nas partes tocadas sozinhas?
2. Quais ícones, e onde cabem no miniplayer sem apertar os botões que já existem?

### Impacto técnico (hipóteses)
- Os marcos das partes já existem (`atual.marcos`, em batidas, em `src/lib/reproducao.svelte.ts`) e `reproducao.irPara()` já
  reposiciona o som e a letra: o botão seria "ir ao início da parte seguinte ou anterior".

---

## I-20 — Metrônomo embutido

- **Status:** **desenho revisado (Opus 5) e decidido pelo responsável (2026-11-20); implementação em andamento, por partes** (1: agendador puro; 2: aba e som; 3: serviço Kotlin e tela bloqueada; 4: Gravador em segundo plano). Em aberto só o que está listado em "Decisões do responsável" como futuro (o gauge de ponteiro)
- **Origem:** pedido do responsável, 2026-11-16: "fazer um metrônomo também, embutido".
- **Prioridade:** a definir
- **Nota (2026-11-17):** a tela inicial vai ter abas de ferramentas (I-28: `Hinos | Afinador | Gravador | …`, "entre outras"). Se o metrônomo também for uma aba, a pergunta 3 ("onde fica") se resolve por ela.
- **Decisão do responsável (2026-11-20):** o metrônomo é uma **aba própria** (`Hinos | Afinador | Gravador | Metrônomo`). A pergunta 3 está respondida.

### O problema
Quem estuda uma voz precisa de um pulso firme, e hoje o app só dá o pulso dentro da música tocada. Para praticar sem o hino
tocando, ou para entrar no tempo certo, é preciso outro aplicativo.

### O que se deseja
Um **metrônomo dentro do app**: um clique regular no andamento do hino (e ajustável), com o primeiro tempo do compasso
acentuado, que se liga e desliga.

### Desenho (2026-11-20, revisado pelo Opus 5 e decidido pelo responsável: aba própria, primeira etapa sem tocar junto com o hino, mas com tela bloqueada)
Escopo da **primeira etapa**: uma ferramenta de estudo independente do player. Fica de fora (etapa 2): tocar por cima do hino, contagem de entrada
antes da música, o compasso vindo do hino e ligar ao andamento do hino aberto. Em princípio é front (Svelte/TypeScript); **não mexe no conversor nem no
`hinario.json`**. **Exceção, decidida (A):** o clique continua com a tela bloqueada, e isso exige **Kotlin** (serviço em primeiro plano); a etapa 1 deixa de ser só front.

#### Tela (aba Metrônomo)
- **Andamento:** reaproveitar o `ControleAndamento.svelte` (− −5 valor +5 +, com `aria-live`), que hoje usa 40 a 160 (`ANDAMENTO_MIN/MAX` em `reproducao.svelte.ts`):
  passar `min`/`max` por propriedade. **Sem slider** (210 valores no celular é impreciso). Faixa a decidir (pergunta C). Muda **na hora**, sem parar o clique.
- **Compasso:** botões com o número de tempos (2, 3, 4, 6), 1º tempo acentuado. Mudar o compasso reinicia a contagem no 1º tempo.
- **Iniciar/Parar:** botão grande (mesma linguagem do Afinador e do Gravador). **Sem volume na tela**: quem ajusta é o volume de mídia (decisão do Afinador, `Afinador.svelte`
  e `tom.ts`); sem a música junto não há o que equilibrar. Revisitar na etapa 2.
- **Indicador de tempo:** uma bolinha por tempo, a atual acesa. O 1º tempo **não** se distingue só pela cor (regra do projeto, como o ✓/negrito/borda do Afinador):
  bolinha maior ou outra forma. O "pisca" fica **só nas bolinhas** (área pequena), com troca de cor sem animação, o que já passa por `movimento.css` e `verificar-movimento.py`;
  nada de pisca de tela cheia (WCAG 2.3.1: no máximo 3 piscadas por segundo, e a 180 bpm ou mais já passaria disso).
- **Leitor de tela:** um `role="status"` só com início, parada, bpm e compasso (como o Afinador). **Sem anúncio por tempo.**
- **Alvos:** 3rem (48 px) como o resto do app.
- **Quando o hino toca:** valem as mesmas regras do Afinador: Iniciar chama `reproducao.parar()` (um som de cada vez) e um `$effect` para o metrônomo quando um hino começa a tocar.

#### Som
Clique sintetizado (oscilador curto com envoltória rápida; o 1º tempo mais agudo e um pouco mais forte, a diferença confirmada pelo `hz` no teste). Nada para baixar.

#### Como agendar os cliques (o ponto técnico)
- O padrão conhecido é o do "A Tale of Two Clocks" (Chris Wilson): um temporizador **grosso** (~25 ms) só **olha adiante** (~100 ms) e agenda no relógio de áudio
  (`AudioContext.currentTime`) os cliques que caem na janela (`osc.start(tempo)`). Nunca usar `setInterval` para soar o clique.
- **Estado e cálculo (corrigido na revisão):** guardar `ultimoTempo` (instante do último clique agendado) e `tempoAtual` (0 a n−1). O próximo instante é calculado
  **só na hora de agendar**: `ultimoTempo + 60 / bpmAtual`. (Somar `60 / bpm` logo depois de agendar fixaria o intervalo com o bpm antigo e atrasaria a troca em um clique.)
  A troca de bpm vale a partir do **primeiro clique ainda não agendado**; o que já está na janela de ~100 ms soa como estava.
- **Atraso do temporizador:** se o temporizador acorda tarde (coleta de lixo, aparelho lento), o `start(t)` com `t` no passado soaria **na hora, todos juntos**. Se
  `proximoTempo < currentTime`, pular para o próximo ponto da grade (`n = ceil(atraso / período)`), avançando `tempoAtual` em `n % compasso` (mantém a fase), sem rajada.
- **Cancelar o que ainda não soou:** guardar os osciladores agendados. Ao parar, ou ao mudar compasso/bpm de modo que invalide a janela, `stop()`/`disconnect()` nos que ainda
  não soaram e esvaziar a fila visual (senão soam cliques fantasmas ao reiniciar, e o acento antigo sai depois de trocar o compasso).
- **Visual alinhado ao som:** fila `(tempoDeÁudio, índice)` consumida no `requestAnimationFrame` quando `currentTime − outputLatency ≥ tempo` (com detecção da propriedade; há o precedente
  `audivel()` em `sintetizador.ts`), para a bolinha não adiantar o som no Bluetooth (100 a 300 ms). Ao voltar à tela, descartar a fila velha e mostrar só o tempo atual.
- **Início:** depois do `await resume()`, começar em `currentTime + 0,1 s` (como o `ATRASO_INICIAL` do sintetizador), sempre com `tempoAtual = 0`. Limitação conhecida: o Bluetooth pode engolir o 1º clique.
- **`AudioContext`:** **próprio** (não o do sintetizador: o `ctx` é privado e pausar o hino faz `ctx.suspend()`, que calaria o clique; `tom.ts` já registra essa decisão), criado no **toque** em Iniciar,
  com a mesma guarda de geração do `TomSustentado` (Iniciar→Parar rápido e sair da aba durante o `await resume()`). `parar()` mantém o contexto e `sair()` o fecha com atraso, como o Afinador.
  Ouvir `ctx.onstatechange`: se sair de `running` com o metrônomo ligado (ligação telefônica, outro app com o foco de áudio), **parar e avisar** na tela, sem tentar `resume()` sozinho (sem gesto falha).
- **Segundo plano:** sem serviço, o Chrome limita os temporizadores da página escondida (a ~1 por segundo; com som nos últimos 30 s a limitação é mínima) e o Android pode congelar o processo.
  **Decisão A (substitui a ideia de "parar ao esconder"):** o metrônomo **continua com a tela bloqueada** até a pessoa parar. Para isso entra um terceiro motivo no `ServicoAudio.kt` (como `gravando`), a
  notificação "Metrônomo · Parar", o wake lock sem limite enquanto ligado e uma janela de agendamento adaptativa (~100 ms com a tela à vista, ~2 s escondido; `JANELA`/`JANELA_ESCONDIDA` em `metronomo.ts`).
  `sincronizarServico` **não** serve como está (`ligadoCom` é um só e o layout o desliga sempre que `reproducao.estado` muda).
- **Módulo puro e testável:** "dado o bpm, o compasso, o último instante e o agora, quais cliques agendar" fica numa função pura (`agendar(estado, agora, janela)` → `[{tempo, indice}]`),
  testada no vitest com relógio falso; o `AudioContext` entra só na casca fina.

#### Arquivos que a aba nova toca (não estavam no rascunho)
`src/lib/inicio.svelte.ts` (tipo `AbaInicio` e `rolagem`), `src/routes/+page.svelte` (`ABAS`, `ROTULOS`, painel), `src/lib/Abas.svelte` (cabem 4 abas? "Metrônomo"/"Metrónomo" em 412 px
com a fonte do sistema a 130% e 200%, e na barra lateral com o celular deitado), `ControleAndamento.svelte` (`min`/`max` por propriedade), `src/lib/preferencias.ts` e `tests/preferencias.test.ts`
(se lembrar bpm e compasso: chave `prefs.metronomo`, validada na leitura: bpm limitado, compasso ∈ {2,3,4,6}), os 3 dicionários i18n (`inicio.aba_metronomo`, `metronomo.*`; o tipo `Dicionario` e o
`npm run check` garantem as chaves, e textos com `{n}` pedem um teste como o de `erros.test.ts`) e o **e2e** (`karaoke.mjs` confere a lista exata de abas e vai quebrar).

#### Critérios de aceitação (revisados: mensuráveis)
- **vitest (função pura, relógio falso):** 1000 cliques com `t_n = t0 + n·p` (±1e-9), sem deriva; troca de bpm e de compasso no meio da janela; recuperação depois de 3 s sem rajada; reinício no 1º tempo.
- **e2e (Chrome mudo):** interceptar `AudioScheduledSourceNode.prototype.start` guardando `{when, agora: context.currentTime, hz}` (há precedente de trocar `AudioContext` em `karaoke.mjs`). A 240 bpm
  (30 cliques ≈ 7,5 s): (a) todo `when − agora > 0`; (b) intervalos = 60/bpm ± 1 ms e nenhum `when` repetido; (c) o mesmo com um laço ocupado de 150 ms; (d) acento a cada n cliques, conferido pelo `hz`
  (substitui o "audivelmente diferente"); (e) **escondido, o clique continua** (decisão A): com a página escondida os `start` seguem, a janela passa a ~2 s e os intervalos continuam em 60/bpm; e `context.state === "closed"` só ao **parar** (não ao esconder).
  O Chrome do e2e roda com `--autoplay-policy=no-user-gesture-required`, então o gesto não é provado por ele: contar as chamadas a `new AudioContext` antes do clique em Iniciar (devem ser 0).
- Uma sonda `window.__bmccbMetronomo` só em desenvolvimento (como `__bmccbTom` em `tom.ts`), com estado, fila e um analisador. Também amostrar a bolinha acesa a cada 25 ms contra `currentTime − outputLatency`.
- **Serviço em primeiro plano (A):** ligar o metrônomo liga o serviço (`iniciarMetronomo`/`pararMetronomo` na ponte), a notificação "Metrônomo · Parar" aparece e o botão para o clique de verdade (como o "Parar" do hino e da gravação);
  o serviço só se encerra quando hino, gravação e metrônomo estão todos parados; o wake lock não expira com o metrônomo ligado; se o Android recusar o serviço, o JavaScript é avisado e o metrônomo para com um aviso na tela.
- Para só quando a pessoa manda (botão na tela ou na notificação), quando o sistema tira o áudio (ligação, outro app: aviso na tela) ou quando um hino começa a tocar (sem fone, regra F). **Sair da aba não o para** (B: gravar com o clique no fone);
  ao desmontar a tela o `AudioContext` fica enquanto o clique estiver ligado, e é liberado ao parar.
- Respeita tema, `rem` e movimento reduzido; alvos de 3rem; textos nos 3 idiomas.

#### Decisões do responsável (2026-11-20, depois da revisão)
- **A. Tela bloqueada:** o clique **continua com a tela bloqueada e só para quando a pessoa pedir** (botão Parar, no app ou na notificação). Isso **entra na etapa 1** e
  exige **Kotlin**: um terceiro motivo no `ServicoAudio.kt`/`PonteServico.kt` (ao lado de `tocando` e `gravando`), tipo `mediaPlayback`, notificação "Metrônomo · Parar", wake lock sem limite
  enquanto ligado e uma janela de agendamento adaptativa (~100 ms com a tela à vista, ~2 s escondida, com o andamento e o compasso travados enquanto escondida). Deixa de valer o "só front".
- **B. Gravar com o clique no fone:** é um caso de uso. Regra igual à do hino: **com fone** o metrônomo e a gravação andam juntos (`foneConectado()`); **sem fone**, um som de cada vez
  (o clique do alto-falante entraria no microfone). Para isso a gravação **não pode parar ao trocar de aba** quando está protegida pelo serviço: o Gravador passa a seguir gravando em
  segundo plano e a tela mostra um aviso fixo "● Gravando 0:34 · Parar" fora da aba (a decidir onde: na barra de abas ou no miniplayer). Mexe no `Gravador.svelte` (`sair()`) e no layout.
- **C. Faixa de andamento:** de **30 a 240** bpm. O `ControleAndamento` recebe `min`/`max` por propriedade (o do player segue em 40 a 160).
- **D. Acento:** o **1º tempo é forte** e todos os outros são fracos; ao voltar ao 1º tempo, forte de novo. **Sem apoio médio** (nem no 4º tempo do 6). Compassos de 2, 3, 4 e 6 tempos.
- **E. Lembrar:** o app guarda o último andamento e compasso usados **e uma lista dos 5 a 10 últimos** (andamento + compasso, sem repetir; o mais recente no topo). Tocar num item da lista **substitui
  na hora** o que está tocando (e, se estiver ligado, segue tocando no novo). Entra na lista ao tocar em Iniciar. Chave `prefs.metronomo` `{bpm, compasso, recentes: [{bpm, compasso}]}`, validada na leitura.
- **F. Hino no miniplayer:** Iniciar o metrônomo **para** o hino que toca (e um hino que começa a tocar para o metrônomo), a menos que haja fone (aí vale a regra do B para a gravação; o hino
  continua sendo um som de cada vez com o metrônomo).
- **G. Indicador de tempo:** o responsável quer, no futuro, um **gauge de ponteiro** (como os de painel de carro) e mais de um tipo, escolhido pela pessoa. **Primeira versão: uma
  trilha com uma bolinha que desliza da esquerda para a direita** (calculada do relógio de áudio a cada quadro: passa pelas marcas dos tempos exatamente no clique, a marca do 1º tempo
  maior, e volta ao começo no 1º tempo seguinte). Com movimento reduzido, a bolinha não desliza: só a marca do tempo atual muda de estado. Depois: o gauge de ponteiro como segundo tipo
  e a opção para escolher na tela.

### Perguntas em aberto
1. **Compasso:** o formato do hino traz o `andamento` (bpm), mas **não o compasso** (2/4, 3/4, 4/4, 6/8). Para acentuar o 1º
   tempo, o conversor teria de ler o compasso da partitura e gravá-lo no `hinario.json` (ver `docs/FORMATO.md`), ou a pessoa
   escolhe o número de tempos no próprio metrônomo.
2. **Sozinho ou junto com a música?** Só como ferramenta de estudo (sem o hino tocando), também **tocando por cima da música**
   (para quem quer o pulso marcado), ou com uma **contagem inicial** de um compasso antes de a música começar?
3. **Onde fica?** Um card no player (junto de "Andamento e Tom"), uma tela própria, ou um botão no miniplayer?
4. **Aviso visual:** além do som, um pisca na tela (útil com o celular no mudo ou para quem tem dificuldade de ouvir o clique).
5. **O andamento é o do hino ou independente?** Mudar o andamento do player (−5 −1 +1 +5) muda o do metrônomo junto?
6. **Que som?** Um clique sintetizado curto (o mais leve, sem baixar nada) ou amostras de madeira e sino.

### Impacto técnico (hipóteses, não verificadas)
- **Pesquisar antes de construir** (regra do projeto): metrônomo em Web Audio é um problema conhecido, e o padrão é agendar os
  cliques com **antecedência** no relógio do `AudioContext`, e não com `setInterval`, que oscila. Registrar o que for lido.
- Compartilhar o `AudioContext` do sintetizador (`src/lib/sintetizador.ts`) para o clique ficar **alinhado à música**, e o `volume`
  independente do das vozes.
- Reaproveitar o que já existe: o `andamento` do hino e o reagendamento a partir de uma posição (`reproducao.irPara`).
- Um oscilador curto com envoltória rápida basta para o clique (o 1º tempo, mais agudo ou mais forte); nada novo para baixar.

### Critérios de aceitação (propostos)
- O intervalo entre cliques fica estável (medir o desvio no teste de ponta a ponta, como o do karaokê faz com as sílabas).
- Mudar o andamento com o metrônomo ligado vale na hora e sem estalo; o primeiro tempo é audivelmente diferente dos outros.
- Ligar e desligar o metrônomo não interrompe nem desalinha a música que está tocando.
- Respeita o tema, o `rem` e o movimento reduzido no aviso visual (o pisca não pode ser a única indicação).

---

## I-23 — Equalizar o volume dos sons gravados, para encaixarem no conjunto

- **Status:** **etapa A (nivelar cada nota) tentada e REMOVIDA em 2026-11-16**: o responsável testou e **não sentiu diferença** na caixinha do celular ("serve para nada"). **Ele vai testar no fone de ouvido**; o resto (cadeia de saída, balanço entre vozes, amostras que acabam cedo) espera essa resposta. O rascunho foi revisado pelo subagente Opus 5 (seção "Revisão")
- **Origem:** pedido do responsável, 2026-11-16: "com os sons gravados precisamos ter uma espécie de equalização nos volumes para encaixar bem... algo que não é necessário nos sintetizados".
- **Prioridade:** a definir (mexe na qualidade percebida de **toda** audição com sons gravados)

> **Aviso do rascunho:** nada aqui foi **medido**. As amostras do banco ficam fora do Git (`sons-fonte/`) e não estavam à mão; o que vem
> do código está dito como fato, o resto está marcado como **hipótese**. A primeira etapa proposta é justamente medir.

### Respostas do responsável e a etapa A (tentada e removida, 2026-11-16)

**O que o responsável respondeu às perguntas em aberto**
- **Onde se ouve o problema:** não notou em nota longa nem em hino lento. O que percebe é que, quando as quatro vozes gravadas (soprano, contralto, tenor e baixo) ficam **"na mesma
  altura"**, fica **"bagunçado"**: falta uma equalização que ajuste o nível de cada voz. *(Interpretação registrada: "altura" = volume. Se era a altura do som, o tom, esta leitura está errada.)*
- **Balanço entre as vozes:** **não** pôr o soprano à frente; deixar como está. Ele pensou em algo **mais automático**, a desenvolver aos poucos, com a audição dele no meio.
- **Saída:** ouviu **no alto-falante do celular** (som aberto). **Não testou no fone de ouvido.** **Pendência dele: testar no fone**; a hipótese é que o problema seja do som aberto e o fone o resolva.

**Etapa A: nivelar cada nota (PR #50, APK 024).** Mediu-se toda nota de cada gravado e aplicou-se, pela `velocity` do smplr, a correção em dB que leva a nota ao nível médio do instrumento, com liga/desliga em
Ajustes. **A medição se confirmou** (reproduzida de forma independente: a amplitude entre as notas de cada instrumento é de 2,5 a 10 dB, média 6,1 dB; validada com outras janelas de tempo e a curva do
celular, ela cai para 0,8 a 1,2 dB). **Mas o responsável testou no celular e não sentiu diferença**, e pediu para **remover**; foi removida (app, ferramenta, mapa e testes) no mesmo dia.

**O que fica aprendido**
- A variação entre as notas **dentro** de cada instrumento é real, mas **não é o que ele ouve como "bagunçado"**, e na caixinha do celular, que quase não reproduz o grave, uma correção de poucos dB entre notas é inaudível.
- O que **continua hipótese, e não foi tentado**: o **compressor** que atua sempre e comprime a soma das vozes (etapa C), um **balanço automático entre as vozes** (B), e as **amostras que acabam cedo**, sem laço (0b).
- **Método:** a medição acertou o número e errou o alvo. A próxima tentativa **não deve começar por uma correção medida, e sim por prévias A/B renderizadas** para o responsável escolher de ouvido, como foi feito com os timbres
  (`tools/previas-timbres.mjs`): a cadeia atual contra variantes (sem o compressor, com margem, com o grave reforçado para a caixinha), no celular e no fone. Só depois do que ele escolher se implementa.

### Esclarecimento do responsável (2026-11-17): é um equalizador de CANAIS, não de um único áudio
O responsável pediu para registrar que **o nivelador não fez efeito** e que **o que é necessário é um equalizador de canais de som** (o balanço entre as vozes, a mistura de soprano, contralto, tenor e baixo, como numa mesa de
mixagem), **e não equalizar um único áudio** (o nível das notas dentro de **um** instrumento, que foi o que a etapa A fez). Isso muda o alvo da I-23: o que ficou sem tentar, e agora é o caminho, é a **mistura entre os canais**
(o balanço entre as 4 vozes, e a cadeia de saída que as soma: o compressor), e não o nível de cada nota de cada instrumento.

### Revisão (2026-11-16, subagente Opus 5)

**Como foi feita.** Leitura crítica do rascunho contra o código, mais uma **medição offline do revisor** nas amostras locais (`sons-fonte/`, fora do Git): `ffmpeg` e as
funções do próprio `tools/analisar-timbres.py`, janela de 0,45 a 1,2 s, curva A, ganho do app, **todas as notas** da faixa de vozes dos 16 gravados. Os números
abaixo são dessa medição e **não foram reproduzidos** por quem escreveu este doc. Quatro pontos centrais foram **conferidos no código** depois: o compressor é
criado sem parâmetros e o mestre é 0,9 (`sintetizador.ts:167-170`); o smplr soma um `extraGain` de 5 por padrão e o app **não** passa `loadLoopData`; cada nota é
renderizada com 2,6 s segurada + 0,5 s de cauda (`tools/renderizar-banco.mjs`); e andamento, tom e instrumento só mudam com a música parada ou pausada (`Player.svelte`).

**Veredito.** Não está pronta para virar tarefa. O diagnóstico parte de uma **cadeia de saída incompleta** (faltam os +3,8 dB do smplr, o ganho de compensação
automático do compressor, a referência de pico e a duração das amostras). Precisa de medição, que já dá para fazer em parte.

**Fatos do rascunho que estão errados ou imprecisos**
- **Nível do sintetizado "vem de medidas":** o `nivel` é `base.nivel × fator`, e o `fator` só corrige o fator de crista para manter o RMS da tabela antiga (limite 0,5 a 2;
  `timbres.ts:117-124`). O que foi medido é o **timbre**, não a sonoridade, e no **FluidR3**, enquanto os gravados de hoje são do **GeneralUser GS**. Os órgãos não têm timbre.
- **"Trecho de 0,75 s depois do ataque":** a janela vai de 0,45 a 1,2 s depois do **início** (5% do pico), e o nível é uma média de potência de 3 alturas, dominada pela mais forte
  (a flauta ficou com mediana −26,6 dB, 2 dB abaixo do alvo).
- **Cadeia do gravado:** velocity 90 → ganho `vel²/16129` (0,50) → canal com `extraGain` 5 e volume `100²/16129` (0,62) → pan → ganho do instrumento → ganho da voz → mestre 0,9 →
  compressor. O smplr soma **+3,8 dB (×1,557)**, que a calibração ignora. O pico real de uma voz na entrada do compressor é ≈ 0,85 × 1,557 × 0,9 ≈ **1,19** (acima de 0 dBFS), e não 0,85;
  com o banco atual o limite de pico nem atua (maior pico×ganho medido: 0,41, trompa).
- **"Contrabaixo mudo acima da 59":** valia para o FluidR3. No GeneralUser GS **não há nota muda** nas faixas de voz dos 16 instrumentos. (O próprio script se contradiz: linha 44 diz "até a 57", linha 311 diz 59.)
- **Os comentários do código discordam sobre a referência de volume:** `sintetizador.ts:140` ("iguala ao da síntese equivalente"), `realista.ts:13-16` (alvo absoluto de curva A) e
  `timbres.ts:116` ("calibrados contra a síntese"). Alguém precisa decidir qual é a referência.
- **"Ao vivo" (no descarte do LUFS):** só o **volume e o mudo** mudam ao vivo; andamento, tom e instrumento só parados ou pausados. O descarte continua certo (CPU, memória, karaokê), mas o argumento muda.
- **A ferramenta mede o banco errado por padrão:** `analisar-timbres.py` usa o FluidR3 (`FONTE`). Toda medição da I-23 precisa de `--fonte sons-fonte/GeneralUserGS/amostras`.

**Hipóteses**
1. **Variação dentro do instrumento: sustentada em parte.** Amplitude entre notas na faixa das vozes (curva A, dB): trompete 2,5 · violino 3,1 · viola 4,0 · trombone 4,4 · fagote 4,9 · trompa 4,9 ·
   clarinete 5,6 · violoncelo 5,6 · oboé 6,1 · sax tenor 6,1 · tuba 6,9 · contrabaixo 7,6 · sax alto 8,4 · órgão 8,7 · flauta doce 8,8 · **flauta 10,0**. O maior salto entre notas vizinhas fica em 1,2 a
   2,5 dB (só o sax tenor passa, com 3,1). Ou seja, é uma **inclinação** (o agudo mais forte; flauta e órgão têm o máximo na nota 81), **não** notas que saltam. Falta ouvir para confirmar.
2. **Entre instrumentos: não dá para concluir.** As medianas ficaram entre −24,5 e −26,6 dB A (nível médio razoavelmente igual). Região, ataque e mascaramento pedem a mistura renderizada e o ouvido.
3. **Compressor: fortemente sustentada pela aritmética.** Padrões do Web Audio (limiar −24 dB, joelho 30, razão 12, ataque 3 ms, soltura 250 ms), mais um **ganho de compensação automático**
   (`makeupGain`, estimado em ~+5 dB, **não verificado no navegador**) e 6 ms de atraso. Uma voz sustentada chega a ≈ −22 dB A (já no joelho) e 4 vozes a ≈ −16 dB: o compressor atua **sempre**, também
   no sintetizado. O que muda entre os modos é o envelope.
4. **Volume por voz muda o balanço: sustentada.** O volume e o mudo entram **antes** do mestre; como o compressor não é linear, baixar ou silenciar uma voz **aumenta as outras**. A calibração supõe volume 1 e uma voz sozinha.

**Lacunas que o rascunho não via**
- **As amostras acabam cedo (o candidato mais forte a "sumir").** São 2,6 s segurada + 0,5 s de cauda, **sem laço** (`loadLoopData` falso, e o README do smplr o marca "experimental, can produce clicks"). Uma mínima a
  40 bpm (3 s) ou uma semibreve a 90 bpm (2,67 s) se apaga antes de acabar, e **nenhum mapa de ganho resolve isso**. Alguns instrumentos também caem durante a nota segurada (trompete até −6,1 dB; sax tenor −2,5; trompa −2,7).
- **Notas curtas:** a janela da medida pula o ataque, e uma colcheia a 90 bpm (0,33 s) é quase só ataque; o nível sustentado não a representa.
- **Transposição:** o mapa precisa ser indexado pela altura que **soa** (`midi + transposição`, ±6), nas amostras 30 a 86, com o valor da borda nas pontas.
- **Ganho por nota pela `velocity`:** o `NoteEvent` do smplr não tem campo de ganho, então **não precisa de um `GainNode` por nota**: `velocity = 90·√g`, **limitada a 127** (acima disso a nota some: o casamento de regiões
  exige `velocity <= 127`), o que dá no máximo +6 dB a partir de 90.
- **As etapas C e D mexem no sintetizado também** (a cadeia é compartilhada). Trocar o compressor por um limitador tira o ganho de compensação automático (~+5 dB, estimado): **regressão provável do volume geral** nos dois modos.
- **Falta o critério** "alternar entre Sintetizado e Gravado não muda o volume" (a referência hoje é contraditória, ver acima).
- **Vazamento pequeno:** cada `tocar()` cria compressor e mestre novos, e `parar()` desconecta só o mestre.
- **Memória (já existe, fora da I-23):** o cache por (instrumento, voz) decodifica o mesmo instrumento uma vez por voz (órgão em 4 vozes ≈ 130 MB estimados).

**Plano revisado (a ordem muda)**
0. **Medir.** Dispersão por nota **já feita** pelo revisor (falta acrescentar notas curtas com ataque, a queda de 0 a 3 s e `ffmpeg ebur128` contra a curva A). A **mistura de 4 vozes e a redução do compressor só saem com o motor real**:
   estender `tools/previas-timbres.mjs` (Chrome headless **mudo**, `OfflineAudioContext`, código do app com o smplr, `ctx.suspend(t)` amostrando `reduction`), rodando em **dois motores** (Chromium e WebKit).
   Limiares a acrescentar: **inclinação** (dB por oitava) e **queda de nota longa** (por exemplo, mais de 6 dB antes do fim).
0b. **Decidir o laço ou a cauda maior** das notas longas (`loadLoopData` ou `renderizar-banco.mjs`): hoje é o jeito concreto de a voz "sumir".
C. **Cadeia de saída** (alvo explícito, sem o ganho de compensação implícito, limitador com margem), **antes** de A e B: o compressor muda o nível de tudo, e calibrar notas antes de fixá-lo mede sobre um alvo móvel.
A. **Mapa por nota** (uma inclinação, ou âncoras a cada 3 semitons: os saltos entre vizinhas são pequenos).
B. **Encaixe entre vozes**, de ouvido.
D. Equalizador por frequência **só** se houver mascaramento.

**Perguntas em aberto: o que o revisor recomenda**
1. **Só volume**, sem timbre (decisão técnica, pode ser do projeto).
2. **Balanço:** todas iguais, com um parâmetro opcional de +1 a +2 dB para o soprano. **Só o responsável decide.**
3. **Onde se ouviu o problema:** **só o responsável responde.** Vale perguntar se foi em **nota longa ou hino lento** (separa "a amostra acabou" de "o nível está errado").
4. **Alvo de volume:** manter o percebido atual, compensando o ganho de compensação que se perder ao trocar o compressor; subir o volume no celular é decisão de ouvido **do responsável**.
5. **Saída:** curva A como base e conferir no celular (a ferramenta mede os dois); priorizar o celular **se o responsável confirmar** que é o uso principal.

**O que não foi verificado:** o valor exato do ganho de compensação no Chromium e no WebKit; os filtros `ebur128` e `loudnorm` do `ffmpeg` na prática; boas práticas de limitador em Web Audio.

**Primeiro passo concreto:** estender o `previas-timbres.mjs` para renderizar 2 ou 3 hinos com 4 vozes gravadas e com o sintetizado, gravando o nível ao longo do tempo, a redução do compressor e a queda das notas com mais de 2,6 s; juntar com a tabela por nota já
medida e **perguntar ao responsável onde ouviu o problema**. Só então escolher entre laço/cauda, cadeia de saída e mapa por nota.

### O problema
**O que o código já mostra (fatos):**
- O **sintetizado** nivela **por instrumento e por nota**: `perfilDaNota(id, midi).nivel` (`src/lib/timbres.ts`) vem de medidas, com uma âncora a
  cada 3 semitons (`timbres.json`). Por construção, uma nota não salta mais que a vizinha.
- O **gravado** tem **um único** `ganho` por instrumento (`src/lib/realista.ts`), calculado por `tools/analisar-timbres.py --calibrar` para
  todos terem o **mesmo nível médio no ouvido** (curva A, alvo −24,6 dB), medido em **só 3 ou 4 alturas** por instrumento, num trecho de
  0,75 s depois do ataque. O `velocity` é **fixo em 90** (`sintetizador.ts`). **Não há nenhuma compensação por nota.**
- Cada voz pode ter um instrumento gravado **diferente** (I-09/I-10): o conjunto é uma mistura de até 4 instrumentos de bancos de amostras,
  cada um com o seu jeito.
- A cadeia de saída é: ganho da voz (o volume que a pessoa escolhe) → mestre (0,9) → um `DynamicsCompressor` **com os valores padrão** → saída.
- O script já limita o ganho pelo **pico** (`PICO_MAXIMO` = 0,85 de amplitude numa voz sozinha, "acima disso, 4 vozes somadas passam do que o compressor segura"): o compressor já foi uma preocupação ao calibrar.
- O próprio script registra que "o banco deixa algumas notas **mudas**" (por exemplo, o contrabaixo acima da nota 59): o banco **não é uniforme**.

**Hipóteses (não medidas):**
1. **Dentro de um instrumento**, o nível varia de nota para nota (camadas de amostras, regiões afinadas e gravadas em dias e microfones
   diferentes). Um ganho único acerta a **média** e deixa notas que **saltam** ou **somem**, o que se ouve como uma voz "irregular".
2. **Entre instrumentos**, "mesmo nível médio na curva A" não basta para **encaixar**: pesam também a **região** (o grave quase some no
   alto-falante do celular: o script já tem a medida "celular", com os graves cortados), o **ataque** (percussivo x sustentado) e a
   textura de **quatro vozes somadas**. Uma tuba e um violino no mesmo nível médio não se acomodam do mesmo jeito.
3. O **compressor padrão** do Web Audio (valores da especificação: limiar −24 dB, joelho 30, razão 12, ataque 3 ms, soltura 250 ms; **conferir**)
   pode estar **agindo de forma audível** quando as 4 vozes gravadas somam, "bombeando" o volume. Com sintetizado, as amplitudes mais
   previsíveis talvez o evitem.
4. O volume que a pessoa escolhe por voz **muda o balanço** que a calibração supôs.

### O que se deseja
Ouvir um hino com as vozes gravadas **sem nenhuma voz saltando ou sumindo**, em **qualquer combinação** de instrumentos escolhida, no alto-falante
do celular e no fone, **sem que o volume geral do app mude de modo perceptível** (o alvo atual de −24,6 dB se mantém, salvo decisão em contrário).

### Perguntas em aberto
1. **"Equalizar" é igualar volumes** (por nota e entre instrumentos), **ou também mexer no timbre** (um equalizador por frequência em cada voz,
   como numa mesa de mixagem)? Recomendação: **só volumes** primeiro; o filtro por voz só se a medição mostrar uma voz **mascarando** outra.
2. **Que balanço entre as vozes?** Todas iguais, ou a melodia (soprano) um pouco à frente? É decisão de **ouvido**, do responsável.
3. **Onde se ouviu o problema?** Um exemplo concreto (qual instrumento, qual nota ou hino, celular ou fone) encurta muito a medição.
4. **Alvo de volume geral:** manter −24,6 dB ou subir (celular costuma soar baixo)?
5. **Para qual saída calibrar:** alto-falante do celular, fone, ou os dois (a ferramenta já mede os dois)?

### Caminhos possíveis (hipóteses, do mais barato ao mais caro)
**Etapa 0, medir (sempre primeiro).** Estender `tools/analisar-timbres.py` (ou uma ferramenta irmã) para medir **cada nota** da faixa das vozes de
cada gravado (curva A e "celular", janela do trecho sustentado) e relatar: a **dispersão entre notas** de cada instrumento (desvio, nota mais forte
e mais fraca, notas mudas); o nível da **mistura de 4 vozes** de um hino de amostra, renderizada offline com o **mesmo grafo** do app; e a **redução de
ganho do compressor** (`DynamicsCompressorNode.reduction`) durante a música. Só então decidir. Limiares **propostos** (a validar de ouvido): uma
diferença de ~1 dB mal se nota e **mais de ~3 dB entre notas vizinhas** incomoda; o compressor que reduz **mais de ~3 dB** com frequência merece atenção.

**A. Mapa de ganho por nota (offline).** Medir o nível de cada nota de cada gravado e guardar uma tabela de ganho por altura (todas as notas, ou
âncoras a cada 3 semitons interpoladas, como o `timbres.json` do sintetizado), aplicada ao tocar. Mesmo desenho que o sintetizado já tem. A tabela
é pequena e **mora no app** (não exige regerar o pacote de sons); a calibração roda por script e se refaz quando o banco mudar (a nota do
`realista.ts` já pede isso). Cuidado com notas mudas ou artefatos: manter um **teto** (o script já limita o ganho pelo **pico**: `PICO_MAXIMO` = 0,85 de amplitude numa voz sozinha, para as 4 somadas não passarem do que o compressor segura). Depende de como o `smplr` aceita
um ganho por nota (ver "Pesquisar").

**B. Encaixe entre as vozes.** Ponderar a calibração entre instrumentos pela **região** e pelo **papel** (se a resposta à pergunta 2 for "melodia
à frente"). É só números na mesma tabela da etapa A.

**C. Cadeia de saída.** Trocar o compressor padrão por um **limitador transparente** (limiar perto do topo, razão alta, ataque curto) que só pegue os
picos, e dar **margem** (headroom) à soma de 4 vozes em vez de comprimir. Medir antes e depois com os mesmos hinos.

**D. Equalizador por frequência em cada voz** (só se a pergunta 1 pedir): filtros passa-alta abaixo da faixa da voz e uma prateleira leve; custo de CPU no
celular por voz.

**Descartada à partida: normalizar o hino inteiro para um alvo de loudness (LUFS).** Exigiria **renderizar o hino todo** antes de tocar, e hoje o som é
gerado **em tempo real**, para mudar andamento, tom, instrumento e silenciar vozes ao vivo; renderizar de novo a cada mudança mexe no player e no karaokê
(o mesmo custo já registrado na I-22).

### Pesquisar antes de construir (regra do projeto)
- Como o `smplr` (`Soundfont`) traduz `velocity` em ganho e se aceita **ganho por nota** (opções do `start`); sem isso, um `GainNode` por nota agendada.
- Medida de loudness por padrão (**EBU R128 / ITU-R BS.1770**, ReplayGain): o `ffmpeg` que o script já usa tem os filtros `ebur128` e `loudnorm`, que
  evitam reinventar a medida; comparar com a curva A que o script usa hoje.
- Os parâmetros do `DynamicsCompressorNode` no padrão do Web Audio e boas práticas de limitador em Web Audio.
- Registrar aqui o que for lido (fonte, data, o que serviu).

### Impacto técnico (hipóteses)
`src/lib/realista.ts` (tabela de ganho por nota, no lugar de um número), `src/lib/sintetizador.ts` (`real()` e o `start` de cada nota; a cadeia do
mestre), `tools/analisar-timbres.py` (a medição) e `docs/pacote-de-sons.md` (o registro da calibração). **Sem mudança no pacote de sons** se a
tabela morar no app. Relaciona-se com a **I-15** (o sintetizado já nivela por nota), a **I-07** (pacote de sons) e a **I-09/I-10** (trocar o
instrumento por voz): quanto mais combinações possíveis, mais a calibração **por instrumento sozinha** deixa de bastar.

### Critérios de aceitação (propostos)
- **Por instrumento:** a dispersão de nível **entre notas** da faixa das vozes dele fica dentro de **±1,5 dB** (medida da etapa 0 repetida depois).
- **Entre vozes:** num hino de amostra, com **qualquer par** de instrumentos gravados na mesma dinâmica, a diferença de nível (curva A e "celular")
  fica dentro de **2 dB** (ou do balanço escolhido na pergunta 2).
- **Volume geral:** o nível da mistura fica **dentro de ±1 dB do atual** (ou do novo alvo, se a pergunta 4 mudar).
- **Compressor:** nos hinos de amostra, a redução de ganho fica **abaixo de ~3 dB** na maior parte do tempo (ou o compressor é substituído).
- **De ouvido, no celular e no fone:** o responsável ouve 5 hinos com 3 combinações de instrumentos e **não aponta nenhuma voz saltando ou sumindo**.

---

## I-25 — Verificar atualização dos pacotes (sons gravados e partituras) ao abrir o app

- **Status:** anotada, **rascunho** (a revisar com o subagente Opus antes de implementar)
- **Origem:** pedido do responsável, 2026-11-16: "seria interessante mais para frente, no importar partitura e importar sons gravados, que quando abrir ele fosse no servidor e visse se tem alguma atualização nesses pacotes .zip".
- **Prioridade:** a definir ("mais para frente"; depende da I-24 para ter onde mostrar o aviso)

### O problema
Os pacotes mudam (o banco dos sons já trocou uma vez, do FluidR3 para o GeneralUser GS; as partituras vão crescer de 5 para 480 hinos), mas **o app não sabe disso**:
- O manifesto dos sons (`src/lib/sons/manifesto.json`, com o SHA-256 de cada pacote) está **embutido no app**: um pacote novo no servidor **exige um APK novo**, e o APK antigo **recusa** o pacote novo (foi o que aconteceu no zip 010).
- As partituras **já têm** cartão próprio em Ajustes e um pacote de teste no servidor de arquivos (PR #42; as 5 partituras de amostra), baixado como os sons. O que falta é a **publicação de verdade**, que depende da autorização do autor das transcrições (ver a pergunta 6, abaixo).
- Quem instalou um pacote **não é avisado** de que há uma versão melhor, nem de que um arquivo foi corrigido.

### O que se deseja
**Ao abrir o app** (e no máximo uma vez por dia), ele pergunta ao servidor se há versão nova de cada pacote **instalado** e, se houver, **avisa sem atrapalhar** (por exemplo, o indicador "Atualização disponível" na linha do pacote em Ajustes e uma linha discreta na tela inicial), com o tamanho e uma frase do que mudou. **Nada baixa sozinho**: a pessoa toca em "Atualizar".

### Perguntas em aberto
1. **Onde mora a verdade sobre as versões?** Um **manifesto remoto** (um JSON pequeno no servidor, com versão, tamanho e SHA-256 de cada pacote, e uma frase de mudanças) que **substitui** o manifesto embutido: o app passa a aceitar pacotes novos **sem APK novo**. O embutido vira só o **plano B** offline.
2. **Como confiar no manifesto?** O SHA-256 que vem do **mesmo servidor** não protege contra um servidor comprometido. **Assinar o manifesto** (por exemplo minisign/Ed25519, com a chave pública dentro do app) fecha isso; é mais trabalho. Vale agora, ou só HTTPS e SHA-256 por enquanto?
3. **Dados móveis:** perguntar antes de baixar acima de X MB fora do Wi-Fi? (O app não sabe se a rede é paga no WebView; talvez só avisar o tamanho.)
4. **Frequência e custo:** uma consulta por dia, com `If-None-Match` (ETag) para o servidor responder "sem mudança" em poucos bytes. Sem trabalho em segundo plano (só ao abrir).
5. **Privacidade:** a consulta revela o **IP** e a **versão do app** ao servidor. Sem identificador, sem análise de uso, e o texto de privacidade do "Sobre" precisa dizer isso. Dá para **desligar** a verificação em Ajustes?
6. **Os direitos das partituras:** o servidor **só pode publicar** o pacote de partituras **depois da autorização do autor das transcrições** (ainda pendente). Antes disso, o mecanismo existe, mas o manifesto das partituras fica **vazio** (ou só em endereço privado, para teste).

### Caminhos possíveis (hipóteses)
- **Manifesto remoto** (`manifesto.json` no servidor de arquivos que já serve os sons), lido com o plugin de HTTP que o app já usa para baixar os sons; guardado no aparelho com a data da última consulta.
- **Atualização atômica:** baixa para uma pasta temporária, confere o SHA-256, e só então troca (como a importação de partituras já faz); se falhar, **fica a versão antiga**.
- **Versões:** cada pacote tem um número de versão (inteiro crescente) e, se o formato mudar, uma `versaoMinimaDoApp`; um APK velho **não** oferece um pacote que não entende (evita o "recusa o pacote novo").
- **Falha de rede é silenciosa:** sem internet, o app abre como sempre, sem erro na tela.

### Pesquisar antes de construir (regra do projeto)
Como o plugin de HTTP do Tauri trata cabeçalhos condicionais (ETag) no Android; padrões de atualização de conteúdo em apps offline-first; assinatura de manifesto leve (minisign) e verificação em Rust.

### Critérios de aceitação (propostos)
- Sem internet: o app abre **sem erro e sem demora** (a consulta tem tempo máximo curto).
- Com um pacote novo no servidor: a linha do pacote mostra **"Atualização disponível"** (texto, não só cor) e, ao tocar, baixa, **confere o SHA-256** e troca; com o arquivo corrompido, **fica a versão antiga** e mostra o erro.
- No máximo **uma consulta por dia**, e nenhuma se a verificação estiver desligada.
- Um **APK antigo** não oferece um pacote que não entende.
- O servidor de teste, com um manifesto de mentira, cobre isso num teste automatizado (o app não depende do servidor real para o CI passar).

---

## I-27 — Mostrar na tela de versão qual APK está instalado e em que estado

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-17, depois do incidente do APK 025 (a aba Partitura e o botão de baixar sumiram no aparelho; voltou ao limpar os dados; a causa não foi achada)
- **Prioridade:** a definir (pequena)
- **Nota (2026-11-20):** o responsável prefere nomear os zips de teste pelo **final do commit** (ver a I-34), e não por número; como Ajustes já mostra `Versão (commit)`, isso resolve boa parte desta ideia: falta só a linha de diagnóstico (qual hinário, quantas partituras).

### O problema
O número da versão (`0.3.0`) é o mesmo em todos os zips; só o **commit** os distingue, e o **número do zip** (025, 026) não aparece em lugar nenhum. Quando algo some, não há como saber **qual APK** está instalado nem **em que estado** (qual hinário, quantas partituras) o app está.

### O que se deseja
Na linha de versão, algo como **"0.3.0 · teste 026 (43449fe)"**, e uma linha de diagnóstico, por exemplo no card "Sobre": **"Hinário: amostra-teste · Partituras instaladas: 5"**.

### Perguntas em aberto
1. Só em APK de teste (o build recebe o número por uma variável) ou sempre?
2. O `id` do hinário e a contagem de partituras podem aparecer? (Não são dados pessoais.)

### Impacto técnico (hipóteses)
Uma variável de ambiente no build (por exemplo `BMCCB_TESTE=026`) lida pelo `vite.config.js`; a linha em Ajustes; o texto nos 3 idiomas; um teste.

---

## I-29 — Filtro de ruído no Gravador (tipo Krisp)

- **Status:** anotada, rascunho (2026-11-19). Nada implementado.
- **Origem:** pedido do responsável, 2026-11-19: "um filtro de som tipo Krisp; ele é de graça? dá uma verificada".
- **Prioridade:** a definir (depois de o Gravador estar estável no aparelho: ver a **I-03**).

### O problema
Quem grava em casa ou no ensaio capta ventilador, trânsito, conversa ao fundo e chiado de microfone. Para mandar o áudio ao instrutor (botão **Enviar**), um fundo mais limpo ajuda a ouvir a voz ou o instrumento.

### O Krisp é de graça? (verificado 2026-11-19, só por pesquisa; **confirmar na fonte oficial antes de decidir**)
- **O aplicativo** do Krisp tem um plano gratuito limitado (as fontes citam cerca de **60 min por dia** de cancelamento de ruído; uma fonte fala só em teste de 7 dias). Isso é um app **para o computador e o celular**, não algo que dê para **embutir** no nosso app.
- **Para embutir** existe o **Krisp SDK** (C, JavaScript/WASM, Python, Node, Go, Rust). Ele é **comercial**, com preço e licença **à parte** (planos para desenvolvedores e empresas, sob contato); **não achei preço nem um plano gratuito para desenvolvedores**. É código fechado, e o app é de teste fechado, sem receita e sem servidor: **não serve** sem acordo comercial.
- Conclusão: **o Krisp em si não é uma opção gratuita para este app.** As opções abaixo fazem o mesmo trabalho sem custo.

### O que se deseja
Uma opção **"Reduzir ruído"** no Gravador, **desligada por padrão**, que grave com o ruído de fundo atenuado, **sem enviar áudio para fora do aparelho** (tudo local, como o resto do app).

### Alternativas gratuitas (a escolher)
1. **Supressão de ruído do próprio navegador/Android.** Hoje o app a **desliga de propósito** (`getUserMedia` com `noiseSuppression: false`, `echoCancellation: false`, `autoGainControl: false`, em `src/lib/gravador.ts`) para o áudio sair fiel. Ligar `noiseSuppression: true` é **uma linha**, sem biblioteca, sem peso no APK. Qualidade varia por aparelho (usa o filtro do sistema ou do WebRTC) e **não dá para ajustar**.
2. **RNNoise em WebAssembly** (rede neural pequena, **licença BSD**, feita para voz; há pacotes prontos para o navegador, como `@sapphi-red/web-noise-suppressor`, MIT, e o `@shiguredo/noise-suppression`, Apache-2.0, cujo `.wasm` do RNNoise tem aviso de licença próprio). Roda num `AudioWorklet` entre o microfone e o `MediaRecorder`, **local e offline**, com custo pequeno de CPU e de tamanho. Qualidade boa para fala. Conferir a manutenção do pacote (uma fonte diz que há projetos parados desde 2024) e **guardar o aviso de licença** no app.
3. **DeepFilterNet3** (rede neural aberta, **licença Apache-2.0 ou MIT**, a **mais próxima do Krisp em qualidade para fala** entre as gratuitas; o RNNoise é mais leve e mais simples, mas de qualidade menor). Há pacotes prontos para o navegador que rodam em `AudioWorklet` + WebAssembly (por exemplo `deepfilternet3-noise-filter`, feito para o LiveKit; pede Chrome 91+ e suporte a SIMD no WASM). Custo: modelo maior e mais CPU que o RNNoise, o que pesa em celular fraco e na bateria. **Não achei comparação direta de qualidade e de latência entre DeepFilterNet3, RNNoise e Krisp**: só um teste no aparelho do responsável decide. Verificar a licença no repositório oficial (a informação veio de pacotes de terceiros).

**Variação de momento (vale para qualquer das três):** **filtrar depois**, sobre a gravação guardada, em vez de ao vivo. A gravação original **fica intacta** e a pessoa gera uma cópia limpa e compara. É mais seguro para a qualidade e mais trabalho (decodificar, processar, recodificar em Opus), e ocupa o dobro de espaço. Não é uma quarta tecnologia: é *quando* o filtro roda.

### Comparação das três opções (qualitativa, 2026-11-19)

Notas tiradas da pesquisa e do que se sabe dessas tecnologias; **não achei teste lado a lado** entre elas. Só um teste no aparelho do responsável decide. A numeração é a da lista de alternativas acima; "filtrar depois" não entra na tabela porque é uma variação de momento, que vale para qualquer das três.

| | **1. Filtro do Android/navegador** | **2. RNNoise (WASM)** | **3. DeepFilterNet3 (WASM)** |
|---|---|---|---|
| **Custo** | Grátis | Grátis | Grátis |
| **Licença** | Já faz parte do sistema | BSD (pacotes de navegador em MIT ou Apache-2.0) | Apache-2.0 ou MIT (conferir no repositório oficial) |
| **Qualidade para fala** | Média, varia por aparelho | Boa | A melhor das três, perto do Krisp |
| **Ruído constante** (ventilador, chiado) | Bom | Bom | Muito bom |
| **Ruído variável** (conversa, trânsito) | Fraco a médio | Médio | Melhor |
| **Peso no APK** | Nenhum | Pequeno | Maior (modelo maior) |
| **CPU e bateria** | Baixo (feito pelo sistema) | Baixo (cerca de 10 ms de atraso) | Mais alto: pesa em celular fraco |
| **Esforço para implementar** | Uma linha (`noiseSuppression: true`) | Médio: `AudioWorklet` entre o microfone e o gravador | Médio a alto: igual ao RNNoise, mais teste de desempenho |
| **Dá para ajustar** | Não | Pouco | Pouco |
| **Funciona offline** | Sim | Sim | Sim |
| **Risco para música** (notas longas de instrumento) | Médio | Médio a alto (feito para fala) | Médio a alto (feito para fala) |
| **Quando escolher** | Primeiro teste, sem custo nenhum | Se a opção 1 não bastar | Se o RNNoise ainda ficar fraco e o celular aguentar |

**Para decidir:** voz em casa, a 1 pode bastar e a 3 é o teto de qualidade. Instrumento ou coro: nenhuma é segura; vale manter o **original** e gerar uma **cópia limpa** para comparar. Celular fraco ou bateria: ficar na 1 ou na 2. **Não se sabe** o quanto a 3 é melhor que a 2 no celular do responsável nem quanto pesa na bateria.

### Risco principal: é um app de **música**, não de reunião
Esses filtros foram feitos para **fala** e tratam som contínuo e estável como ruído. **Notas longas de instrumento** (órgão, violino, flauta) e vozes em coro podem sair **apagadas ou "aguadas"**. Por isso: desligado por padrão, rótulo claro, e, se possível, **ouvir antes e depois** (filtrar depois faz isso naturalmente). O **medidor** deve continuar lendo o sinal **original**, para o aviso de "sem som" não depender do filtro.

### Perguntas em aberto
1. O uso é para **voz** (cantar, falar) ou também **instrumento**? Se for instrumento, vale mais **filtrar depois** (ouvir os dois) do que o filtro ao vivo.
2. Começar pela opção **1** (uma linha, ver se já basta no celular do responsável), depois o **RNNoise** (2) e, se ainda ficar fraco, o **DeepFilterNet3** (3)?
3. Filtrar **ao vivo** (o que se grava já sai limpo) ou **depois** (cópia limpa ao lado da original)?
4. O **Afinador** nunca usa o filtro (precisa do som cru)? (Hipótese: sim.)
5. A escolha fica lembrada nos Ajustes ou por gravação?

### Impacto técnico (hipóteses, a verificar)
- `src/lib/gravador.ts`: o fluxo do microfone passaria por um nó de filtro (`AudioWorkletNode`) até um `MediaStreamAudioDestinationNode`, que alimenta o `MediaRecorder`; o `AnalyserNode` do medidor liga no microfone **cru**.
- Pacote do filtro e do `.wasm` no front (sem CDN, o app funciona offline), carregados **só ao ligar a opção**; teste de peso do APK.
- Teste: o filtro com um sinal de ruído branco sintético (a energia cai) e com um tom puro (a energia se mantém), no Vitest; no Chrome de teste, `--use-fake-device-for-media-stream`.
- i18n nos 3 idiomas; licença do filtro em `docs/` e na tela "Sobre".

### Critérios de aceitação (propostos)
- Há uma opção **Reduzir ruído**, desligada por padrão; ligada, uma gravação com ventilador ao fundo sai nitidamente mais limpa **no aparelho do responsável**.
- Uma nota longa de instrumento ou o canto continuam audíveis e sem distorção evidente (teste de ouvido, ligado e desligado).
- Nada sai do aparelho; funciona offline.
- O medidor e o aviso de "sem som" continuam como hoje.
- O Afinador não muda.

---

## I-30 — Gerar o hinário completo a partir dos projetos do Enéias

- **Status:** **em andamento** (2026-11-20): os **480 hinos do Dó estão convertidos** (hinário `3d349101…`: 1.121 correções de letra, coro e final em blocos, ligaduras unidas, introdução até a última nota), as **480 partituras estão geradas** (pacote 005) e os APKs de teste (até o 045) as levam; o processo é reproduzível por `pipeline-480/run.sh` (fora do Git). **Falta:** a autorização do Enéias, os outros 10 tons, os coros 1 a 6 e as letras pendentes (61, 62, 185, 189, 198, 238 e 475).
- **Origem:** o responsável, 2026-11-19: o **Enéias respondeu** e é o **dono dos repositórios de onde tiramos os arquivos do MuseScore (`.mscx`)**. Falta registrar aqui o que ele respondeu.
- **Prioridade:** a definir
- **Projetos do Enéias (fonte dos `.mscx`), um repositório por tonalidade** (lista dada pelo responsável em 2026-11-19). **Clonados em 2026-11-19** (clone raso) em `~/Development/auxiliar/` (fora do Git do app). **Cada um tem o hinário nº 5 inteiro** (486 `.mscx`: `hino-1` a `hino-480` e `coro-1` a `coro-6`, ~120 MB), **transposto** para os instrumentos da tonalidade: não é uma divisão por hinos. Os 5 hinos de amostra do app são **idênticos, byte a byte, aos do repositório Dó** (`do/musescore/xml/hino-N.mscx`, commit `0f6ab3d` na clonagem); os outros 6 diferem (transposição). Há também PDFs prontos (`<tom>/pdf/final.pdf`) e capa (`misc/capa.png`):
  - [`ccb-hinario-5-do`](https://github.com/eneiasramos/ccb-hinario-5-do) (Dó; o único que os docs já citavam, "todos os direitos reservados", sem licença; ver `docs/pacote-de-partituras.md`)
  - [`ccb-hinario-5-re`](https://github.com/eneiasramos/ccb-hinario-5-re) (Ré)
  - [`ccb-hinario-5-mib-2s`](https://github.com/eneiasramos/ccb-hinario-5-mib-2s) (Mi bemol, 2 s)
  - [`ccb-hinario-5-fa`](https://github.com/eneiasramos/ccb-hinario-5-fa) (Fá)
  - [`ccb-hinario-5-sol`](https://github.com/eneiasramos/ccb-hinario-5-sol) (Sol)
  - [`ccb-hinario-5-la`](https://github.com/eneiasramos/ccb-hinario-5-la) (Lá)
  - [`ccb-hinario-5-sib`](https://github.com/eneiasramos/ccb-hinario-5-sib) (Si bemol)
  - *A preencher (depois da autorização, sem baixar antes):* quais hinos estão em cada repositório, a pasta dos `.mscx`, o ramo e o commit usados, e o que significa o `2s` em `mib-2s`. **Este card existe para apontar para eles.** Já foi extraído antes: os **5 hinos de amostra** (`content/amostras/`, fora do Git) e o conversor `tools/mscx2json`. Hinários 1 a 4: nenhuma fonte encontrada.

### Já está no plano (não duplicar)
Este card **executa a "Etapa 5 — Conteúdo completo"** de [`roadmap-fase-2.md`](roadmap-fase-2.md) (e a seção 3 de [`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md)), que já prevê: converter os 480 hinos; **decidir sobre os coros 1 a 6** (hoje ignorados pelo conversor); revisar o que só foi testado com partituras fictícias (ligaduras, repetições, quiálteras, finais diferentes do 457); escrever o `correcoes.json` dos defeitos de letra (I-05); confirmar direitos de letras e partituras com a CCB.

**Trava vigente:** *"Sem a autorização, não baixar mais nada"* e *"não baixar mais arquivos dele enquanto isso"*. Então **nenhum subagente clona ou baixa os `.mscx` antes de a resposta do Enéias estar registrada** (o que ele autoriza e como quer o crédito) e de o responsável liberar.

### O problema
Hoje só há 5 hinos de amostra (`content/amostras/`). O app precisa do hinário todo, e o conteúdo vem de terceiros.

### O que se deseja
Converter **todos** os `.mscx` dos repositórios do Eneas (`tools/mscx2json`, depois `tools/gerar-partituras.py`) e montar o hinário e os pacotes, com um relatório do que converteu e do que foi recusado.

### Plano proposto (subagentes)
- **Fonte única: o repositório Dó** (som real, sem transposição de instrumento; é de onde saíram as amostras). Os outros 6 são o mesmo livro transposto para instrumentos; o app já transpõe (Andamento e Tom), então **não precisam ser convertidos** (servem, no máximo, para conferir um hino). *Hipótese a confirmar com o responsável.*
- **Lotes de 30 hinos, no máximo, por subagente:** os 480 hinos do Dó em 16 lotes (1–30 … 451–480) e um 17º lote com os 6 coros (ainda sem decisão, ver acima).
- Cada subagente **só roda o pipeline do seu lote e devolve um relatório**: não edita código nem arquivos compartilhados; escreve numa pasta própria (`lote-NN/`).
- O relatório lista: hinos convertidos; hinos recusados e o motivo; anomalias (final expandido, repetições, pausas, ligaduras, letra sem sílabas, defeitos de letra para o `correcoes.json`).
- **Lote-piloto primeiro** (hinos 1–30) para validar o formato do relatório; depois os outros em paralelo.
- A consolidação (manifesto, pacote, PR) fica numa só sessão, no fim.

### Tamanho e divisão (estimativa a partir dos 5 hinos de amostra; ~480 hinos, a confirmar)
| Peça | Amostra (5 hinos) | Por hino | ~480 hinos |
|---|---|---|---|
| `.mscx` (fonte, **não** vai ao app) | 524 KB | ~105 KB | ~50 MB |
| Hinário `.json` (letra, compassos) | 35 KB (49,9 KB com sincronia e karaokê) | 7 a 10 KB | **3,4 a 4,8 MB** |
| Partituras `.zip` (retrato + paisagem) | 228 KB | ~46 KB | **~22 MB** (só retrato: ~11 MB, a medir) |
| Sons gravados (já existe) | | | 38 MB |

A amostra tem hinos de 42 a 178 KB de `.mscx`, então o total real pode variar uns ±30%.

**Proposta de divisão (a decidir):**
- **Nada de hino embutido no APK** (regra de direitos já vigente: o APK público sai sem conteúdo). O APK segue pequeno.
- **Hinário em um pacote só** (~5 MB): é texto, cabe em um download, e a lista de hinos precisa estar completa para a busca.
- **Partituras em pacotes por faixa de 100 hinos** (5 zips de ~4,5 MB cada), baixados **sob demanda** (por faixa ou "todas"), com Remover por faixa. Motivos: 22 MB num zip só vira ~29 MB de texto base64 na ponte do Tauri (o `FORMATO.md` já avisa do peso), pesa para quem só quer alguns hinos, e um erro no meio obriga a baixar tudo de novo.
- **Mudança no app:** hoje a instalação **troca a pasta `partituras/` inteira**; com várias faixas ela precisa **acrescentar** (e o card mostrar "faixas instaladas"). O manifesto passa a listar as faixas, cada uma com tamanho e SHA-256.
- Se o servidor ficar caro de manter, a alternativa é **retrato só** no pacote base e a paisagem como faixa à parte.

### Resultado dos 16 lotes (2026-11-19, fora do Git em `~/Development/auxiliar/saida/`)
- **480 de 480 hinos do Dó convertidos, 0 recusados** (coros fora). Cada `lote-NN/relatorio.md` traz o detalhe. Os SVG passaram só no `verifica_svg.py` dos subagentes: **o `svg::limpar` do app ainda não rodou**.
- **Correções da letra:** os subagentes propuseram **1.121 correções em 354 hinos** (627 trocar, 250 quebrar_antes, 195 juntar, 49 separar), unidas em `correcoes-unificado.json`; o conversor as aplicou todas (0 "NÃO aplicada"), mas **"aplicada" só prova que casou com o texto, não que a letra ficou certa** (no hino 130 uma quebra aplicada não surtiu efeito). **(Os hinos 1 a 30 ganharam as suas em 2026-11-19: ver "Estado do `hinario.json`".)**
- **Letras trocadas pelo OCR** (`I` por `l`, `c`/`ç`/`q` por `o`: "Iuz", "peIo", "mãc"...): 24 trocas de mesmo tamanho aplicadas em `hinario-480-v2.json`. Sobram `Escu`, `Visia`, `Quanê`, `Ede`, `Ee` (dúvida).
- **Dúvidas para o responsável:** cerca de 300 nos relatórios (grafia, texto que falta na fonte, hífen de pronome "Faz-me"/"Dá-nos", que entrou por regra de ortografia e não por evidência do `.mscx`).
- **Limites do formato de correções / conversor** (pedidos repetidos pelos subagentes): sem verbo para **mover sílaba entre estrofes** (ex.: refrão do 475), **juntar linhas**, **recuperar sílaba que está fora das notas** (finais de estrofe dos hinos 61 e 62), nem casar `_` literal; falta um `--mostrar-silabas`, tratar sílaba terminada em ` -` e dizer o compasso nos avisos de "notas do meio omitidas"; `varrer_letra.py` e `verifica_svg.py` têm o caminho do lote 01 fixo.

### Estado do `hinario.json` (2026-11-19, `hinario-480-final.json`, fora do Git)
**Atualização (hinos 1 a 30):** o piloto não tinha tido a etapa de correções. Um subagente propôs **218 correções em 29 hinos** (o 12 não precisa; 99 trocar, 59 juntar, 53 quebrar_antes, 7 separar), todas aplicadas (0 "NÃO aplicada"), e o `run.sh` foi refeito com elas (hinos 1 a 30 mudaram, só na letra; os demais ficaram iguais; 480 hinos válidos). **45 são hífen de pronome ("Faz-nos")**, marcadas no `comentario` como "ortografia, sem evidência no .mscx" para o responsável vetar em bloco. **Sobram sem correção possível:** `_-` literal nos hinos 19, 24 e 25, e linhas quebradas no meio da frase (hino 2, estrofe 2). **Dúvidas do lote 1** (14, em `lote-01/relatorio-correcoes.md`): texto faltando nos hinos 6, 26, 28 e 29; grafia ou sentido em 17, 21, 23, 24 e 26; quebras de verso sem pista em 13, 18, 21 e 25; o acento do título do 28 ("ceú").
**SVG:** os 60 SVG do lote 01 foram refeitos com o gerador de depois da PR #82 (tinham sido gerados antes, sem `data-t`, então o app só marcaria o compasso). Os 960 SVG do pacote têm `data-t` (retrato e paisagem com a mesma contagem), o limpador do app os aceitou (`svgs_gerados`) e o pacote passou no `conteudo_real`.

Os 480 hinos do Dó, com as 1.121 correções dos lotes, as letras trocadas pelo OCR e correções manuais do responsável por cima (hinos 2, 61, 62, 83, 96, 110, 143, 178, 185, 189, 198, 238 e 475). **Validado** (480 números, 1 a 480; marcas do karaokê dentro de cada linha; mesmo número de linhas que a letra). **Reproduzível (2026-11-19):** `bash ~/Development/auxiliar/ferramentas/pipeline-480/run.sh` regera o arquivo do zero (fora do Git): une as correções dos lotes, converte com o `mscx2json`, aplica por cima, em ordem, os ajustes do responsável (letras trocadas pelo OCR, finais truncados, refrão partido) e valida. Cada ajuste confere o texto que vai trocar e **falha** se não bater. O resultado saiu **idêntico byte a byte** ao arquivo anterior (SHA-256 `e6dacd03…`, antes das correções dos hinos 1 a 30). **O app já leu este arquivo** (teste `conteudo_real`, ver abaixo). **O que os ajustes manuais ainda precisam do conversor:** verbos para mover sílaba entre estrofes, juntar linhas e recuperar sílaba fora das notas. **Atualização (2026-11-20):** o `run.sh` ganhou o passo `10-coro.py` (separa o coro de 309 hinos) e o `11-final.py` (separa o final de 33 hinos), depois dos ajustes manuais, porque estes dependem do número da linha; o conversor usado por ele é o da `main` com o coro e o final em bloco desligados, e o hinário atual é o `3d349101…`.
- **Partituras dos 480 hinos conferidas no app (2026-11-19):** zip único `partituras-480.zip` (480 partituras, todas com paisagem, 18,7 MiB, SHA-256 `7e761027…`, fora do Git) montado com `tools/montar-pacote.py` das 16 pastas de lote. Pelo teste `conteudo_real` (leitor e `svg::limpar` do app, ver `docs/pacote-de-partituras.md`): **o hinário de 480 hinos foi lido, 480 partituras importadas, 0 recusadas, todas lidas de volta (retrato e paisagem)**. **Não testado:** num celular (22 MB de zip viram ~29 MB de texto na ponte do Tauri) nem a divisão em faixas de 100; **não publicado** (sem acesso ao servidor e sem a autorização do Enéias).
- **Causa de vários defeitos (responsável):** a **ligadura por baixo das notas confunde o OCR** do autor, e o final da estrofe vem escrito uma vez, sob a estrofe 1 (hinos 61, 62, 189, 198).
- **Pendente (o responsável decidiu deixar como está por enquanto):** 61 (frase "Contigo na luz, ó meu Redentor…"), 62 ("implo-re Ti" e a quebra da estrofe 4), 189 (fim da estrofe 1), 185 (trecho partido da estrofe 1), 238 ("nhor," solto e fim da estrofe 3), 475 (fim da estrofe 3 e "O sano Evangelho"), as dúvidas de grafia dos relatórios de lote.

### Regra do refrão no conversor (2026-11-19)
O refrão vem escrito depois das estrofes, na camada da estrofe 1, mas com as primeiras sílabas marcadas como estrofe 2 (hino 5: "A Ro cha" como estrofe 2). O conversor ganhou a regra
`refrao_com_estrofe_trocada` (`tools/mscx2json/src/main.rs`, com 5 testes e descrita no README do conversor): depois do último instante com mais de uma estrofe cantando, o que sobra é refrão
e vai para uma estrofe só. Medido nos 480 hinos do Dó: **131 recebem a correção** (aviso "refrão com estrofe trocada"), e só a letra muda. Sem essa regra o hino 5 sai com "celestial" colado no fim
da linha 4 e "A Rocha" no fim da estrofe 2.

### Perguntas em aberto
1. O que o Enéias respondeu, e **o que ele autoriza** (uso, redistribuição, crédito)? Define o que pode entrar no repositório **e se os pacotes podem ficar num repositório público do GitHub (Releases) ou só no servidor próprio** (ver I-31).
2. URLs, ramos e estrutura dos repositórios dele; os nomes dos arquivos seguem a numeração do hinário?
3. Total de hinos e se há hinos com mais de uma versão ou sem partitura.
4. Como acompanhar atualizações dele (clonar numa pasta de trabalho, ou submódulo)?

### Impacto técnico (hipóteses, a verificar)
- **Direitos:** conteúdo de terceiros **nunca** entra no CI nem em *release* público (`BMCCB_PACOTE`, ver `docs/release-e-apk-no-github.md`); os `.mscx` ficam fora do repositório, numa pasta local, e só os zips/JSON gerados seguem o fluxo atual.
- O pipeline já existe; o risco está nas **anomalias** dos hinos reais (a I-26 já listou pausas, enfeites e ligaduras).
- Tamanho do pacote de partituras e do hinário completo (hoje 155 KB para 5 hinos).

### Critérios de aceitação (propostos)
- Todos os hinos convertidos ou com **motivo de recusa registrado**.
- Relatório consolidado por lote e um total.
- Nenhum conteúdo de terceiros no repositório nem no CI.
- Crédito ao Eneas e a origem registrados (`docs/licencas-de-terceiros.md` e tela "Sobre").

---

## I-31 — Servir hinário e partituras em produção (GitHub, com nginx no Vidar como reserva)

- **Status:** anotada, **rascunho** (2026-11-19). **Consolidada na [I-34](#i-34--distribuição-pelo-github-apk-ios-futuro-sons-gravados-partituras-e-hinário)** (2026-11-20), que junta esta ideia, o APK por tag e o iOS.
- **Origem:** o responsável, 2026-11-19: "quando for para produção de fato, subir nginx com compose para servir esses dados do Vidar"; endereço provável **`bm.driit.co`** ou **`bibliotecamusical.driit.co`**.
- **Prioridade:** a definir (depende da autorização do Enéias, I-30)

### O problema
Hoje os pacotes (partituras e sons) saem de um link público do File Browser (`fb.hm.hv2.xyz`), que baixa a **pasta inteira em zip** e não é feito para servir arquivo. Com o hinário completo (hinário ~4 MB, partituras ~20 MB em zip, sons 38 MB) e publicação de verdade, o servidor precisa de endereço próprio e estável.

### O que se deseja
**Principal: GitHub Releases** (ver a seção abaixo). **Reserva opcional:** um **nginx num `docker-compose`, no Vidar**, servindo só arquivos estáticos: o hinário, os pacotes de partituras (por faixa de 100 hinos, ver I-30) e os sons, com os manifestos. Endereço **`bm.driit.co`** (curto) ou **`bibliotecamusical.driit.co`** (claro).

### Alternativa gratuita: servir de dentro do GitHub (ideia do responsável, 2026-11-19)
Dá para hospedar os pacotes **sem servidor**, em um **repositório público só dos pacotes** (separado do código, para o CI e o histórico do código ficarem sem conteúdo de terceiros):
- **GitHub Releases (a melhor):** até **2 GiB por arquivo**, sem cota de banda declarada, URL estável por arquivo (`github.com/<dono>/<repo>/releases/download/<tag>/partituras-001.zip`, ou `releases/latest/download/…`), sem zip de pasta. Cabem folgados o hinário (~4 MB), as partituras (~19 MB) e os sons (38 MB).
- **GitHub Pages:** site de até 1 GB e ~100 GB/mês de banda (limite flexível), com **domínio personalizado** (`bm.driit.co` poderia apontar para ele).
- **Não servem:** `raw.githubusercontent.com` (limita requisições, é para texto pequeno), **Git LFS** (1 GB/mês de banda) e **repositório privado** (o app não sabe se autenticar).
- **No app:** `capabilities/default.json` passa a liberar `github.com` e o domínio para onde ele redireciona os downloads (`objects.githubusercontent.com`; a verificar), o que pede **APK novo**; o SHA-256 do manifesto continua valendo.
- **O que decide é a autorização do Enéias (I-30):** publicar num repositório público é **distribuir** o trabalho dele (hoje "todos os direitos reservados") e o GitHub pode derrubar o conteúdo se houver reclamação. A regra vigente (nada de terceiros em *release* público) vale até ele autorizar.
- **Decisão do responsável (2026-11-19): servir pelo GitHub, que fica melhor que o servidor próprio** (sem custo nem manutenção, mais banda e disponibilidade). **GitHub Releases é o principal**; o **nginx no Vidar vira reserva opcional** (bm.driit.co), caso o conteúdo seja derrubado ou o GitHub mude as regras. **Riscos:** ponto único (uma reclamação de direitos derruba o repositório inteiro, então **guardar uma cópia local dos pacotes**) e a **autorização do Enéias antes de publicar**. O app poderia tentar um endereço e cair no outro (a verificar; hoje o manifesto tem um endereço só).

### Perguntas em aberto
0. **Reserva:** vale subir o nginx no Vidar como segunda fonte (e o app cair nele), ou só o GitHub e uma cópia guardada?
1. **Nome do domínio:** `bm.driit.co` ou `bibliotecamusical.driit.co`?
2. **Acesso:** público, ou atrás de alguma proteção? O app não sabe pedir senha; o conteúdo é de terceiros (I-30), então a **autorização do Enéias** decide se pode ser público.
3. **Onde vive o proxy reverso e o TLS** no Vidar (já há um, ou o compose traz o seu)?
4. **Cache e ETag:** o nginx entrega `ETag`/`Last-Modified`, o que ajuda a atualização automática de pacotes (I-25).
5. **Estrutura de pastas e nomes** estáveis (`/partituras/partituras-NNN.zip`, `/sons/`, `/hinario/`), em vez do zip de pasta do File Browser; o app hoje acha o zip de dentro pelo nome.

### Impacto técnico (hipóteses, a verificar)
- `src-tauri/capabilities/default.json` hoje só libera `https://fb.hm.hv2.xyz/*`: o endereço novo entra ali e nos manifestos (`src/lib/partituras/manifesto.json`, `src/lib/sons/manifesto.json`), o que pede **APK novo**.
- Com arquivo servido direto (não zip de pasta), o app pode baixar o arquivo certo sem abrir o zip de fora.
- Compose enxuto: `nginx:alpine`, um volume só-leitura com os pacotes, cabeçalhos de cache, `Content-Type` correto, sem listagem de diretório.
- Nada de conteúdo de terceiros no Git nem no CI (regra vigente).

### Critérios de aceitação (propostos)
- O app baixa hinário, partituras e sons do endereço novo, conferindo tamanho e SHA-256 do manifesto.
- Trocar um pacote no servidor não exige mexer no compose.
- O endereço não lista diretórios nem expõe nada além dos pacotes.

---

## I-32 — Afinador: ouvir e medir (etapa 2 da I-13)

- **Status:** anotada (2026-11-20). A etapa 1 (dar o tom) está feita e arquivada ([`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md), I-13); o texto completo da especificação
  (decisões, esboço da tela, critérios de aceitação da etapa 2) está em [`archive/ideias-implementadas.md`](archive/ideias-implementadas.md), seção I-13.
- **Origem:** pedido do responsável, 2026-11-14: com **fone de ouvido**, escutar a voz ou o instrumento e mostrar num **medidor** se a nota está **baixa ou alta**.
- **Prioridade:** a definir
- **O que falta:** o teste do microfone no aparelho (permissões, fone com fio e Bluetooth), o detector de altura (`pitchy`), os filtros e o ponteiro do medidor; **dar o tom continua funcionando** se a permissão for negada.
  O `afinador.ts` já tem as contas de cents (`centsEntre`, `notaMaisProxima`).

---

## I-33 — Negrito para o coro e o final

- **Status:** anotada (2026-11-20)
- **Origem:** o hinário impresso mostra o coro **em negrito e separado** da estrofe, sem número (hinos 398 e 457); o coro e o final já saem como blocos próprios (I-19), mas ainda em texto normal.
- **Prioridade:** a definir (pequena)
- **O que se deseja:** que o bloco "Coro" e o bloco "Final" apareçam em negrito na aba Letra, como no impresso. Só o app (`+page.svelte`, CSS do `.estrofe`), sem mexer no hinário nem nos pacotes. Ver o contraste
  nos temas (alto contraste) e se o negrito atrapalha o destaque da sílaba que soa.

---

## I-34 — Distribuição pelo GitHub: APK, iOS (futuro), sons gravados, partituras e hinário

- **Status:** anotada, **rascunho** (2026-11-20). Junta o que estava espalhado: a **I-31** (servir hinário e partituras pelo GitHub Releases, com o nginx no Vidar como reserva),
  [`release-e-apk-no-github.md`](release-e-apk-no-github.md) (o APK por tag), a nota "Depois: GitHub Releases" de [`pacote-de-sons.md`](pacote-de-sons.md) e o iOS de
  [`roadmap-pendencias.md`](roadmap-pendencias.md) (seção 2). Nada disto roda ainda.
- **Origem:** o responsável, 2026-11-19 (servir pelo GitHub, "melhor que o servidor próprio") e 2026-11-20 ("fazer release também, vários dias sem release"; "disponibilizar os pacotes no GitHub:
  APK, iOS no futuro, sons gravados, partituras").
- **Prioridade:** a definir. **Trava de tudo o que é conteúdo:** a **autorização do Enéias** (I-30). O que é só código (o APK sem hinos) não depende dela.

### O problema
Hoje cada coisa sai de um lugar: o APK de teste vai para o Nextcloud, na mão, com o hinário embutido (teste fechado); as partituras e os sons saem de um **link público do File Browser** que baixa a **pasta inteira em zip**
(`fb.hm.hv2.xyz`, ~500 KB/s); e **não há tag nem release** (a versão é `0.3.0` em todos os zips). Não há endereço estável por arquivo, nem jeito de uma pessoa de fora instalar o app sem pedir o zip ao responsável.

### O que se deseja
**Um só lugar, o GitHub, para tudo o que o app e as pessoas baixam**, em dois tipos de release:

| Tipo | Onde | Tag (exemplo) | O que leva |
|---|---|---|---|
| **Release do app** | repositório do código | `v0.4.0` (pré-lançamento enquanto for `0.x`) | **APK assinado, sem hinos embutidos**, com o SHA-256; no futuro o **iOS** (build do CI para TestFlight) |
| **Release de conteúdo** | **repositório público só dos pacotes** (nome a definir, por exemplo `biblioteca-musical-ccb-pacotes`), separado do código para o CI e o histórico do código ficarem sem conteúdo de terceiros | `partituras-006`, `sons-orgao-001`, `hinario-001` | o `.zip` do pacote, o manifesto e o SHA-256 |

- **URL estável por arquivo:** `github.com/<dono>/<repo>/releases/download/<tag>/<arquivo>`, sem zip de pasta (o app deixa de abrir o zip de fora). Até **2 GiB por arquivo**, sem cota de banda declarada: o hinário (~4 MB),
  as partituras (~19 MB) e os sons (~38 MB) cabem folgados.
- **Atualização automática (I-25):** um release fixo `indice` guarda os manifestos (`partituras.json`, `sons.json`, `hinario.json`), trocados a cada publicação; o app lê esse índice ao abrir e oferece o pacote novo.
  Sem isso, trocar de pacote exige **APK novo** (o manifesto vai dentro do app, como hoje).
- **Quem publica o conteúdo é a máquina do responsável, não o CI:** o conteúdo é de terceiros e **nunca entra no CI**. Um script local (`tools/publicar-pacote.sh`: gera o manifesto, `gh release create`, baixa de volta e confere o SHA-256)
  faz o envio; o GitHub só hospeda. O CI fica só com o **APK sem hinos** (`apk.yml`, de [`release-e-apk-no-github.md`](release-e-apk-no-github.md)).
- **iOS (futuro):** o GitHub tem máquinas macOS (de graça em repositório público), então o CI consegue **compilar**; **instalar** exige a conta do **Apple Developer Program** (~US$ 99 por ano), com certificado e perfil nos segredos.
  Sem a conta só sai build de simulador. A alternativa é uma **PWA** instalável. Fica fora desta ideia até haver conta.

### Nome dos arquivos: o fim do commit, e não um número (pedido do responsável, 2026-11-20)
O responsável **não gosta da numeração sequencial** dos zips de teste (`...-teste-045.zip`) e prefere **terminar o nome com o final do commit que os gerou**. Proposta:
- **APK:** `BibliotecaMusical-CCB-<versão>-<commit curto>.zip` (por exemplo `BibliotecaMusical-CCB-0.4.0-038df34.zip`), e o mesmo no release do GitHub. O nome diz de que commit o APK saiu, sem tabela de números.
- **Só com a árvore limpa:** um APK compilado com mudanças sem commit (hoje o commit sai com `+`, por exemplo `038df34+`) **não teria nome válido**; é uma vantagem: o que se entrega é sempre reproduzível a partir de um commit.
- **Pacotes de conteúdo:** o conteúdo também depende das **fontes** (`.mscx`), que não estão no Git; então o nome leva o commit do **gerador** e, para ficar inequívoco, o início do SHA-256 do zip
  (por exemplo `partituras-<commit>-<sha8>.zip`). O manifesto continua guardando o SHA-256 inteiro.
- **Combina com a I-27:** Ajustes já mostra `Versão (commit)`; com o commit no nome do arquivo, quem testa confere o APK instalado com o nome do zip, e a I-27 (mostrar qual APK está instalado) fica quase resolvida.
- **O que muda:** `docs/apk-de-teste.md` (a tabela deixa de ser por número e passa a ser por commit, mais recente primeiro), a pasta do Nextcloud (manter só os 10 mais recentes continua valendo) e, nos pacotes, `tools/montar-pacote.py` e `tools/montar-manifesto-partituras.py` (hoje o nome vem do argumento). Os zips antigos (003 a 006) ficam como estão no servidor.

### Passos propostos (nesta ordem)
0. **Autorização do Enéias** registrada (só para os releases de conteúdo). Sem ela, **só o release do app**, sem hinos.
1. **Release do app sem conteúdo:** subir a versão (`0.4.0`) nos três arquivos, notas da versão, tag como **pré-lançamento**, sem APK (já combinado com o responsável: "ainda não", 2026-11-20).
2. **Chave de assinatura própria** (criada e guardada pelo responsável; segredos no GitHub) e o `apk.yml`: primeiro só sob demanda (`workflow_dispatch`), depois por tag, anexando o APK e o SHA-256; testar com `v0.4.0-rc1`.
3. **Repositório de pacotes** + `tools/publicar-pacote.sh`: publicar `partituras-006`, `hinario-001` e os sons; manifestos do app apontando para as URLs novas; `capabilities/default.json` libera `github.com` e o domínio de onde ele redireciona os downloads
   (`objects.githubusercontent.com`, a verificar). Pede **APK novo**. Manter o servidor atual como **espelho** durante a troca.
4. **Índice e atualização (I-25):** o release `indice` e o app lendo-o ao abrir.
5. **iOS:** só depois de a conta da Apple existir.

### Riscos
- **Ponto único:** uma reclamação de direitos derruba o repositório de pacotes inteiro. **Guardar cópia** de todos os zips (o servidor atual e/ou o nginx no Vidar, `bm.driit.co`, como reserva opcional da I-31).
- **Direitos:** publicar num repositório público é **distribuir** o trabalho do Enéias (hoje "todos os direitos reservados"); a regra vigente ("nada de terceiros em release público") vale até ele autorizar.
- **APK com a chave de depuração** não atualiza por cima de outro APK do responsável: só o release com a chave própria serve a quem não é o responsável.
- **Perder a chave própria** impede atualizar o app para sempre: guardar em dois lugares.

### Perguntas em aberto
1. **Nome e dono** do repositório de pacotes (a conta pessoal ou uma organização).
2. **Repositório separado ou o mesmo?** Separado é o recomendado (CI e histórico do código sem conteúdo de terceiros); o mesmo seria mais simples, com tags por prefixo.
3. **Domínio** próprio na frente (`bm.driit.co` apontando para o GitHub Pages) ou a URL do GitHub direto.
4. **Só arm64** (o que os zips de teste já usam) ou também x86_64 (emulador) no APK do release?
5. **O que o Enéias autoriza** (uso, redistribuição, crédito)? Define se os pacotes podem ser públicos.
6. **Hinário no release:** vai como pacote próprio (`hinario-001`) ou embutido no APK? Hoje o hinário embutido é só de teste fechado.
7. **Nome dos pacotes:** o commit do gerador mais o início do SHA-256 (proposta acima) ou só o commit? O pacote muda também quando mudam as fontes, que não estão no Git.

### Critérios de aceitação (propostos)
- Uma pessoa de fora instala o app só com o link do release, e o app baixa o que precisar, conferindo o **SHA-256** do manifesto.
- Trocar um pacote não exige APK novo (com o índice) nem mexer em servidor.
- O release do app **não leva nenhum hino** e o CI nunca vê conteúdo de terceiros.
- Há cópia de todos os pacotes fora do GitHub.

---

## Modelo para novas ideias

```markdown

---

## I-NN — Título curto

- **Status:** anotada
- **Origem:** quem pediu e quando
- **Prioridade:** a definir

### O problema
### O que se deseja
### Perguntas em aberto
### Impacto técnico (hipóteses)
### Critérios de aceitação (propostos)
```
