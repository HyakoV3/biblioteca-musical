# Ideia: busca inteligente (rascunho, I-37)

**Status:** rascunho de 2026-11-25, **revisado por um segundo modelo (Opus) no mesmo dia**; o que a revisão mudou está marcado com "(revisão)". Nada foi implementado. Este texto separa **o que foi medido ou lido** do que é **proposta minha**; onde não verifiquei, digo.

## O pedido (2026-11-25, do responsável)

A busca da tela inicial é limitada. Melhorar para uma **busca inteligente** que:

1. ache por **número** de um jeito esperto ("1" deve ajudar a chegar no 1, 10, 100, 21…);
2. ache por **autor** (barato) e por **tom** (tonalidade);
3. ache pela **letra** (o verso que o aluno lembra);
4. não force o aluno a digitar demais antes de mostrar algo (quantos caracteres esperar);
5. aguente o futuro: hoje só existe o **Hinário 5**, mas o **Hinário 4** deve vir, e podem entrar **outras bibliotecas** (músicas gospel para sopro, cordas…). Hoje há **um** botão de hinário e **um** de partituras em Ajustes; em breve podem ser **seletores** com 2 ou mais de cada.

## Como é hoje (conferido no código)

`src/routes/+page.svelte` (a lista) e `src/lib/numero.ts`:

| O que | Hoje |
|---|---|
| Número | **Exato**: "1", "01" ou "001" acham só o hino 1. "1" **não** mostra o 10, o 11 nem o 100. O campo diz "Buscar por número ou título" (`i18n/pt.ts:7`). |
| Título | O trecho digitado, em **qualquer lugar** do título (inclusive no meio da palavra), sem diferenciar maiúsculas nem acentos. **Só** tira acentos e espaços das pontas: pontuação não é tratada (217 dos 480 títulos têm pontuação). |
| Autoria | **Não busca**, mas **já aparece em cada linha** da lista, abaixo do título (`+page.svelte:120`). 389 dos 480 hinos têm autoria. |
| Letra | **Não busca**. |
| Tom | **Não busca** (os 480 têm tonalidade). |
| Ordem | A do hinário. **Sem relevância**: o que casa no título e o que casa em outro lugar não se distinguem. |
| Acervo | **Um** hinário (`biblioteca.pacote`); o id é `ccb-hinario-5-do` e o nome "Hinário 5 (Dó)", o que sugere **edições do mesmo hinário em outros tons**. Importar ou remover o hinário **limpa a busca** (`biblioteca.svelte.ts:82,122`). |
| Outros | **O número é a chave do app inteiro**, e não só da busca: a rota `/hino/[numero]`, `biblioteca.hino(numero)`, `ultimoHino.numero`, `Pacote.partituras: number[]`, `lerPartitura(numero)` e `reproducao.atual.numero` usam só o número (revisão). O termo sobrevive à navegação; o ✕ limpa; sem resultado há um aviso com "limpar". |

## O que os dados mostram (hinário de 480 hinos, medido em 2026-11-25)

