# Ideia: gravar com contexto, o que tocava no fone (rascunho, I-38)

**Status:** rascunho de 2026-11-25. Nada foi implementado. Separo o que foi **conferido no código** e **lido na pesquisa** do que é **proposta minha**; o que não verifiquei está dito.

## O pedido (2026-11-25, do responsável)

Quando a pessoa **grava** enquanto ouve algo no **fone** (o **metrônomo** ou um **hino**), o app deve **guardar essa informação**, como etiquetas em JSON. Motivo: ao **enviar o áudio ao professor**, o comentário deveria dizer, por exemplo, "aluno tocando junto com o metrônomo, 65 bpm, compasso quaternário simples" ou "hino 10, vozes soprano, tenor e baixo (o contralto foi tirado), 60 bpm, +1 semitom". Quais informações seriam úteis?

## Como é hoje (conferido no código)

| O quê | Hoje |
|---|---|
| Gravação guardada | `MetaGravacao = { id, criadaEm, segundos, tipo, bytes }` (`gravacoes.ts:7`) no IndexedDB (`meta` e `blobs`). **Nada** sobre o que tocava. |
| Quando dá para gravar com som | **Só com fone**: `foneConectado()` (`servico.ts:73`). Sem fone, ligar o metrônomo ou o hino **para a gravação** (`Gravador.svelte:312` e `:342`), porque o alto-falante entraria no microfone. Então o contexto só existe no caso **com fone**. |
| Metrônomo | `bpm` (30 a 240) e `compasso` (2, 3, 4, 6, 9 ou 12 **cliques por compasso**, o 1º forte), `ligado` (`metronomo.svelte.ts`, `metronomo.ts`). A tela chama 2, 3 e 4 de **simples** e 6, 9 e 12 de **compostos, "de 3 em 3"**. |
| Hino | `numero`, `titulo`, `parte` (`"tudo"`, `"intro"` ou o número da vez), `andamento` (bpm), `transposicao` (semitons, ±6), `instrumentos[]`, `volumes[]` e `mudas[]` **por voz**, na ordem de `hino.vozes` (`reproducao.svelte.ts`). |
| Metrônomo e hino juntos | **Não**: o metrônomo **para quando um hino começa a tocar** (`metronomo.svelte.ts`). Então, no máximo **um** dos dois toca durante a gravação. |
| Envio | `ACTION_SEND` com **só `EXTRA_STREAM`** (`PonteCompartilhar.kt:85-87`): **não há texto junto**. O nome do arquivo é `gravacao-AAAA-MM-DD-HHMM.ogg`. |
| Arquivo | WebM/Opus vira **Ogg/Opus** sem recodificar (`ogg.ts`). O `OpusTags` que ele escreve tem **só o fabricante** ("Biblioteca Musical") e **zero comentários**: dá para acrescentar. |

## Pesquisa (2026-11-25, só web; não testei nada no aparelho)

- **Etiquetas dentro do arquivo x arquivo ao lado ("sidecar").** Estudos de arquivistas de áudio (ARSC, Library of Congress) apontam que metadado **embutido não persiste de modo consistente** entre programas (o estudo da ARSC é de 2011, pode estar defasado); o sidecar deixa o original intocado e serve a metadado que muda, em JSON, XML ou texto leve. Para MP3 o padrão é o ID3. Uma ferramenta que li diz que Opus e AAC ficam só com sidecar.
- **Ogg/Opus:** o cabeçalho `OpusTags` tem campos `NOME=valor`, **valores em UTF-8**, nomes em ASCII sem diferenciar maiúsculas (RFC 7845). A documentação oficial do Vorbis diz que o cabeçalho de comentários é para **textos curtos**, e não para metadado arbitrário. **Não consegui ler a lista de nomes padrão** (RFC 7845, seção 5.2.1): precisa ler o RFC antes de escolher o nome do campo.
- **Mensagens (WhatsApp, Telegram):** **não achei** nada confirmando se mostram as etiquetas do arquivo ou o texto que vai junto do áudio. A minha leitura (inferência, **não confirmada**) é que o **professor não vai ler etiqueta nenhuma** e que **o que chega é o que aparece na conversa**. Isso precisa de teste no aparelho (ver "O que testar").
- **Versão do esquema** (padrões práticos, não norma): guardar um **número de versão** junto dos dados, só **acrescentar campos** (não renomear nem tirar), **preservar campo desconhecido** ao regravar e ter **migração explícita** para mudança incompatível.
- **Compasso, na teoria** (Fiveable, Soundbrenner, LibreTexts, Open Music Theory): 2, 3 e 4 no numerador são **simples**; 6, 9 e 12 são **compostos**. Dividir o numerador por 3 dá os tempos do compasso: **6/8 = composto binário** (2 tempos), **9/8 = composto ternário** (3), **12/8 = composto quaternário** (4). No composto o número de baixo é a **divisão**, e o tempo é a **semínima pontuada**. **Não achei um bpm "canônico" para o composto**: é escolha de quem pratica.

