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

## I-05 — Arquivo de correções para a letra (proposta do assistente)

- **Status:** anotada
- **Origem:** observação do assistente, 2026-11-14, a partir do hino 1.
- **Prioridade:** a definir

### O problema

Algumas partituras trazem a letra com marcas incompletas ou erros de digitação: numa partitura, "Pa" e "ra," sem marca de continuação (saem "Pa ra,") e "Ia" com "I" maiúsculo no lugar de "la" ("cantêIa"). O
conversor mostra o texto como está no arquivo. Corrigir isso por heurística seria arriscado (poderia alterar o texto
de um hino sem ninguém perceber).

### Ideia

Um arquivo de **correções explícitas**, mantido pelo responsável (por exemplo `content/correcoes.json`, fora do Git
como o resto do conteúdo): uma lista de "trocar este texto por este, neste hino". O conversor aplica só o que estiver
listado e **avisa** cada correção aplicada. Assim o texto dos hinos nunca muda sem registro.

### Perguntas em aberto

1. As correções devem ficar no repositório (úteis a todos, mas são texto do hinário) ou só locais?
2. Prefere corrigir direto nos `.mscx` (sem arquivo de correções)? Isso diverge dos arquivos do autor das transcrições.
3. Vale uma ferramenta que liste os suspeitos (palavras com "I" maiúsculo no meio, sílabas sem marca de continuação)
   para o responsável revisar, em vez de procurar à mão?

---

## I-06 — Modo de baixa visão: preto sobre amarelo bem claro

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14, como requisito de acessibilidade.
- **Prioridade:** a definir (é acessibilidade, então vale tratar como importante)

### O que se deseja (nas palavras do responsável)

Uma versão de **baixa visibilidade**: **preto sobre amarelo bem claro**.

### Contraste medido (2026-11-14)

Preto puro (`#000000`) sobre os candidatos a fundo, contra a meta **AAA de 7:1** para texto comum (WCAG 1.4.6):

| Fundo | Contraste com preto |
|---|---|
| `#FFFFE0` (amarelo claro) | 20,63 : 1 |
| `#FFFDE7` (creme amarelado) | 20,46 : 1 |
| `#FFFFCC` (amarelo bem claro) | 20,43 : 1 |
| `#FFFF99` (amarelo mais forte) | 20,02 : 1 |
| `#FFF9C4` (amarelo suave) | 19,60 : 1 |

Para comparar, o texto principal do tema claro atual dá 14,73 : 1. Qualquer um desses fundos passa com folga. Texto
secundário em cinza também passaria se ficar escuro (`#333333` sobre `#FFFFCC` dá 12,29 : 1; `#4D4D4D` dá 8,22 : 1), mas
num modo de baixa visão vale usar preto também no secundário.

### Ideia de comportamento (a validar)

Uma nova opção em **Ajustes → Aparência**, ao lado de Automático, Claro e Escuro: **Alto contraste** (preto sobre
amarelo claro). Além das cores, o modo reforça o resto do visual:

- Borda dos controles mais grossa e preta; foco com contorno grosso e bem visível.
- Links sempre sublinhados; nada de informação só por cor (o app já segue isso).
- Sem sombras, degradês ou tons intermediários; barras de progresso e interruptores em preto e branco.
- Texto um pouco maior por padrão, combinando com a ideia I-04 (tamanho da letra).

### Aproveitar o padrão da plataforma (não reinventar)

O navegador e o sistema já têm o conceito: a media query CSS **`prefers-contrast: more`** indica que a pessoa pediu mais
contraste, e **`forced-colors`** cobre o modo de cores forçadas. A ideia é: em "Automático", se o aparelho pedir
mais contraste, o app usa esta paleta automaticamente; e a opção manual existe para quem quer o modo sem mexer no
sistema. **Não verificado:** se o WebView do Android e o do iOS repassam essa preferência; precisa de teste no aparelho.

### Perguntas em aberto

1. **Qual amarelo?** Os cinco acima passam; falta escolher no olho, de preferência com quem tem baixa visão.
2. **Ter também a versão invertida** (amarelo ou branco sobre preto)? Muita gente com baixa visão prefere fundo escuro;
   o pedido foi só preto sobre amarelo claro, então fica como pergunta.
3. **Combina com o "pergaminho" (I-02)?** Provavelmente não: é um modo próprio, e juntar os dois complicaria o desenho.
4. **Nome na interface:** "Alto contraste", "Baixa visão" ou outro? Em espanhol e inglês também.
5. **O ícone do app e a barra de status do Android** não mudam com este modo; aceitável?

### Impacto técnico (hipóteses, não verificadas)