- **Números:** 1 a 480, todos únicos. 9 têm 1 dígito, 90 têm 2, 381 têm 3. Se "1" casasse por **prefixo**, apareceriam **111 hinos** (1, 10 a 19, 100 a 199); "2" também 111; "10", "21" e "33" casam 11 cada; "100" casa só 1. Ou seja: **o prefixo ajuda pouco até o número digitado ter tantos dígitos quanto o maior número do acervo (3, aqui)**; com 1 ou 2 dígitos ele despeja dezenas de hinos. Vale para este acervo; outro acervo muda a conta (revisão).
- **Autoria:** 389 de 480 preenchidas (80%). Exemplos: "Leila Naylor Morris", "Samuel Sebastian Wesley".
- **Tom:** 10 tonalidades, todas maiores: Mi♭ (92), Sol (77), Lá♭ (75), Si♭ (65), Dó (55), Fá (48), Ré (40), **Ré♭ (18)**, Lá (8), Mi (2). A grafia é a **do hinário** (Ré♭ continua Ré♭, e não vira Dó♯: `nomeDaTonalidade`, `notacao.ts:56-67`) e a tela a mostra na notação e no idioma de agora ("E♭ major"). Os chips e a busca precisam comparar por **nota + modo**, e não pelo texto (revisão).
- **Letra, ruído por termo curto** (revisão: refeito **por palavra**; a primeira contagem, "si" 202, contava o trecho **dentro** de palavras como "assim"). Hinos que contêm a **palavra inteira**, na letra e no título: "jesus" 344 e 79; "cristo" 272 e 52; "si" 11 e 1; "sol" 11 e 1; "tom" 0 e 0; "mi" 0; "fá" 0; **"lá" 78** e 2. Como **início de palavra** (o que o prefixo acha): "si" 117, "mi" 126, "fá" 194, "re" 424 de 480. Palavras curtas **com sentido** na letra: "fé" 159, "só" 91, "ti" 85, "tu" 68. Conclusões: o conflito real do tom com o texto é **"lá"** (e "sol"/"si" em menor grau); termo curto como **prefixo** na letra acha quase tudo; termo curto como **palavra inteira** é seletivo e útil.
- **Custo (medido em Node/V8 no meu computador, não no celular):** indexar os 480 hinos leva ~3 ms e ~270 KB de texto normalizado (título, autoria e letra). Uma busca que varre tudo, em todos os termos, leva **~0,12 ms**. Num celular modesto seria algo como 10 vezes isso, mas **é palpite, não medi**. Para 480 hinos a conclusão "não precisa de índice nem de biblioteca" é plausível; para "alguns milhares" ninguém mediu: **medir no celular mais fraco de teste antes de descartar o índice** (revisão).

## Pesquisa (2026-11-25, só pesquisa na web, não testei nenhum dos apps)

**Quantos caracteres esperar**
- A documentação da Microsoft (Azure AI Search) diz que a API **não exige mínimo** e que **2 ou 3 caracteres** é o típico em componentes de autocompletar como o do jQuery; o casamento dela é por **início de termo**, e não por trecho. Não é "padrão de mercado" (revisão). A Algolia defende o contrário, **responder desde a 1ª tecla**, desde que a resposta seja rápida. Uma fonte de engenharia cita **~100 ms** como o ponto em que o atraso é notado. A Baymard (pesquisa de usabilidade) achou que **muitas sugestões** causam "paralisia de escolha". Não há consenso único; o ponto de equilíbrio depende de quão barata é a resposta e de quão ruidosa é a consulta curta.
- **Leitura para nós:** responder desde a 1ª tecla é possível (0,12 ms), mas **mostrar tudo** com 1 caractere vira ruído. A solução não é esperar, e sim **mostrar pouco e bem ordenado** com consulta curta.

**Número de hino**
- Há relatos de usuários de programas de igreja (Proclaim/Logos): buscar "33" trouxe também 330 e 331 e músicas sem relação; outros pedem que o número do hino entre na busca. Em outro app de hinos, a busca por número parou de funcionar numa versão e o desenvolvedor reconheceu que "não pensou em testar esse caso". Apps de hinos costumam ter **"ir direto ao número"** separado da busca por palavras ("Search for words or by number").
- **Leitura para nós:** o número deve ser tratado como **uma intenção própria**: o acerto exato vem **primeiro e fixo**; o prefixo é complemento, nunca substitui o exato.

**Ranking por campo**
- A prática descrita (Elasticsearch, Algolia, Adobe, documentação de vários produtos): **exato > começa com > contém**, com pesos por campo (título acima de texto longo); para **código ou ID**, um acerto exato com peso alto. Uma fonte dá faixas de peso (exato 60–90, começa com 40–60, contém 30–50), que **são de um fornecedor e não valem como regra**. Nenhuma fonte tratava de ID numérico curto; "tratar consulta numérica como termo exato num campo de chave, com peso alto" é o que eu proponho, **sem ter confirmado** como padrão geral.
- Aviso das mesmas fontes: os sinais **competem** (frase num campo fraco x termos soltos num campo forte). Precisa de uma tabela de casos para validar a ordem, e não só de pesos.

