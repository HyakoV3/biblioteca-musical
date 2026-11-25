# Ideia: organizar muitas gravações (rascunho, I-39)

**Status:** rascunho **revisado** (2026-11-25): revisado por um subagente Opus 5 e conferido de novo contra o código. Nada foi implementado. Separo o que foi **conferido no código** e **lido na pesquisa** do que é **proposta minha**.

## O pedido (2026-11-25, do responsável)

Hoje há 4 gravações, mas com 100 ou 1000 é preciso **organizar** e **paginar**. Rascunhar a ideia, revisar com um subagente Opus 5, revisar de novo e então implementar.

## Como é hoje (conferido no código)

| O quê | Hoje |
|---|---|
| Lista | `Gravador.svelte`: da mais nova para a mais antiga, **10 por página** (`TAMANHO_DA_PAGINA`, `gravacoes.ts:16`), carregada por cursor no índice `porData` (`gravacoes.listar`). |
| Paginação | **Rolagem infinita**: um `IntersectionObserver` carrega a próxima página quando o fim chega a 600 px da tela (efeito em `Gravador.svelte:360-372`, `rootMargin` na linha 367). O "Carregando mais gravações…" não é anunciado ao leitor de tela. Não há botão nem número de página. |
| Resumo | Quantidade e espaço total ("4 gravações · 2,1 MB"), por `gravacoes.resumo()`, que **percorre todos os `meta` com um cursor a cada salvar ou apagar** (`gravacoes.ts:220-236`). **O app já lê todos os metadados o tempo todo**, o que reforça a proposta abaixo. |
| Nome | Fixo: "Gravação 25/11 14:30" (`gravador.nome`, `formatarData`: dia, mês e hora, **sem ano**, então depois de um ano os nomes se repetem). **Não dá para renomear.** |
| Achar uma | **Só rolando.** Sem busca, sem filtro, sem favoritas, sem agrupar por dia. (O item já mostra "Com: hino 10" ou "Com: metrônomo, 65 bpm", só isso: `gravador.resumo_hino`.) |
| Apagar | Uma (com confirmação em dois toques, `ItemGravacao.svelte:92-102`) ou **todas** (`Gravador.svelte:292-314`). Apagar uma **grava na hora** no IndexedDB. Não há "apagar as mais antigas", nem selecionar várias, nem lixeira. |
| Dados | `MetaGravacao = { id, criadaEm, segundos, tipo, bytes, contexto? }` (`meta`, leve, com o índice `porData` que já existe) e o áudio em `blobs` (lido só ao tocar ou enviar). O `contexto` (I-38) diz o que tocava no fone: hino (número e título) ou metrônomo. |

**O que isso faz com 100 ou 1000 gravações:** achar "aquela do hino 10 de semana passada" exige rolar e abrir uma a uma; todas têm nomes quase iguais (só muda a hora); e o único jeito de liberar espaço é apagar tudo ou uma por uma.

## Pesquisa (2026-11-25, só web; não testei os apps)

- **Apple Voice Memos** (guias oficiais; **li só o resumo da busca, não as páginas**): o guia do iPhone (a página citada é do **iOS 14**) trata de **favoritas** e **pastas**; o guia do **Mac** é o que fala de pasta inteligente (as favoritas numa visão própria), de uma gravação ficar em **uma** pasta e de "Apagados recentemente" por **30 dias**; a **busca por nome** e o modo **Editar** (selecionar várias e mover) vêm de outros guias da Apple. A separação "onde a gravação mora" x "como eu a encontro" é o padrão a copiar.
- **Um gravador de terceiros** (**uma** página de loja, não uma avaliação): toque longo para mover, compartilhar e apagar; filtro **Todas / Favoritas**.
- **Não achei** nada confiável sobre o Google Recorder nem estudo de UX específico para gravadores.
- **Paginação x rolagem infinita x "carregar mais"** (NN/g, Deque, WordPress Accessibility Handbook, GitLab, Smashing): as fontes apontam a rolagem infinita como **a mais difícil para leitor de tela** (GitLab e o WordPress Handbook; a Deque discute o `role=feed`, que **não** resolve para todos); a paginação numerada é a **mais robusta** (WordPress Handbook); "carregar mais" é o meio-termo, dá **controle** e um **fim natural** à lista (GitLab, Built In), mas exige anunciar o que chegou e cuidar do foco (Smashing). O problema prático é o foco e o anúncio. Quem usa rolagem infinita deve oferecer o botão como alternativa (Deque).
- **IndexedDB com milhares de registros** (Nolan Lawson, RxDB, MDN, lista do W3C): `getAll()` em lote é **bem mais rápido** que cursor item a item, mas `getAll()` de tudo pode estourar memória quando os itens são grandes; índices ajudam a ordenar e filtrar. **Não consegui** confirmar o desempenho de `count()`, nem o suporte atual de `getAllRecords()`. Como o registro `meta` do app é **pequeno** e o áudio fica em outra loja, ler **todos os `meta` de uma vez** é viável (o app já faz uma varredura completa no `resumo()`). **Cuidado com a memória:** o tamanho do JSON engana; objetos aninhados (`contexto.hino.vozes[]`) e um `$state` profundo do Svelte 5 (um proxy por objeto) custam várias vezes mais. Precisa de **medida no aparelho**.

