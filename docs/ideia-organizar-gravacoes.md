# Ideia: organizar muitas gravações (rascunho, I-39)

**Status:** rascunho de 2026-11-25. Nada foi implementado. Separo o que foi **conferido no código** e **lido na pesquisa** do que é **proposta minha**.

## O pedido (2026-11-25, do responsável)

Hoje há 4 gravações, mas com 100 ou 1000 é preciso **organizar** e **paginar**. Rascunhar a ideia, revisar com um subagente Opus 5, revisar de novo e então implementar.

## Como é hoje (conferido no código)

| O quê | Hoje |
|---|---|
| Lista | `Gravador.svelte`: da mais nova para a mais antiga, **10 por página** (`TAMANHO_DA_PAGINA`), carregada por cursor no IndexedDB (`gravacoes.listar`). |
| Paginação | **Rolagem infinita**: um `IntersectionObserver` carrega a próxima página quando o fim chega a 600 px da tela (`Gravador.svelte:361`). Não há botão nem número de página. |
| Resumo | Quantidade e espaço total ("4 gravações · 2,1 MB"), lidos por `gravacoes.resumo()`. |
| Nome | Fixo: "Gravação 25/11 14:30" (`gravador.nome`, a partir de `criadaEm`). **Não dá para renomear.** |
| Achar uma | **Só rolando.** Sem busca, sem filtro, sem favoritas, sem agrupar por dia. |
| Apagar | Uma (com confirmação em dois toques) ou **todas**. Não há "apagar as mais antigas", nem selecionar várias, nem lixeira. |
| Dados | `MetaGravacao = { id, criadaEm, segundos, tipo, bytes, contexto? }` (`meta`, leve) e o áudio em `blobs` (lido só ao tocar ou enviar). O `contexto` (I-38) diz o que tocava no fone: hino (número e título) ou metrônomo. |

**O que isso faz com 100 ou 1000 gravações:** achar "aquela do hino 10 de semana passada" exige rolar e abrir uma a uma; todas têm nomes quase iguais (só muda a hora); e o único jeito de liberar espaço é apagar tudo ou uma por uma.

## Pesquisa (2026-11-25, só web; não testei os apps)

- **Apple Voice Memos** (guia oficial): **favoritas** e **pastas**; uma gravação fica em **uma** pasta, e as favoritas aparecem numa visão própria; **busca por nome**; modo **Editar** para selecionar várias e mover; pasta apagada vai para **"Apagados recentemente" por 30 dias**. A separação "onde a gravação mora" x "como eu a encontro" é o padrão a copiar.
- **Gravadores de terceiros** (descrições de loja, não avaliações): toque longo para mover, compartilhar e apagar; filtro **Todas / Favoritas**.
- **Não achei** nada confiável sobre o Google Recorder nem estudo de UX específico para gravadores.
- **Paginação x rolagem infinita x "carregar mais"** (NN/g, Deque, WordPress Accessibility Handbook, GitLab, Smashing): a rolagem infinita é **a mais difícil para leitor de tela** (o leitor só recebe o primeiro trecho e não consegue pedir mais); a paginação numerada é a **mais robusta**; "carregar mais" é o meio-termo e dá **controle** e um **fim natural** à lista, mas exige anunciar o que chegou e cuidar do foco. Quem usa rolagem infinita deve oferecer o botão como alternativa.
- **IndexedDB com milhares de registros** (Nolan Lawson, RxDB, MDN, lista do W3C): `getAll()` em lote é **bem mais rápido** que cursor item a item, mas `getAll()` de tudo pode estourar memória quando os itens são grandes; índices ajudam a ordenar e filtrar. **Não consegui** confirmar o desempenho de `count()`, nem o suporte atual de `getAllRecords()`. Como o registro `meta` do app é **pequeno** (centenas de bytes) e o áudio fica em outra loja, ler **todos os `meta` de uma vez** é viável (mil registros são da ordem de centenas de KB); isso precisa de **medida no aparelho**.

## Proposta

### Princípio: ler todos os metadados, filtrar na memória, paginar só o que se desenha

O áudio não entra na conta. Com todos os `meta` na memória:

- **busca, filtro, ordem e agrupamento** viram **funções puras** (testáveis no Vitest com 1000 e 10000 registros sinteticos), sem criar um índice do IndexedDB por filtro;
- **a paginação passa a ser só de exibição**: desenhar 20 por vez (cada item monta um `<audio>` e botões; desenhar 1000 itens de uma vez é que pesa);
- o contador "mostrando 20 de 137" é **exato** e grátis.

