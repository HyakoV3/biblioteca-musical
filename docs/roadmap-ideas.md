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

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

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

## I-08 — Mostrar a partitura no hino

> **Origem:** sugestão do responsável: "como temos letras, mostrarmos a partitura também". Não estava no escopo
> inicial. O formato já tem o campo opcional `partitura` (caminho de arquivo), mas nunca foi usado.

### O que se deseja
Uma aba **Partitura** no hino (ao lado de Ouvir e Letra) para o músico ler a música enquanto ouve.

### Decisões (responsável, 2026-11-16)
1. **Ferramentas:** MuseScore 4 (Flatpak) e Verovio (pacote Python) instalados **fora do repositório**: só geram o conteúdo.
2. **Diagramação:** **Verovio, pensada para o celular** (a página tem a largura da tela e reflui em sistemas curtos), no lugar de
   copiar a diagramação do MuseScore, que é de página larga e exigiria rolagem lateral.
3. **Entrega:** as partituras vão **dentro do pacote `.zip`** (o `hinario.json` e os SVGs), fora do Git.
4. **Aba Partitura:** com o pacote já importado, aparece **só nos hinos que têm partitura**. Quem acabou de instalar e ainda não
   importou nada vê a aba **com um aviso e um botão para Ajustes**, onde baixa o arquivo. (Cursor na partitura, I-12 fase B: fica
   para depois, mas o instante de cada nota já sai no **timemap**, para não regerar tudo mais tarde.)

### Caminho
1. **Gerar fora do app** (`python3 tools/gerar-partituras.py ENTRADA SAIDA`): `.mscx` → **MusicXML** (MuseScore 4, sem janela) →
   **SVG** (Verovio), uma página por hino, mais um `hino-N.timemap.json`.
2. **Empacotar** no `.zip` junto do `hinario.json`, usando o campo `partitura` (PR 2: importador em Rust e **sanitização do SVG**).
3. **Aba "Partitura"** com zoom e rolagem (PR 3). SVG fica nítido em qualquer tamanho, o que ajuda quem tem baixa visão.
4. **Teste no emulador e no celular** num APK (PR 4).

**Por que não desenhar a partitura a partir do JSON:** o JSON guarda só altura e duração. Faltam armadura, fórmula
de compasso, acidentes, ligaduras, cifras e casas de volta. Reconstruir isso seria reinventar a roda.

### Primeiro teste (PR 1, feito nos 5 hinos de amostra)
O MuseScore converte cada hino em MusicXML em menos de 1 s, e o Verovio o desenha em segundos. Medido com `largura=700`, `escala=40`:

| Hino | SVG | SVG comprimido (gzip) | timemap |
|---:|---:|---:|---:|
| 1 | 134 KB | 23 KB | 7 KB |
| 276 | 71 KB | 14 KB | 3 KB |
| 283 | 167 KB | 28 KB | 11 KB |
| 398 | 304 KB | 50 KB | 20 KB |
| 457 | 243 KB | 40 KB | 26 KB |

Média de **184 KB por hino**, ou **uns 31 KB comprimido**. Para 480 hinos: ~88 MB sem compressão e **uns 15 MB num zip** (o pacote
real de 5 hinos, com o `hinario.json`, tem 166 KB). Os números da primeira medição (400 KB por hino) incluíam, em **cada** SVG, a
fonte Leipzig embutida (58 KB em base64, igual em todos) e a indentação; sem elas o arquivo cai a menos da metade (ver a PR 2). O
limite de 20 MB de hoje, para o `hinario.json`, não serve para o pacote com partituras: a PR 2 aceita o `.zip`. (No aparelho, o SVG
gravado depois da limpeza fica uns **14% maior** que o do zip: o prefixo dos `id` e as tags fechadas por extenso; para 480 hinos,
uns 100 MB em disco.)

O que se aprendeu, e que a ferramenta já faz:
- **Largura 700 em vez de 1000:** olhando num celular de 412 px, as notas ficam bem maiores e há poucos compassos por linha; o
  arquivo só cresce 3%.
- **Elisão ("sempre_em", duas palavras numa nota):** o MuseScore escreve o sinal como um texto solto numa fonte privada, que a página
  mostra como um quadrado (▯). A ferramenta o troca pelo `<elision>` padrão do MusicXML, e o Verovio o desenha como a ligação "‿",
  como no hinário impresso.
- **Espaço entre as palavras da letra:** com o padrão do Verovio, onde duas vozes cantam letras diferentes as palavras se colam
  ("bemu-", "ComJe-sus"). `lyricWordSpace` em 2,5 resolve.
- **O SVG usa só `svg`, `g`, `path`, `use`, `text`, `tspan`, `rect`, `ellipse`, `style`, `defs` e `desc`**, e todo `href` é interno
  (`#id`). Isso permite sanitizar por **lista de permitidos** (o app roda com `csp: null`, então um SVG com `<script>` ou
  referência externa não pode passar): é o `src-tauri/src/svg.rs`, da PR 2, que lê, confere e **reescreve** o SVG.
