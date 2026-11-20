# Formato de dados

O app lê um pacote de conteúdo local (pasta `content/`, não versionada). Exemplo com
dados **fictícios**, só para mostrar a estrutura:

```json
{
  "versao": 1,
  "hinario": { "id": "exemplo", "nome": "Hinário de exemplo" },
  "hinos": [
    {
      "numero": 1,
      "titulo": "Título de exemplo",
      "armadura": 0,
      "modo": "maior",
      "tonalidade": "Dó maior",
      "andamento": 90,
      "letra": ["Linha 1 fictícia", "Linha 2 fictícia"],
      "partitura": "partituras/001.pdf",
      "vozes": [
        { "nome": "Soprano", "notas": [[0, 1, 72], [1, 1, 74]] },
        { "nome": "Baixo",   "notas": [[0, 2, 48]] }
      ]
    }
  ]
}
```

## Passadas e final

> **Vocabulário.** Na **interface**, cada vez que o hino é tocado do começo ao fim se chama **vez** ("3 vezes",
> "Terminar com o final"); é o termo natural em português. Nestes documentos e no **código**, usamos **passada** como
> nome interno **no conversor e no Rust** (`passada_final`), porque "vez" é genérico demais para código de dados. No
> front-end o módulo se chama `vezes.ts`. Em teoria musical, **volta** é o final alternativo (a "casa de 1ª ou 2ª vez"),
> e por isso **não** a usamos para outro sentido. A palavra "passada" não é termo musical padrão: é só o nome que
> demos internamente.

`vozes` traz as notas de **uma passada normal** do hino. Alguns hinos terminam de forma diferente na última
passada (o **final**). Para esses, o hino ganha um campo opcional `final` com as notas da **última passada
inteira**, com as mesmas vozes, **na mesma ordem e com os mesmos nomes** de `vozes`:

```json
{
  "numero": 457,
  "vozes": [{ "nome": "Soprano", "notas": [[0, 1, 64]] }],
  "final": { "vozes": [{ "nome": "Soprano", "notas": [[0, 1, 64], [1, 2, 62]] }] }
}
```

O tempo de cada versão começa em 0, em batidas. Todo hino tem uma **vez por estrofe da letra**
(no máximo 8; sem letra ou com uma estrofe, uma só). Num hino **com final**, a **última vez** usa `final` (e há no
mínimo 2 vezes); as anteriores, e todas as vezes de um hino sem final, usam `vozes`. A interface oferece **"Tocar o
hino todo"** (a introdução e todas as vezes em sequência, com 2 s de pausa entre as partes) e um botão para **cada
vez**, que toca só aquela, direto (por exemplo, "3ª ⚑" toca o final sem passar pelas outras). Enquanto o hino todo
toca, o botão da parte que está soando fica em destaque. Com uma só vez e sem introdução há um só botão de tocar.
Um arquivo cujo `final` tenha vozes diferentes das de `vozes` é recusado na importação, com uma mensagem que diz o hino
e as vozes.

### Introdução

Opcionalmente o hino ganha `introducao`: as notas do **começo da partitura até o fim da nota marcada com `*`**, com as mesmas
vozes, na mesma ordem e com os mesmos nomes de `vozes`, e o tempo começando em 0. A interface oferece um botão
**Intro** que a toca sozinha e, em **"Tocar o hino todo"**, toca a introdução antes da 1ª vez. Entre as partes (a
introdução e cada vez) há uma **pausa de 2 segundos**. Um arquivo cuja `introducao` tenha vozes diferentes das de
`vozes` é recusado na importação. Sem `introducao`, o botão não aparece.

**Onde a introdução termina.** O autor escreve o `*` sobre a **última nota da introdução** (e a fecha com a respiração): em 413 dos 480 hinos do Dó a sequência no
arquivo é `*`, acorde, respiração. Por isso a introdução vai até o **fim** dessa nota (que coincide com a respiração), e não até o começo dela. Se o `*` vem logo
antes de uma pausa, vai até o fim da pausa; se vem logo antes da respiração sem nota no meio, até onde a respiração está. (Até 2026-11-20 o conversor parava no começo
da nota marcada e cortava a última nota da introdução em 477 dos 480 hinos.)

```json
{ "numero": 457, "vozes": [{ "nome": "Soprano", "notas": [[0, 1, 64]] }],
  "introducao": { "vozes": [{ "nome": "Soprano", "notas": [[0, 1, 64]] }] } }
```