## Proposta

### Princípio: ler todos os metadados, filtrar na memória, paginar só o que se desenha

O áudio não entra na conta. Com todos os `meta` na memória:

- **busca, filtro, ordem e agrupamento** viram **funções puras** (testáveis no Vitest com 1000 e 10000 registros sinteticos), sem criar um índice do IndexedDB por filtro;
- **a paginação passa a ser só de exibição**: desenhar 20 por vez (cada item monta um `<audio>` e botões; desenhar 1000 itens de uma vez é que pesa);
- o contador "mostrando 20 de 137" é **exato** e grátis.

O custo é a memória e o tempo da primeira leitura. Para segurar o custo (revisão):

- a lista completa fica em **`$state.raw`** (sem proxy profundo), com cópias imutáveis a cada mudança;
- a **chave de busca normalizada** (nome, número e título do hino, sem acento) é **calculada uma vez por registro**, e não a cada tecla;
- o **resumo** (quantidade e bytes) passa a ser **derivado da lista** em memória, no lugar do cursor que percorre tudo a cada mudança;
- **um só diálogo de envio**, no `Gravador`, no lugar de um `<dialog>` por item (depois de 50 toques em "Mostrar mais" seriam 1000 diálogos no DOM);
- a leitura usa o índice `porData` (`getAll()` direto na loja vem na ordem do `id`, não da data).

O limite de onde isso deixa de valer (dezenas de milhares) fica anotado; a saída seria índice no IndexedDB.

### A corrida entre a leitura completa e salvar, alterar e apagar (revisão)

Hoje há duas proteções: `geracao` (só sobe em "Apagar todas") e `apagadasNaCarga` (só guarda ids apagados durante a leitura de uma página). Uma leitura completa que **substitui** a lista abre três furos: a gravação **salva** durante a leitura some até recarregar; um nome ou favorita **alterados** voltam ao valor antigo; apagar **várias** não entra em nenhum dos dois. Regra proposta: ao chegar a leitura, **mesclar** em vez de substituir: *lidas ∪ salvas desde o início − apagadas desde o início*, e para as alteradas vale a **versão local**. Um **único registro de mudanças** por leitura substitui `geracao` e `apagadasNaCarga`. Teste de corrida no `fake-indexeddb`.

### O que a pessoa ganha (em ordem de valor)

