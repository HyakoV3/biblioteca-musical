# Ideia: player próprio para as gravações, no miniplayer do app (rascunho revisado, I-40)

**Status:** rascunho **revisado** (2026-11-25): revisado por um subagente Opus 5 e conferido de novo contra o código. Nada foi implementado. Separo o que foi **conferido no código** e **lido na pesquisa** do que é **proposta minha**; o que não verifiquei está dito.

## O pedido (2026-11-25, do responsável)

Os hinos já têm player próprio. As gravações usam o player do sistema; elas poderiam usar controles do app e **o nosso miniplayer**, o que seria até mais interessante. Rascunhar a ideia.

## Como é hoje (conferido no código)

| O quê | Hoje |
|---|---|
| Player da gravação | `<audio controls>` do HTML, **dentro de cada item** (`ItemGravacao.svelte`) e no cartão "Sua gravação" (`Gravador.svelte`, a gravação que não pôde ser guardada). Quem desenha os controles é o motor web do aparelho (WebView no Android, WKWebView no iOS): **o visual muda por sistema e não dá para estilizar**. |
| Formato guardado | **WebM/Opus, sem Cues e sem duração** (o `nomeDoFormato` mostra "webm (opus)"). O **Ogg só existe ao compartilhar** (`compartilhar.ts` é o único uso de `webmParaOgg`). O `corrigirDuracao` (`gravador.ts`) lê o arquivo até o fim para descobrir a duração. |
| Quando toca | Ao tocar em "Ouvir" o app lê o áudio do banco, cria uma URL e monta o `<audio>`. Só uma gravação da lista toca por vez (`tocandoId`). O botão "Ouvir" **some** depois do toque (`{#if !url}`) e o foco cai no `body`. |
| Ao trocar de aba | **Para** (`Gravador.svelte:459`, "a aba saiu de cena"). |
| Em segundo plano | **Nada para nem segura a gravação da lista.** O `aoEsconder` do Gravador só olha a gravação **em curso** (`gravando && !protegida`); `ItemGravacao` não ouve `visibilitychange`. O Wry pausa a WebView em `onPause` (`MainActivity.kt`), e **só o serviço em primeiro plano segura o som** (é assim que o hino segue tocando com a tela bloqueada). Sem serviço, uma gravação da lista fica com comportamento **indefinido** em segundo plano. |
| Tela de bloqueio | Nenhum uso de `MediaSession`: **sem controles na tela de bloqueio** para gravações. |
| Hino | `reproducao.svelte.ts` (estado global: `atual`, `estado`, `decorrido`, `duracao`, `irPara`, `alternarAtual`, `parar`, `painelNumero`) + `Miniplayer.svelte` + `Busca.svelte`. O `Miniplayer` fica em `+layout.svelte`, sobe acima da barra de abas e reserva o espaço com `--altura-miniplayer`; **some** na tela do próprio hino com o painel aberto (`painelNumero`). |
| Serviço do hino | `sincronizarServico(tocando, titulo)` (`servico.ts`): **um único** `ligadoCom` no módulo; a ponte tem **um só** sinal "tocando" (`PonteServico.kt`) e o "Parar" da notificação chama **um só** `aoPararPelaNotificacao`, ligado a `reproducao.parar()` (`+layout.svelte:23`). O wake lock tem limite de **1 h** (`ServicoAudio.kt`, `LIMITE_WAKE_LOCK_MS`), só ilimitado para gravação e metrônomo. |
| "Um som de cada vez" | `aoTocarItem` (`Gravador.svelte:368`) para o hino e **a gravação em curso, sem checar o fone**; o **metrônomo não é parado** (hoje já se pode tocar uma gravação com o metrônomo ligado). O tom de referência e o "Qual nota é essa?" do Afinador só olham `reproducao`. |
| Barra de tempo | `Busca.svelte` é acessível (um `<input type="range">` nativo e transparente sobre uma barra desenhada; versão `fino` no miniplayer; o som só muda ao **soltar**). |

## Pesquisa (2026-11-25, só web; **não testei nada no aparelho**)

