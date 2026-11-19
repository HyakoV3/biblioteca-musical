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

- **Status:** **em implementação (2026-11-17).** Feito: a aba **Gravador** (só microfone; formato Opus/webm a 64 kbps; permissão pedida só ao gravar; microfone devolvido ao parar, ao sair da aba e ao esconder o app; **medidor de som no botão** e aviso de "sem som"; **gravações guardadas** no armazenamento do app, **sem limite**, em lista paginada (10 por vez, carrega mais quando o fim chega perto da tela), com nome de data e hora, resumo de quantidade e espaço usado, "Ouvir" e "Apagar" com confirmação e "Apagar todas"). **Testado no aparelho do responsável:** a gravação e o medidor (a gravação funcionou). **Enviar o áudio** já funciona (botão **Enviar**, folha de compartilhamento do Android, PR #77; testado no WhatsApp do responsável em 2026-11-18). **Falta:** **gravar junto com o hino no fone** (depende da detecção de fone e da decisão da pergunta 1 abaixo), renomear a gravação e ligá-la a um hino, e o fone Bluetooth (atraso).
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir
- **Nota (2026-11-17):** o responsável quer o Gravador como uma **aba da tela inicial** (`Hinos | Afinador | Gravador | …`): ver a **I-28**. A permissão de microfone e a detecção de fone se decidem **junto com o afinador** (I-13, etapas 2 e 3): a pesquisa de 2026-11-17 está lá.

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

- **Status:** **etapa 1 pronta, sem o "Tom de um hino".** **DESCARTADO (2026-11-17, o responsável): o "Tom de um hino" (digitar o número do hino e ouvir a tônica) não é necessário e não será feito;** o código foi escrito, testado e **retirado** (commit `c8a81d4`, só local, sem PR). O que ficou: o conversor grava `armadura`, `modo` e `tonalidade` (PR #66) e a tonalidade aparece na lista e no cabeçalho do hino. O Rust do app ainda **não declara** `armadura` nem `modo` (o serde os descarta sem erro); quem os quiser usar um dia, declare-os como `Option<i64>` e `Option<String>` e valide depois de ler. Onde a spec abaixo fala de "Tom de um hino" (decisão 2, o esboço da tela, o item "Tom de um hino" e as etapas de entrega), **vale o descarte**. Fora isso, segue: Feito (2026-11-17): a aba **Afinador** com o **Lá 440 Hz** (botão largo, fora de cartão) e **outra nota** (12 notas num cartão fechado, oitava), o **temporizador** (cartão fechado: até parar, 10, 20 ou 30 s; o tom para sozinho; o botão mostra o que falta e uma barra de progresso; vale para o Lá e para outra nota e recomeça a cada nota nova; não é lembrado), tom sustentado com contexto de áudio próprio, um som de cada vez, sem volume na tela (o do celular), o `afinador.ts` e a `contagem.ts` puros e testados, e o teste de ponta a ponta que **mede o som gerado** (440,3 Hz) e a contagem em tempo real. **Falta:** a **etapa 2** (ouvir e medir), que começa pelo teste do microfone no aparelho. Especificada e revisada por subagente Opus 5 em 2026-11-17 (18 achados, aplicados; ver "Revisão").
- **Origem:** pedido do responsável, 2026-11-14; especificada em 2026-11-17.
- **Prioridade:** a definir. Depende da **I-28** (a aba Afinador na tela inicial), que entra **junto** com a primeira tela do afinador.

### O que se deseja (nas palavras do responsável, 2026-11-14)

Um **afinador** que **dá o tom** e, se a pessoa estiver de **fone de ouvido**, oferece **escutar o som** do instrumento
ou da voz e mostrar se está **baixo ou alto**, num **medidor (gauge) parecido com o de um acelerador**, com o ponteiro
indo para baixo ou para cima da nota certa.

### Decisões do responsável (2026-11-17)

1. **Duas etapas.** Primeiro **dar o tom** (não usa microfone nem permissão), depois **ouvir e medir**.
2. **O tom do hino vem da partitura.** O conversor passa a ler a **tonalidade** do arquivo do MuseScore e a gravá-la no hinário (ver "Dados: a tonalidade").
3. **Onde fica:** uma **aba da tela inicial** (`Hinos | Afinador | Gravador | …`), no mesmo estilo do `Ouvir | Letra | Partitura` de dentro do hino. É a **I-28**, que reaproveita o componente de abas.

### Etapa 1 — Dar o tom

**A aba Afinador** (esboço, no celular em pé; a barra de baixo é a da I-28):

```
┌──────────────────────────────────────────────┐
│ Biblioteca Musical                      ⚙    │
├──────────────────────────────────────────────┤
│ Afinador                                     │
│                                              │
│   ┌──────────────────────────────────┐       │
│   │      ▶  Lá 440 Hz                │       │
│   └──────────────────────────────────┘       │
│                                              │
│   ▸ Outra nota                Dó4 · 262 Hz   │
│     (fechado; abre para escolher a nota,     │
│      a oitava e tocar)                       │
│                                              │
│   Tom de um hino                             │
│   Hino nº [ 276 ]        Mi♭ maior           │
│   ┌──────────────────────────────────┐       │
│   │      ▶  Dar o tom                │       │
│   └──────────────────────────────────┘       │
├──────────────────────────────────────────────┤
│    Hinos        ▌ Afinador ▐    Gravador     │
└──────────────────────────────────────────────┘
```

**O que faz**
- **Lá 440 Hz.** Um botão toca o lá central (A4) e **sustenta** a nota até ser apertado de novo (botão de ligar e desligar, com `aria-pressed`).
- **Outra nota.** É um **cartão fechado** (o mesmo `Cartao.svelte` de Ajustes): a linha de cima mostra a nota e a frequência ("Dó4 · 262 Hz") e quem quiser o abre. Dentro, a pessoa escolhe a nota entre **12 botões** e a **oitava** (2 a 6), vê o nome e a frequência e toca; o mesmo botão toca e para. O cartão **não é lembrado** (começa fechado) e **fechá-lo com a nota soando a para**, porque o botão de parar fica dentro dele. **Grafia fixa dos 12:** Dó, Dó♯, Ré, Mi♭, Mi, Fá, Fá♯, Sol, Lá♭, Lá, Si♭, Si (os bemóis dos tons que os hinos mais usam e os sustenidos só onde faltam). Os botões formam um `radiogroup`, e cada um leva um `aria-label` **por extenso** ("Mi bemol"), porque o leitor de tela pode ler "♭" e "♯" como símbolos.
- **Tom de um hino.** A pessoa escolhe o hino (campo com o número, a mesma busca da lista) e a tela mostra a **tonalidade** ("Mi♭ maior", no idioma da interface). **Dar o tom** toca a **tônica** dessa tonalidade. A **oitava padrão é a 4** (de Dó4 a Si4); abaixo da 3 o alto-falante do celular quase não reproduz o som, e a tela **avisa**. Hino sem tonalidade no hinário (conteúdo importado antes desta mudança) deixa o botão desligado com a explicação "importe um hinário atualizado".
- **Som.** Timbre **sintetizado** `orgao_suave` (`src/lib/instrumentos.ts`: quase uma onda simples, **sem vibrato**, fácil de afinar de ouvido). Os instrumentos gravados ficam de fora porque o afinador **tem de funcionar sem nenhum pacote baixado** (o `smplr` até tem laço, `loadLoopData`, mas isso não muda o motivo).
- **Temporizador.** Um segundo cartão, fechado, com a escolha atual na linha de cima ("Até parar" / "20 s"). O padrão é o de sempre: o tom soa até a pessoa parar. Com 10, 20 ou 30 s o tom **para sozinho** (sai com a envoltória) e o botão volta a "tocar". Vale para o Lá e para outra nota (uma escolha só) e **a contagem recomeça a cada nota ou oitava nova**; mudar o tempo com o tom soando vale a partir de agora, e voltar a "até parar" cancela a contagem sem parar o tom. A escolha **não é lembrada**. O botão de parar mostra "Parar · faltam 14 s" e um fio de progresso na borda de baixo (só visual: o leitor de tela só é avisado do fim, "Tom encerrado pelo temporizador", e não ouve a contagem segundo a segundo; a barra anda em passos de 1 s, sem animação).
- **Sem controle de volume na tela** (decisão do responsável, 2026-11-17: "como é celular, não faz sentido ter volume ali; a pessoa controla nos botões físicos"). O tom tem ganho fixo e quem ajusta é o volume de mídia do celular. Afinação de referência fixa em **440 Hz** nesta etapa (temperamento igual).

**Áudio: um contexto próprio e um som de cada vez** (achado de bloqueio da revisão)
- O hino toca num `AudioContext` **privado** do `Sintetizador` (nasce dentro de `tocar()`), e a pausa do hino é `ctx.suspend()`. Se o afinador usasse o mesmo contexto, **pausar o hino calaria o tom**. Logo o afinador tem o **seu próprio** `AudioContext`, criado e retomado **no toque** (o áudio só inicia depois de um gesto do usuário). **Reaproveita os perfis e a construção das ondas, não o contexto.**
- **Nota sustentada é código novo:** `agendarNota` exige a duração e agenda a soltura de antemão. A nota do afinador precisa de rampa de entrada, nota sem fim, rampa de saída e `stop` do oscilador só depois da soltura (sem estalo).
- **Dar o tom para o hino** que estiver tocando. Como `reproducao.pausar()` **não faz nada enquanto o hino ainda carrega** (`trocando`), o afinador **observa `reproducao.estado`** e só toca quando o hino não está tocando nem carregando.
- **O caminho inverso também vale:** se a pessoa der "Tocar" no miniplayer (ou na tela do hino) **com o tom soando**, o tom **se cala**. O hino **não volta sozinho** depois que o tom para.
- **Quando o tom para:** ao apertar de novo, ao sair da aba, quando a página vai para segundo plano (`visibilitychange`) e quando o hino começa.

**Dados: a tonalidade** (o conversor e o formato)

Hoje o conversor **não grava `tonalidade`**: o campo existe no formato (`docs/FORMATO.md`, e `Hino.tonalidade` no Rust) e a tela já o mostra, mas nos 5 hinos de amostra ele vem vazio. O arquivo do MuseScore traz a **armadura** (`<KeySig><accidental>-3</accidental>`: número de bemóis, negativo, ou de sustenidos, positivo) e, nos arquivos de amostra, **não traz o modo** (todos são do MuseScore **2.06**; que o MuseScore 4 grave `<concertKey>` e um `<mode>` **não foi confirmado**: aceitar o que existir e usar o modo escrito quando houver).

- **Armadura:** a do **primeiro** `KeySig` da partitura (um braço `"KeySig"` em `percorrer`, como o `"Tempo"`, que também guarda só o primeiro); sem o elemento, armadura 0. Modulações no meio da peça são ignoradas (documentar).
- **Tônica e modo (hipótese a validar):** a tônica **maior** da armadura é `(armadura × 7)` módulo 12 (em Rust, **`rem_euclid`**, porque o resto de um número negativo é negativo); a da **relativa menor** fica 3 semitons abaixo. O modo sai da **nota final do baixo**: se bate com a menor, **menor**; senão, **maior**. A "nota final" é a da passada **final**, se o hino tiver uma, ou a da normal. Se não bater com nenhuma, usa a **primeira** nota do baixo; se ainda não bater, assume maior e o conversor **avisa** na saída.
- **Medido nos 5 hinos de amostra:** 4 trazem `KeySig` (−3, −3, +1 e −2) e o 457 não traz o elemento (a primeira nota do baixo é Dó: armadura 0). Nos 4 com armadura, a nota final do baixo é a tônica **maior** (Mi♭, Mi♭, Sol e Si♭) e igual à primeira nota do baixo. **Nenhum hino de amostra é menor**, então o ramo "menor" ainda não foi visto em dado real.
- **O nome vem da armadura, não da tônica** (a mesma classe de nota tem dois nomes: +6 é Fá♯ maior e −6 é Sol♭ maior). Tabela, da armadura à tonalidade (maior / relativa menor):

  | Armadura | −7 | −6 | −5 | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Maior | Dó♭ | Sol♭ | Ré♭ | Lá♭ | Mi♭ | Si♭ | Fá | Dó | Sol | Ré | Lá | Mi | Si | Fá♯ | Dó♯ |
  | Menor | Lá♭ | Mi♭ | Si♭ | Fá | Dó | Sol | Ré | Lá | Mi | Si | Fá♯ | Dó♯ | Sol♯ | Ré♯ | Lá♯ |

- **O que se grava no hinário** (opcional; hinários antigos continuam válidos): `armadura` (−7 a +7), `modo` (`"maior"` ou `"menor"`) e, por compatibilidade com versões antigas do app, `tonalidade` em texto no idioma do hinário. **A tônica não é gravada:** o app a deriva de `armadura` e `modo` (função pura e testada em `afinador.ts`).
- **Nomes por idioma:** o app **monta o nome** a partir de `armadura` e `modo` no idioma da **interface** (pt "Mi♭ maior", en "E♭ major", es "Mi♭ mayor"), e usa o texto `tonalidade` só se os campos faltarem. Efeito colateral a decidir: a **lista de hinos** e o cabeçalho do hino passam a mostrar a tonalidade de cada hino (o código já existe e hoje não aparece nada).
- **Rust (`src-tauri/src/hinario.rs`):** declarar `armadura: Option<i64>` e `modo: Option<String>` (não um tipo mais estreito): um **tipo errado** num campo declarado faz o serde **recusar o hinário inteiro** (`json_invalido`), ao contrário de `compassos`, cujo descarte só acontece com o tipo certo e o conteúdo inválido. Validar **depois** de ler (armadura em −7 a 7, modo em `maior`/`menor`) e, se algo estiver inválido, **descartar os dois sem recusar o hino**. Sem declarar, o serde os descartaria em silêncio na ida ao front.
- **`docs/FORMATO.md`:** o exemplo traz `"tonalidade": "Dó"`, sem modo; atualizar.
- **Reconverter e reimportar o hinário** é parte do teste (a mesma lição dos `compassos`).

**Impacto técnico da etapa 1 (hipóteses)**
- `tools/mscx2json`: o braço `"KeySig"`, o modo, os campos novos (`armadura`, `modo`, `tonalidade`) e testes com armaduras de −7 a +7, ausência de `KeySig`, hino menor e caso ambíguo.
- `src-tauri/src/hinario.rs` e `src/lib/biblioteca.svelte.ts`: os campos e a validação.
- `src/lib/afinador.ts` (**funções puras**, testáveis no Vitest): `tonicaDe(armadura, modo)`, nome da nota e da tonalidade por idioma (pt, en, es), frequência de uma nota dada a afinação (`440 × 2^((n−69)/12)`; já existe `frequencia` em `sintetizador.ts`), cents entre duas frequências e nota mais próxima. Serve também à etapa 2.
- Um módulo do **tom sustentado** (com o `AudioContext` próprio), usando os perfis de `src/lib/instrumentos.ts`.
- Componente `Afinador.svelte` com a prop `ativa`, como a `Partitura.svelte`. Textos nos 3 idiomas, tamanhos em `rem`, botões com `aria-pressed`.
- **Teste de ponta a ponta:** o teste de hoje não alcança o grafo de áudio privado do app, e o Chrome do `tests/e2e/karaoke.mjs` roda com `--autoplay-policy=no-user-gesture-required`, o que **esconde** o problema do gesto. Então: (1) conferir a frequência com um **nó de teste** exposto só em modo de teste, ou com um `OfflineAudioContext` que renderiza o mesmo perfil, e (2) rodar o trecho do gesto **sem essa flag** (mantendo `--mute-audio`) para provar que o toque inicia o áudio.

### Etapa 2 — Ouvir e medir

O app escuta o microfone, descobre a nota e mostra **quantos cents** ela está acima ou abaixo (1 semitom = 100 cents), num **ponteiro** que vai de "baixo" a "alto" passando pelo centro ("afinado").

**O medidor**
- Mostra o **nome da nota** mais próxima, o **número de cents** (com sinal) e a **palavra** ("baixo", "alto", "afinado"); o ponteiro nunca depende só da cor, e respeita "reduzir movimento".
- **"Afinado":** ±5 cents (a banda mais comum nos afinadores; o limiar de percepção fica em 5 a 6 cents), com **histerese** para a palavra não piscar na borda. A tolerância fica configurável.
- **Faixa:** de cerca de 65 Hz (Dó2) a 2100 Hz (Dó7); fora dela, "sem nota".
- Sem som ou com sinal fraco, o medidor **descansa** e diz "toque ou cante uma nota", em vez de inventar uma leitura.
- **Leitor de tela:** o medidor leva `aria-live` com **taxa limitada** (anunciar a mudança de nota e de palavra, no máximo uma vez por segundo, e não cada leitura em cents).

**Como detecta (pesquisado em 2026-11-17)**
- **Biblioteca: `pitchy`** (algoritmo MPM, de McLeod): tipos TypeScript, cerca de 2,8 KB comprimida (com a dependência `fft.js`), versão 4.1.0 de janeiro de 2024. Licença **MIT** no pacote do npm e **0BSD** no repositório (conferidos na revisão): as duas servem a um projeto MIT. API: `PitchDetector.forFloat32Array(N).findPitch(buffer, taxa)` devolve a frequência e uma **clareza** de 0 a 1. Ressalva: o último lançamento tem quase 3 anos (há commits recentes e uma issue de lançamento automático aberta), mas é pequeno o bastante para **copiar para o repositório** se for abandonado.
- **Recusadas:** `pitchfinder` (a licença é "GNU v3" no `package.json`, sem arquivo de licença, e o YIN vem do aubio, que é GPL), `aubiojs` (aubio é GPL-3.0; 427 KB) e CREPE (precisa do TensorFlow.js e de um modelo; pesado demais). `@audio/pitch` (MIT, 2026) é uma alternativa **muito nova** (3 estrelas) e de cálculo O(N²).
- **Janela:** 2048 amostras (de 42,7 a 46,4 ms a 48 e 44,1 kHz) cobrem dois períodos até ~65 Hz. **Ler a cada quadro** (~16 ms), com janelas sobrepostas, e não a cada 50 a 100 ms: a mediana abaixo precisa de várias leituras e, com leituras espaçadas, o atraso passaria de 400 ms. A latência de captura pesa pouco perto da janela, então **começar com `AnalyserNode`** (`getFloatTimeDomainData`), mais simples que um `AudioWorklet`, e só passar ao `AudioWorklet` se o teste no aparelho pedir.
- **Filtros por cima do detector** (a biblioteca não os traz): corte por **clareza** (começar em 0,9 e calibrar entre 0,7 e 0,9, como relatam usuários do `pitchy`), corte por **volume** (RMS), **mediana sobre ~200 ms** (cerca de 12 leituras a ~16 ms) para o vibrato da voz (taxa de 4 a 7 Hz) e **regra de oitava**: travar a faixa e ignorar saltos de ~1200 cents até que persistam por N quadros. São **inferências**, a calibrar com voz e instrumentos reais.
- **Precisão em voz cantada e metais não tem número publicado** que eu tenha achado (o mantenedor do `pitchy` nunca testou voz; há relatos de picos espúrios), então o desempenho **só se confirma testando** com a voz e os instrumentos do responsável.

**Microfone no Tauri 2 para Android (pesquisado em 2026-11-17)**
- O **wry trata o pedido de permissão da WebView** (`RustWebChromeClient.kt`, conferido na revisão): para captura de áudio ele pede `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` em tempo de execução e só concede se a pessoa aceitar; senão nega. As versões atuais são wry 0.57.2 e tauri 2.12.6.
- **O manifesto precisa declarar** `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` (hoje só tem `INTERNET`, em `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, que está versionado; nada em `capabilities/` nem em `tauri.conf.json` afeta o microfone). Sem a segunda há relato de `NotReadableError` (discussão tauri-apps/tauri#12732). Essa discussão sugere código extra na `MainActivity`; **não foi possível confirmar se ainda é necessário**.
- Chamar `getUserMedia` **uma vez só, a partir de um toque**, sem chamadas paralelas: há uma issue aberta no wry (#1917) em que um resultado de permissão vazio é tratado como concedido e dois pedidos simultâneos se sobrescrevem.
- **Não mudar `useHttpsScheme`:** muda a origem do armazenamento da WebView (e os dados do app). Que `http://tauri.localhost` conte como contexto seguro **não foi confirmado**, embora a discussão indique que funciona.
- iOS: `NSMicrophoneUsageDescription` em `src-tauri/Info.ios.plist` (fora do escopo agora).
- Não há plugin oficial; o plugin de comunidade encontrado **grava** nativamente e não serve para Web Audio. **Nada disso foi testado em Android 12 a 15**: é o motivo do teste de aparelho antes de construir o medidor.

**Restrições de áudio**
- Pedir `echoCancellation`, `noiseSuppression` e `autoGainControl` como `false` (como `ideal`), `channelCount: 1`, e **conferir o que valeu** com `track.getSettings()`. No código atual do Chromium para Android, sem o cancelamento de eco ele **não usa o caminho de chamada** (que mexe no sinal). Há um relato isolado de que desligar o AGC e o NS não evitou quedas de volume em vogais sustentadas; **testar com a voz**.

**Casos de borda da escuta**
- **Permissão negada "para sempre":** o app só pode **explicar** e mandar a pessoa para os ajustes do aparelho (não há plugin para abri-los daqui). **Dar o tom continua funcionando.**
- **Segundo plano e bloqueio de tela:** soltar o microfone em `visibilitychange`.
- **Chamada telefônica e foco de áudio:** o comportamento da WebView com Web Audio **não foi confirmado**; testar no aparelho.

**Fone, Bluetooth e o ciclo de áudio** (a premissa original muda; **proposta minha, não decisão do responsável**: ver a pergunta 1)
- O rascunho dizia "só com fone". Se os dois modos forem **exclusivos** (ao escutar, a nota de referência **para**; ao tocar a nota, o microfone **fecha**), o app não cria o ciclo alto-falante → microfone por conta própria e **não precisa detectar fone** na v1. Ao ligar a escuta, o app também **pausa** o hino que estiver tocando.
- Ouvir e tocar **ao mesmo tempo** (a ideia original, com fone) exige saber se há fone. No navegador isso é **pouco confiável** na WebView do Android (o evento `devicechange` só existe a partir do Chrome 132, os nomes dos dispositivos podem vir vazios, relatos de só aparecer o dispositivo `default`). O caminho sustentável é um **plugin Tauri pequeno em Kotlin** com `AudioManager.getDevices` e `registerAudioDeviceCallback`, que avisa o JavaScript (não achei plugin pronto). Fica para uma etapa 3, junto com o gravador (I-03), que tem a mesma necessidade.
- **Fone Bluetooth:** quando o microfone usado é o do fone Bluetooth, o Chromium coloca o Android em **modo de comunicação** e a saída passa do perfil de música (A2DP) para o de voz (SCO), de qualidade de chamada (commit `78d0de138346e6edfc8c33bdd22c45b3eec4f3d0` do Chromium, "android audio: Set communication mode when using Bluetooth microphone"; a revisão leu a mensagem do commit, não o código). Recomendação: **fone com fio (ou USB-C)** ou o microfone do próprio aparelho. Forçar o microfone do aparelho por `deviceId` quando houver Bluetooth é uma ideia **não testada**.

### Perguntas em aberto (com a minha recomendação)

1. **Abandonar a premissa "só com fone" na v1** (modos exclusivos, sem detectar fone)? É **proposta minha**; o responsável pediu a escuta "se a pessoa estiver de fone". **Recomendo sim**: entrega a escuta sem depender de um plugin nativo, e a escuta e o tom ao mesmo tempo ficam para a etapa 3.
2. **Atalho "Dar o tom" dentro do player do hino**, usando a **transposição** escolhida (o cartão "Andamento e Tom")? **Recomendo sim, depois da etapa 1**: é a hora em que a pessoa mais precisa.
3. **Nota inicial de cada voz** (soprano, contralto, tenor e baixo) além da tônica? **Recomendo sim, é barato**: os dados já existem em `vozes`.
4. **Tocar o acorde da tônica** (tônica, terça e quinta), e não só a nota? **Recomendo só a nota na v1.**
5. **Mostrar a tonalidade na lista de hinos** e no cabeçalho do hino (o código já existe)? **Recomendo sim**, é pequena e útil a quem canta.
6. **Instrumentos que transpõem** (si bemol, mi bemol, fá): **mostrar a nota real** (a que soa) na etapa 2, e uma opção "instrumento" depois.
7. **Afinação de referência** de 440 para 442 Hz: **fixa em 440 Hz** na etapa 1; configurável na etapa 2.
8. **Voz cantada** também? **Sim desde a etapa 2** (a mediana trata o vibrato); validar com a voz do responsável.
9. **Escolher o microfone** (aparelho, fio, Bluetooth) numa lista? **Só se o teste de aparelho mostrar o problema do Bluetooth.**

### Etapas de entrega (pull requests, nesta ordem)

1. **Conversor, Rust e formato:** `armadura`, `modo` e `tonalidade` (com testes e `docs/FORMATO.md`). Sozinha já é útil: a tonalidade aparece nos hinos reconvertidos.
2. **Aba Afinador, "dar o tom", junto com a I-28** (a barra de abas só aparece com mais de uma aba, então a I-28 sozinha não mostraria nada): `afinador.ts`, o tom sustentado, a tela e os testes. **Fim da etapa 1.**
3. **Teste do microfone no aparelho (spike, antes de qualquer medidor):** um APK de teste com as duas permissões no manifesto e uma tela mínima que chama `getUserMedia`, mostra `track.getSettings()` e o nível do sinal. Confere, no aparelho do responsável, se pede a permissão, se funciona e como fica com fone com fio e Bluetooth.
4. **Medição e medidor:** detector (`pitchy`), filtros e o ponteiro.
5. **Mais tarde:** escuta e nota ao mesmo tempo com fone (plugin Kotlin), junto com o gravador.

### Critérios de aceitação (propostos)

**Etapa 1**
- O Lá toca a 440 Hz (medido no teste, com folga de 1 Hz) e para ao apertar de novo, ao sair da aba, ao ir para segundo plano e quando o hino começa.
- **Pausar o hino não cala o tom**, e o tom não começa **por cima** de um hino que está tocando ou carregando; dar "Tocar" no miniplayer com o tom soando **cala o tom**; o hino **não volta sozinho** depois do tom.
- O toque inicia o áudio **sem** a flag de autoplay do Chrome de teste.
- Para uma nota escolhida e para a tônica de um hino de amostra, a frequência bate com a fórmula do temperamento igual.
- A tonalidade dos hinos de amostra sai certa no hinário (hinos 1, 276, 283, 398 e 457: Mi♭ maior, Mi♭ maior, Sol maior, Si♭ maior e Dó maior), os nomes saem corretos em pt, en e es, e um hino sem ela tem o botão desligado com a explicação.
- Nenhum estalo ao ligar e desligar. Legível em todos os temas, em `rem`, com o teclado e o leitor de tela (o nome da nota é anunciado por extenso).

**Etapa 2**
- Com um tom puro de 440 Hz vindo de outra fonte, o medidor marca **afinado** (±5 cents); a 20 cents abaixo ou acima, marca **baixo** ou **alto** com o número certo (±3 cents).
- Funciona com a voz do responsável e com pelo menos um instrumento de sopro, sem pular de oitava de forma visível.
- Ao negar a permissão de microfone, **dar o tom continua funcionando** e a tela explica o que aconteceu.
- Ao escutar, a nota de referência está parada; ao tocar a nota, o microfone está fechado; o hino que tocava é pausado.
- O medidor se entende sem cor (número e palavra) e com "reduzir movimento".

### Revisão

Revisão por subagente **Opus 5** em 2026-11-17, só leitura, com o código aberto: **18 achados** (1 bloqueio, 15 a corrigir e 2 sugestões), todos aplicados acima; os mais pesados foram conferidos por mim no código antes de aplicar.
- **Bloqueio:** o `AudioContext` do hino é privado e a pausa dele é `ctx.suspend()`; um afinador no mesmo contexto calaria ao pausar o hino. Agora o afinador tem contexto próprio.
- **Mudou o desenho:** `reproducao.pausar()` não age enquanto o hino carrega (o afinador observa o estado); o serde **recusa o hinário inteiro** se um campo declarado vier com tipo errado (campos `Option<i64>` e `Option<String>`, validados depois); nomes de tonalidade pela armadura (tabela) e montados no idioma da interface; a I-28 entra junto com a aba Afinador; leitura a cada quadro, não a cada 50 a 100 ms.
- **Corrigido por engano meu:** "as amostras gravadas não fazem laço" (o `smplr` tem laço); trocada a justificativa do timbre sintetizado.
- **Confirmado pela revisão:** a matemática (fórmula, 65 a 2093 Hz, janela de 42,7 a 46,4 ms, relativa menor 3 semitons abaixo), os dados medidos nas amostras, a licença do `pitchy` (MIT no npm, 0BSD no repositório), o tratamento de permissão no wry e o commit do Chromium (hash completo acima).
- **Não confirmado:** o `<mode>`/`<concertKey>` do MuseScore 4, o foco de áudio da WebView em chamada, o "desde 2022" do wry e a duração de ~3 s das amostras gravadas (que deixei de usar como argumento).
- **Risco que mais preocupava o revisor:** o contexto compartilhado, que deixaria a etapa 1 muda justamente no caso "pausar o hino". Resolvido pelo contexto próprio e pelos critérios de aceitação acima.

---

## I-20 — Metrônomo embutido

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-16: "fazer um metrônomo também, embutido".
- **Prioridade:** a definir
- **Nota (2026-11-17):** a tela inicial vai ter abas de ferramentas (I-28: `Hinos | Afinador | Gravador | …`, "entre outras"). Se o metrônomo também for uma aba, a pergunta 3 ("onde fica") se resolve por ela.

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

- **Status:** **teste no emulador feito e implementação do caminho 1 em andamento (2026-11-17).** **Teste (emulador Android 17, APK 029 em diante, sem nada de segundo plano):** o hino 1 tocou com a tela **bloqueada** por mais de 1 minuto e o som **não cortou**: o stream de áudio do app seguiu `started` (`dumpsys audio`) e, ao desbloquear, o hino estava em 1:14, na 2ª estrofe (o relógio do JavaScript seguiu). **Não vale como prova para o celular do responsável:** o emulador não imita as economias de bateria dos fabricantes nem o Doze depois de vários minutos no bolso, e não deu para testar o "hino todo" com as pausas de 2 s. O teste de trocar de aplicativo (Home) foi **inconclusivo** (a tela apagou por tempo). **Implementado (falta o teste no aparelho):** serviço em primeiro plano de mídia (`ServicoAudio.kt`) com notificação (título do hino e botão "Parar"), `WAKE_LOCK` parcial e a ponte `window.BmccbServico` (`PonteServico.kt`), ligada e desligada pelo `reproducao.estado` no layout (`servico.ts`). Ainda **não há** MediaSession (controles na tela de bloqueio além do "Parar" e botões do fone).
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

- **Status:** **implementada** (2026-11-17, fatias 1 a 4): `Cartao.svelte` e `LinhaPacote.svelte` (o player e Ajustes migraram sem mudar a aparência); Ajustes em cartões, com a linha de estado e o cartão **Conteúdo** (o Hinário sem caixa, com os botões lado a lado, por pedido do responsável ao testar); Aparência, Idioma e Conteúdo **lembram** se ficaram abertos (`prefs.ajustes`; Sobre e Créditos abrem sempre fechados); e o botão "Abrir Ajustes" da aba Partitura leva a `/ajustes?abrir=partituras`, que abre o Conteúdo e rola até as partituras **sem gravar** essa abertura. O título de cada cartão é um `<h2>` dentro do resumo (navegação por títulos do leitor de tela). Reescrita em 2026-11-17 sobre o estado atual da tela (a primeira versão, de 2026-11-16, era anterior à PR #42) e revisada por subagente Opus 5 no mesmo dia (12 achados, aplicados; ver "Revisão"). Pode ir para `docs/archive/` depois que o responsável testar.
- **Origem:** pedido do responsável, 2026-11-16: "no Ajustes já cabe uns cards... o de temas, o de importação (importar hinário agora, apesar de que no futuro não existe, mas teria o importar partituras e importar sons gravados dentro)". E, em 2026-11-17: "tá me atrapalhando já um pouco o Ajustes".
- **Prioridade:** **a próxima**, depois da I-13 (o responsável, 2026-11-17).

### O problema
Hoje **Ajustes** é uma coluna de **sete blocos soltos** mais a versão. Só "Sobre o app" e "Créditos e licenças" são cartões que se recolhem (`<details class="cartao">`):

```
┌──────────────────────────────────────────────────────┐
│ Ajustes                                              │
│ APARÊNCIA                                            │
│   Modo    [Automático][Claro][Escuro][Alto contr.]   │
│   Estilo  [Normal][Pergaminho][Marinho]              │
│ IDIOMA                                               │
│   [ Português                                  ▾ ]   │
│ BIBLIOTECA                                           │
│   Amostra de teste · 5 hinos                         │
│   [Importar hinário]  [Remover importação]           │
│ PARTITURAS                             (#partituras) │
│   ┌────────────────────────────────────────────┐     │
│   │ Todas as partituras                        │     │
│   │ Instaladas: 5                    [Remover] │     │
│   └────────────────────────────────────────────┘     │
│ SONS GRAVADOS                                        │
│   ┌────────────────────────────────────────────┐     │
│   │ Todos os sons gravados                     │     │
│   │ 36 MB · Não instalado    [Baixar (36 MB)]  │     │
│   └────────────────────────────────────────────┘     │
│ ⓘ Aplicativo não oficial (sem ligação com a CCB)     │
│ ▸ Sobre o app                                        │
│ ▸ Créditos e licenças                                │
│         Versão 0.3.0 (…)                             │
└──────────────────────────────────────────────────────┘
```

O que incomoda:
1. **A tela é comprida**, e fica mais ainda com a fonte do sistema grande (tudo cresce em `rem`). Cada pacote novo (a I-25 acrescenta um estado "atualização" a cada linha) piora.
2. **A mesma coisa, desenhos diferentes.** Hinário, partituras e sons gravados são **conteúdo que se instala e remove**, mas o hinário é um texto com botões soltos, enquanto partituras e sons usam o bloco `.pacote`.
3. **Código duplicado.** O bloco `.pacote` está escrito **duas vezes** (Partituras e Sons) e o cartão com resumo (`.cartao` + `<summary>`) também (Ajustes e o **player**, que já tem "Andamento e Tom" com resumo na linha de cima). Um terceiro uso seria uma terceira cópia.

### O que já está decidido (não reabrir)
- **Partituras não têm importação manual.** O app **baixa** o pacote do servidor e confere o SHA-256 (PR #42; `docs/FORMATO.md`; o teste de ponta a ponta exige que o cartão não tenha campo de arquivo).
- **O pacote de partituras é separado do hinário.** O `.zip` só aceita `partituras/…` e grava a marca `.hinario` com o `id` do hinário instalado (`src-tauri/src/pacote.rs`); baixar ou remover partituras **nunca** troca o hinário.
- **"Importar hinário" aceita só `.json`** ("no futuro não existe": o hinário virá de um pacote). O teste confere o `accept`.

### O que se deseja
Ajustes em **cartões recolhíveis**, cada um com uma **linha de estado quando fechado** (recolher não esconde o que importa), e um cartão **Conteúdo** com as três coisas instaláveis. **Decisão do responsável ao testar (2026-11-17):** o **Hinário** não leva caixa (o texto do hinário e os dois botões **lado a lado**); as **partituras** e os **sons** ficam no desenho de linha (`LinhaPacote`):

```
┌──────────────────────────────────────────────────────┐
│ Ajustes                                              │
│ ⓘ Aplicativo não oficial (aviso sempre à vista)      │
│ ▸ Aparência        Automático · Normal               │
│ ▸ Idioma           Português                         │
│ ▾ Conteúdo         Amostra · 5 partituras · sem sons │
│   HINÁRIO                                            │
│   Amostra de teste                                   │
│   5 hinos                                            │
│   [Importar hinário]    [Remover importação]         │
│   PARTITURAS                                         │
│   ┌────────────────────────────────────────────┐     │
│   │ Todas as partituras                        │     │
│   │ Instaladas: 5                    [Remover] │     │
│   └────────────────────────────────────────────┘     │
│   SONS GRAVADOS                                      │
│   ┌────────────────────────────────────────────┐     │
│   │ Todos os sons gravados                     │     │
│   │ 36 MB · Não instalado    [Baixar (36 MB)]  │     │
│   └────────────────────────────────────────────┘     │
│ ▸ Sobre o app                                        │
│ ▸ Créditos e licenças                                │
│         Versão 0.3.0 (…)                             │
└──────────────────────────────────────────────────────┘
```

O aviso "aplicativo não oficial" continua **sempre à vista** (não é cartão).

**Princípios do projeto:** medidas em `rem`; cores só das variáveis do tema; estado por **texto e ícone**, nunca só por cor; vale nos temas claro, escuro e alto contraste; **teclado e leitor de tela** (o `<details>` e o `<summary>` já dão isso); textos nos 3 idiomas.

### O que se reaproveita
- **`Cartao.svelte`** (novo, extraído do que já existe): props `titulo`, `resumo`, `aberto` (ligável) e `name` (opcional, para o acordeão nativo que o player usa). Substitui o `.cartao` duplicado do player (`Player.svelte`) e o de Ajustes; **o player migra junto**, para não ficarem três cópias.
- **`LinhaPacote.svelte`** (novo, do bloco `.pacote`): título, detalhe, e a ação (baixar, andamento, remover, **atualizar**: a I-25). A **lógica** de baixar, conferir e instalar **já está separada** (`src/lib/sons/pacotes.svelte.ts`, `src/lib/partituras/partituras.svelte.ts`, os dois sobre `baixarZip`) e **não muda**: a duplicação é só do desenho.
- **O molde de preferências** de `lerCartoes` (`src/lib/preferencias.ts`): leitura validada, valor ruim volta ao padrão, `try/catch`.

### Comportamento
- **Linha de estado dos cartões fechados:**
  - **Aparência:** "{modo} · {estilo}"; com Alto contraste (que ignora o estilo), só "Alto contraste".
  - **Idioma:** o nome do idioma, na própria língua.
  - **Conteúdo:** hinário em uso, partituras instaladas e sons instalados (por exemplo "Amostra · 5 partituras · sem sons"). **Durante um download ou um erro**, a linha mostra "baixando N%" ou "erro" com ícone (não só cor), porque o `<Aviso>` e o progresso **ficam dentro** do cartão e sumiriam se ele estivesse fechado.
- **Estado lembrado** (só Aparência, Idioma e Conteúdo): uma **chave nova** `prefs.ajustes` (a `prefs.cartoes` **já é do player**), com um objeto de booleanos, validado como `lerCartoes`. **Sobre e Créditos não entram** (continuam abrindo fechados). Padrão: **todos fechados**.
- **"Abrir Ajustes" da aba Partitura** (hoje `<a href="/ajustes">`, em `Partitura.svelte`): passa a `/ajustes?abrir=partituras`. A tela lê o parâmetro ao montar, **abre o cartão Conteúdo**, espera (`tick`) e rola até `#partituras`. **Essa abertura forçada não é gravada.** O texto `partitura.sem_pacote_texto` ("… no cartão Partituras") muda nos 3 idiomas. Não conto com a abertura automática do `<details>` ao seguir um `#hash` (depende da versão da WebView); abro por código.
- **Remover:** "Remover importação" (hinário) **tem diálogo** e apaga o hinário **e** as partituras (volta ao exemplo); o "Remover" das partituras e o dos sons **apagam na hora**, sem confirmar (o pacote se baixa de novo). Ver a pergunta 5.

### Perguntas em aberto (com a minha recomendação)
1. **Um cartão "Conteúdo" com as três linhas, ou três cartões?** **Um:** é a mesma coisa para a pessoa e o desenho da linha é o mesmo.
2. **Cartões livres ou acordeão** (abrir um fecha os outros, como no player)? **Livre**, para comparar Conteúdo com Aparência; lembra só o que a pessoa abriu.
3. **Padrão e a abertura pelo link da aba Partitura:** todos fechados no primeiro uso; quem chega pelo link vê o Conteúdo aberto e rolado, sem gravar isso. **Concordo.**
4. **A linha "Hinário":** "Importar arquivo" (`.json`) como hoje, e, quando o hinário passar a vir de um pacote, ele **vai para um submenu "Avançado"**, em vez de sumir (serve para testar hinários sem servidor). **Concordo.**
5. **"Remover" de partituras e de sons pede confirmação?** Hoje nenhum pede. **Recomendo não:** o pacote se baixa de novo; o diálogo fica só no "Remover importação", que **não** é recuperável.
6. **O player migra para o `Cartao.svelte` na primeira fatia?** **Sim**: senão ficam três cópias do mesmo cartão. É o trecho mais arriscado (o player usa `name` e guarda o estado em `prefs.cartoes`).

### Impacto técnico (hipóteses, a verificar)
- `src/routes/ajustes/+page.svelte` (a tela): trocar as seções por `Cartao` e `LinhaPacote`; o resumo de cada cartão é `$derived`.
- `src/lib/preferencias.ts` e `tests/preferencias.test.ts`: a chave `prefs.ajustes`, com testes de valor ruim.
- `src/lib/i18n/pt.ts`, `en.ts` e `es.ts`: as chaves novas (resumos, rótulos); o `Dicionario` tipado faz o `svelte-check` exigir a paridade.
- `src/lib/Partitura.svelte` e o texto `partitura.sem_pacote_texto`: o link com `?abrir=partituras`.
- **Não muda:** o Rust (`remover_partituras` **já é** um comando, em `lib.rs`), o formato do pacote e as lojas de estado dos sons e das partituras.
- **Teste de ponta a ponta** (`tests/e2e/karaoke.mjs`) depende de Ajustes: do `id="partituras"` (**manter na linha**), do `innerText` do cartão (com o `<details>` fechado o texto some: **abrir o cartão antes de ler**), de `href === "/ajustes"` (passa a `/ajustes?abrir=partituras`) e do primeiro `input[type=file]` da página (fica na linha Hinário, dentro de Conteúdo). Ajustar sem afrouxar o que ele afirma (sem campo de arquivo nas partituras; `accept` só `.json`).
- **Cruza com a I-25:** a `LinhaPacote` precisa do estado "atualização disponível" (texto e ícone), e o interruptor de "verificar atualização" (pergunta 5 da I-25) precisa de um lugar: no cartão Conteúdo. A I-28 (abas da tela inicial) **não interage** com Ajustes.

### Fatias de entrega (pull requests, nesta ordem)
1. **`Cartao.svelte` e `LinhaPacote.svelte`**, migrando o player e Ajustes **sem mudar o comportamento** (o teste de ponta a ponta passa como está).
2. **Ajustes em cartões, com a linha de estado** (o teste ajustado).
3. **Estado lembrado** (`prefs.ajustes`) e os testes de preferências.
4. **O link `?abrir=partituras`** da aba Partitura, com o texto nos 3 idiomas.

### Critérios de aceitação (propostos)
- Com todos os cartões fechados, **cada um mostra a linha de estado correta** (modo e estilo, ou só Alto contraste; idioma; hinário, partituras e sons), **inclusive durante o download e depois de um erro**. É testável no e2e pelo texto do `<summary>`.
- A aba Partitura sem partituras leva a **Conteúdo → Partituras**, com o cartão aberto e a linha à vista; a abertura não fica gravada.
- **Teclado:** cada cartão abre e fecha com Enter e Espaço; a ordem de foco é a visual. **Leitor de tela:** o estado é lido junto do nome do cartão.
- **Capturas conferidas** (nada cortado nem sobreposto): fonte do sistema a **200%**, os **3 temas** (claro, escuro, alto contraste) e largura de **360 dp**.
- O que ficou aberto é lembrado entre aberturas (só Aparência, Idioma e Conteúdo); valor ruim na chave volta ao padrão; as regras de `rem`, tema e i18n do projeto passam nos verificadores.
- O e2e cobre: abrir e fechar, a linha de estado, o caminho da aba Partitura até o cartão, o importar do hinário (só `.json`) e que as partituras **seguem sem** campo de arquivo.

### Revisão
Revisão por subagente **Opus 5** em 2026-11-17, só leitura, com o código aberto: **12 achados** (4 bloqueios), todos aplicados; **os quatro bloqueios eu conferi no código** antes de reescrever.
- **A seção original estava desatualizada**: foi escrita antes da PR #42 e descrevia um app que já mudou. O diagrama "hoje" não tinha a seção Partituras (que já existe, com estado, Baixar, progresso e Remover); o "problema 1" dizia que as partituras entravam pelo "Importar hinário" (falso: ele só aceita `.json`); a pergunta 4 e o desenho propunham um **"Importar .zip" de partituras**, que **reabria uma decisão tomada**; a pergunta 5 propunha **separar** o pacote de partituras do hinário, que **já é separado**; e o texto dizia que `remover_partituras` "não é um comando", mas é.
- **Acrescentado pela revisão:** a chave `prefs.cartoes` já é do player (a nova é `prefs.ajustes`); o cartão com resumo **já existe** no player (extrair `Cartao.svelte` e migrar os dois); a abertura por link precisa ser feita por código; o e2e depende de `#partituras` e do texto dos cartões; o `<Aviso>` e o progresso dentro de um cartão fechado somem; a pergunta certa sobre remover é "pede confirmação?".
- **Risco que mais preocupava o revisor:** implementar a partir da versão antiga, reabrindo decisões já tomadas e quebrando o teste de `#partituras` sem ninguém entender o porquê. Resolvido pela seção "O que já está decidido".

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

## I-28 — Abas na tela inicial (Hinos | Afinador | Gravador | …)

- **Status:** **implementada** (2026-11-17) junto com a aba Afinador (I-13, etapa 1): a barra `Hinos | Afinador` na tela inicial, o mesmo `Abas.svelte` do hino, os painéis montados, a busca preservada ao trocar de aba e a aba reaberta ao voltar de um hino. **Em aberto:** a rolagem de cada aba é guardada e restaurada, mas isso ainda não tem teste de ponta a ponta; e a ordem das abas (assumi `Hinos` primeiro) espera a confirmação do responsável. Revisada por subagente Opus 5 em 2026-11-17 (achados aplicados).
- **Origem:** pedido do responsável, 2026-11-17: "o Afinador vai ser o primeiro tab na tela inicial de lista, lá vai ter Hinos | Afinador | Gravador... entre outras, no mesmo estilo do que temos dentro do hino para Ouvir | Letra | Partituras", e "podemos até reaproveitar o frontend do componente, talvez o backend".
- **Prioridade:** a definir (a primeira peça das ferramentas de estudo: afinador I-13, gravador I-03 e, talvez, metrônomo I-20)

### O problema
A tela inicial é só a lista de hinos. As ferramentas de estudo que pedimos (afinador, gravador, metrônomo) não pertencem a um hino específico, e não há onde pô-las. Dentro do hino o app já resolveu o problema parecido com **abas** (`Ouvir | Letra | Partitura`).

### O que se deseja
A tela inicial ganha uma **barra de abas** igual à do hino: **`Hinos | Afinador | Gravador | …`**. A aba **Hinos** é a lista de hoje (busca e lista); cada ferramenta nova entra como uma aba. A engrenagem de Ajustes continua no cabeçalho.

**Atenção à frase do responsável:** "o Afinador vai ser o **primeiro** tab" pode querer dizer a **primeira aba nova** (depois de Hinos) ou a **primeira da barra**. Os dois exemplos dele listam `Hinos | Afinador | Gravador`, então leio como a primeira nova; **confirmar** (pergunta 1).

### O que se reaproveita (conferido no código na revisão)
- **`src/lib/Abas.svelte`, como está:** não tem nada preso ao hino. Barra fixa embaixo, **trilho lateral** com o celular deitado, as variáveis `--altura-navegacao` e `--largura-trilho` (o `.conteudo` do layout e o `Miniplayer` já as leem e abrem espaço) e a semântica WAI-ARIA de abas (`aba-<id>` e `painel-<id>`).
- **O padrão de painéis do hino:** todos ficam **montados** e só um fica visível (`hidden`), então a **busca** (que mora em `biblioteca.busca`) **não se perde** ao trocar de aba. A lógica é a mesma do hino (`aba` como `$state`, lista de abas derivada, rótulos pelo i18n); **não** pede abstração nova agora, só a segunda ocupação do mesmo padrão.
- **A barra só aparece com mais de uma aba**, como no hino: enquanto só existir **Hinos** e **Afinador**, são duas; o Gravador entra quando existir (I-03).

### Comportamento
- **A aba Afinador existe sempre**, também **fora** do `{#if biblioteca.pacote}` de `+page.svelte`: o Lá 440 não depende de hinário carregado (hoje essa condição envolve a tela toda).
- **Cada ferramenta recebe `ativa`**, como a `Partitura.svelte`, e **solta o que usa** quando a aba não está à vista (nota do afinador, microfone).
- **A rolagem não é do contêiner, é do documento:** a lista de hinos é longa e a aba Afinador é curta; ao trocar para ela, a página encurta e o navegador **corta a rolagem**, que se perde. Então a tela **guarda e restaura o `scrollY` de cada aba**.
- **Voltar de um hino para a lista** reabre a aba em que a pessoa estava (estado guardado em módulo, como a busca), em vez de sempre voltar a **Hinos**.
- **Áudio:** uma ferramenta que toca ou escuta **pausa** o hino que estiver tocando no miniplayer (um som de cada vez; ver as regras do tom na I-13).
- O miniplayer continua aparecendo **acima** da barra de abas, como já faz dentro do hino.

### Perguntas em aberto
1. **Ordem e aba inicial:** `Hinos` à **esquerda** e aberta ao iniciar o app, com o Afinador em seguida? **Recomendo sim** (e confirmar a frase do responsável acima).
2. A aba escolhida **fica lembrada** ao fechar o app, ou o app sempre abre em Hinos? **Recomendo abrir sempre em Hinos.**
3. Com o celular **deitado**, o trilho lateral divide a largura com a lista (que já respeita `--largura-trilho`): conferir se a lista fica confortável.

### Impacto técnico (hipóteses, a verificar)
- `src/routes/+page.svelte`: envolver a lista num painel e acrescentar a barra; o componente `Afinador.svelte` (I-13) como segundo painel, **fora** da condição do pacote carregado.
- **i18n:** a chave do rótulo de cada aba (`rotulo` de `Abas`) nos 3 idiomas, e o `aria-labelledby` **condicional** nos painéis (como no hino, que só o põe quando há mais de uma aba).
- Teste de ponta a ponta: trocar de aba mantém a busca, o foco e a **rolagem de cada aba**, e a barra some se houver uma só aba.
- O que a barra publica (`--altura-navegacao`) já é lido pelo `.conteudo` e pelo miniplayer.

### Critérios de aceitação (propostos)
- A tela inicial mostra a barra com as abas existentes, no celular em pé (embaixo) e deitado (trilho), igual à do hino.
- Trocar de aba não apaga a busca nem a rolagem da lista (cada aba volta onde estava); o teclado e o leitor de tela se comportam como no hino.
- A aba Afinador abre **sem hinário carregado**.
- Sair da aba de uma ferramenta a solta (sem som, sem microfone aberto).
- O miniplayer não cobre a barra nem o conteúdo.

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

- **Status:** anotada, **rascunho** (2026-11-19)
- **Origem:** o responsável, 2026-11-19: o **Enéias respondeu** e é o **dono dos repositórios de onde tiramos os arquivos do MuseScore (`.mscx`)**. Falta registrar aqui o que ele respondeu.
- **Prioridade:** a definir
- **Projetos do Enéias (fonte dos `.mscx`), um repositório por tonalidade** (todos do Hinário 5; lista dada pelo responsável em 2026-11-19):
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
- **Lotes de 30 hinos, no máximo, por subagente, sem misturar repositórios:** cada repositório (tonalidade) é dividido em lotes de até 30 (para ~480 hinos, no mínimo 16 lotes; o número real sai da contagem de hinos de cada um dos 7).
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

### Perguntas em aberto
1. O que o Enéias respondeu, e **o que ele autoriza** (uso, redistribuição, crédito)? Define o que pode entrar no repositório.
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