1. **Achar:** campo de busca (nome, número e título do hino do contexto) e **filtros** em botões: *Todas · Favoritas · Com hino · Com metrônomo · Sem contexto*, e **período** (*Hoje · 7 dias · 30 dias*).
2. **Nome e anotação:** renomear ("Hino 10, ensaio do coro") e uma **nota** curta opcional. Sem `titulo`, o nome é **derivado na exibição** (não se grava nada): "Gravação 25/11 14:30", ou "Hino 10 · 25/11 14:30" quando há contexto, com o **ano** quando não é o corrente. (Isso resolve a pergunta sobre o nome sugerido.)
3. **Favoritas:** uma estrela (padrão do Voice Memos).
4. **Agrupar por dia** na lista ("Hoje", "Ontem", "Últimos 7 dias", "Novembro de 2026"): uma `<section>` com `<h3>` e `<ul>` por grupo (o `<h3>` não pode ficar dentro do `<ul>` único de hoje), que também serve de navegação para leitor de tela. **Regra do dia:** dia civil **local** (getters locais, comparar datas, nunca `Δms / 86400000`, que erra na mudança de horário de verão); "Esta semana" sai (o primeiro dia da semana varia e `Intl.Locale.weekInfo` é irregular no WebView); meses por `Intl.DateTimeFormat({ month: "long", year: "numeric" })`; o "agora" é recalculado ao voltar à aba (`visibilitychange`) e à meia-noite.
5. **Selecionar várias** (modo Editar): apagar, favoritar, desfavoritar. Enviar várias fica fora (cada app trata vários anexos de um jeito). Precisa de: "Selecionar todas as filtradas", sair com o voltar do Android e o Esc, nome acessível em cada caixa e folga para a barra fixa não cobrir os últimos itens nem o "Mostrar mais".
6. **Liberar espaço:** ordenar por **tamanho** e **"Apagar as mais antigas que…"** (30, 90 dias), num **diálogo de confirmação** com a quantidade e o espaço **antes** de confirmar (sem o prazo de 4 s dos dois toques). As favoritas ficam de fora por padrão. Mostrar também o espaço do aparelho (`navigator.storage.estimate()`).
7. **Paginação acessível:** botão **"Mostrar mais (20)"** com o total à vista ("Mostrando 20 de 137"), no lugar da rolagem infinita, com anúncio ao leitor de tela. (Pergunta 3.)
8. **Proteger o armazenamento:** 1000 gravações de ~380 KB são ~380 MB só no IndexedDB da WebView, que **some ao limpar os dados ou desinstalar**. Hoje só o pacote de sons pede `navigator.storage.persist()` (`sons/armazenamento.ts:15`); pedir também ao guardar a **primeira gravação**. Backup (exportar tudo) segue como pergunta, e não mais como "ideia à parte". (Pergunta 4.)

### O que **não** entra (proposta)

- **Pastas e etiquetas livres:** com busca, filtros, favoritas e agrupamento por dia, as pastas pouco acrescentam e pesam na tela pequena. Se depois o filtro "por hino" não bastar, **etiquetas** (várias por gravação) vêm antes de pastas. (Pergunta 3.)
- **Lixeira de 30 dias:** protege contra apagar sem querer, mas guarda **áudio**, que ocupa espaço (é justamente o problema). Alternativa: **desfazer** de alguns segundos **só para apagar uma** (esconde agora e apaga depois; ao reabrir o app com uma exclusão pendente, ela é concluída). **Lote:** confirmação forte, **sem desfazer** (guardar os blobs de 300 itens em memória não cabe). Hoje `apagarUma` apaga na hora, então o desfazer é mudança de comportamento. (Pergunta 5.)
- **Nuvem e transcrição:** ideias à parte. **Exportar tudo (zip)**: ver a pergunta 4.

## Modelo de dados

```ts
type MetaGravacao = {
  id: string; criadaEm: number; segundos: number; tipo: string; bytes: number;
  contexto?: ContextoGravacao;   // I-38, já existe
  titulo?: string;               // novo: renomeada (até 80 caracteres)
  nota?: string;                 // novo: anotação (até 500)
  favorita?: boolean;            // novo
};
```

- Campos **opcionais**: nenhuma migração do banco (a versão do IndexedDB não sobe); as gravações antigas continuam como estão.
- **Alterar** o `meta` de uma gravação: `gravacoes.atualizar(id, mudancas)` faz o **`get` e o `put` na MESMA transação** `readwrite` da loja `meta` (o helper `transacao` e `pedido` já permitem), **preserva campos que não conhece** e, **se o registro não existe mais, não grava nada** (senão recriaria um `meta` sem áudio, que a lista mostraria como "não foi possível abrir"). Dois toques rápidos (favoritar e renomear) não podem perder um ao outro. Teste: apagar e atualizar ao mesmo tempo não deixa `meta` órfão.
- `apagarVarias(ids)` apaga `meta` e `blobs` numa transação só.
- **Validação ao ler**, como o `contextoValido`: `metaValida()` confere tipos, **recorta** `titulo` (80) e `nota` (500) por **caracteres visíveis** (não unidades UTF-16), normaliza em NFC, `trim`, colapsa espaços e **tira quebras de linha** do título; título vazio **remove o campo** (volta ao nome padrão). O trecho achado na busca é realçado em **segmentos** (nunca com `{@html}`).
- `titulo` e `nota` são **texto da pessoa**. O **texto de contexto enviado** (I-38) segue sem eles; se entrarem, passam por `limparParaMarkdown`. (Pergunta 6.)
- O filtro e a busca por hino leem o contexto **sempre via `contextoValido`**. O `ContextoHino` **não tem acervo** (`contexto.ts`), então "hino 10" fica ambíguo quando houver mais de um hinário: aceitar por ora, ou subir o contexto para `v: 2` com o acervo. Uma busca só de números usa `numeroDaConsulta` (como a busca de hinos) e **não** casa com a data "10/11" nem com "0:10".