- **`playbackRate` e `preservesPitch`** (MDN, caniuse): `preservesPitch` é um booleano, **verdadeiro por padrão**, que compensa a mudança de tom ao mudar `playbackRate`. Chrome e Chrome Android desde a 86; as tabelas divergem para Safari e Firefox (**a conferir**). **Não verifiquei no WebView do aparelho.** O esticamento de tempo do Chromium é pensado para voz: em música pode deixar artefatos a 0,75× (**suposição minha, a testar**).
- **MediaSession** (web.dev, Chrome, MDN): metadados e botões na notificação e na tela de bloqueio; Chrome para Android desde 2017. **Não achei** nada sobre o **WebView**. O WebView não é o app Chrome; pelo que sei, a notificação **não aparece sem uma `MediaSession` nativa** no `ServicoAudio`, ou seja, a opção C abaixo é **trabalho nativo** (a confirmar).
- **Áudio em segundo plano no Android** (documentação do Android media3 e a página do Android 17): a recomendação é um **serviço em primeiro plano com tipo `mediaPlayback`**. No Android 17 a reprodução em segundo plano **sem esse serviço é silenciada sem erro, seja qual for o `targetSdk`** (conferido na página). O app **já tem** o serviço do hino.
- **Autoplay no WebView do Tauri/Wry** (informação do revisor, **a conferir no código**): o Wry liga o autoplay por padrão (`setMediaPlaybackRequiresUserGesture(false)`). O risco, então, é o contrário do que eu temia: um `play()` perdido tocar **sem toque nenhum**. E o e2e roda com `--autoplay-policy=no-user-gesture-required`, então **nunca pegaria** uma regressão de gesto.

## Proposta

### Princípio: um `<audio>` global, ao lado do `reproducao`, e o miniplayer com dois ramos

**Sem contrato genérico `Fonte`** (a primeira versão do rascunho o propunha; a revisão mostrou que ele só serviria ao Miniplayer, que o hino não o cumpre sem adaptação e que não entrega nada sozinho). Em vez disso:

- Um módulo novo, **`gravacaoTocando.svelte.ts`**, ao lado de `reproducao.svelte.ts`: `atual` (`{ id, meta }`), `estado`, `decorrido`, `duracao`, `erro`, `tocar(meta)`, `alternar()`, `irPara(s)`, `parar()`. Um **único `HTMLAudioElement`** fora de qualquer item (sobrevive a trocar de aba, filtrar e desmontar itens).
- O `Miniplayer` ganha **um ramo**: `{#if gravacaoTocando.atual}…{:else if hino visível}…`, ou um `$derived` adaptador **local**, com o título vindo de `nomeDaGravacao(meta)` **ao vivo** (renomear a gravação que toca muda o título do miniplayer).
- **Cuidados do `<audio>` global** (revisão): um **contador de geração** (como `reproducao.geracao`) para a corrida "tocar A e logo B enquanto o blob de A é lido"; ignorar o `AbortError` de um `play()` interrompido pela troca de `src`; antes de `revokeObjectURL`, `removeAttribute("src")` e `load()` para soltar o decodificador; o `error` volta ao **item certo** (hoje o item mostra "Não foi possível abrir" e devolve o botão Ouvir) e limpa o miniplayer.
- **Duração do WebM:** o truque do `corrigirDuracao` faz `currentTime = 1e101` e volta; num player global ele geraria `timeupdate`, `seeking`, talvez `pause` ou `ended` falsos. Uma bandeira **"corrigindo"** os ignora, e **`meta.segundos`** (já salvo) serve de duração enquanto `audio.duration` for `Infinity`. O `Busca` **quebra** com `duracao = Infinity` (`Math.ceil(Infinity)`): proteger. **Seek em WebM sem Cues** só é bom depois de o truque ler o arquivo até o fim, e pode ser lento ou impreciso em gravação longa: testar com mais de 30 min.

### Um som de cada vez, em todos os pontos (revisão)

A exclusão tem de morar **no módulo do player** (`tocar`/`alternar`), e não no `aoTocarItem` do Gravador, porque o play do miniplayer não passa por ele. Pontos que hoje só olham o hino e precisam parar ou olhar também a gravação:

- `Afinador.svelte` (tom de referência: ao começar e ao trocar de nota) e `QualNota.svelte` (o microfone **ouviria a gravação no alto-falante** e leria a nota errada);
- `Metronomo.svelte`: **parar o metrônomo** ao tocar uma gravação, como o hino faz (hoje não para);
- `Gravador.svelte`: gravar para o player (hoje `tocandoId = null`); apagar a gravação que toca e **Apagar todas** param o player (hoje o item desmontado calava o som de graça); o efeito `ativa` **deixa de parar** a gravação ao trocar de aba (a nova decisão); o hino que começa **para a gravação** (hoje a troca de tela desmontava o item);
- `+layout.svelte`: o efeito do serviço, "manter a tela ligada" e "o hino cala o metrônomo" só olham `reproducao`.
- **O cartão "Sua gravação"** (a que não pôde ser guardada): a URL é do Gravador e é revogada em `descartar()`; com o player global, revogaria **debaixo do player**. Na v1 o cartão **mantém o `<audio controls>` nativo** (é raro: só com a cota cheia) e só **para** o player global, e vice-versa.

### Segundo plano e notificação (a decisão que a revisão inverteu)