- **A fonte embutida:** o Verovio coloca em cada SVG um `<style>` com um `@font-face` da fonte Leipzig, 58 KB em base64
  (`url(data:...)`), igual em todos os hinos. A primeira versão da limpeza recusou os 5 hinos reais por causa desse `url(`; e
  liberar `url(data:` seria abrir a porta que a limpeza existe para fechar. Em vez disso, `smuflTextFont: "none"` tira a fonte do
  SVG, e o app a traz uma vez só (licença OFL 1.1). Conferido no Chrome: com a Leipzig vinda da página, o desenho fica **idêntico,
  byte a byte**, ao do SVG com a fonte embutida; sem ela, só os glifos de **texto** da fonte falham (a figura de nota do andamento, "♩ = 58", vira um quadrado ▯); as notas, pautas e claves são `path` e ficam. O `<style>` que sobra era só de negrito, itálico e `stroke:currentColor`, e é **descartado** na importação (um `<style>` em SVG embutido vale para a página inteira, e o vandame mostrou que isso deixaria um pacote malicioso falsificar botões); o CSS equivalente vai no app, escopado à partitura (ver `FORMATO.md`).
- **Cor pelo tema:** o `<svg>` vem com `color="black"` e o preenchimento padrão é preto, então uma cor no contêiner de fora **não**
  pinta nada (testado: preto sobre preto). O que funciona, testado no Chrome com o SVG **embutido na página** (inline, depois de
  sanitizado), é uma regra de CSS no próprio `svg`: `color: var(--texto); fill: currentColor`. Aí pauta, notas, letra e andamento
  seguem o tema escuro e o alto contraste (amarelo sobre preto) sem regerar nada. Como `<img>`, não dá: a CSS da página não entra
  no SVG.
- **Andamento esquisito no topo ("( - 84) ♩ = 63")** vem do próprio arquivo do autor (o texto do andamento está assim na
  transcrição), não é defeito da geração.
- O Verovio avisa quando um sistema fica muito apertado (razão de justificação < 0,8); nos 5 hinos a leitura não foi prejudicada.

### Pontos de atenção
- **Direitos:** as partituras vêm das mesmas transcrições, então a resposta do autor vale aqui também. As
  imagens ficam **fora do Git**, como as letras (e as capturas de tela de partituras reais também).
- **Importação:** hoje o app importa um só JSON (limite de 20 MB). Com imagens, é preciso um **pacote de vários
  arquivos** (um `.zip`). É a parte de maior trabalho (PR 2).
- **Licenças das ferramentas:** MuseScore (GPL-3.0) e Verovio (LGPL-3.0) só **geram** o conteúdo; nenhum dos dois entra no app.
  O SVG gerado é do conteúdo, não das ferramentas.

### Critérios de aceitação (propostos)
- A partitura de um hino de amostra aparece nítida na aba, com zoom e rolagem, no emulador e no desktop.
- O pacote importa sem passar de um tamanho combinado e sem ir para o Git.
- Com a fonte do sistema no máximo e nos temas claro, escuro e baixa visão, a aba continua utilizável.

---

## I-12 — Karaokê na partitura (fase B)

- **Status:** **escolhida como a próxima frente** pelo responsável (2026-11-16); **passo 0 (medição) feito**; **etapa 1 (os dados) feita**: o conversor emite `compassos` e o app os lê (`docs/FORMATO.md`); **etapa 2 (a interface) feita e testada no celular pelo responsável (APK 025/026: "funcionou")**: o compasso que toca fica destacado na aba Partitura, com rolagem e o mesmo botão do karaokê da letra. **Ele esperava a NOTA, e não o compasso**: o cursor por nota virou a **I-26** (a **fase A**, o karaokê na letra, está feita: ver [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md))
- **Origem:** sugestão do responsável: um karaokê "tanto na letra das músicas como nas partituras".
- **Prioridade:** depende da I-08 (aba Partitura)

### O que se deseja
Um cursor ou destaque de compasso na **partitura** acompanhando a música, como a letra já faz na aba Letra.

### Perguntas em aberto
1. Cursor por **nota** ou destaque por **compasso**? (O campo `sincronia` do hinário traz tempos por **sílaba**, não por
   compasso: o conversor precisaria gerar também os tempos de cada compasso ou nota.)
2. O histórico e as decisões da fase A (posição do botão, como a sílaba acende, latência da saída de áudio) estão em
   [`archive/ideias-implementadas.md`](archive/ideias-implementadas.md), seção I-12.

### Passo 0: casar o tempo do app com o `timemap` do Verovio (2026-11-16, medido)
Antes de construir, mediu-se nos 5 hinos de amostra se o tempo das notas que o app toca casa com o `timemap` que o Verovio gera (`tools/gerar-partituras.py` já o grava por hino e por versão).

