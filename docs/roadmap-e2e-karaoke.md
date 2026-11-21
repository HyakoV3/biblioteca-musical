# Roadmap do e2e do karaokê ("Karaokê num Chrome de verdade")

Levantamento de **todas** as falhas do workflow `ci` desde a primeira execução, com a causa, a categoria e o que fazer para não
repetir. Feito em 21/11/2026 com `gh` e `git` (logs de job pela API `actions/jobs/<id>/logs`, todas as tentativas com
`runs/<id>/jobs?filter=all`). Convenção: **FATO** = visto no log, no código ou no histórico; **INFERÊNCIA** = conclusão
tirada dos fatos; **HIPÓTESE** = ainda precisa de teste.

## 1. Resumo

| Item | Número |
|---|---|
| Período coberto | 15/11/2026 12:53 UTC (1ª execução) a 21/11/2026 13:32 UTC |
| Execuções do workflow `ci` | **298** (255 verdes no fim, 20 vermelhas, 23 canceladas) |
| Execuções com **algum job vermelho** em alguma tentativa | **30** (20 terminaram vermelhas, 8 ficaram verdes só depois de reexecutar, 2 foram canceladas por push novo com o e2e já vermelho) |
| Jobs vermelhos (contando cada tentativa) | **35**: 34 do e2e + 1 do job App |
| Jobs do e2e executados (sem cancelados) | 299 (265 verdes, 34 vermelhos) |
| Canceladas | 23 execuções, todas por `concurrency` (push novo no mesmo PR) ou à mão; nenhuma por timeout do job |

Contagem por categoria (jobs vermelhos):