O conversor `mscx2json` gera `final` ao reconhecer, no MuseScore, o padrão: início de repetição, fim de
repetição junto da 1ª casa de volta, 2ª casa de volta logo depois e um trecho final até o fim. A passada
normal vai do começo ao fim da 1ª casa; a passada do final vai do começo até antes da 1ª casa, depois a 2ª
casa e o resto. Outras estruturas de repetição **não** são interpretadas: o conversor avisa e lê a partitura
uma vez, em ordem.

## Campos de identificação

- No cabeçalho `hinario`: `idioma` (opcional) é o **idioma do conteúdo** (título e letra), em código BCP 47
  (`"pt-BR"`, `"es"`, `"en"`). Ele é independente do idioma da interface. Com ele, a tela marca o título e a
  letra no idioma certo, e o leitor de tela pronuncia corretamente mesmo com a interface em outra língua.
  Sem ele, o app não marca o idioma do texto dos hinos.
- Em cada hino: `autoria` (opcional) é o crédito como aparece na partitura, por exemplo
  `"Fulana de Tal"`. Aparece sob o título do hino e na lista. O conversor monta esse campo a partir dos
  textos de moldura com estilo `Lyricist` e `Composer` do MuseScore (letrista primeiro, sem repetir).
  O `titulo` vem do texto com estilo `Title`.

## Áudio por síntese

Não há arquivos de áudio. O som é gerado por um sintetizador dentro do app a partir das
notas de cada voz. Cada nota é `[inicio, duracao, midi]`:

- `inicio` e `duracao` em **batidas** (o `andamento` em bpm converte para segundos);
- `midi` é o número da nota MIDI (60 = Dó central, 69 = Lá 440 Hz).

O player permite silenciar vozes, mudar o andamento e transpor em semitons.
`letra` é uma lista de linhas. Uma linha vazia (`""`) separa as estrofes, e a primeira linha
de cada estrofe pode começar com o número ("1. ..."). O app mostra as linhas como estão.

**Como o conversor decide as quebras de linha.** A linha da letra acompanha o **verso** do poema, como no hinário impresso, mas a
partitura marca a respiração também **no meio do verso** (entre duas frases musicais). Por isso o `mscx2json` não quebra mais
em toda respiração: quebra só naquelas em que a **próxima palavra começa em maiúscula**, que é como o autor escreve o começo
de um verso (a continuação vem em minúscula). Duas ressalvas:
- Nome reverencial ("Jesus", "Senhor", "Te"...) é maiúsculo em qualquer lugar; ele só começa verso se o trecho anterior
  terminou em pontuação (`. ; ! ? : ,`). A lista fica em `REVERENCIAIS`, em `tools/mscx2json/src/main.rs`.
- A regra só vale numa estrofe com **pelo menos duas respirações seguidas de maiúscula**. Se o autor escreveu tudo em
  minúscula, não há pista, e vale a quebra a cada respiração (o comportamento antigo).

**Erros de digitação que o conversor conserta sozinho**, sílaba a sílaba e antes de montar as linhas (`corrigir_silabas`, para
as marcas do karaokê já nascerem do texto certo):
- pronome colado ao verbo que termina em vogal acentuada, sem hífen (-lo, -la, -los, -las, -lhe, -lhes): ganha o hífen. Nesse caso
  um "I" maiúsculo no começo do pronome só pode ser um "l" digitado errado e também é consertado ("cantáIo" vira "cantá-lo");
- "~" literal vira espaço (como a elisão do MuseScore).

**O que o conversor NÃO adivinha:** qualquer erro com mais de uma leitura possível. Uma regra "esperta" que trocava "ãc" por "ãe"
errou: o autor tinha escrito "mãc" para **"mão"**. Um "I" no meio de uma palavra, fora do pronome, também não se mexe (poderia ser "l"
ou "i"). Esses casos são decisão do responsável, no arquivo de correções.

O que a regra não resolve: verso que o autor escreveu **sem respiração** na partitura (dois versos colados na mesma linha) e
**erros de digitação** que não seguem um padrão seguro. Esses casos se conseguem com o **arquivo de correções** da letra (opção
`--correcoes` do conversor): trocas explícitas, escritas pelo responsável e mantidas fora do Git; ver
[`correcoes-da-letra.md`](correcoes-da-letra.md).

### Sincronia da letra (karaokê)

Opcionalmente o hino ganha `sincronia`: o **instante em que cada sílaba é cantada**, para a aba Letra acender a
estrofe, a linha e a sílaba que está soando. O conversor `mscx2json` gera o campo sozinho quando a partitura tem letra.