- **A escala é a mesma.** O `qstamp` do `timemap` conta semínimas; no app a colcheia vale 0,5 batida e a semínima 1. Não há conversão de unidade.
- **O app tem até 3 fluxos de notas por hino:** a vez normal, a introdução e o final. Pareando cada nota do soprano com os eventos do `timemap` pela altura, **100% das notas de cada fluxo casam num único deslocamento constante** (`qstamp - t`): a vez normal e a introdução em **0**, e o **final do 457 em 48 batidas** (a duração da vez normal). Hinos 1, 276, 283, 398: normal 48/48, 25/25, 80/80, 138/138 e introdução 18/18, 11/11, 20/20, 12/12 em 0; 457: normal 55/55, introdução 13/13 e final 110/110.
- **Mas o `timemap` expande as repetições com ids que não existem no SVG.** No 457 o desenho tem 38 compassos e o `timemap` lista 56 compassos de ids **únicos**. O destaque **não pode usar os ids do `timemap`** (os dos compassos repetidos não estão no SVG).

**Decisão proposta (a confirmar com o responsável):**
1. **Destaque por compasso**, não cursor por nota (pergunta 1): é o que dá para fazer de forma robusta e legível; o cursor por nota fica para depois.
2. **Quem diz qual compasso toca em cada instante é o conversor** (`tools/mscx2json`), que já conhece o instante de cada compasso e as repetições e casas de volta de cada passada (`Estrutura`: `inicio_compasso`, a passada normal e a do final). Ele emitiria, por fluxo, uma lista `[batida local, índice do compasso escrito]`, no mesmo molde da `sincronia` da letra. O app marca o N-ésimo `g.measure` do SVG (a ordem no documento seria a ordem escrita). **Sem o `timemap` no pacote.**
3. **A rolagem** que acompanha o compasso tem de respeitar "reduzir movimento" (`tools/verificar-movimento.py`), e o liga/desliga é o mesmo do karaokê da letra.

**Riscos (verificados na etapa 1, nos 5 hinos de amostra):** a ordem dos `g.measure` no SVG **é** a ordem escrita dos compassos do `.mscx`. O número de compassos do SVG é o que o conversor usa (11, 8, 18, 56 e 38), e cada início da passada normal do conversor corresponde ao `g.measure[i]` pelo id que o Verovio atribui; no final do 457 (só existe expandido no `timemap`), os 37 compassos têm início e comprimento idênticos aos do `timemap`. **Verificado na etapa 2:** o `class="measure"` sobrevive à limpeza do SVG no Rust (10 de 10 arquivos, mesmo número de compassos antes e depois), e o retrato e a paisagem de cada hino têm o mesmo número de compassos, então o índice vale nas duas versões.

### Critérios de aceitação (propostos)
- O destaque na partitura e o da letra andam juntos, na pausa congelam e ao mudar o andamento seguem no lugar certo.

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

## I-19 — Organizar como os hinos aparecem na letra

- **Status:** **em andamento**: as **quebras de verso** já foram corrigidas no conversor (2026-11-16); falta o **coro** e o resto
  (ver "O que se descobriu")
- **Origem:** pedido do responsável, 2026-11-16: organizar "como os hinos aparecem no hinário, na parte de letra", a partir de
  fotos que ele vai tirar.
- **Prioridade:** a definir

### O que se deseja
Que a aba Letra apresente cada hino como ele aparece no hinário impresso (ordem e numeração das estrofes, coro, quebras de
verso, títulos). O desenho exato depende das fotos.

### O que se descobriu (2026-11-16, com 4 fotos: hinos 1, 276, 398 e 457)
- **Versos partidos:** o conversor quebrava a linha em **toda respiração** da partitura, mas o hinário imprime **um verso por
  linha**, e a partitura respira também no meio do verso. Das quebras do conversor nos 4 hinos, só 36 de 57 eram fim de verso. A
  pista confiável é o **texto**: o verso novo começa em maiúscula, e a continuação, em minúscula (com exceção dos nomes
  reverenciais). Com essa regra, **46 dos 48 versos impressos** conferidos passaram a sair iguais (**48 de 48** depois dos consertos
  de hífen e de digitação, abaixo), e as quebras acertaram 57 de 57. Descrita em `docs/FORMATO.md`. A regra foi ajustada olhando esses 4 hinos, então vale **validar com mais fotos**.
- **Coro (refrão):** nos hinos 398 e 457 o hinário imprime o coro **em negrito e separado** da estrofe, sem número. **Posição:**
  no 457 (hino com final) o coro vem **depois da última estrofe**, e o autor o escreveu sob a estrofe 1; o conversor agora o
  passa para a última (2026-11-16, `coro_para_a_ultima_estrofe`). No 398 o coro vem logo **depois da estrofe 1**, e já saía
  ali. **Falta:** o JSON não marca onde o coro começa, então o app ainda o mostra colado à estrofe, sem negrito nem separação.
- **Versos colados:** no hino 283 a partitura não tem respiração entre dois versos, e eles saem na mesma linha. A regra de
  maiúscula não resolve (a letra tem frases com maiúscula no meio de um verso); o **arquivo de correções** (I-05, feita) tem o verbo
  `quebrar_antes`, mas falta a foto do hino 283 para saber onde ficam os versos.