- **Tokens (`src/lib/tema.css`):** novo conjunto de valores para `data-tema="alto-contraste"`, e um bloco
  `@media (prefers-contrast: more)` para "Automático".
- **Preferência e primeira pintura:** estender `src/lib/tema.svelte.ts` (os temas passam de 3 para 4) e o script do
  `src/app.html` que aplica o tema antes da primeira pintura.
- **Contraste (`tools/contraste.py`):** conferir esta paleta com a meta **AAA** (7:1 para texto, e 4,5:1 ou mais para
  componentes), mais exigente que a das outras.
- **Traduções:** nova chave nos três idiomas.

### Critérios de aceitação (propostos)

- Todos os pares de texto da paleta passam de 7 : 1 em `tools/contraste.py`.
- Escolher o modo muda o app inteiro na hora e a escolha sobrevive ao fechar o app.
- Com a fonte do sistema no máximo, nada fica cortado.
- Revisado por pelo menos uma pessoa com baixa visão antes de ser dado como pronto.

---

## I-08 — Mostrar a partitura no hino

> **Origem:** sugestão do responsável: "como temos letras, mostrarmos a partitura também". Não estava no escopo
> inicial. O formato já tem o campo opcional `partitura` (caminho de arquivo), mas nunca foi usado.

### O que se deseja
Uma aba **Partitura** no hino (ao lado de Ouvir e Letra) para o músico ler a música enquanto ouve.

### Caminho recomendado (a confirmar com um teste pequeno)
1. **Gerar imagens fora do app**, na conversão: uma ferramenta de linha de comando transforma cada `.mscx` em **SVG**
   (um por página), por exemplo o MuseScore (`mscore -o hino.svg`). A partitura sai idêntica à do arquivo.
2. **Empacotar** as imagens junto do `hinario.json`, usando o campo `partitura`.
3. **Aba "Partitura"** com zoom e rolagem. SVG fica nítido em qualquer tamanho, o que ajuda quem tem baixa visão.
4. **Extra, depois:** acompanhar a música tocando (cursor ou compasso destacado). É viável, porque o conversor já
   sabe o instante de cada compasso.

**Por que não desenhar a partitura a partir do JSON:** o JSON guarda só altura e duração. Faltam armadura, fórmula
de compasso, acidentes, ligaduras, cifras e casas de volta. Reconstruir isso seria reinventar a roda.

### Pontos de atenção
- **Direitos:** as partituras vêm das mesmas transcrições, então a resposta dele vale aqui também. As
  imagens ficam **fora do Git**, como as letras.
- **Importação:** hoje o app importa um só JSON (limite de 20 MB). Com imagens, é preciso um **pacote de vários
  arquivos** (um `.zip`). É a parte de maior trabalho.
- **Tamanho:** 480 hinos em SVG podem somar dezenas de MB; avaliar compressão.
- **Ferramenta:** o MuseScore **não está instalado** no computador de desenvolvimento. Alternativa sem instalar:
  renderizar no próprio app com uma biblioteca como o OpenSheetMusicDisplay, mas exige converter antes para
  MusicXML e é mais frágil. Pesquisar as duas opções antes de escolher (ver também I-01, "Alternativas
  consideradas", onde o MuseScore em linha de comando já foi avaliado para outro fim).

### Perguntas em aberto
1. Instalar o MuseScore para o primeiro teste, ou avaliar a alternativa sem instalar?
2. A aba Partitura deve aparecer só quando o hino tem partitura, ou sempre, com aviso?
3. Vale já planejar o cursor acompanhando a música, ou fica para depois?

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
  reverenciais). Com essa regra, **46 dos 48 versos impressos** conferidos passaram a sair iguais, e as quebras acertaram 57
  de 57. Descrita em `docs/FORMATO.md`. A regra foi ajustada olhando esses 4 hinos, então vale **validar com mais fotos**.
- **Coro (refrão):** nos hinos 398 e 457 o hinário imprime o coro **em negrito e separado** da estrofe, sem número. No JSON ele
  segue **dentro da estrofe 1**, sem marca nenhuma. O app não sabe onde o coro começa.
- **Versos colados:** no hino 283 a partitura não tem respiração entre dois versos, e eles saem na mesma linha. A regra de
  maiúscula não resolve (a letra tem frases com maiúscula no meio de um verso); fica para o arquivo de correções (I-05).
- **Erros de digitação do autor** nos arquivos `.mscx`. **O conversor já conserta, por regra segura** (2026-11-16): pronome
  colado sem hífen depois de vogal acentuada, "I" maiúsculo no lugar de "l", "~" literal e "ãc" no lugar de "ãe". **Continua para a
  I-05:** sílaba sem o marcador de hífen (a palavra sai partida em duas) e outras letras trocadas, que não têm padrão seguro.
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