- **B na v1: o serviço de reprodução.** Só exige JavaScript. Um **único efeito** em `+layout.svelte`: `sincronizarServico(hinoTocando || gravacaoTocando, tituloDoQueToca)`; a exclusão mútua garante que só um toca. O `aoPararPelaNotificacao` passa a parar **os dois**. **Não muda o nativo** (o texto da notificação já é genérico; o título é cortado em 120 caracteres). **Chamar `sincronizarServico` de dois lugares não funciona**: o `ligadoCom` único e o `parar()` único fariam um desligar o serviço do outro.
- **Limite do wake lock de 1 h:** um ensaio gravado com mais de 1 h perderia a CPU com a tela apagada. Pede mudança nativa ou fica **aceito como limite** (decidir).
- **A como reserva:** pausar a gravação no `visibilitychange` (código novo; **não** é "como hoje"). Sem isso o tempo do `<audio>` anda em silêncio e, no Android 17, o som é silenciado.
- **C (MediaSession):** na prática, **trabalho nativo** no `ServicoAudio`; fica para depois.
- **Um APK de teste logo depois da primeira fatia:** segundo plano, tela bloqueada, seek em WebM longo e Android 17. Se B falhar, cai para A.

### O que muda na tela

```
Item da lista (hoje)                 Item da lista (proposta)
┌────────────────────────────┐      ┌────────────────────────────┐
│ Hino 10 · 25/11 14:30  [☆]│      │ Hino 10 · 25/11 14:30  [☆]│
│ ▶ ──────●────── 0:12 / 0:42│      │ 0:42 · 380 KB · webm (opus)│
│ (controles do sistema)     │      │ [ ▶ Ouvir ] [Enviar] [...] │
│ [Enviar] [Apagar]          │      │ ──────●────── 0:12 / 0:42  │  ← só no item ativo
└────────────────────────────┘      └────────────────────────────┘

                                    Miniplayer (em todas as telas)
                                    ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━
                                    [⏸]  Hino 10 · 25/11 14:30  [■]
                                         0:12 / 0:42
```

- **O item** deixa de montar um `<audio>`. O botão **Ouvir/Pausar é o mesmo elemento** (muda o rótulo, com `aria-pressed`): hoje o "Ouvir" some e o foco cai no `body`. **O item ativo ganha um `Busca` completo** com nome acessível "Posição: {nome}" (**responde à pergunta 1 a favor da barra no item**): o miniplayer vem **depois de todo o conteúdo no DOM**, e quem usa TalkBack teria de atravessar a lista inteira até a barra.
- **O miniplayer** mostra a gravação como mostra o hino (o mesmo botão, o `Busca` `fino`, título, tempo, parar). Um anúncio único "Tocando: nome" / "Pausado". Ao tocar em Ouvir no **último** item, o miniplayer surge **por cima** dele: `scrollIntoView({ block: "nearest" })` depois que aparece. O `--altura-miniplayer` não precisa mudar.
- **Toque no título do miniplayer:** **v1 leva só à aba Gravador.** Rolar até o item exige limpar o filtro, **abrir a janela até o item** (a lista mostra 20 por vez), esperar a leitura (`listaPronta`) e só então focar: fica para depois.
- **Fim da gravação:** o miniplayer **some** (como o hino) ou fica **pausado no fim** para ouvir de novo? (Pergunta.)

### O que sai do I-39 (e o que o substitui)

Some o fixar a que toca, a marca "Tocando, fora do filtro" (`gravador.marca_tocando`), o `tocandoId`, o `aoParar` do item e o efeito que pausa quem não é o `tocandoId`. O que o `tocandoId` fazia de graça vira **chamada explícita ao player** (ver a lista acima: gravar, apagar uma, apagar todas, a troca de aba). Com o som global, uma gravação que **sai da lista** (filtro "Favoritas" e a estrela tirada, por exemplo) **continua tocando** e o miniplayer a mostra: é o comportamento certo, mas precisa estar escrito.

### Extras (a decidir; depois do teste no aparelho)

1. **Velocidade** (0,75×, 1×, 1,25×, 1,5×) com `preservesPitch`: **só no item ou num menu da gravação, nunca no miniplayer compartilhado** (`playbackRate` não vale para o hino, que é sintetizado, e confundiria com o andamento do hino). Com contexto, rotular "0,75× (≈45 bpm)": o "60 bpm" do contexto fica falso a 0,75×. `preservesPitch = false` mudaria a altura e contrariaria a transposição do contexto. **Conferir antes** se o `<audio controls>` do WebView já oferece velocidade (não vender como novidade).
2. **Pular 5 s para trás e 15 s para a frente.**
3. **Repetir um trecho (A-B)**; **lembrar o ponto** (no `localStorage`, e não no `meta`, que mudaria o formato do banco): depois.
4. **MediaSession / tela de bloqueio:** a opção C.

## Impacto no código (hipóteses; não implementado)