## A tela (esboço)

```
Gravações guardadas                137 gravações · 84 MB
[ Buscar por nome, hino…           ]
(•) Todas  ( ) Favoritas  ( ) Com hino  ( ) Com metrônomo     Período ▾   Ordem ▾   [Selecionar]

Hoje
  ★ Hino 10, ensaio do coro        0:42 · 380 KB · Ogg
     Com: hino 10, 60 bpm, +1 semitom
     [Ouvir] [Enviar] [Apagar]
Ontem
  ...
Mostrando 20 de 137            [ Mostrar mais (20) ]
```

- Sem resultado: "Nenhuma gravação com esse filtro." e um botão "Limpar filtros".
- O esboço mostra "Com: hino 10, 60 bpm, +1 semitom", mas **hoje** o item só mostra "hino {numero}": a linha completa é uma **mudança nova** (etapa 3).
- O **resumo** passa a mostrar o total **filtrado** e o total geral.
- O **modo selecionar** troca os botões de cada item por uma caixa de seleção e mostra uma barra fixa com "Apagar (n)" e "Favoritar (n)".

## Acessibilidade e comportamento

- **Filtros exclusivos são um grupo de rádio** (`fieldset` + `legend`, rádios nativos estilizados como chips), e não botões `aria-pressed` independentes. **Período e ordem: `<select>` nativo** (o mais robusto no TalkBack). O campo de busca tem rótulo.
- **Um só anúncio** ("n resultados", "20 novas gravações, mostrando 40 de 137"), numa **região única** com o atraso de 600 ms da busca de hinos (`+page.svelte:75,144`); já existe um `role=status` para o estado da gravação, e um segundo competiria com ele.
- **Foco:** em "Mostrar mais", o foco vai para o **primeiro item novo** (o botão some quando chega a última leva, e o foco cairia no `body`); depois de **apagar**, o foco vai para o item seguinte ou para o cabeçalho da lista (hoje fica órfão, `Gravador.svelte:282`).
- **Uma só gravação toca por vez** continua valendo. **O som não pode "seguir com o item escondido"**: o `<audio>` e a URL do blob moram dentro do `ItemGravacao`, e tirar o item do filtro o **desmonta** (`onDestroy` revoga a URL, `ItemGravacao.svelte:138`). Regra: a lista exibida é **filtradas ∪ {a que toca}**, com a marca "tocando, fora do filtro".
- **A gravação recém-feita nunca "some":** com um filtro ativo que ela não satisfaz, aparece **fixa no topo com a marca "nova"** até a próxima troca de filtro (e a janela de "mostrar" cresce em 1, em vez de empurrar um item para fora).
- Apagar com a lista filtrada apaga **só as selecionadas**, e "Apagar todas" ganha o texto "Apagar as 137" ou "Apagar as 12 filtradas", sempre com a contagem, num **diálogo** (lote não usa o prazo de 4 s).
- Interação com o **I-38**: o filtro "Com hino" lê `contexto.origem`; a busca lê `contexto.hino.numero` e `titulo`.

## Desempenho (orçamento proposto, a medir no aparelho)

- Ler todos os `meta` de 1000 gravações: **< 200 ms**; de 5000: **< 1 s** (**só se mede no aparelho** do responsável; o `fake-indexeddb` e o Node não representam o WebView do Android).
- Filtrar e ordenar 5000 em memória: **< 30 ms** por mudança no filtro, **medido no aparelho**. No Vitest se testa só a **complexidade** (nada de limite de tempo absoluto, que seria instável no CI).
- Desenhar 20 itens: igual a hoje (hoje são 10 por página).
- **Memória:** o tamanho do JSON subestima; ver o `$state.raw` e a chave de busca única acima. Medir o uso de memória do WebView com 5000 registros sintéticos.

## Etapas sugeridas (reordenadas depois da revisão: fatias que entregam valor)