- **Erros de digitação do autor** nos arquivos `.mscx`. **O conversor já conserta, por regra segura** (2026-11-16): pronome
  colado sem hífen depois de vogal acentuada (com o "I" no lugar do "l") e "~" literal. A regra "ãc" vira "ãe" **foi removida** (2026-11-16): o
  autor tinha escrito "mãc" para "mão"; o que é ambíguo não se adivinha. **O resto** (sílaba
  sem o marcador de continuação, a palavra que sai partida em duas, letras trocadas) **conserta-se com o arquivo de correções**
  (I-05, feita 2026-11-16, [`correcoes-da-letra.md`](correcoes-da-letra.md)); nos 5 hinos de amostra, 10 correções deixaram as palavras
  iguais ao impresso (hinos 1, 276, 398 e 457) e sem palavras desconhecidas para o dicionário (exceto uma palavra do 283, sem foto).
- **A pauta no topo** de cada hino impresso é o **começo da melodia**, no tom e no compasso do hino; o tamanho dela é o do
  primeiro verso. Não está no `.mscx`, então não serve de régua para as quebras.

### Perguntas em aberto
1. Quais diferenças entre os hinos existem (coro, estribilho, estrofes numeradas ou não, repetições)?
2. O justificado da I-04 ainda faz sentido com esse desenho? (hoje ele abre espaços largos nos versos que quebram)

---

## I-13 — Afinador: dar o tom e mostrar se a nota está baixa ou alta

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

### O que se deseja (nas palavras do responsável)

Um **afinador** que **dá o tom** e, se a pessoa estiver de **fone de ouvido**, oferece **escutar o som** do instrumento
ou da voz e mostrar se está **baixo ou alto**, num **medidor (gauge) parecido com o de um acelerador**, com o ponteiro
indo para baixo ou para cima da nota certa.

### Ideia de comportamento (a validar)

Duas funções na mesma tela:

1. **Dar o tom.** O app toca uma nota de referência: o **lá** (padrão 440 Hz) ou uma nota escolhida. Para o músico de
   hinário, a nota mais útil é a **tonalidade do hino** (o campo `tonalidade` já existe no hino), então a tela pode
   oferecer "dar o tom do hino". Sai pelo mesmo sintetizador do app, com os timbres que já existem.
2. **Ouvir e medir** (só **com fone**). O app escuta o microfone, descobre a nota e mostra **quantos cents** ela está
   acima ou abaixo (1 semitom = 100 cents), num **ponteiro** que vai de "baixo" a "alto" passando pelo centro
   ("afinado"). O ponteiro não pode depender só de cor: leva também o número em cents e a palavra ("baixo", "alto",
   "afinado"), e respeita "reduzir movimento".

**Por que o fone:** se o app toca a nota de referência no alto-falante e escuta ao mesmo tempo, o microfone capta a
própria nota de referência e confunde a medição. Com fone, a pessoa **ouve a referência no ouvido** e o microfone capta
**só o instrumento**. Sem fone, o app oferece uma função por vez (dar o tom **ou** escutar). É a mesma ideia do
gravador (I-03).

### Perguntas em aberto

1. **Instrumentos que transpõem** (trompete e clarinete em si bemol, sax em mi bemol, trompa em fá): mostrar a nota
   **tocada** (a que o músico lê) ou a **real**? O app já transpõe os hinos em semitons, então talvez haja
   uma opção "instrumento" que ajuste a leitura.
2. **Afinação de referência** configurável (440 ou 442 Hz), e **temperamento** igual (o usual).
3. **Voz cantada** também, ou só instrumentos? A voz oscila mais e o ponteiro precisa de suavização.
4. **Onde fica:** um atalho na aba Ouvir, uma tela própria ou dentro de Ajustes?

### Impacto técnico (hipóteses, não verificadas)

- **Detecção de altura (pitch):** algoritmos conhecidos são a autocorrelação, o **YIN** e o **McLeod (MPM)**. Antes de
  escrever qualquer coisa, **pesquisar bibliotecas** que já fazem isso no navegador (por exemplo `pitchy`, de MPM, e
  `pitchfinder`, de YIN), conferindo licença, tamanho e desempenho no celular, como foi feito com os sons.
- **Microfone:** `getUserMedia` e a permissão `RECORD_AUDIO`, com o mesmo teste no Tauri Mobile da I-03. A permissão é
  pedida só ao usar a escuta, com explicação, e o app funciona normalmente se for negada (dar o tom não precisa dela).
- **Detecção de fone:** o mesmo problema da I-03 (pergunta 6): `enumerateDevices()` e `devicechange`, ou código nativo.
- **Fone Bluetooth:** o atraso (100 a 300 ms) não atrapalha medir a nota, mas **a referência chega atrasada** ao ouvido.
  Para afinar não importa, para o gravador importa.
- **Baixa latência:** o ponteiro precisa reagir em poucas dezenas de milissegundos; ler o áudio com `AudioWorklet`, e
  não com temporizadores, para ele não ficar "pulando".
