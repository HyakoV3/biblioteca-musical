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

- **Status:** anotada (a **fase A**, o karaokê na letra, está feita: ver [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md))
- **Origem:** sugestão do responsável: um karaokê "tanto na letra das músicas como nas partituras".
- **Prioridade:** depende da I-08 (aba Partitura)

### O que se deseja
Um cursor ou destaque de compasso na **partitura** acompanhando a música, como a letra já faz na aba Letra.

### Perguntas em aberto
1. Cursor por **nota** ou destaque por **compasso**? (O campo `sincronia` do hinário traz tempos por **sílaba**, não por
   compasso: o conversor precisaria gerar também os tempos de cada compasso ou nota.)
2. O histórico e as decisões da fase A (posição do botão, como a sílaba acende, latência da saída de áudio) estão em
   [`archive/ideias-implementadas.md`](archive/ideias-implementadas.md), seção I-12.

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