**Bibliotecas (conferido no npm em 2026-11-25)**
- **MiniSearch 7.2.0**, MIT: índice invertido em memória; `prefix`, `fuzzy`, `boost` por campo, `autoSuggest` e `processTerm` (normalização, filtro, stemming). Pelo README. O README mostra a normalização **só passando para minúsculas**: tirar acentos é por nossa conta. **`combineWith` não confirmei** no README.
- **Fuse.js 7.5.0**, Apache-2.0: busca aproximada (Bitap), simples, varre tudo (O(n)).
- **FlexSearch**: rápido, com mais opções e mais complexidade.
- **Tamanhos:** as fontes **divergem** (de 4 a 17 kB comprimidos); não vale citar número. O pacote do MiniSearch tem ~826 KB descompactado no npm, mas o que entra no app depende do empacotador. Conferir com um build real antes de decidir.
- **Não verifiquei:** como cada biblioteca trata acentos sem configuração (o `processTerm` do MiniSearch permite normalizar), nem stemming em português.

## Proposta (minha; a validar)

### 1. Separar o motor da tela
Uma função **pura** `buscar(consulta, acervo, opcoes)` em `src/lib/busca-hinos.ts` (nome a definir; `Busca.svelte` já é a barra de progresso), com testes por tabela de casos. A tela só mostra o resultado. Sem biblioteca na v1: com ~480 itens (e mesmo com alguns milhares) uma varredura linear com normalização basta. **MiniSearch fica como opção** se entrarmos em erro de digitação (fuzzy) ou em acervos grandes.

### 2. O que a consulta entende
Quebrar o que foi digitado em termos e reconhecer **intenções**. **Decisão que muda o que já funciona** (revisão): hoje o título casa por **trecho em qualquer lugar** ("ristã" acha "Cristã"); a proposta passa a **início de palavra** (todos os termos, o último como prefixo). É mais certeiro e menos ruidoso, mas quem digitava o meio da palavra deixa de achar; está nas perguntas.

| Digitou | Intenção | O que mostra |
|---|---|---|
| `21`, `021`, `hino 21`, `nº 21`, `#21` | número | o hino 21 **primeiro e fixo**; depois os que **começam por 21** (210 a 219); `Enter` abre o 21 |
| `1` | número (1 dígito) | o hino 1 fixo e **só os primeiros** que começam por 1, com "e mais 105" (não 111 linhas) |
| `jesus` | texto | título primeiro, depois autoria, depois letra |
| `leila` | texto | achados em **autoria**, com o nome destacado |
| `gloria ao` | texto, vários termos | todos os termos precisam aparecer (E), o último casa por **prefixo** (está digitando) |
| `senhor meu pastor` | letra | os hinos cujo **verso** contém todos os termos, com o trecho do verso na linha |
| `mi bemol`, `sib`, `tom si b` | tom | ver item 4 |

Normalização: sem acentos, maiúsculas e minúsculas, ignorando pontuação e hífen; `ç`, `ñ` tratados como letras comuns; os sinais ♭ e ♯ aceitam "b", "bemol", "sust", "#".

### 3. Número "inteligente"
- **Exato sempre em 1º lugar e fixo**, qualquer que seja o resto.
- **Prefixo como complemento**, ordenado por número, **limitado** (por exemplo 6 itens) com "e mais N", onde **N = total que casa − 1 exato − os mostrados** (com "1": 111 − 1 − 5 = 105). Tocar em "e mais N" **abre a lista inteira** daquele prefixo. A pesquisa mostra que muitas opções atrapalham, e "33" trazendo 330 e 331 é a queixa conhecida. O prefixo para de ajudar quando o número digitado já tem tantos dígitos quanto o maior número do acervo.
- **Zeros à esquerda:** "01" e "001" valem como o número 1 (o exato); o prefixo vale **sobre o número sem zeros** ("01" mostra 1 e os que começam por 1), e não sobre "010 a 019", que é só o desenho da lista.
- **Número que não existe** ("481", "0"): sem exato; Enter **não faz nada**, e o aviso de quantidade diz "nenhum hino com esse número".
- **A lista não pode "pular" a cada tecla** (quem passa pelo "1" para chegar ao "100"): altura estável e o anúncio de leitor de tela só depois de uma pausa na digitação.
- **Enter abre o exato** (o caminho rápido de quem já sabe o número, que é como se usa hino em culto).
- Termos de texto **com** número ("hino 21", "21 jesus") entendem o número como filtro **e** o texto como busca.
- Se dois acervos têm o mesmo número (Hinário 4 e Hinário 5): mostrar os dois **rotulados** (o acervo ativo primeiro).