- **Ruído e harmônicos:** metais e saxofones têm harmônicos fortes que confundem algoritmos simples; testar com
  instrumentos reais no celular do responsável.

### Critérios de aceitação (propostos)

- O app toca o lá 440 Hz e a tonalidade de um hino de amostra, com o timbre escolhido.
- Com um tom puro de 440 Hz vindo de outra fonte, o medidor marca "afinado" (±5 cents); a 20 cents abaixo ou acima,
  marca "baixo" ou "alto" com o número certo.
- Sem fone, o app não tenta tocar e escutar ao mesmo tempo e diz por quê.
- Sem a permissão de microfone, dar o tom continua funcionando.
- O medidor se entende sem cor (número e palavra) e com "reduzir movimento".

---

## I-20 — Metrônomo embutido

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-16: "fazer um metrônomo também, embutido".
- **Prioridade:** a definir

### O problema
Quem estuda uma voz precisa de um pulso firme, e hoje o app só dá o pulso dentro da música tocada. Para praticar sem o hino
tocando, ou para entrar no tempo certo, é preciso outro aplicativo.

### O que se deseja
Um **metrônomo dentro do app**: um clique regular no andamento do hino (e ajustável), com o primeiro tempo do compasso
acentuado, que se liga e desliga.

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

## I-22 — Continuar tocando com a tela bloqueada

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-16: "o miniplayer, mesmo com a tela do celular bloqueada, se ele estiver ativo, deve continuar tocando o som... com a tela bloqueada etc."
- **Prioridade:** a definir (para quem estuda ouvindo o hino com o celular no bolso, é quase requisito)

### O problema
Hoje o som é gerado **dentro da WebView** do app (Web Audio: `AudioContext` em `src/lib/sintetizador.ts`, com as notas agendadas por JavaScript
em `src/lib/reproducao.svelte.ts`). O app **não tem nada para segundo plano**: nem MediaSession, nem wake lock, nem serviço em primeiro plano, e
o manifesto Android só pede `INTERNET`. A hipótese forte é que, **com a tela bloqueada ou o app em segundo plano, o Android pausa o JavaScript
da WebView e o som para** (ainda **não foi testado** no aparelho; precisa ser o primeiro passo). O miniplayer fica no app e para junto.

### O que se deseja
Com um hino tocando (miniplayer ativo), **bloquear a tela ou trocar de aplicativo não interrompe o som**. Idealmente há também **controles
na tela de bloqueio e na barra de notificações** (tocar/pausar, parar, o título do hino), como qualquer tocador de música, e os botões do
fone de ouvido funcionam.

### Perguntas em aberto
1. **Só Android por enquanto?** Os APKs de teste são Android; o iOS tem outro mecanismo (modo de fundo de áudio) e outra política. Começar pelo Android?
2. **Controles na tela de bloqueio:** só continuar tocando, ou também a notificação com tocar/pausar/parar? (O Android **exige** uma notificação
   para um serviço em primeiro plano, então, na prática, ela existe de qualquer jeito.)
3. **O karaokê e a letra:** ao desbloquear, a aba Letra deve estar **no ponto certo** da música (o relógio do áudio continua, então a posição
   deve voltar certa; conferir).
4. **Quando o hino termina ou a pessoa para:** o serviço e a notificação **somem** (sem consumir bateria à toa).
5. **Interrupções:** chamada telefônica ou outro aplicativo tocando (foco de áudio): pausar, e voltar depois?
6. **Tocar o hino todo com as pausas de 2 s entre as partes** e a transição entre as vezes dependem de temporizadores do JavaScript, os mais
   sujeitos a parar em segundo plano. Precisam seguir funcionando.

### Caminhos possíveis (hipóteses, não verificadas)
A pesquisa inicial (2026-11-16) não achou um guia específico para o Tauri; os relatos de Capacitor, Ionic e React Native em WebView
apontam sempre o mesmo padrão: o Android **pausa o JavaScript com a tela desligada**, e o remédio usual é um **serviço em primeiro plano**,
mas há relatos de que **a WebView sozinha pode não ser coberta por esse serviço**, então o áudio talvez precise tocar **fora da WebView**.
1. **Serviço em primeiro plano + Web Audio** (menor mudança): iniciar um serviço (tipo de mídia, com notificação) quando o hino começa
   a tocar, mais `WAKE_LOCK`, e manter o `AudioContext`. **Pode não bastar**: falta saber se o JavaScript da WebView continua rodando.
   É o teste mais barato e deve vir primeiro.
2. **Renderizar o hino em um buffer de áudio e tocar por um elemento `<audio>` + MediaSession.** Navegadores tratam a mídia de um
   `<audio>` como reprodução de verdade (controles de bloqueio e segundo plano), ao contrário de um grafo Web Audio. Custa: o som deixa de
   ser gerado em tempo real (mudar andamento, tom e silenciar vozes passaria a exigir **renderizar de novo**), então mexe nos controles
   do player (I-10) e no karaokê, que hoje seguem o relógio do `AudioContext`.
