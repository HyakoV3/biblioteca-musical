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
      "tonalidade": "Dó",
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

Opcionalmente o hino ganha `introducao`: as notas do **começo da partitura até o marcador `*`**, com as mesmas
vozes, na mesma ordem e com os mesmos nomes de `vozes`, e o tempo começando em 0. A interface oferece um botão
**Intro** que a toca sozinha e, em **"Tocar o hino todo"**, toca a introdução antes da 1ª vez. Entre as partes (a
introdução e cada vez) há uma **pausa de 2 segundos**. Um arquivo cuja `introducao` tenha vozes diferentes das de
`vozes` é recusado na importação. Sem `introducao`, o botão não aparece.

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
- `linhas[i]` é a i-ésima linha da estrofe na `letra` (sem o "N. " do começo). Cada trecho é
  `[inicio_em_batidas, de, ate]`: o pedaço `de..ate` da linha começa a ser cantado em `inicio`. As posições contam
  **unidades UTF-16**, como o JavaScript indexa o texto. Uma linha sem trecho naquela passada é uma lista vazia, para o
  índice continuar o da letra.
- O app **confere a sincronia com a letra** (posições dentro da linha, estrofes existentes). Se a letra foi editada e
  deixou de combinar, o karaokê fica desligado para aquele hino e a letra aparece normalmente. Na leitura, uma
  estrutura malformada (tempo negativo, `de >= ate`, estrofe 0) é descartada **sem recusar o hino**.
- Sem `sincronia`, o hino funciona como sempre e o botão "Karaokê" não aparece.

`partitura` é opcional e vale `"partituras/hino-N.svg"` quando o pacote traz a partitura do hino. Ele só **informa**: o app lê a
partitura pelo **número do hino**, nunca pelo caminho que o JSON traz (assim um JSON malicioso não aponta para um arquivo
qualquer). Todos os campos além de `numero` e `titulo` são opcionais.

## Importar

Em **Ajustes**, o botão **Importar hinário** escolhe um arquivo `.json` ou um pacote `.zip` (o app distingue pelos primeiros
bytes, não pelo nome).

**`.json`:** o app valida (versão, ao menos um hino, números de hino sem repetição, limite de 20 MB) e só então grava em
`content/hinario.json`, de forma atômica: um arquivo inválido nunca substitui o conteúdo atual. As partituras já importadas só
ficam se o novo JSON for do mesmo hinário (mesmo `hinario.id`); com outro `id`, são apagadas, porque os números não combinariam.

**`.zip` (I-08, partituras):** o pacote tem **só** estes nomes:

```
hinario.json                  o mesmo JSON de cima (obrigatório)
partituras/hino-<número>.svg  a partitura do hino, uma página (opcional, um por hino)
```

`tools/montar-pacote.py hinario.json pasta-dos-svg pacote.zip` monta o zip (e preenche `partitura` em cada hino que tem SVG); os
SVG vêm de `tools/gerar-partituras.py`. O app confere tudo antes de gravar:

- **Nomes exatos.** Qualquer outro nome (`..`, caminho absoluto, subpasta, maiúscula, zero à esquerda, `\`, nome repetido) **recusa
  o pacote inteiro**, sem tocar no conteúdo atual. Nenhum nome do zip vira caminho no disco: o app grava sempre
  `partituras/hino-<número>.svg`, montado por ele.
- **Limites.** 150 MB de zip, 2000 arquivos, 300 MB descompactados, 8 MB por SVG, 20 MB de `hinario.json`. Valem também quando o
  cabeçalho do zip declara um tamanho errado (a leitura é cortada no limite).
- **O SVG é limpo, não copiado.** O app lê o SVG com um parser XML, confere cada elemento, atributo e valor contra uma **lista de
  permitidos** e o **reescreve**; é essa versão que fica no disco e que a tela mostra, embutida na página. Ficam de fora `script`,
  `foreignObject`, `image`, `a`, animações, `url(...)` em qualquer valor, `@import` e qualquer regra com `@` no CSS, escapes de
  CSS (`\`), atributos `on*`, `href` que não seja `#id`, `xlink:href`, DOCTYPE, comentários e instruções. O que não passa é
  **recusado e informado** (hino e motivo), e o resto do pacote entra. O SVG de um hino que o `hinario.json` não tem também é
  recusado.
- **Tudo ou nada.** Os SVG são gravados numa pasta de preparo, e só quando tudo está pronto ela troca a `partituras/` anterior. O
  `hinario.json` é o último a ser trocado. (Uma queda no meio da troca pode deixar o JSON antigo com as partituras novas: como elas
  são lidas pelo número, nada quebra, e importar de novo conserta.)
- **Fonte.** O SVG sai **sem** a fonte Leipzig (o `tools/gerar-partituras.py` desliga a que o Verovio embute, 58 KB por hino, em
  `url(data:...)`, que a limpeza recusaria). O texto do SVG usa `font-family="Leipzig"`, então a tela precisa trazer a fonte
  (licença OFL 1.1) uma vez só.

As partituras ficam em `content/partituras/`, com a marca `.hinario` (o `id` do hinário a que pertencem). Sem pacote `.zip`
importado, `partituras` na resposta do app é vazio. Cada partitura é lida pelo número do hino e **limpa de novo** na leitura.

**Remover importação** apaga o `hinario.json` e as partituras e volta ao pacote de exemplo.

## Onde o app lê

O app procura `hinario.json` em `<pasta de dados do app>/content/` (no Linux:
`~/.local/share/br.pro.bibliotecamusical.ccb/content/`). Se o arquivo não existir,
mostra o pacote de exemplo embutido (`src-tauri/exemplo/hinario.json`, dados fictícios).
Se o arquivo existir mas estiver inválido, o app mostra o erro em vez de esconder com o exemplo.
Apenas `versao: 1` é suportada.