```json
"sincronia": {
  "normal": [ { "estrofe": 1, "linhas": [ [ [0, 0, 2], [1, 2, 4] ], [ [2, 0, 2] ] ] } ],
  "final":  [ { "estrofe": 1, "linhas": [ [ [0, 0, 2] ] ] } ]
}
```

- `normal` vale para as vezes normais e `final` (opcional, só em hino com final) para a última vez. O **tempo de cada
  trecho está na régua das notas daquela passada** (batidas, começando em 0, como `vozes` e `final.vozes`): o conversor
  já tira da passada do final o que ela não toca (a 1ª casa) e cola o resto sem buracos.
- `estrofe` é o número como aparece na letra ("1." é 1). A vez N acende a estrofe N. Num hino com final, o texto do
  trecho final (o coro, cantado só na última vez) costuma estar escrito pelo autor sob a estrofe 1. O conversor o **passa
  para a última estrofe**, como no hinário impresso, onde o coro vem depois dela (só quando esse texto está todo sob uma
  única estrofe; com mais de uma, ele fica como o autor escreveu). Se o texto do final continuar sob outra estrofe, depois da
  última sílaba da estrofe da vez o destaque passa a ele, onde ele está na letra.
- **Coro (refrão).** Um parágrafo da `letra` que começa com `Coro. ` (no lugar do "N. ") é o coro: o app o mostra como um bloco à parte, com o
  subtítulo "Coro", e ele **não conta como uma vez a mais** (as vezes continuam uma por estrofe). Na sincronia ele é a **estrofe 0**. Como o
  coro vem depois da música das estrofes, ele acende **depois de cada estrofe**, em toda vez (a regra de "outras estrofes só depois da última da vez").
  O conversor o separa sozinho: o que é cantado depois do último instante em que mais de uma estrofe canta junto (com pelo menos 6 sílabas) é o coro, e
  a letra o põe logo depois da estrofe 1, como no hinário impresso. Num hino com final vale a regra do coro do final, acima.
- `linhas[i]` é a i-ésima linha da estrofe na `letra` (sem o "N. " nem o "Coro. " do começo). Cada trecho é
  `[inicio_em_batidas, de, ate]`: o pedaço `de..ate` da linha começa a ser cantado em `inicio`. As posições contam
  **unidades UTF-16**, como o JavaScript indexa o texto. Uma linha sem trecho naquela passada é uma lista vazia, para o
  índice continuar o da letra.
- O app **confere a sincronia com a letra** (posições dentro da linha, estrofes existentes). Se a letra foi editada e
  deixou de combinar, o karaokê fica desligado para aquele hino e a letra aparece normalmente. Na leitura, uma
  estrutura malformada (tempo negativo, `de >= ate`, estrofe 0) é descartada **sem recusar o hino**.
- Sem `sincronia`, o hino funciona como sempre e o botão "Karaokê" não aparece.

### Compassos (destaque na partitura)

Opcionalmente o hino ganha `compassos`: **em que instante cada compasso da partitura começa a tocar**, para a aba Partitura destacar o compasso
que soa (I-12, fase B). O conversor `mscx2json` gera o campo sozinho.

```json
"compassos": {
  "normal":     [ [0, 0], [4, 1], [8, 2] ],
  "final":      [ [0, 0], [4, 1], [8, 3], [12, 4], [16, 5] ],
  "introducao": [ [0, 0], [4, 1] ]
}
```

- Cada item é `[inicio_em_batidas, indice_do_compasso]`. O **índice conta os compassos escritos** da partitura, a partir de 0, na ordem em que aparecem,
  que é também a **ordem dos `g.measure` do SVG** da partitura (conferido nos hinos de amostra, comparando com os ids que o Verovio atribui). Um compasso
  que se repete na execução (as repetições e as casas de volta) aparece nas listas com o mesmo índice, em instantes diferentes.
- O **tempo está na régua do próprio fluxo**, a mesma das notas (`vozes`, `final.vozes`, `introducao.vozes`): `normal` vale para as vezes normais, `final`
  (só em hino com final) para a última vez, e `introducao` para a introdução (os compassos que começam antes do fim da nota marcada com `*`; o que contém o `*` entra).
  O conversor usa a mesma conta que já monta cada passada, então o instante de um compasso é exatamente onde as notas dele caem.