3. **Player nativo** (Kotlin com ExoPlayer/Media3 num serviço de mídia, via plugin do Tauri): o mais robusto no Android e o que dá controles de
   bloqueio e fone de graça, mas é **reescrever o motor de som fora da WebView** (sintetizador e pacote de sons gravados), muito mais trabalho, e
   só no Android.
- **Permissões prováveis** (a confirmar): `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS` (Android 13+) e `WAKE_LOCK`.
  Do Android 12 em diante, o serviço em primeiro plano só pode ser **iniciado com o app visível** (o toque em "tocar" serve).
- **Pesquisar antes de construir** (regra do projeto): ler a documentação de plugins móveis do Tauri e de MediaSession, e registrar o que for lido.
  Fontes da pesquisa inicial: fóruns de Capacitor e Ionic sobre áudio em segundo plano, o README do `tauri-plugin-native-audio` (permissões) e
  relatos de WebView no React Native.

### Critérios de aceitação (propostos)
- Tocando um hino no aparelho, **bloquear a tela por 2 minutos e desbloquear**: o som não cortou nenhuma vez e a letra está no ponto certo.
- **Trocar de aplicativo** durante o hino também não corta; o hino todo (com as pausas entre as partes) chega ao fim com a tela apagada.
- Parar ou terminar o hino **remove a notificação** e o serviço (conferir no Android que o app deixou de estar em primeiro plano).
- Teste manual registrado no `docs/apk-de-teste.md` (aparelho, versão do Android, o que aconteceu): não há como provar isso só no e2e do Chrome.

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

## I-24 — Ajustes em cartões, com um cartão de Conteúdo (hinário, partituras e sons gravados)

- **Status:** anotada, **rascunho** (a revisar com o subagente Opus antes de implementar)
- **Origem:** pedido do responsável, 2026-11-16: "no Ajustes já cabe uns cards... o de temas, o de importação (importar hinário agora, apesar de que no futuro não existe, mas teria o importar partituras e importar sons gravados dentro)". E, ao tentar importar as partituras: "achei que ele teria um botão específico para ele, tipo o dos sons gravados".
- **Prioridade:** a definir (a tela já está longa, e cada pacote novo, como as partituras, acrescenta mais botões)

### O problema
Hoje **Ajustes** é uma coluna de seções soltas, e só "Sobre o app" e "Créditos e licenças" são cartões que se recolhem (`<details class="cartao">`):

```
┌─ Ajustes ──────────────────────────────────────┐
│ Aparência                                       │
│   Modo    [Automático][Claro][Escuro][Alto contr.]│
│   Estilo  [Normal][Pergaminho][Marinho]         │
│ Idioma da interface            [ Português ▾ ]  │
│ Biblioteca                                      │
│   Conteúdo atual: Amostra de teste (5 hinos)    │
│   [Importar hinário]  [Remover importação]      │
│ Sons gravados                                   │
│   Todos os sons gravados  36 MB · Não instalado │
│                                [Baixar (36 MB)] │
│   Órgão / Madeiras / Metais / Cordas ...        │
│ ⓘ Aviso: o app não tem ligação com a CCB        │
│ ▸ Sobre o app                                   │
│ ▸ Créditos e licenças                           │
└─────────────────────────────────────────────────┘
```

Três coisas incomodam:
1. **O botão certo não está onde se espera.** As partituras não têm botão próprio: entram pelo mesmo "Importar hinário" (que aceita `.json` ou `.zip`). Quem procura "partituras" em Ajustes não acha nada, e o texto do botão não diz que ele serve para isso.
2. **Cada pacote novo piora a tela.** Hinário, partituras e sons gravados são a **mesma coisa** para a pessoa (conteúdo que se instala, atualiza e remove), mas estão em desenhos diferentes: o de sons tem estado, "Baixar (tamanho)" e "Remover"; o do hinário só tem "Importar" e "Remover importação".
3. **A tela fica comprida** (e mais ainda com a fonte do sistema grande, onde tudo cresce em `rem`).

### O que se deseja
Ajustes em **cartões recolhíveis**, cada um com **uma linha de estado quando fechado** (assim recolher não esconde o que importa), e um cartão **Conteúdo** com as três coisas instaláveis no **mesmo desenho de linha** que os sons gravados já têm.

```
┌─ Ajustes ──────────────────────────────────────┐
│ ⓘ Aplicativo não oficial (aviso sempre à vista) │
│ ▸ Aparência        Automático · Normal          │
│ ▸ Idioma           Português                    │
│ ▾ Conteúdo         Hinário · Partituras · Sons  │
│ ┌────────────────────────────────────────────┐ │
│ │ Hinário                                    │ │
│ │ Amostra de teste · 5 hinos                 │ │
│ │ [Importar arquivo]            [Remover]    │ │
│ ├────────────────────────────────────────────┤ │
│ │ Partituras                                 │ │
│ │ 5 de 5 hinos · 0,2 MB · Instaladas         │ │
│ │ [Baixar (15 MB)] [Importar .zip] [Remover] │ │
│ ├────────────────────────────────────────────┤ │
│ │ Sons gravados                              │ │
│ │ 2 de 4 pacotes · 20 MB                     │ │
│ │ Órgão    Instalado          [Remover]      │ │
│ │ Cordas   ● Atualização      [Atualizar]    │ │
│ └────────────────────────────────────────────┘ │
│ ▸ Sobre o app                                   │
│ ▸ Créditos e licenças                           │
└─────────────────────────────────────────────────┘
```
(`●` é só um exemplo de indicador de atualização, ver I-25; nunca por cor sozinha.)