### 4. Tom
- **Algumas notas são palavras** (revisão, com a contagem por palavra): **"lá" aparece como palavra em 78 hinos**, "sol" em 11 e "si" em 11; "mi" e "fá" em nenhum. Tratar `lá` ou `sol` sozinhos como tom geraria falsos positivos, mas o risco de "si/mi/fá" é pequeno. Proposta: o tom entra como **filtro por botões** (chips) abaixo do campo, com a contagem, comparando por **nota + modo**; e o texto é lido como tom quando traz **nota + acidente** (`sib`, `mi♭`, `si bemol`), a palavra **"tom"**, "maior/menor", ou o símbolo; uma nota **sozinha** ("lá", "sol", "ré") **não** vira filtro de tom (busca como texto).
- A grafia do tom é a **do hinário** (Ré♭ fica Ré♭), mostrada na notação e no idioma atuais; a busca aceita as grafias comuns (sib, si b, si bemol, Bb) e as **três notações** (sílabas, letras), e compara por **nota e modo** (a nota Ré♭ e Dó♯ são a mesma classe, mas o hinário usa Ré♭; decidir se a busca por "dó sustenido" acha Ré♭).
- **Pergunta:** o músico busca por tom do hino? ("quais hinos estão em Si♭?") Provavelmente sim (afinação, transposição e instrumentos transpositores).

### 5. Letra: só a partir de 3 letras
- **Título, autoria e número respondem desde a 1ª tecla** (são curtos e seletivos).
- **Letra: termo de 1 a 2 letras só vale como PALAVRA INTEIRA, nunca como prefixo** (revisão: descartá-lo perderia palavras com sentido, como "fé", "só", "ti", "tu"). Termo de 3 ou mais letras casa por início de palavra. Com **um só** termo de 1 a 2 letras digitado, a letra não é consultada (só número, título e autoria). Pelos números acima, "si" como prefixo acharia 117 hinos na letra; como palavra inteira, 11.
- **Ordem:** acerto no **título** > no **início do título** > autoria > **letra**; dentro da letra, mais termos casando juntos, e verso com todos os termos na **mesma linha** acima de termos espalhados.
- **Trecho do verso na linha do resultado**, com o termo em **negrito** (é o que faz a busca pela letra ser reconhecível: o aluno vê "ah, é esse"). Só um trecho, curto.
- **Contagem** ("12 hinos") numa região `aria-live="polite"`, com taxa limitada.