| Categoria | Jobs | Onde |
|---|---|---|
| A. Teste desatualizado | **0** | nenhum chegou vermelho ao CI (o teste foi atualizado no mesmo commit; ver seção 3.A) |
| B. Teste frágil (tempo) | **3** | karaokê: amostragem começava tarde (15 a 17/11) |
| C. Bug real do app | **1** | job App (não o e2e): regra de movimento violada no `Gravador.svelte` (#77) |
| D. Ambiente/CI | **0 confirmados** | o sintoma das 29 falhas do Gravador é de ambiente, mas a causa raiz não está provada (ficam em F) |
| E. Infraestrutura do script | **2** | `ENOTEMPTY` ao apagar o perfil do Chrome (15/11) |
| F. Não determinado | **29** | Gravador: o `indexedDB.open()` nunca responde no Chrome do runner |

Taxa atual do problema aberto (FATO, contagem dos logs): desde o merge da #77 (19/11 02:08) o e2e falhou no Gravador em
**29 de 104** jobs (28%). Antes disso, com o teste do Gravador já no e2e (desde 17/11 21:00), **0 de 24**.

## 2. Tabela cronológica das falhas

Hora em UTC. "Exec." = id da execução; "Job" = id do job; "T" = tentativa. Chrome só aparece no log a partir de `afd73cf`
(20/11, #103). "Depois" = o que aconteceu com a execução.

| # | Data | Exec. | Job | T | Evento | Branch (PR) | Commit | Chrome | Mensagem curta | Cat. | Depois |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 15/11 12:53 | 43716095635 | 132817845770 | 1 | pull_request | ci-inicial (#2) | 1ce7047 | – | testes OK; `ENOTEMPTY ... rmdir '/tmp/bmccb-e2e-*/Default'` em `limpar` | E | corrigido na #3 |
| 2 | 15/11 12:56 | 43716343753 | 132818601084 | 1 | push | main (#2) | bbda364 | – | idem | E | corrigido na #3 |
| 3 | 15/11 17:21 | 43740612781 | 132892789898 | 1 | push | main (#10) | 1f6a270 | – | `FALHOU sílabas na ordem certa: re mi fa ...`, estrofe, `desvio 2000 ms` | B | corrigido na #63 |
| 4 | 16/11 23:46 | 43982122692 | 133700949318 | 1 | push | main (#47) | d94c793 | – | idem | B | corrigido na #63 |
| 5 | 17/11 16:42 | 44128752323 | 134199679652 | 1 | pull_request | docs-028 (#62) | 81e83c3 | – | idem | B | T2 passou; corrigido na #63 |
| 6 | 18/11 15:25 | 44335429627 | 134910696813 | 1 | pull_request | gravador-compartilhar (#77) | 1a91d64 | – | **job App**: `Gravador.svelte:387: 'transform:'/'transition:' fora de movimento.css` | C | corrigido no próprio #77 |
| 7 | 19/11 02:09 | 44442168756 | 135285414480 | 1 | push | main (#77) | 8e049c6 | – | `FALHOU Gravador: ao parar entrega a gravação`: `itens:0, erro:false, ativos:0` | F | não reexecutada |
| 8 | 19/11 15:04 | 44550709037 | 135653350655 | 1 | pull_request | docs-filtro-de-ruido (#79) | 3e444a8 | – | idem | F | execução cancelada por push novo |
| 9 | 19/11 20:25 | 44608590174 | 135858796560 | 1 | push | main (#80) | 8e8f413 | – | idem | F | não reexecutada |
| 10 | 19/11 21:13 | 44616588873 | 135886832948 | 1 | pull_request | worktree-card-i30-eneas (#81) | 3faf36c | – | idem | F | push novo |
| 11 | 19/11 21:16 | 44617155617 | 135888798634 | 1 | pull_request | worktree-card-i30-eneas (#81) | f6371e4 | – | idem | F | execução cancelada por push novo |
| 12 | 19/11 21:40 | 44621055038 | 135902499572 | 1 | push | main (#81) | a8917f3 | – | idem | F | não reexecutada |
| 13 | 20/11 00:31 | 44646602536 | 135990664641 | 1 | pull_request | i30-continua (#85) | c67b2cc | – | idem | F | T2 passou |
| 14 | 20/11 01:00 | 44650357789 | 136003407714 | 1 | push | main (#86) | cae2d24 | – | idem | F | não reexecutada |
| 15 | 20/11 13:23 | 44743942022 | 136314289108 | 1 | pull_request | karaoke-compasso-sem-fundo (#88) | 37eff78 | – | idem | F | T2 passou |
| 16 | 20/11 14:11 | 44751069934 | 136338926165 | 1 | pull_request | intro-inclui-ultimo-acorde (#89) | 4e4c4db | – | idem | F | reexecutada |
| 17 | 20/11 14:22 | 44751069934 | 136344562165 | 2 | pull_request | intro-inclui-ultimo-acorde (#89) | 4e4c4db | – | idem | F | T3 passou |
| 18 | 20/11 14:25 | 44753278787 | 136346341645 | 1 | pull_request | e2e-gravador-espera (#91) | c52a198 | – | idem, já com espera de até 10 s | F | push novo |
| 19 | 20/11 15:27 | 44763455507 | 136381763848 | 1 | push | main (#92) | 7587250 | – | `FALHOU ... a gravação apareceu na lista em até 10 s`, sem alerta na tela | F | não reexecutada |
| 20 | 20/11 15:35 | 44764832945 | 136386543426 | 1 | pull_request | ligadura-endspanner (#93) | 64292e9 | – | idem | F | push novo |
| 21 | 20/11 15:39 | 44765511529 | 136388944413 | 1 | pull_request | ligadura-endspanner (#93) | 1160380 | – | idem | F | reexecutada |
| 22 | 20/11 15:47 | 44765511529 | 136393239015 | 2 | pull_request | ligadura-endspanner (#93) | 1160380 | – | idem | F | reexecutada |
| 23 | 20/11 15:51 | 44765511529 | 136395949141 | 3 | pull_request | ligadura-endspanner (#93) | 1160380 | – | idem | F | T4 passou |
| 24 | 20/11 16:59 | 44778828658 | 136435788644 | 1 | pull_request | pacote-005-manifesto (#97) | 46f12df | – | idem | F | reexecutada |
| 25 | 20/11 17:06 | 44778828658 | 136439993470 | 2 | pull_request | pacote-005-manifesto (#97) | 46f12df | – | idem | F | T3 passou |
| 26 | 20/11 19:35 | 44803577308 | 136521606572 | 1 | push | main (#98) | 2bf8ffc | – | idem | F | não reexecutada |
| 27 | 20/11 19:55 | 44806626120 | 136532210382 | 1 | pull_request | creditos-eneias (#100) | 2fe53ef | – | idem | F | push novo |
| 28 | 20/11 20:23 | 44810950202 | 136547032919 | 1 | pull_request | docs-apk-046 (#102) | e33ee5e | – | idem | F | T2 passou |
| 29 | 20/11 20:51 | 44815163903 | 136561482397 | 1 | pull_request | gravador-parar-com-limite (#103) | e3a97ab | – | rastro: `guardando 12756 bytes` → `o armazenamento demorou demais para guardar`; alerta na tela | F | push novo |
| 30 | 20/11 21:30 | 44820844760 | 136581048187 | 1 | pull_request | gravador-em-segundo-plano (#104) | 11b576c | 157.0.8103.78 | idem (já guardando `ArrayBuffer`) | F | push novo |
| 31 | 21/11 01:03 | 44847823816 | 136671761671 | 1 | pull_request | afinador-play-centralizado (#105) | e780287 | 157.0.8103.78 | rastro: `bytes lidos em 1 ms; abrindo o armazenamento` → silêncio → `demorou demais` | F | T2 passou |
| 32 | 21/11 01:11 | 44848672787 | 136674566065 | 1 | push | main (#105) | af09a87 | 157.0.8103.78 | idem | F | não reexecutada |
| 33 | 21/11 13:08 | 44907365340 | 136855768035 | 1 | pull_request | metronomo-compassos-simples-compostos (#112) | 94b5f28 | 157.0.8103.78 | idem | F | reexecutada |
| 34 | 21/11 13:12 | 44907365340 | 136856626954 | 2 | pull_request | metronomo-compassos-simples-compostos (#112) | 94b5f28 | 157.0.8103.78 | idem | F | T2 vermelha; o push seguinte (994ffdd, exec. 44908996704) passou |
| 35 | 21/11 13:16 | 44907999651 | 136857600697 | 1 | pull_request | gravacoes-reabrir-sem-resposta (#113) | f6ba192 | 157.0.8103.78 | `FALHOU Gravador: começa parado ... erro:true`; `sem resposta ao abrir (tentativa 1, 2 e 3 de 3)`; `o armazenamento não respondeu ao abrir` | F | o push seguinte (cdcfb48, exec. 44908589027) passou |

Em **todas** as 29 falhas do Gravador vem depois `erro no teste: ... TypeError: Cannot re...` (FATO). É consequência:
o passo seguinte faz `document.querySelector('.gravacao-item .ouvir').click()` (`tests/e2e/karaoke.mjs`, logo depois de
"ao parar entrega a gravação") num item que não existe, e a exceção **encerra o e2e inteiro**. O resto (Metrônomo, Ajustes)
não roda nessas execuções.

## 3. Por categoria

### A. Teste desatualizado: 0 falhas no CI (erro nosso, evitado)

- FATO: nenhuma falha vermelha teve essa causa. Nos commits em que o app mudou de propósito, o e2e foi ajustado **no mesmo
  commit**:

| Commit | O que mudou no app | O que mudou no e2e |
|---|---|---|
| 98efd97 | abas na tela inicial (Hinos, Afinador) | lista exata de abas |
| 0d57f66 | aba Gravador | lista de abas vira `aba-hinos,aba-afinador,aba-gravador` |
| fe32358 | aba Metrônomo | lista de abas ganha `aba-metronomo` |
| 49457f8 / e0dd68a | compassos do metrônomo (4 → 9 → 6 botões) | `antesMet.botoes === 9`, depois `=== 6` |
| 9857cd0 | Play da "Outra nota" vira pílula | seletor `.grande` vira `:is(.grande, .tocar-pilula)` |
| 3c8ce6e | botão da aba Partitura leva direto às partituras | `href` esperado |
| 6ee400a | slider do miniplayer no topo | posição do slider |

- Risco que continua (FATO, `docs/roadmap-ideas.md` linha ~220): o e2e confere a **lista exata** de abas e números exatos
  de botões. Qualquer aba ou botão novo quebra o teste se o commit esquecer de atualizá-lo.

### B. Teste frágil: 3 falhas (erro nosso)

- Falhas 3, 4 e 5 (15/11, 16/11, 17/11). FATO (log do job 132892789898): `trocas: 25 re | 700 mi | ...`: a 1ª sílaba
  ("do") não foi vista, e daí vêm as 3 mensagens (ordem, estrofe, desvio de 2000 ms).
- Causa (FATO, reproduzida e descrita na #63 / commit 1c56345): o teste tocava o hino, dormia 500 ms + 300 ms, conferia um
  botão e **só então** começava a amostrar; a 1ª sílaba dura 1 s, então a folga era de ~0,3 s. No runner mais lento a
  amostragem começava depois do "do".
- Correção: #63 (merge 17/11 17:07). Começa a amostrar **antes** de tocar. Resolveu: FATO, nenhuma linha `FALHOU sílabas`
  em nenhum log depois de 17/11 17:07 (113 jobs do e2e verdes desde então, e as 29 vermelhas são todas do Gravador).
- Como evitar: nunca medir um evento que começa num tempo fixo depois de uma espera fixa; ancorar no estado observado.

### C. Bug real do app: 1 falha (erro nosso, pego pelo CI, não pelo e2e)

- Falha 6. FATO (job 134910696813): `tools/verificar-movimento.py` acusou `transform:` e `transition:` em
  `src/lib/Gravador.svelte:387`. Corrigido no próprio #77 (commit "barra do medidor sem transform nem transition no
  componente"); o PR passou depois.
- Efeito colateral útil das falhas F (FATO): o e2e mostrou que o **app ficava mudo** quando o IndexedDB não respondia (a
  lista e o Gravador esperavam para sempre, sem erro). Isso foi corrigido no app (#103: limites de 4 s e 10 s; #113:
  limite por tentativa de abrir). Não conta como falha à parte: são as mesmas 29 da categoria F.

### D. Ambiente/CI: 0 confirmadas

- O **sintoma** das 29 falhas do Gravador é de ambiente (FATO: nunca falhou na máquina local, que tem Chrome 157.0.8103.38;
  só no runner, Chrome 157.0.8103.78). Mas não está provado que a causa não é nossa (ver F, hipótese H1). Por isso não
  foram contadas aqui.

### E. Infraestrutura do script: 2 falhas (erro nosso)

- Falhas 1 e 2 (15/11 12:53 e 12:56). FATO: todos os testes deram `ok` e `E2E do karaokê: OK`, e depois
  `Error: ENOTEMPTY: directory not empty, rmdir '/tmp/bmccb-e2e-.../Default'` em `limpar` (`karaoke.mjs:67`).
- Causa (FATO, commit ff8e78f): o perfil era apagado enquanto processos filhos do Chrome ainda escreviam nele.
- Correção: #3 (ff8e78f e 39d026b, merge 15/11 14:03): Chrome e Vite em grupo de processos próprio, encerrados juntos
  (SIGTERM e depois SIGKILL), espera o grupo esvaziar, e erro ao apagar a pasta só avisa. Resolveu: FATO, nenhum
  `ENOTEMPTY` nem `aviso: não deu para apagar` em nenhum log depois.

### F. Não determinado: 29 falhas (o problema aberto)

O que é FATO:

1. Todas no bloco do Gravador, o único que grava no IndexedDB. Nenhuma no karaokê, partitura, Afinador, Ajustes ou
   Metrônomo depois de 17/11.
2. Com espera fixa de 900 ms (até #91) e com espera de até 10 s (#91 em diante), o resultado é o mesmo: não era pressa.
3. Com o rastro da #103 (falha 29): o gravador para e entrega os bytes; o passo de **guardar** não termina em 10 s.
4. Com `ArrayBuffer` no lugar de `Blob` (afd73cf, #103) a falha continuou (falhas 30 a 35). Logo o `put` do Blob **não**
   era a causa.
5. Com o rastro da #104 (falhas 31 a 34): `bytes lidos em 1 ms; abrindo o armazenamento` e depois nada; nunca aparece
   `armazenamento pronto`. O travamento é no `indexedDB.open()`.
6. Com a #113 (falha 35, commit f6ba192): a lista já começa com erro (`começa parado ... erro:true`) e as **3 tentativas**
   de abrir ficam mudas. O `open()` do banco do app (`bmccb-gravacoes`) fica sem resposta durante a execução inteira.
7. Mesma versão do Chrome nas verdes e nas vermelhas: 157.0.8103.78 em todos os 30 logs que a imprimem.
8. Distribuição por nuvem do runner (cabeçalho do log, `Cloud:`), jobs com o teste do Gravador:

| Nuvem | Imagem | Verdes | Vermelhos no Gravador | Taxa |
|---|---|---|---|---|
| Azure | 20261111.370.1 e 20261116.376.1 | 39 | 21 | 35% |
| AWS | 20261111.127.1 e 20261116.133.1 | 60 | 8 | 12% |
| Só 20 e 21/11, Azure 20261116.376.1 | | 17 | 14 | 45% |
| Só 20 e 21/11, AWS 20261116.133.1 | | 38 | 7 | 16% |

9. Começo: 0 falhas em 24 jobs com o Gravador no e2e antes do merge da #77; a 1ª falha é o push da #77 na main. A #77 não
   mexeu em `karaoke.mjs` nem em `gravacoes.ts` (mexeu em `Gravador.svelte`, `ItemGravacao.svelte`, `gravador.ts`,
   `compartilhar.ts`).
10. Desde a #113 com a sonda (cdcfb48): 4 jobs, 4 verdes, e **nenhum** `AVISO: este Chrome subiu com o IndexedDB sem
    resposta`. A sonda ainda não foi posta à prova numa falha.

O que é INFERÊNCIA (forte):

- As 29 são a mesma falha: o mesmo passo, o mesmo estado (`itens:0, ativos:0`), e o rastro, quando existiu, sempre parou no
  `open()`. As primeiras, sem rastro, também tinham `erro:false` no começo porque, antes da #113, a lista esperava o
  `open()` sem limite (não mostrava erro).
- As novas tentativas da #113 não podiam funcionar: pela especificação do IndexedDB, cada `open()` do mesmo banco entra na
  **fila de conexões** daquele nome e espera os pedidos anteriores. Se o 1º está preso, os seguintes ficam atrás dele.
- **A sonda da #113 pode não pegar o caso real**: ela abre `__sonda_e2e`, outro nome, que tem outra fila. Se o que trava é
  a fila de `bmccb-gravacoes`, a sonda passa e o Gravador falha igual.
- O runner mais lento (Azure) aumenta a chance. Não é a versão do Chrome (a mesma nas verdes e vermelhas).

O que é HIPÓTESE (causa raiz; ver seção 5):

- **H1 (seria erro nosso, B):** o teste navega para outra página logo depois da 1ª visita a `/`. Em `/` o `Gravador.svelte`
  monta e chama `carregarLista()` no `onMount`, o que faz o 1º `open()` de `bmccb-gravacoes`, com a criação do banco
  (`onupgradeneeded`). Se a página sai no meio dessa criação, e fica congelada no cache de voltar/avançar (bfcache) com a
  transação de versão em curso, os `open()` das páginas seguintes ficam na fila para sempre. Em `karaoke.mjs` isso
  acontece na tela inicial (logo do app) seguida de `/ajustes`; desde a #113, também na própria sonda (`/` e, ~1,5 s
  depois, `/hino/999`).
- **H2 (D):** o perfil em `/tmp` (LevelDB) ou `/dev/shm` pequeno no runner travam o armazenamento do Chrome.
- **H3 (D):** diferença de build do Chrome (8103.78 no CI e 8103.38 na máquina local).
- **H4 (F):** algo que entrou com a #77 mudou o tempo de carga da tela inicial e abriu a janela da corrida da H1.

O que falta para decidir: o log do Chrome (hoje `stdio: "ignore"`), o rastro do 1º `open()` (o gancho `__avisos` só é
instalado quando o teste entra na aba Gravador, depois do 1º `open()`), a lista de bancos (`indexedDB.databases()`)
no momento da falha e os testes da seção 5.

## 4. Linha do tempo das correções

| Quando (merge, UTC) | PR / commits | O que mudou | Resolveu? |
|---|---|---|---|
| 15/11 14:03 | #3 (ff8e78f, 39d026b) | encerra o grupo de processos do Chrome e do Vite, espera esvaziar, falha ao apagar o perfil só avisa | **Sim** (E) |
| 15/11 22:23 | #14 (45655a3, 60d736a) | pausa do karaokê ancorada no estado observado | sem falha antes; prevenção |
| 17/11 17:07 | #63 (1c56345) | amostra o destaque antes de tocar | **Sim** (B) |
| 19/11 02:08 | #77 (8e049c6) | corrige a regra de movimento no `Gravador.svelte` | **Sim** (C) |
| 19/11 20:25 | #80 (30726ae) | retries e limite de tempo no `apt` do job Leitor | sim para o Leitor (fora do e2e; na exec. 44436715272 o Leitor foi cancelado 3 vezes no passo "Dependências do Tauri no Linux", de 6 a 14 min cada) |
| 20/11 14:40 | #91 (c52a198, b0d7372) | espera a gravação aparecer (até 10 s) em vez de 900 ms; mostra a tela no estouro | **Não**: provou que não era pressa |
| 20/11 21:09 | #103 (e3a97ab, afd73cf) | limites de 4 s (parar) e 10 s (guardar); `ArrayBuffer` no lugar de `Blob`; rastro no console e despejo no log; versão do Chrome no log | **Não**: localizou o passo (guardar); o `ArrayBuffer` não mudou nada; o app deixou de ficar mudo |
| 20/11 23:55 | #104 (ab3cc33) | rastro na leitura e na abertura do armazenamento | **Não**: localizou o `open()` |
| 21/11 13:27 | #113 (f6ba192, cdcfb48) | limite de 3 s por tentativa de abrir e até 3 tentativas; sonda de IndexedDB que descarta o Chrome e sobe outro | **Em aberto**: 4 verdes depois, amostra pequena; as tentativas ficam na mesma fila (inferência) e a sonda abre outro banco |

Correções no rascunho anterior (`e2e-falhas.md`): a espera de até 10 s veio da **#91**, não da #98; o histórico tem 35 jobs
vermelhos em 30 execuções, não 15 (8 ficaram escondidos por reexecução e 2 em execuções canceladas); o rascunho não tinha
a falha do job App, a diferença entre Azure e AWS nem a fila de conexões do IndexedDB.

## 5. O que está aberto e o que testar (do mais barato ao mais caro)

Referência para dizer que funcionou: hoje o Gravador falha em ~28% dos jobs (35% no Azure). Com essa taxa, 10 jobs verdes
seguidos acontecem por acaso em ~4% das vezes e 20 em ~0,1%. Contar só jobs que rodaram o bloco do Gravador e anotar a
nuvem (`Cloud:` no cabeçalho do log).

| # | Hipótese / ação | Custo | Como testar | Como saber se funcionou |
|---|---|---|---|---|
| 1 | Diagnóstico melhor (não corrige nada) | baixo, só o e2e | gancho de `console.debug/warn` via `Page.addScriptToEvaluateOnNewDocument` (pega o 1º `open()`); na falha, despejar `indexedDB.databases()` e `IndexedDB.requestDatabaseNames` (CDP); Chrome com `--enable-logging=stderr --v=0` e o stderr salvo como artefato do job | a próxima falha mostra se o 1º `open()` de `bmccb-gravacoes` começou numa página que saiu antes de `banco aberto` |
| 2 | Sonda no banco certo | baixo, só o e2e | a sonda passa a abrir `bmccb-gravacoes` (com a mesma versão do app) **depois** de uma ida e volta de navegação, não `__sonda_e2e` | se uma falha acontece, ela é pega pela sonda (`AVISO: ... tentativa N`), e não pelo teste do Gravador |
| 3 | H1, bfcache | baixo, 1 opção do Chrome | rodar com `--disable-features=BackForwardCache`; pode ser em PR de teste com reexecuções | 20 jobs seguidos sem falha no Gravador, pelo menos 10 deles no Azure |
| 4 | H1, corrida da 1ª abertura | baixo, só o e2e | antes de sair de `/` pela 1ª vez, esperar a lista do Gravador terminar de carregar (ou `indexedDB.databases()` listar `bmccb-gravacoes`) | igual ao 3; se o 3 e o 4 resolvem e o 1 mostra a página saindo no meio, a causa é nossa (B) |
| 5 | H1 na máquina | médio, local | `Emulation.setCPUThrottlingRate` 4x a 6x e navegar para fora de `/` 50, 100, 200 ... ms depois da carga, 20 vezes cada; depois tentar abrir `bmccb-gravacoes` | reproduzir o `open()` mudo localmente fecha a questão |
| 6 | H2, perfil e memória | baixo | perfil em `$RUNNER_TEMP` ou dentro do repositório no lugar de `/tmp`; `--disable-dev-shm-usage` | igual ao 3 |
| 7 | H3, versão do Chrome | médio | instalar Chrome for Testing 157.0.8103.38 no job (`CHROME=...`) | igual ao 3; se resolver só com a versão, é D |
| 8 | H4, #77 | médio | rodar o e2e de 8e049c6~1 e de 8e049c6 várias vezes por `workflow_dispatch` (num ramo de teste) | diferença clara de taxa entre os dois |
| 9 | Estatística direta | alto (minutos de CI) | job manual com matriz de 10 a 20 repetições do e2e | taxa por nuvem antes e depois de cada mudança |

## 6. Recomendações de mudança (propostas, não aplicadas)

`tests/e2e/karaoke.mjs`:

1. **Sonda no banco do app** (`bmccb-gravacoes`, mesma versão), e não em `__sonda_e2e`. Motivo: a fila de `open()` é por
   nome; a sonda atual não vê a fila que trava.
2. **Esperar a 1ª abertura terminar antes de navegar para fora de `/`** (na sonda e na tela inicial). Motivo: H1; e é a
   mesma regra que já resolveu a categoria B (ancorar no estado, não no tempo).
3. **Se as 3 tentativas da sonda falharem, parar com mensagem clara** ("ambiente sem IndexedDB") em vez de seguir com o
   Chrome quebrado. Motivo: hoje o laço termina e o teste segue com a última sessão ruim.
4. **Não deixar uma falha derrubar o resto**: `?.click()` em `.gravacao-item .ouvir` (e nos outros cliques do Gravador).
   Motivo: o `TypeError` encerra o e2e e esconde o Metrônomo e os Ajustes em 29 execuções.
5. **Instalar o gancho de `console` com `Page.addScriptToEvaluateOnNewDocument`** junto do `STUB`. Motivo: hoje o rastro
   do 1º `open()` se perde.
6. **Não cortar a mensagem do erro em 300 caracteres** em `av()` (hoje sai `TypeError: Cannot re`). Motivo: diagnóstico.
7. **Guardar o stderr do Chrome** (`--enable-logging=stderr`) num arquivo e subi-lo como artefato quando falhar.
8. Trocar os `dormir()` fixos que esperam estado (ex.: `dormir(7000)` da 1ª compilação do Vite, `dormir(900)` no
   Afinador) por esperas de condição. Motivo: categoria B; o runner Azure é mais lento.
9. Conferir abas e botões por presença (`includes`) quando a ordem não for o que se testa. Motivo: categoria A.

`.github/workflows/ci.yml`:

1. `--disable-features=BackForwardCache` (pelo `karaoke.mjs`) se o teste 3 da seção 5 confirmar.
2. Passo `if: failure()` com `actions/upload-artifact` do log do Chrome e do rastro. Motivo: hoje só existe o que cabe no
   log do job.
3. Imprimir `nproc`, `free -m` e `df -h /tmp /dev/shm` antes do e2e. Motivo: comparar runner lento e rápido.
4. Só se nada acima resolver: fixar o Chrome (Chrome for Testing) na versão da máquina local.
5. Não reexecutar no automático (retry do job). Motivo: esconde a taxa; 8 execuções já ficaram verdes assim.

## 7. Como ler uma falha nova

1. Ache o job: `gh run view <exec> --json jobs` ou `gh api repos/HyakoV3/biblioteca-musical-ccb/actions/runs/<exec>/jobs?filter=all`
   (o `filter=all` mostra também as tentativas antigas).
2. Baixe o log: `gh api repos/HyakoV3/biblioteca-musical-ccb/actions/jobs/<job>/logs` (o `--log-failed` vem vazio em
   execuções antigas).
3. No cabeçalho, anote `Cloud:` (AWS ou Azure) e a versão da imagem; mais abaixo, `Chrome: Chrome/...`.
4. Procure `FALHOU`, `erro no teste`, `ENOTEMPTY`, `AVISO: este Chrome`:

| O que aparece | Categoria provável | Próximo passo |
|---|---|---|
| todos `ok`, `E2E do karaokê: OK` e erro depois (limpeza, porta, processo) | E | ver `limpar()` e os processos filhos |
| `FALHOU` num teste que mexe em algo que o commit mudou de propósito (abas, textos, botões) | A | atualizar o teste no mesmo PR |
| `FALHOU` com tempo (desvio, ordem, "não apareceu") que passa ao reexecutar e não é do Gravador | B | achar a espera fixa e ancorar no estado |
| `FALHOU Gravador` com `armazenamento: sem resposta ao abrir` ou `AVISO: este Chrome subiu com o IndexedDB sem resposta` | F (a falha aberta) | registrar na tabela da seção 2 com a nuvem e seguir a seção 5 |
| `FALHOU` que também falha na máquina (`npm run test:e2e`) | C | é bug do app: corrigir o app |
| falha num job que não é o e2e (App, Rust) | ver o passo vermelho | – |

5. Antes de reexecutar, anote a falha (data, execução, job, nuvem, mensagem). Reexecutar sem anotar apaga a estatística.
6. Ignore o `TypeError: Cannot re...` depois de um `FALHOU Gravador`: é consequência (item 4 da seção 6).


## 8. Mudanças aplicadas em 2026-11-21 (itens 1 a 3 da seção 5)

Feitas no `tests/e2e/karaoke.mjs` na mesma PR deste documento; **ainda não provam nada**: só a taxa de falha dos próximos jobs (20 verdes seguidos, 10 deles no Azure) vai dizer se resolveram.

| Item | O que mudou |
|---|---|
| 1. Diagnóstico | O gancho de `console.debug/warn` agora é instalado em **todo documento novo** (`Page.addScriptToEvaluateOnNewDocument`), então o rastro pega a 1ª abertura do banco (a que acontece quando a tela inicial monta). O despejo da falha do Gravador ganhou `indexedDB.databases()` (campo `bancos`). O aviso da sonda imprime os últimos 12 registros do rastro. |
| 2. Sonda no banco certo | A sonda **não abre banco nenhum** (abrir `bmccb-gravacoes` com outra versão ou sem as tabelas estragaria o app): espera o banco do **app** aparecer em `indexedDB.databases()` (até 10 s), o que só acontece depois de a abertura dele terminar. Se não aparece, o Chrome é descartado e outro sobe (até 3). Isso também faz o teste **esperar a 1ª abertura terminar antes de sair da tela inicial** (item 4 da seção 5, no mesmo gesto). |
| 3. Sem cache de voltar/avançar | Chrome sobe com `--disable-features=BackForwardCache` (hipótese H1). |
| Efeito colateral do `TypeError` | Os cliques e leituras em itens da lista (`.gravacao-item .ouvir` e `.apagar`) viraram `?.`: quando o Gravador falha, o teste seguinte falha com a própria mensagem em vez de derrubar o script, e o Metrônomo e os Ajustes continuam rodando. |

Conferido na máquina: o e2e passa; com `BMCCB_E2E_FORCAR_REINICIO=1` a sonda falha na 1ª tentativa, o Chrome é descartado e o 2º sobe (o rastro do aviso mostra "criando o banco" e "banco aberto" desde o 1º documento).