**Princípios** (do projeto): medidas em `rem`; cores só das variáveis do tema; estado por **texto e ícone**, não só por cor; funciona nos temas claro, escuro e alto contraste; **teclado e leitor de tela** (o `<details>/<summary>` já dá isso de graça); textos em pt, es e en; com a fonte do sistema grande, a linha de estado **quebra**, não corta.

### Perguntas em aberto
1. **Um cartão "Conteúdo" com três linhas, ou três cartões?** Recomendação: **um**, porque são a mesma coisa para a pessoa e o desenho da linha é igual; o cartão de sons já tem 4 sublinhas.
2. **Acordeão** (abrir um fecha os outros, como já é nos cartões do player) **ou livre?** Recomendação: **livre**, para comparar Conteúdo com Aparência; mas **lembrar** o que ficou aberto.
3. **Qual cartão abre por padrão?** Recomendação: **todos fechados** no primeiro uso, com a linha de estado de cada um, **exceto** quando se chega pelo botão "Abrir Ajustes" da aba Partitura (aí abre o **Conteúdo**, já rolado até Partituras).
4. **Onde vai o botão de importar de arquivo?** Recomendação: **em cada linha** do cartão (hinário aceita `.json`/`.zip`, partituras aceita `.zip`), no lugar do botão único de hoje; "Baixar" convive com ele até todo pacote ter servidor (I-25).
5. **O pacote de partituras deve ser separado do hinário?** Hoje o `.zip` leva o `hinario.json` **junto** (a importação troca o hinário e as partituras de uma vez). Importar pela linha **Partituras** e ver o hinário mudar surpreende. Alternativa: um pacote de partituras **só com os SVG** e um manifesto com o `id` do hinário a que se aplica. É decisão de **formato** (mexe em `docs/FORMATO.md` e no Rust), a tomar antes de construir a linha.
6. **"Importar hinário" no futuro não existe** (o responsável): o hinário também virá de um pacote. Até lá a linha **Hinário** tem "Importar arquivo"; depois ela vira "Baixar/Atualizar" como as outras e o importar de arquivo passa para um submenu **Avançado**, ou some?
7. **Um comando para remover só as partituras** (hoje "Remover importação" apaga hinário **e** partituras): confirmar o texto de cada remoção (hoje há um diálogo só).

### Impacto técnico (hipóteses)
- `src/routes/ajustes/+page.svelte` (a tela, hoje com seções soltas): extrair um componente de **cartão** a partir do `.cartao` que já existe, e um de **linha de pacote** a partir do `.pacote` dos sons.
- `src-tauri/src/pacote.rs` e `lib.rs`: um comando **`remover_partituras`** (a função `remover_partituras` já existe no Rust, só não é um comando) e, se a pergunta 5 for "separar", um importador só de SVG.
- `src/lib/biblioteca.svelte.ts` e a tela da aba Partitura: o botão "Abrir Ajustes" passa a levar ao cartão Conteúdo (parâmetro na rota ou `#conteudo`).
- Sem mudança de conteúdo nem de formato **se** a pergunta 5 for "continua junto".

### Critérios de aceitação (propostos)
- Com todos os cartões fechados, **cada um mostra uma linha de estado** correta (modo e estilo; idioma; hinário, partituras e sons instalados).
- A aba Partitura sem partituras leva a **Conteúdo → Partituras**, que mostra o estado e a ação certa.
- **Teclado:** cada cartão abre e fecha com Enter e Espaço; a ordem de foco é a visual. **Leitor de tela:** o estado é lido junto do nome do cartão.
- **Fonte do sistema no máximo** e os três temas (incluindo Alto contraste): nada cortado nem sobreposto (captura de tela conferida).
- O que ficou aberto é **lembrado** entre aberturas, e as regras de `rem`/tema/i18n do projeto passam nos verificadores.
- O e2e cobre: abrir/fechar, a linha de estado, o caminho da aba Partitura até o cartão e o importar de arquivo por linha.

---

## I-25 — Verificar atualização dos pacotes (sons gravados e partituras) ao abrir o app

- **Status:** anotada, **rascunho** (a revisar com o subagente Opus antes de implementar)
- **Origem:** pedido do responsável, 2026-11-16: "seria interessante mais para frente, no importar partitura e importar sons gravados, que quando abrir ele fosse no servidor e visse se tem alguma atualização nesses pacotes .zip".
- **Prioridade:** a definir ("mais para frente"; depende da I-24 para ter onde mostrar o aviso)