### 6. Vários acervos (o futuro)
Hoje `biblioteca.pacote` é **um** pacote. Para 2 ou mais:
- **O número é a chave do app inteiro (revisão):** hoje a rota `/hino/[numero]`, `biblioteca.hino(numero)`, `ultimoHino.numero`, `Pacote.partituras: number[]`, `lerPartitura(numero)` e `reproducao.atual.numero` usam **só o número**. Um campo `acervo` no item de busca **não basta**: com dois hinários, o mesmo número aparece nos dois. É preciso definir **já** uma **chave composta** (acervo + número, ou um id próprio do item) e listar essas dependências na etapa de acervos; a etapa 1 do motor precisa dela para o resultado apontar a um hino sem ambiguidade.
- **Acervo** (coleção) = um pacote com `hinario: { id, nome, idioma }` (**já existe** no JSON do hinário) mais, no futuro, outros tipos (gospel para sopro, cordas…), que **podem não ter número nem letra**. O item de busca fica **opcional por campo**: `numero?`, `titulo`, `autoria?`, `tonalidade?`, `letra?`, `instrumentos?`, `acervo`.
- **Seletor do acervo ativo**: onde? Hoje há um botão de hinário e um de partituras em **Ajustes**. Com 2 ou mais viram **seletores** ali, e a lista da tela inicial mostra **um acervo por vez** (o ativo).
- **Escopo da busca**: **"Este acervo"** (padrão) ou **"Todos"** (chip abaixo do campo). Resultado de outro acervo mostra o **rótulo** do acervo. Sem resultado no acervo ativo: "Buscar em todos (N)".
- **Partituras** acompanham o hino pelo número **e** pelo acervo. A busca não muda (acha o hino; a partitura é uma aba dele), mas o seletor de partituras precisa saber a qual acervo cada pacote pertence.
- **Nada disso entra na v1 da busca**; a v1 só deixa o motor **pronto** para receber vários acervos (o `acervo` é um campo do item, com valor único hoje, e a chave composta definida). **Sem um segundo acervo real, ficam fora da v1** (revisão): o escopo "Este acervo | Todos", os rótulos de acervo, o campo `instrumentos` e a ordem alfabética opcional.

### 7. Interface
- Campo de busca atual, com o placeholder (hoje "Buscar por número ou título") dizendo o que ele entende ("Número, título, autor ou verso").
- Chips (uma linha rolável) abaixo: **Tom** (as tonalidades do acervo, com contagem) e, quando houver mais de um acervo, **Este acervo | Todos**. Um filtro ativo mostra ✕.
- Cada linha: número (3 dígitos, como hoje), título e a **autoria que já aparece hoje**, mais o tom pequeno; o trecho do verso **só** quando o acerto foi na letra. Se o acerto foi na autoria, **destacar** o nome que já está na linha (e não tirá-lo).
- Estado vazio útil: sugestão ("tente parte do título ou um verso") e o botão de limpar, como hoje.

### 8. Acessibilidade
- Anúncio da quantidade de resultados em `aria-live="polite"`, limitado (uma vez por pausa de digitação).
- O destaque em negrito não pode ser a **única** pista (o trecho é texto; o leitor de tela lê a linha inteira).
- `Enter` abre o resultado fixo no topo quando a consulta é número; o campo continua `type="search"`.

### 9. Testes
- **Tabela de casos** no Vitest (a ordem esperada para cada consulta: "1", "21", "100", "hino 21", "leila", "jesus", "gloria", "mi bemol", "si", "senhor meu pastor", "sib", vazio, só espaços, só pontuação).
- Um caso e2e (no Chrome do CI) de digitar um verso e chegar ao hino.
- **Dados reais de teste só em fixture sintética**: o hinário real é conteúdo do Enéias e não entra no Git (os números acima foram medidos fora do repositório).

## O que é barato e já vale, mesmo antes do motor (revisão)

- **Pontuação no título:** normalizar (ignorar pontuação e hífen) já no filtro atual.
- **Autoria no filtro atual:** incluir a autoria (já aparece na linha, então a pessoa **espera** achar por ela).
- **Tabela de casos com contagens por palavra:** é o que decide as regras acima.

## Etapas sugeridas

1. **Chave composta do item** (acervo + número) e **motor puro + tabela de testes** (sem mexer na tela). É o que mais reduz o risco, e já dá para ajustar a ordem com casos reais.
2. **Tela**: número inteligente com fixo + "e mais N", Enter abre, autoria, letra com trecho, contagem `aria-live`.
3. **Chips de tom** e o texto de tom (`tom si b`).
4. **Acervos**: modelo com `acervo`, seletores em Ajustes, escopo "Este acervo | Todos".
5. **Opcional**: erro de digitação (fuzzy) e acervos grandes, com MiniSearch ou parecido.

## O que eu não sei (a medir ou perguntar)