## O que registrar (proposta)

Um objeto `contexto`, guardado **junto da gravação**, com versão. Só dados **musicais** do que estava tocando **no começo** da gravação.

```json
{
  "v": 1,
  "fone": true,
  "origem": "metronomo",
  "metronomo": { "bpm": 65, "cliques": 4, "familia": "simples", "tempos": 4, "nome": "quaternário simples" }
}
```

```json
{
  "v": 1,
  "fone": true,
  "origem": "hino",
  "hino": {
    "acervo": "ccb-hinario-5-do", "numero": 10, "titulo": "Prossegui vitoriosos em Cristo",
    "tonalidade": "Si♭ maior", "transposicao": 1, "andamento": 60, "andamentoOriginal": 69,
    "parte": "tudo",
    "vozes": [
      { "nome": "Soprano", "tocando": true,  "instrumento": "flauta", "volume": 1 },
      { "nome": "Contralto", "tocando": false },
      { "nome": "Tenor", "tocando": true, "instrumento": "trompa", "volume": 0.8 },
      { "nome": "Baixo", "tocando": true, "instrumento": "tuba", "volume": 1 }
    ]
  }
}
```

**Campos, e por que cada um serve ao professor**

| Campo | Para quê |
|---|---|
| `origem` | `"metronomo"`, `"hino"` ou `"nada"` (gravou em silêncio; **o `contexto` pode nem existir**). |
| `metronomo.bpm`, `cliques`, `familia`, `tempos` | O professor sabe o andamento e se o compasso é simples ou composto. **Conferido no código** (`metronomo.ts`, período do clique = 60 ÷ bpm): o `bpm` do app é **por clique**, que nos compostos é a **colcheia**. `tempos` = `cliques` nos simples (2, 3, 4) e `cliques` ÷ 3 nos compostos (6, 9, 12). O **bpm por tempo** (semínima pontuada, `bpm` ÷ 3) **não é guardado**: o texto o calcula na hora, só para os compostos. |
| `metronomo.nome` | Texto pronto: "binário/ternário/quaternário simples ou composto". |
| `hino.numero`, `titulo`, `acervo` | Qual hino. O **acervo** entra por causa do Hinário 4 (o mesmo número em dois hinários). |
| `hino.tonalidade`, `transposicao` | O professor ouve o aluno em outro tom: "**+1 semitom** sobre Si♭ maior" é o que explica. Registrar também o **tom resultante** (Si♭ + 1 = Si maior) ajuda quem não faz a conta. |
| `hino.andamento`, `andamentoOriginal` | "60 bpm (o hino é 69)". Diz se o aluno praticou mais lento. |
| `hino.parte` | "tudo", "só a introdução", "1ª vez" etc. |
| `hino.vozes[]` | Quais vozes **estavam no fone** (o que o aluno **ouvia**) e quais ele tirou. É o dado mais pedido: "ele tocava a voz dele junto com as outras três?". O instrumento e o volume de cada voz são **opcionais** (ruído para o professor; úteis para o aluno rever). |
| `fone` | Sempre `true` quando há contexto (sem fone o app nem deixa gravar com som). Útil para o professor saber que **o som não está no áudio** que ele recebe. |

**O que não registrar (privacidade):** identificador do aparelho, local, nome da pessoa, versão do Android. Só o que é **musical** e do próprio app. Dar à pessoa um **interruptor "Anexar o que eu ouvia"** (lembrado), com o padrão a decidir (pergunta 1).

## E se mudar no meio da gravação?

A pessoa pode **mudar o andamento**, **tirar uma voz** ou **parar o hino** enquanto grava. Opções:

- **v1 (proposta):** guardar o **estado no instante em que a gravação começa** e uma marca `mudouDurante: true` se algo mudou (o texto diz "no início da gravação"). Barato e honesto.
- **v2:** uma **linha do tempo** `eventos: [{ "t": 12.4, "tipo": "voz", "nome": "Contralto", "tocando": false }, …]` (segundos desde o início). Mais fiel, mais código e mais para o professor ler; só vale se o professor pedir.
- Também registrar **se o hino chegou ao fim** enquanto gravava (a gravação seguiu depois dele?).

## O texto para o professor (proposta)

A partir do `contexto`, um texto curto nos **três idiomas** da interface (pt, en, es), por exemplo:

> Gravado junto com o metrônomo: 65 bpm, compasso quaternário simples (4 tempos).

> Gravado junto com o hino 10, "Prossegui vitoriosos em Cristo": vozes no fone: soprano, tenor e baixo (sem o contralto); 60 bpm (o hino é 69); +1 semitom (de Si♭ maior para Si maior).

Regras do texto: **uma linha** (ou duas), sem sigla; vozes por nome; "sem o contralto" só quando alguma voz **foi tirada**; transposição só quando **diferente de zero**; andamento "original" só quando **diferente**.

## Por onde o professor vai receber isso (o ponto que decide o desenho)

Quatro caminhos, do mais para o menos confiável (a **ordem é minha** e só o teste no aparelho confirma):

| # | Caminho | Prós | Contras |
|---|---|---|---|
| A | **Texto junto do áudio** (`EXTRA_TEXT` no `ACTION_SEND`) | O professor lê direto na conversa, se o app de destino mostrar. | **Não verifiquei** se o WhatsApp mostra `EXTRA_TEXT` junto de um **áudio** (ele aceita legenda em foto e vídeo; em áudio não sei). Cada app trata de um jeito. |
| B | **No nome do arquivo** (`gravacao-2026-11-25-1430-metronomo-65bpm-4tempos.ogg`) | O nome **viaja com o arquivo** em qualquer app. | Nome é curto e feio; nem todo app o mostra para áudio. Precisa de limite de tamanho e de caracteres seguros. |
| C | **No `OpusTags`** (campo `COMMENT`, UTF-8, o mesmo texto) | Fica **dentro** do arquivo; é fácil de acrescentar (já escrevemos o `OpusTags` no `ogg.ts`); um programa de áudio mostra. | Pelo estudo, tag **não persiste** de modo confiável e o app de mensagem pode **recodificar ou ignorar**; o professor num celular dificilmente verá. |
| D | **Segundo arquivo** (`.json` ou `.txt`) com `ACTION_SEND_MULTIPLE` | Leva o JSON completo. | O professor tem de **abrir um arquivo a mais**; alguns apps tratam mal vários anexos. |

**Decisão do responsável (2026-11-25):** o caminho principal é o **A**: o texto vai **junto do áudio, escrito abaixo dele**, montado a partir de um **template em Markdown**. B e C ficam como extras baratos (nome do arquivo e `OpusTags` com o mesmo texto), e D só se o A falhar no teste.

## Template em Markdown (proposta)

O JSON do `contexto` preenche um template por idioma; o resultado vai no `EXTRA_TEXT`. Como o WhatsApp e o Telegram **não leem Markdown completo** (a formatação do WhatsApp, de memória e **não verificada aqui**: `*negrito*`, `_itálico_`, listas com `- ` e citação com `> `; **sem** `#` de título nem tabelas), o template usa só esse subconjunto, que também lê bem como texto puro:

```md
*Gravação com contexto*
- Com: hino 10, "Prossegui vitoriosos em Cristo"
- Vozes no fone: soprano, tenor e baixo _(sem o contralto)_
- Andamento: 60 bpm _(original 69)_
- Tom: +1 semitom (de Si♭ maior para Si maior)
```

```md
*Gravação com contexto*
- Com: metrônomo, 65 bpm
- Compasso: quaternário simples (4 tempos)
```

Regras: linhas **opcionais** somem quando não se aplicam (sem voz tirada, transposição 0, andamento igual ao original); rótulos nos três idiomas; valores escapados (título com `*` ou `_` não pode quebrar a formatação); o template fica num arquivo do app (um por idioma) e o **gerador é uma função pura testada**. Linha em branco entre o título e a lista só se o app de destino precisar (testar).

**Ponto a testar primeiro:** se o app de destino mostra o `EXTRA_TEXT` **de um áudio** (o WhatsApp tem legenda em foto e vídeo; em áudio não verifiquei). Se não mostrar, o texto pode ir como **mensagem separada logo antes ou depois** (dois envios) ou cair no caminho D.

## Onde guardar no app

- `contexto` é um **campo novo e opcional** no registro `meta` do IndexedDB, **sem migrar o banco** (acrescentar campo é compatível: gravações antigas ficam sem `contexto`).
- Versão `v: 1` no objeto; ao ler, **ignorar campos que não conhece** e **não os apagar**.
- A lista de gravações mostra uma **linha pequena** com o texto, e o botão **Enviar** leva o texto.
- Texto gerado **na hora de mostrar/enviar**, a partir do JSON e do idioma **de agora** (assim muda com o idioma da interface); o JSON guarda **dados**, e não frases.