### O problema
Os pacotes mudam (o banco dos sons já trocou uma vez, do FluidR3 para o GeneralUser GS; as partituras vão crescer de 5 para 480 hinos), mas **o app não sabe disso**:
- O manifesto dos sons (`src/lib/sons/manifesto.json`, com o SHA-256 de cada pacote) está **embutido no app**: um pacote novo no servidor **exige um APK novo**, e o APK antigo **recusa** o pacote novo (foi o que aconteceu no zip 010).
- As partituras não têm servidor ainda (ver a I-24 e a questão dos direitos, abaixo).
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

## I-26 — Karaokê na partitura por NOTA (cursor por nota)

- **Status:** anotada, **rascunho** (a revisar com o subagente Opus antes de implementar); amplia a I-12 (fase B), que hoje destaca o **compasso**
- **Origem:** pedido do responsável, 2026-11-17, ao testar o APK 025/026: "tu tá marcando no karaokê apenas o compasso né? Achei que tu marcaria a nota."
- **Prioridade:** a definir (o destaque do compasso funciona; a nota é o que ele esperava)

### O problema
O destaque de hoje (I-12, etapa 2) pinta o **compasso inteiro**. Quem acompanha cantando ou tocando tem várias notas por compasso, e o compasso aceso não diz **qual nota soa agora**.

### O que se deseja
A(s) nota(s) que soa(m) **agora** ficam destacadas na partitura, **no instante em que soam**, e o destaque anda **nota a nota**.

### O que já se sabe (medido em 2026-11-17, nos 5 hinos de amostra)
- O `timemap` do Verovio traz, para cada instante, os ids das notas que **começam** (`on`) e que **terminam** (`off`): é a matéria-prima.
- **A dificuldade das repetições, a mesma do compasso:** o `timemap` é expandido, e nas repetições traz ids de notas **copiadas** que não existem no SVG (hino 457: **669** notas distintas no `timemap` contra **459** desenhadas).
  **A função `getExpansionIdsForElement` do Verovio resolve as 669 para ids reais do desenho (100%), e nenhuma nota do desenho fica sem evento.** Nos outros 4 hinos (sem repetição) os ids do `timemap` já são os do SVG.
  Isso torna o destaque por nota **viável e robusto**.
- **Os ids mudam a cada desenho:** o retrato e a paisagem **não têm nenhum id em comum** (medido na I-12), então o mapa de notas é **por versão** (2 por hino).

### Perguntas em aberto
1. **Todas as vozes ou só a melodia (soprano)?** Destacar as 4 vozes acende ~8 cabeças de nota juntas (2 pautas); só a melodia é mais limpa; talvez uma cor por voz.
2. **Como destacar a nota:** trocar a cor da cabeça e da haste, um halo atrás, ou os dois? **Mantém o destaque do compasso** (mais fraco, como contexto) ou o troca por completo?
3. **Notas ligadas** (ligadura de prolongamento): a segunda nota acende? E as pausas, e as notas de enfeite?
4. Basta o botão do karaokê, ou **uma opção em Ajustes** (compasso, nota, desligado)?

### Impacto técnico (hipóteses, a verificar)
- **Dados:** o gerador (`tools/gerar-partituras.py`) emitiria, por versão, um `hino-N[-paisagem].notas.json`: para cada nota do desenho, `[índice do compasso escrito, início e fim dentro do compasso, em batidas]`, com o id do SVG. A posição dentro do compasso vem do `timemap`
  (relativa ao início do compasso daquela passada), e o instante no fluxo vem da lista `compassos` que o hinário **já traz** (início do compasso + posição), então **não depende do deslocamento de cada fluxo** (o final do 457 começa em 48).
- **Pacote e Rust:** o zip passa a aceitar o arquivo novo (nomes exatos, limites, validação) e `ler_partitura` devolve o mapa junto do SVG; o prefixo `bmccb-p-` que a limpeza põe nos ids do SVG tem de valer também no mapa.
- **Interface:** como o destaque do compasso: lê `reproducao.ponto()` e marca os elementos pelo id, só quando muda.
- **Pacote novo (004) e APK novo.** O pacote 003 não tem o mapa: as partituras instaladas precisam ser **baixadas de novo**.
- **Tamanho:** os `timemap` brutos têm de 7 a 26 KB por hino e versão; o mapa compacto, bem menos.

### Critérios de aceitação (propostos)
- A nota destacada é a que soa, em cada instante, nos 5 hinos de amostra, **inclusive nas repetições e no final do 457**.
- Pausado, congela; ao arrastar o slider, acompanha; fora da aba, some.
- Sem o mapa de notas (pacote antigo), o app **cai no destaque por compasso**.
- Legível em todos os temas (contraste).

---

## I-27 — Mostrar na tela de versão qual APK está instalado e em que estado

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-17, depois do incidente do APK 025 (a aba Partitura e o botão de baixar sumiram no aparelho; voltou ao limpar os dados; a causa não foi achada)
- **Prioridade:** a definir (pequena)

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

## Modelo para novas ideias

```markdown
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