- **Por que não o `timemap` do Verovio:** ele expande as repetições com ids de compasso que **não existem no SVG** (no hino 457, 56 compassos únicos contra
  38 desenhados). O conversor, que lê o `.mscx` e conhece as repetições de cada passada, é quem sabe qual compasso escrito toca em cada instante.
- **Como o app usa (I-12, fase B):** com o hino tocando e o karaokê ligado (o **mesmo** botão da letra, que aparece também na aba Partitura), o compasso que toca fica
  **destacado** na partitura: um retângulo dourado translúcido **atrás** do compasso (o N-ésimo `g.measure` do SVG), com contorno de 2 px, que vale em qualquer tema
  (no alto contraste, amarelo sobre preto). A posição vem do mesmo relógio do áudio que a letra usa, já na batida local da parte (introdução, vez normal ou final).
  Na pausa entre as partes o último compasso continua aceso; pausado, o destaque congela e acompanha o slider; parado, some. A partitura **rola** até o compasso
  só quando ele sai da vista (a rolagem é suave só se a pessoa não pediu menos movimento). **As partituras já instaladas servem** (a limpeza do SVG preserva o
  `class="measure"`, e o retrato e a paisagem de cada hino têm o mesmo número de compassos): o que muda é só o `hinario.json`, que traz o `compassos`.
- Cada lista tem de ter ao menos um item, com tempos finitos, não negativos e **estritamente crescentes**. Se **alguma** lista estiver malformada (inclusive
  `final` ou `introducao`, que são opcionais), o campo `compassos` **inteiro** é descartado na leitura, **sem recusar o hino**: uma lista ruim derruba também a
  `normal` válida, e as notas e a letra seguem como sempre. O conversor não gera esse caso; só um JSON editado à mão. Sem `compassos`, o hino e a partitura
  funcionam como sempre, só sem o destaque.

### Notas na partitura (karaokê por nota)

Cada nota e cada pausa do SVG da partitura (`<g class="note">` e `<g class="rest">`) pode trazer o instante em que soa **dentro do compasso**, em
batidas (semínimas, as mesmas do hinário), em dois atributos: `data-t` (começo) e `data-f` (fim). O gerador (`tools/gerar-partituras.py`) os escreve a
partir do `timemap` do Verovio; o app os soma ao início do compasso que toca (a lista `compassos` acima) e acende a nota que soa (I-26).

```xml
<g id="k1sawo0h" class="note" data-t="1.5" data-f="2">...</g>
```

- **Números simples:** dígitos com no máximo um ponto decimal, até 12 caracteres, até 4 casas (`0`, `1.5`, `0.3333`). O Rust **recusa** o SVG com outro valor
  nesses dois atributos, e com qualquer outro `data-*`.
- **Todas as vozes** que soam ao mesmo tempo levam o seu tempo; a **pausa** também. A **nota de enfeite** (sem duração) **não** leva.
- **Ligadura (pacote 005 em diante):** cada nota leva o **seu** tempo, inclusive a segunda; a curva (`<g class="tie">`) leva `data-t`/`data-f` iguais aos da
  nota que a abre (se o fim da linha parte a curva em duas, o tempo se divide em partes iguais, na ordem). O app mostra o halo na 1ª nota, uma cópia dourada da curva que
  **cresce da esquerda para a direita** enquanto ela soa, e o halo na 2ª nota quando ela começa (com "reduzir movimento", a curva aparece inteira). Pacotes até o 004 não têm
  isso: lá a **segunda** nota não leva tempo e a **primeira** tem o fim somado (`data-f` pode passar do fim do compasso, e o app mantém a nota acesa no compasso seguinte);
  o app lê os dois jeitos.
- **Repetições:** o instante dentro do compasso é o mesmo em todas as passadas, então vale um só por elemento; quem decide a passada é a lista `compassos`.
- **Como aparece:** o halo dourado atrás da nota (a nota fica na cor do tema); o compasso que toca ganha só um **contorno fino** e uma **barra dourada à esquerda** (como a barra da estrofe da vez na letra), **sem o fundo amarelo**, que apagava o halo.
- **Sem os atributos** (um pacote de partituras antigo), o app destaca só o compasso, como antes. As partituras novas precisam de um **pacote novo**.

`partitura` é opcional e vale `"partituras/hino-N.svg"` quando o pacote traz a partitura do hino. Ele só **informa**: o app lê a
partitura pelo **número do hino**, nunca pelo caminho que o JSON traz (assim um JSON malicioso não aponta para um arquivo
qualquer). Todos os campos além de `numero` e `titulo` são opcionais.