- Novo `gravacaoTocando.svelte.ts`; `Miniplayer.svelte` com o ramo da gravação; `+layout.svelte` com **um** efeito de serviço para os dois; `Busca.svelte` protegida contra `duracao = Infinity`.
- `ItemGravacao.svelte`: sai o `<audio>`, o `use:player`, a URL por item e o `onDestroy` que a revoga; entra o botão estável e o `Busca` do item ativo. `Gravador.svelte`: some o `tocandoId` e o fixar; chamadas explícitas ao player.
- **Os dois PRs mexem nas mesmas linhas** de `ItemGravacao.svelte` e `Gravador.svelte` (renomear e favoritas, do I-39): **o I-40 parte depois do merge dessa PR**.
- **Testes e2e a reescrever:** `.gravacao-item audio` em `karaoke.mjs` (cerca das linhas 1139, 1349 a 1355, que chama `audio.play()` direto, e 1419 a 1421, o erro e o botão Ouvir) e `#painel-gravador audio` (1105, diagnóstico). **Novos:** a gravação segue ao trocar de aba; apagar a que toca para o miniplayer; o hino para a gravação e vice-versa; o tom de referência, o "Qual nota é essa?" e o metrônomo param a gravação; a notificação para a gravação. O e2e roda com `--autoplay-policy=no-user-gesture-required`: **não pega regressão de gesto**.
- **Textos** em pt, en e es; o rótulo do `Busca` hoje é genérico (`player.progresso_rotulo`).

## Riscos

- Erro de decodificação por item, a duração do WebM e a corrida de trocar de gravação (ver o princípio acima).
- **Memória:** só **uma** URL de áudio existe por vez, revogada ao trocar.
- **iOS:** o app ainda não roda lá; o `play()` precisa vir de um toque, que o botão atende.
- **Android 17:** sem o serviço, o áudio em segundo plano é silenciado; por isso B é a v1.

## Etapas sugeridas (depois do merge da PR de renomear e favoritas)

1. **`gravacaoTocando` + Miniplayer com o ramo + item com botão estável e `Busca`** (com o `Busca` protegido, a bandeira da duração, `meta.segundos` de reserva, o contador de geração e o título por `nomeDaGravacao`), **a exclusão completa em todos os pontos** acima, apagar uma e apagar todas parando o player, **um único efeito de serviço (B)** e o e2e reescrito. O cartão "Sua gravação" fica nativo e só exclui.
2. **APK de teste:** segundo plano, tela bloqueada, seek em WebM longo e Android 17; ajustar B ou cair para A.
3. **Toque no título do miniplayer** levando ao item (limpa o filtro, abre a janela, espera a leitura).
4. **Velocidade** e pular 5 s e 15 s, se confirmados.

## Perguntas ao responsável

Decisões que **bloqueiam**:

1. **Segundo plano (a v1):** o hino segue tocando com a tela bloqueada; a gravação **faz o mesmo** pelo serviço (B, só JavaScript, com teste no aparelho), com a opção A como reserva?
2. **Com fone, pode gravar com uma gravação tocando** (por exemplo, gravar por cima do próprio acompanhamento)? Isso mexe em `lerContexto`/`montarContexto`, que só conhecem o hino e o metrônomo.
3. **Tocar uma gravação para** o tom de referência, o "Qual nota é essa?" e o metrônomo? (Proposta: sim, como o hino.)
4. **No fim da gravação**, o miniplayer some (como o hino) ou fica pausado no fim?
5. **"Manter a tela ligada"** vale para a gravação?
6. **Gravações com mais de 1 h:** aceitar o limite do wake lock, ou mudar o serviço nativo?
7. **A velocidade** entra? Só depois do teste no aparelho e **só no item** (proposta).

Confirmações de uma linha: o item ativo **mantém uma barra de tempo** (proposta, por causa do TalkBack); o toque no título do miniplayer **leva só à aba Gravador** na v1; A-B e lembrar o ponto ficam **depois**.

## Fontes (pesquisa de 2026-11-25)

- `preservesPitch`: [MDN](https://developer.mozilla.org/docs/Web/API/HTMLMediaElement/preservesPitch); [caniuse](https://caniuse.com/mdn-api_htmlmediaelement_preservespitch).
- MediaSession: [web.dev](https://web.dev/articles/media-session); [Chrome](https://developer.chrome.com/blog/media-session/); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API).
- Áudio em segundo plano: [Android media3, reprodução em segundo plano](https://developer.android.com/media/media3/session/background-playback); [Android 17, endurecimento do áudio em segundo plano](https://developer.android.com/about/versions/17/changes/bg-audio).
- **Não verificado:** o comportamento do `<audio>`, do `preservesPitch` e do autoplay **no WebView do aparelho do responsável**; se o WebView mostra a notificação da MediaSession; se o som da gravação segue com o serviço de reprodução no ar; o seek em WebM longo; as faixas de versão por navegador (as tabelas divergem).