O custo é a memória e o tempo da primeira leitura. Com `meta` pequeno, é aceitável; o limite de onde isso deixa de valer (dezenas de milhares) fica anotado, e a saída seria índice no IndexedDB.

### O que a pessoa ganha (em ordem de valor)

1. **Achar:** campo de busca (nome, número e título do hino do contexto) e **filtros** em botões: *Todas · Favoritas · Com hino · Com metrônomo · Sem contexto*, e **período** (*Hoje · 7 dias · 30 dias*).
2. **Nome e anotação:** renomear ("Hino 10, ensaio do coro") e uma **nota** curta opcional. O nome padrão continua o de hoje enquanto não for mudado. O contexto (I-38) já pode sugerir o nome: "Hino 10 · 25/11 14:30".
3. **Favoritas:** uma estrela (padrão do Voice Memos).
4. **Agrupar por dia** na lista ("Hoje", "Ontem", "Esta semana", "Novembro de 2026"): títulos de seção que também servem de navegação para leitor de tela.
5. **Selecionar várias** (modo Editar): apagar, favoritar, desfavoritar. Enviar várias fica fora (cada app trata vários anexos de um jeito).
6. **Liberar espaço:** ordenar por **tamanho** e **"Apagar as mais antigas que…"** (30, 90 dias), sempre com a quantidade e o espaço **antes** de confirmar. As favoritas ficam de fora por padrão.
7. **Paginação acessível:** botão **"Mostrar mais (20)"** com o total à vista ("Mostrando 20 de 137"), no lugar da rolagem infinita, com anúncio ao leitor de tela. (Pergunta 4.)

### O que **não** entra (proposta)

- **Pastas e etiquetas livres:** com busca, filtros, favoritas e agrupamento por dia, as pastas pouco acrescentam e pesam na tela pequena. Se depois o filtro "por hino" não bastar, **etiquetas** (várias por gravação) vêm antes de pastas. (Pergunta 3.)
- **Lixeira de 30 dias:** protege contra apagar sem querer, mas guarda **áudio**, que ocupa espaço (é justamente o problema). Alternativa mais barata: o **desfazer** de alguns segundos depois de apagar. (Pergunta 5.)
- **Exportar tudo (zip), nuvem, transcrição:** ideias à parte.

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
- **Alterar** o `meta` de uma gravação: `gravacoes.atualizar(id, mudancas)` lê o registro, **preserva campos que não conhece** e grava de volta, só na loja `meta` (o áudio não é tocado).
- `titulo` e `nota` são **texto da pessoa**: sempre escapados ao mostrar; o **texto de contexto enviado** ao professor (I-38) segue sem o título, a menos que a pessoa peça.

## A tela (esboço)

```
Gravações guardadas                137 gravações · 84 MB
[ Buscar por nome, hino…           ]
[Todas] [★ Favoritas] [Hino] [Metrônomo]   Período ▾   Ordem ▾   [Selecionar]

Hoje
  ★ Hino 10, ensaio do coro        0:42 · 380 KB · Ogg
     Com: hino 10, 60 bpm, +1 semitom
     [Ouvir] [Enviar] [Apagar]
Ontem
  ...
Mostrando 20 de 137            [ Mostrar mais (20) ]
```

- Sem resultado: "Nenhuma gravação com esse filtro." e um botão "Limpar filtros".
- O **resumo** passa a mostrar o total **filtrado** e o total geral.
- O **modo selecionar** troca os botões de cada item por uma caixa de seleção e mostra uma barra fixa com "Apagar (n)" e "Favoritar (n)".

## Acessibilidade e comportamento

- Filtros são **botões de alternar** com `aria-pressed`; o campo de busca tem rótulo; "n resultados" vai num `aria-live` **com atraso** (como a busca de hinos, I-37), e não a cada tecla.
- "Mostrar mais": o foco **fica no botão**; o primeiro item novo é anunciado ("20 novas gravações, mostrando 40 de 137").
- Cabeçalhos de dia como `<h3>`: navegação por títulos.
- **Uma só gravação toca por vez** continua valendo; trocar de filtro **para** a que toca? (Proposta: **não** para; a gravação que toca fica fixa no topo enquanto toca, ou o filtro só esconde o item e o som segue. Decidir.)
- Apagar com a lista filtrada apaga **só as selecionadas**, e "Apagar todas" ganha o texto "Apagar as 137" ou "Apagar as 12 filtradas", sempre com a contagem.
- Interação com o **I-38**: o filtro "Com hino" lê `contexto.origem`; a busca lê `contexto.hino.numero` e `titulo`.