- Se o **músico** usa a busca por **verso** (e com que termos) ou se é só curiosidade; e se prefere **Enter abre o exato** ou uma lista sempre.
- **Quantas** bibliotecas e de que tipo virão: se músicas **sem número** (gospel instrumental) entram na mesma lista, o número deixa de ser a chave visual.
- O custo no **celular real** (medi só no computador; ~0,12 ms por busca em 480 hinos).
- Acentos e cedilha: o **comportamento do `normalize("NFD")`** com as letras do espanhol (ñ) e do hinário em outros idiomas (o app tem pt, en e es).
- **Stemming** (plural e flexão: "pecado" x "pecados"): não verifiquei se vale. Com busca por **prefixo** já cobre boa parte ("pecad").
- Se a **ordem alfabética** (e não a do hinário) deve ser uma opção quando há mais de um acervo.

## Perguntas ao responsável

1. **Número:** o exato **fixo no topo** mais "e mais N" para o prefixo está bom? E **Enter abre o exato**?
2. **Letra:** só a partir de **3 letras** e com **o trecho do verso** na linha?
3. **Tom:** **chips** de tonalidade (com contagem) e o texto só quando vier "tom", "bemol" ou o símbolo?
4. **Acervos:** busca **neste acervo** por padrão e **Todos** como chip? Ou sempre em todos?
5. Os outros acervos (gospel, cordas) vão ter **número**? Têm **letra**? Têm **instrumento**, e queremos buscar por ele?
6. Quer que o **motor** (etapa 1) saia primeiro, sem mudar a tela, para você ver a tabela de casos?
7. **Hinário 5 (Dó)** terá outras edições (Si♭, Mi♭)? Se tiver, o mesmo número com outro tom conta como **acervo** ou como **variante** do mesmo hino?
8. Hinos de acervos diferentes podem ser o **"último aberto"** ao mesmo tempo, ou é um só para o app?
9. A busca por tom deve seguir a **notação** que a pessoa escolheu (letras ou sílabas)?
10. O título passar a casar por **início de palavra** (e não mais por trecho em qualquer lugar) é aceitável?

## Fontes (pesquisa de 2026-11-25)

- Quantos caracteres e latência: [Microsoft Learn, autocomplete no Azure AI Search](https://learn.microsoft.com/en-us/azure/search/search-add-autocomplete-suggestions); [Algolia, autocomplete](https://www.algolia.com/blog/ux/autocomplete-beyond-search-engaging-users-with-next-level-ux); [Baymard, desenho de autocomplete](https://baymard.com/research-articles/autocomplete-design).
- Hinos: [Logos, números de hino na busca](https://community.logos.com/discussion/251056/song-library-search-include-hymn-numbers-in-results) e [outra discussão](https://community.logos.com/discussion/comment/1283548); listagens de [Hymnbooks](https://apps.apple.com/us/app/hymnbooks/id574873272) e [Hymns Mobile](https://apps.apple.com/us/app/hymns-mobile/id1510007574).
- Ranking por campo: [AddSearch, exact match boost](https://www.addsearch.com/docs/result-management/ranking-exact-match-boost/); [Adobe Commerce, relevância](https://experienceleague.adobe.com/en/docs/commerce/live-search/live-search-admin/search-relevance-matching); [Elastic, boost de prefixo](https://discuss.elastic.co/t/text-search-with-more-preference-to-prefix-matches/10388).
- Bibliotecas: [MiniSearch](https://github.com/lucaong/minisearch) (README: `prefix`, `fuzzy`, `boost`, `processTerm`, `autoSuggest`); [Fuse.js](https://www.fusejs.io/); [FlexSearch](https://github.com/nextapps-de/flexsearch); comparação [npm-compare](https://npm-compare.com/elasticlunr,flexsearch,fuse.js,minisearch) (tamanhos divergentes entre as fontes).
- **Não verificado nesta rodada:** os apps citados (li só descrições e discussões de usuários), o tamanho real de cada biblioteca num build do app, o tratamento de acentos de cada biblioteca e o stemming em português.