**PR 1: achar e paginar, sem mudar o modelo de dados**
1. `organizar.ts` puro: `filtrar`, `buscar` (chave normalizada pré-calculada, `normalizar` da busca de hinos e `contextoValido`), `ordenar`, `agrupar` por dia civil local e `janela`; testes de complexidade com 1000 e 10000 registros sintéticos, dias de mudança de horário de verão, fronteiras de dia e título estranho.
2. `listarTodas()` pelo índice `porData`; resumo derivado da lista; **a mesclagem** que resolve a corrida da leitura com salvar e apagar (teste de corrida).
3. Tela: busca, grupo de rádio *Todas · Com hino · Com metrônomo*, cabeçalhos de dia, **"Mostrar mais (20)"** com contador e anúncio **no lugar do `IntersectionObserver`**, as regras de foco, a recém-gravada sempre visível, a gravação que toca mantida visível e um só diálogo de envio. O **e2e atual testa a rolagem infinita** (`karaoke.mjs:1376`, `#fim-lista`): é **reescrito**, com 60 gravações sintéticas.
4. Textos em pt, en e es.

**PR 2: nome e favoritas**
5. `atualizar` numa transação, `metaValida`, `titulo`, `favorita` e o filtro de favoritas; nome derivado na exibição; a linha de contexto completa no item.

**PR 3: lotes e espaço**
6. `apagarVarias`, selecionar várias, "Apagar as mais antigas que…" com diálogo, `persist()` e `estimate()`.

**Depois:** nota, desfazer de uma exclusão, backup.

## Perguntas ao responsável

Decisões que **bloqueiam** o desenho (a proposta entre parênteses):

1. **Paginação:** **"Mostrar mais (20)"** com o total (proposta), **páginas numeradas** ou manter a **rolagem infinita**? (O botão é o mais acessível e dá um fim à lista; a rolagem infinita é a pior para leitor de tela.)
2. **Recém-gravada fora do filtro:** fica **fixa no topo com a marca "nova"** (proposta) ou só um aviso "Guardada; não aparece com este filtro"?
3. **Gravação que toca e o filtro muda:** a que toca **continua na lista** com a marca "tocando, fora do filtro" (proposta) ou a reprodução **para**?
4. **Armazenamento:** pedir `persist()` na primeira gravação e mostrar o espaço (proposta). E **exportar tudo (backup)**: entra no roadmap, e com que prioridade?
5. **Apagou sem querer:** **desfazer de alguns segundos só para uma** (proposta), **lixeira de 30 dias** ou nenhum?
6. **Título e nota entram no texto enviado ao professor?** (Proposta: **não** por padrão; a nota pode ser a mais útil.)
7. **Filtros e busca** lembrados ao trocar de aba e ao reabrir o app, ou sempre limpos? (Proposta: limpos.)

Confirmações de uma linha (a proposta serve?): **renomear e nota** os dois; **pastas e etiquetas** fora da primeira versão; **"Apagar as mais antigas que…"** protegendo as favoritas; o que mais importa achar (**hino**, **data**, **favorita**) só ordena os filtros à vista.

## Fontes (pesquisa de 2026-11-25)

- Organização: [Apple, organizar gravações (iPhone)](https://support.apple.com/en-kg/guide/iphone/organize-recordings-iph73bfaba07/14.0); [Apple, Voice Memos no Mac](https://support.apple.com/guide/voice-memos/vmef955050b0/mac); [descrição de gravador de terceiros](https://apps.apple.com/app/id6742039637) (loja, não testado).
- Paginação e acessibilidade: [NN/g, rolagem infinita](https://nngroup.com/articles/infinite-scrolling-tips); [Deque, rolagem infinita e `role=feed`](https://www.deque.com/blog/infinite-scrolling-rolefeed-accessibility-issues); [WordPress Accessibility Handbook](https://make.wordpress.org/accessibility/handbook/markup/design-patterns/infinite-scroll/); [GitLab, auditoria de acessibilidade](https://gitlab.com/gitlab-org/gitlab-ui/-/issues/1196); [Smashing, rolagem infinita](https://smashingmagazine.com/2022/03/designing-better-infinite-scroll).
- IndexedDB: [Nolan Lawson, acelerar leituras e escritas](https://nolanlawson.com/2021/08/22/speeding-up-indexeddb-reads-and-writes); [RxDB, IndexedDB lento](https://rxdb.info/slow-indexeddb.html); [MDN, `getAll()`](https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex/getAll); [lista do W3C, memória do `getAll()`](https://lists.w3.org/Archives/Public/public-webapps-github/2021Dec/0643.html).
- **Não verificado:** o texto das páginas da Apple (só o resumo da busca; o revisor abriu a do iPhone, que é do iOS 14); o comportamento do Google Recorder; o desempenho de `count()` e de `getAllRecords()`; qualquer medida no aparelho do responsável.