## Desempenho (orçamento proposto, a medir no aparelho)

- Ler todos os `meta` de 1000 gravações: **< 200 ms**; de 5000: **< 1 s** (medir no aparelho do responsável, não só no `fake-indexeddb`, que não representa o Chrome do Android).
- Filtrar e ordenar 5000 em memória: **< 30 ms** por mudança no filtro (função pura; medir no Vitest).
- Desenhar 20 itens: igual a hoje (hoje são 10 por página).
- **Memória:** `meta` com `contexto` pesa centenas de bytes; 5000 registros são poucos MB.

## Etapas sugeridas

1. **Funções puras e testes** (`organizar.ts`): `filtrar`, `buscar` (normalização sem acento, como a busca de hinos), `ordenar`, `agrupar` por dia, `paginar`; testes com 1000 e 10000 registros sintéticos, fronteiras de dia e fuso, e título com caracteres estranhos.
2. **Dados:** `titulo`, `nota`, `favorita`; `gravacoes.listarTodas()` e `gravacoes.atualizar()`; testes com o `fake-indexeddb` (campos desconhecidos preservados; gravações antigas lidas).
3. **Tela:** busca, filtros, agrupar por dia, "Mostrar mais" e o contador (**substitui** a rolagem infinita).
4. **Renomear, nota e favorita** no item.
5. **Selecionar várias** e **apagar as mais antigas que…** com contagem e espaço.
6. **Textos** em pt, en e es; e2e (o Chrome do CI) com 60 gravações sintéticas: busca, filtro, "mostrar mais" e apagar selecionadas.
7. **Medida no aparelho** (as metas de desempenho acima) e ajuste do tamanho da página.

## Perguntas ao responsável

1. **O que mais importa achar:** por **hino**, por **data**, por **favorita**? (Define quais filtros ficam à vista e quais vão para o menu.)
2. **Renomear** e **nota**: os dois, ou só o nome?
3. **Pastas ou etiquetas:** ficam de fora da primeira versão (proposta), ou você já tem um caso que as exige?
4. **Paginação:** **"Mostrar mais (20)"** com o total (proposta), **páginas numeradas** ou manter a **rolagem infinita**?
5. **Apagou sem querer:** um **desfazer de alguns segundos** (proposta) ou uma **lixeira de 30 dias**?
6. **"Apagar as mais antigas que…"** com as favoritas protegidas (proposta): serve?
7. **O nome sugerido** pelo contexto ("Hino 10 · 25/11 14:30") já na hora de gravar, ou só o nome de data de hoje até a pessoa renomear?

## Fontes (pesquisa de 2026-11-25)

- Organização: [Apple, organizar gravações (iPhone)](https://support.apple.com/en-kg/guide/iphone/organize-recordings-iph73bfaba07/14.0); [Apple, Voice Memos no Mac](https://support.apple.com/guide/voice-memos/vmef955050b0/mac); [descrição de gravador de terceiros](https://apps.apple.com/app/id6742039637) (loja, não testado).
- Paginação e acessibilidade: [NN/g, rolagem infinita](https://nngroup.com/articles/infinite-scrolling-tips); [Deque, rolagem infinita e `role=feed`](https://www.deque.com/blog/infinite-scrolling-rolefeed-accessibility-issues); [WordPress Accessibility Handbook](https://make.wordpress.org/accessibility/handbook/markup/design-patterns/infinite-scroll/); [GitLab, auditoria de acessibilidade](https://gitlab.com/gitlab-org/gitlab-ui/-/issues/1196); [Smashing, rolagem infinita](https://smashingmagazine.com/2022/03/designing-better-infinite-scroll).
- IndexedDB: [Nolan Lawson, acelerar leituras e escritas](https://nolanlawson.com/2021/08/22/speeding-up-indexeddb-reads-and-writes); [RxDB, IndexedDB lento](https://rxdb.info/slow-indexeddb.html); [MDN, `getAll()`](https://developer.mozilla.org/en-US/docs/Web/API/IDBIndex/getAll); [lista do W3C, memória do `getAll()`](https://lists.w3.org/Archives/Public/public-webapps-github/2021Dec/0643.html).
- **Não verificado:** o comportamento do Google Recorder; o desempenho de `count()` e de `getAllRecords()`; qualquer medida no aparelho do responsável.