## Importar

**Hinário.** Em **Ajustes**, o botão **Importar hinário** escolhe um arquivo **`.json`** (só `.json`: o hinário vai deixar de ser importado e
virar um pacote baixado, como os sons). O app valida (versão, ao menos um hino, números de hino sem repetição, limite de 20 MB, conferido
pelo `file.size` **antes de ler o arquivo**) e só então grava em `content/hinario.json`, de forma atômica: um arquivo inválido nunca
substitui o conteúdo atual. As partituras já instaladas só ficam se o novo JSON for do mesmo hinário (mesmo `hinario.id`); com outro `id`,
são apagadas, porque os números não combinariam. **Remover importação** apaga o `hinario.json` e as partituras e volta ao pacote de exemplo.

**Partituras (I-08).** Têm o **card próprio "Partituras"** em Ajustes, no molde dos sons gravados: estado ("Instaladas: N" ou "Não
instaladas"), **Baixar (tamanho)**, progresso, **Remover** (só as partituras; o hinário fica). Não há importação manual. O app baixa o pacote
do servidor, confere o **tamanho e o SHA-256 contra o manifesto** (`src/lib/partituras/manifesto.json`, gerado por
`tools/montar-manifesto-partituras.py`; sem pacote publicado, `"pacote": null`, e o botão Baixar não aparece) e só então o entrega ao Rust.
O processo de publicar está em [`pacote-de-partituras.md`](pacote-de-partituras.md).

O pacote é um `.zip` com **só** estes nomes (nada de `hinario.json`: as partituras valem para o hinário já instalado, de onde vêm os números
de hino aceitos):

```
partituras/hino-<número>.svg           a partitura do hino para a tela em pé (retrato), uma página: obrigatória
partituras/hino-<número>-paisagem.svg  a mesma partitura desenhada mais larga, para a tela deitada: opcional
```

**Duas versões, porque o SVG é pré-desenhado:** as quebras de linha são fixas, então virar o celular só redimensiona o desenho (compassos
miúdos demais, ou cortados). O retrato (largura 700 do Verovio) tem ~1,6 compasso por linha; a paisagem (1200), ~3. O app escolhe pela
largura da janela (`min-width: 36rem`; em `rem`, para acompanhar a fonte do sistema) e **segue a tela ao girar**; a versão já lida fica na
memória, então girar de volta não lê de novo. Na aba Partitura, a coluna deixa de ser limitada a 40rem (vai a 64rem) para a paisagem usar a
largura. **A paisagem só vale com o retrato do mesmo hino** (sem ele é recusada, com o motivo `(paisagem) falta a versão de retrato…`), e
**sem a paisagem o retrato serve nas duas telas**. "Partitura instalada" é o hino que tem o retrato; só a paisagem solta no disco não conta.

O app manda o zip ao Rust como **texto base64** (`invoke("importar_partituras", { zip })`), e não como corpo binário: **no Android o Tauri
não entrega corpo binário** (só o `postMessage`, que é texto). O tamanho do texto é conferido antes de decodificar. Num pacote de 15 MB
isso são ~20 MB de texto na chamada. `tools/montar-pacote.py pasta-dos-svg pacote.zip` monta o zip; os SVG vêm de `tools/gerar-partituras.py`.
O Rust confere tudo antes de gravar:

- **Hinário instalado.** Sem hinário importado, a instalação é recusada (`partituras_sem_hinario`); um zip sem nenhum SVG também
  (`partituras_nenhuma`). O SVG de um hino que o hinário não tem é recusado.
- **Nomes exatos.** Qualquer outro nome (`hinario.json`, `..`, caminho absoluto, subpasta, maiúscula, zero à esquerda, `\`, nome repetido)
  **recusa o pacote inteiro**, sem tocar no conteúdo atual. Nenhum nome do zip vira caminho no disco: o app grava sempre
  `partituras/hino-<número>.svg` ou `partituras/hino-<número>-paisagem.svg`, montado por ele.
- **Limites.** 150 MB de zip, 2000 arquivos, 300 MB descompactados, 8 MB por SVG. Valem também quando o cabeçalho do zip declara um tamanho
  errado (a leitura é cortada no limite).
- **O SVG é limpo, não copiado.** O app lê o SVG com um parser XML, confere cada elemento, atributo e valor contra uma **lista de
  permitidos** e o **reescreve**; é essa versão que fica no disco e que a tela mostra, embutida na página. Ficam de fora `script`,
  `foreignObject`, `image`, `a`, animações, `url(...)` em qualquer valor, `@import`, escapes de CSS (`\`), atributos `on*`,
  `style`, `href` que não seja `#id`, `xlink:href`, DOCTYPE, comentários e instruções. O que não passa é **recusado e informado**
  (hino e motivo, no card), e o resto do pacote entra.
- **Nenhum CSS do pacote entra.** Um `<style>` dentro de um SVG embutido na página vale para o **documento inteiro**, não só para
  o SVG: um pacote malicioso poderia esconder ou falsificar botões do app (`.botao{position:fixed;inset:0}`). Por isso o `<style>`
  do Verovio é **descartado** (com o que tiver dentro) e o atributo `style` é recusado. O que o `<style>` do Verovio fazia é
  pouco, e quem embute o SVG traz no CSS do app, escopado à partitura (por exemplo, dentro de `.partitura`):
  ```css
  .partitura svg path, .partitura svg ellipse, .partitura svg polygon, .partitura svg polyline, .partitura svg rect { stroke: currentColor; }
  .partitura svg g.ending, .partitura svg g.fing, .partitura svg g.reh, .partitura svg g.tempo { font-weight: bold; }
  .partitura svg g.dir, .partitura svg g.dynam, .partitura svg g.mNum { font-style: italic; }
  .partitura svg g.label { font-weight: normal; }
  .partitura svg g.placeholder { visibility: hidden; }
  ```
  Conferido no Chrome nos 5 hinos de amostra: com esse CSS o desenho é o mesmo do SVG com o `<style>` original (4 hinos idênticos
  byte a byte e 1 com um pixel de diferença de 2/255, ruído de antialiasing); sem ele, difere (o `stroke` some). A cor segue o
  tema com `color` e `fill: currentColor` no `svg`.
- **O SVG não alcança a página.** Os `id` (e os `href="#..."`) ganham o prefixo `bmccb-p-`, então um `id` igual ao de um elemento
  do app não o confunde. O `<svg>` raiz, que é o que o layout da página enxerga, não pode ter `class` (puxaria uma regra do app,
  como `position:fixed`) nem `transform`, e sai sempre com `overflow="hidden"` (o desenho não passa por cima da interface). Quem
  embute o SVG também deve recortá-lo (`overflow: hidden` no contêiner).
- **Tudo ou nada.** Os SVG são gravados numa pasta de preparo, e só quando tudo está pronto ela troca a `partituras/` anterior; o
  `hinario.json` nunca é tocado. Se **nenhuma** partitura do zip for aceita (todas recusadas), as que já estavam instaladas ficam.
- **Fonte.** O SVG sai **sem** a fonte Leipzig (o `tools/gerar-partituras.py` desliga a que o Verovio embute, 58 KB por hino, em
  `url(data:...)`, que a limpeza recusaria). O texto do SVG usa `font-family="Leipzig"`, então o **app a traz uma vez só**
  (`src/lib/fonts/Leipzig.woff2`, carregada por `src/lib/partitura.css`; licença OFL 1.1, nos créditos de Ajustes).
- **Na tela (aba Partitura).** O SVG é embutido na página (`{@html}`, já limpo) dentro de `.folha`, com o CSS acima e `color` do
  tema; o zoom (50% a 400%, 9 passos, com o 100% no meio como padrão; lembrado no aparelho) muda a largura da folha: abaixo de 100% ela fica mais estreita e
  centralizada, acima rola para os lados. A aba
  Partitura aparece nos hinos que têm partitura; enquanto **nenhum** hino tem partitura instalada, aparece em todos, com um aviso e
  um botão para Ajustes (o card Partituras); num pacote que tem partituras, não aparece nos hinos que não têm.

As partituras ficam em `content/partituras/`, com a marca `.hinario` (o `id` do hinário a que pertencem). Sem partituras instaladas,
`partituras` na resposta do app é vazio. Cada partitura é lida pelo número do hino e **limpa de novo** na leitura.

## Onde o app lê

O app procura `hinario.json` em `<pasta de dados do app>/content/` (no Linux:
`~/.local/share/br.pro.bibliotecamusical.ccb/content/`). Se o arquivo não existir,
mostra o pacote de exemplo embutido (`src-tauri/exemplo/hinario.json`, dados fictícios).
Se o arquivo existir mas estiver inválido, o app mostra o erro em vez de esconder com o exemplo.
Apenas `versao: 1` é suportada.