## O que testar no aparelho (não substituível)

1. O WhatsApp mostra o `EXTRA_TEXT` que vai com um áudio `.ogg`? E o Telegram?
   **Respondida em 2026-11-27 (aparelho do responsável):** o **WhatsApp não mostra**; o **Telegram e o Discord mostram**. Por isso o app também copia o contexto para a área de transferência (PR #233) e a pessoa cola na conversa.
2. O WhatsApp mostra o nome do arquivo de áudio? Com que tamanho?
3. O `COMMENT` do `OpusTags` sobrevive ao WhatsApp (o arquivo recebido ainda o tem)?
4. Se o `EXTRA_TEXT` for ignorado, o professor consegue abrir o `.txt` do caminho D?

## Perguntas ao responsável

1. **Padrão do interruptor "Anexar o que eu ouvia":** ligado ou desligado? (Proposta: **ligado**, porque o professor quase sempre quer saber.)
2. O professor precisa de **instrumento e volume** de cada voz, ou só **quais vozes** estavam no fone?
3. **Mudou no meio da gravação:** basta "no início da gravação" (v1) ou quer a **linha do tempo** (v2)?
4. **bpm do compasso composto:** o app conta por **clique** (colcheia). O texto da proposta diz os dois ("120 bpm por clique (40 bpm por tempo)"): serve, ou o professor prefere só o por tempo?
5. Quer o **nome do arquivo** informativo, ou prefere manter `gravacao-AAAA-MM-DD-HHMM`?
6. O **tom de referência do Afinador** (Lá 440 ou outra nota) também entra? Hoje o Afinador tem som próprio e, pelo código, é **um som de cada vez**; não achei como ele convive com a gravação, **conferir** antes de decidir.
7. Se a pessoa **gravar sem fone** (o app impede som), ou **em silêncio**, vale ainda gravar o **hino que estava aberto** na tela como contexto (sem som no áudio), ou nada?

## Etapas sugeridas

1. **Funções puras e testes:** montar o `contexto` a partir do estado do metrônomo e do hino; gerar o **texto** nos três idiomas (casos: sem voz tirada, transposição zero, andamento igual, compasso simples e composto, tudo isso em tabela).
2. **Captura:** o Gravador tira o instantâneo **ao começar** (e a marca `mudouDurante`).
3. **Guardar** em `meta` e **mostrar** na lista.
4. **Envio:** `EXTRA_TEXT` (ponte Kotlin), nome do arquivo e `OpusTags` (`ogg.ts`).
5. **Teste no aparelho** (a lista acima) e **ajuste** do caminho que o professor de fato vê.
6. **v2 (opcional):** linha do tempo.

## Fontes (pesquisa de 2026-11-25)

- Etiqueta embutida x sidecar: [Library of Congress, adicionar rótulos e descrições ao áudio](https://blogs.loc.gov/thesignal/2013/01/name-that-tune-adding-labels-and-descriptions-into-your-audio-files/); [ARSC, estudo de metadado](https://arsc.wildapricot.org/resources/Documents/Technical%20Cmmtte/ARSCTC_metadata_study.pdf); [Estudo de metadado embutido em programas de gravação (AVP)](https://weareavp.com/?p=1173); [Broadcast Bridge, ID3](https://www.thebroadcastbridge.com/content/entry/21824/standards-id3-metadata-tagging?cat_id=134).
- Ogg/Opus: [RFC 7845](https://rfc-editor.org/rfc/rfc7845) (seção 5.2.1, a conferir); [Vorbis comment, especificação](https://xiph.org/vorbis/doc/v-comment.html); [Xiph, VorbisComment](https://wiki.xiph.org/VorbisComment).
- Compasso: [Open Music Theory, compassos compostos](https://viva.pressbooks.pub/openmusictheory/chapter/compound-meters-and-time-signatures/); [Soundbrenner](https://www.soundbrenner.com/blogs/articles/compound-meter); [LibreTexts, simples x composto](https://human.libretexts.org/Courses/Sierra_College/Equipping_the_Musical_Ear/04%3A_Compound_Meter/4.02%3A_Simple_Meter_vs._Compound_Meter).
- Esquema versionado: [version-migrate](https://docs.rs/crate/version-migrate/0.20.0); [padrão de estado persistido versionado](https://dev.to/sebastianthiebaud/a-simple-pattern-for-versioned-persisted-state-in-react-native-ll6).
- **Não verificado nesta rodada:** se WhatsApp ou Telegram mostram `EXTRA_TEXT`, o nome do arquivo ou o `COMMENT` de um áudio; a lista de nomes padrão do RFC 7845.
