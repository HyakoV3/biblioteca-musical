# Ideias implementadas (sumário)

Este arquivo é um **sumário**: diz o que cada ideia concluída virou e **aponta para os arquivos onde o implementado está
descrito** (documentos, código, testes e PRs). Ele não repete esses detalhes.

- O **texto original** de cada ideia (pedido, perguntas, decisões, o que se descobriu) está em
  [`ideias-implementadas.md`](ideias-implementadas.md), movido sem alterações em 2026-11-16.
- O que **ficou pendente** dentro de cada ideia (ver no celular, perguntas que dependem do responsável) está na seção 7 de
  [`../roadmap-pendencias.md`](../roadmap-pendencias.md).
- As ideias **ainda abertas** estão em [`../roadmap-ideas.md`](../roadmap-ideas.md).
- Os números dos PRs são os de `HyakoV3/biblioteca-musical-ccb`. Onde não há PR numerado, a ideia veio antes dos PRs ou dentro do
  trabalho de outra.

| Ideia | O que é | Situação | Onde está o implementado |
|---|---|---|---|
| **I-01** | Tocar o hino com a passada do final | feita, a ouvir com o hino 457 | [`../FORMATO.md`](../FORMATO.md) (passadas e final), `tools/mscx2json`, `src/lib/vezes.ts` |
| **I-02** | Estilo de cor Pergaminho | feita, a ver no celular | [`../design-tokens.md`](../design-tokens.md), `src/lib/tema.css`, PR #4 |
| **I-04** | Tamanho e alinhamento da letra | feita, a ver no celular | `src/lib/leitura.ts`, aba Letra, PR #18 |
| **I-05** | Arquivo de correções para a letra | feita, a usar nos hinos reais | [`../correcoes-da-letra.md`](../correcoes-da-letra.md), `tools/mscx2json/src/correcoes.rs`, `tools/mscx2json/README.md` |
| **I-06** | Modo de baixa visão (preto sobre amarelo bem claro) | feita, a ver no celular e com quem tem baixa visão | [`../design-tokens.md`](../design-tokens.md), `src/lib/tema.css`, `tools/contraste.py`, `tests/estilos.test.ts` |
| **I-07** | Sons de instrumentos mais realistas | feita (pacote opcional) | [`../pacote-de-sons.md`](../pacote-de-sons.md), [`../licencas-de-terceiros.md`](../licencas-de-terceiros.md), PRs #10, #11, #16 |
| **I-09** | Mostrar em que parte do hino se está | feita, a ver no aparelho | `src/lib/Player.svelte`, `src/lib/vezes.ts` |
| **I-10** | Trocar instrumento, andamento e tom na pausa | feita, a ver no aparelho | `src/lib/reproducao.svelte.ts`, `src/lib/sintetizador.ts` |
| **I-11** | Ícones em SVG local | feita | `src/lib/Icone.svelte`, `src/lib/icones.json`, `tools/gerar-icones.mjs` |
| **I-12 (fase A)** | Karaokê na letra | feita, a ver no aparelho | [`../FORMATO.md`](../FORMATO.md) (`sincronia`), `src/lib/karaoke.ts`, `tests/e2e/karaoke.mjs` |
| **I-14** | Estilo de cor Marinho e ouro | feita, a ver no celular | [`../design-tokens.md`](../design-tokens.md), `src/lib/tema.css`, PR #4 |
| **I-15** | Timbres sintetizados mais parecidos | feita, aprovada de ouvido em parte | `src/lib/timbres.ts`, `tools/analisar-timbres.py`, PRs #2, #6, #7 |
| **I-21** | Slider do miniplayer em cima (embaixo, confundia com as abas) | feita, a ver no celular | `src/lib/Miniplayer.svelte`, `tests/e2e/karaoke.mjs`, PR #27 |
| **I-08** | Partitura no hino (aba Partitura, pacotes de partituras) | feita e testada no celular (pacotes 003 a 005) | [`../pacote-de-partituras.md`](../pacote-de-partituras.md), [`../FORMATO.md`](../FORMATO.md), `tools/gerar-partituras.py`, `tools/montar-pacote.py`, `src-tauri/src/svg.rs`, `src/lib/Partitura.svelte` |
| **I-12 (fase B)** | Karaokê na partitura: o compasso que toca | feita e testada no celular | [`../FORMATO.md`](../FORMATO.md) (`compassos`), `src/lib/compassos.ts`, `src/lib/Partitura.svelte`, PRs #52 e #54 |
| **I-13** | Afinador, etapa 1 (dar o tom) | feita; **a etapa 2 (ouvir e medir) segue aberta na I-32** | `src/lib/Afinador.svelte`, `src/lib/afinador.ts`, `src/lib/contagem.ts`, [`../FORMATO.md`](../FORMATO.md) (tonalidade), PRs #66 e #67 |
| **I-19** | Organizar como os hinos aparecem na letra | feita; faltam o negrito (I-33) e 4 hinos | [`../FORMATO.md`](../FORMATO.md), `tools/mscx2json/README.md`, `src/lib/letra.ts`, PRs #92 e #96 |
| **I-22** | Continuar tocando com a tela bloqueada | feita e confirmada no celular (APK 030) | `ServicoAudio.kt`, `PonteServico.kt`, `src/lib/servico.ts`, PR #68 |
| **I-24** | Ajustes em cartões, com o cartão Conteúdo | feita | `src/lib/Cartao.svelte`, `src/lib/LinhaPacote.svelte`, `src/routes/ajustes/+page.svelte` |
| **I-26** | Karaokê na partitura por nota | feita e testada no celular (APK 044 e 045) | [`../FORMATO.md`](../FORMATO.md) ("Notas na partitura"), `src/lib/notas.ts`, `src/lib/Partitura.svelte`, `tools/gerar-partituras.py`, `tests/e2e/karaoke.mjs`, PRs #82, #86, #88 a #95 |
| **I-28** | Abas na tela inicial (Hinos, Afinador, Gravador) | feita | `src/lib/Abas.svelte`, `src/routes/+page.svelte` |

---

## I-01 — Tocar o hino com a passada do final
- **O que virou:** o conversor reconhece o padrão do hino 457 (duas casas de volta e um trecho "Final") e gera `vozes`, `final` e
  `introducao`. O player tem "Tocar o hino todo" (com pausa de 2 s entre as partes) e botões Intro, 1ª, 2ª e a última com
  bandeira de final.
- **Onde:** [`../FORMATO.md`](../FORMATO.md) (seção "Passadas e final"), `tools/mscx2json/src/main.rs` (`introducao` e o aviso
  "estrutura não reconhecida"), `src-tauri/src/hinario.rs`, `src/lib/vezes.ts`, `src/lib/rotulo-vez.ts`, `src/lib/Player.svelte`,
  `tests/vezes.test.ts`.
- **Pendente:** ouvir o 457; outras estruturas (três casas, D.C., coda) precisam de amostra real; ligadura que atravessa o corte.
  Ver [`../roadmap-pendencias.md`](../roadmap-pendencias.md), seção 7.

## I-02 e I-14 — Estilos de cor (Pergaminho, Marinho e ouro)
- **O que virou:** em Ajustes, Aparência, há **Modo** (Automático, Claro, Escuro) e **Estilo** (Normal, Pergaminho, Marinho e
  ouro): seis paletas, aplicadas ao app inteiro e antes da primeira pintura.
- **Onde:** `src/lib/estilos.ts`, `src/lib/tema.css`, `src/lib/tema.svelte.ts`, `src/app.html`, `src/routes/ajustes/+page.svelte`,
  `tools/contraste.py` (confere o contraste de cada par de cores nos seis temas), `tests/estilos.test.ts`,
  [`../design-tokens.md`](../design-tokens.md), prévias em `design/identidade/`. **PR #4.**
- **Pendente:** ver no celular; o quanto o pergaminho é amarelado e os nomes nos três idiomas.

## I-04 — Tamanho e alinhamento da letra
- **O que virou:** barra no topo da aba Letra com `A−`, `A` (restaurar) e `A+` (6 passos, de 85% a 160%, somando com a fonte do
  sistema) e alinhar à esquerda, à direita ou justificar. A escolha vale para todos os hinos e fica no aparelho.
- **Onde:** `src/lib/leitura.ts` (regras puras), `src/lib/preferencias.ts` (`prefs.letra`), `src/routes/hino/[numero]/+page.svelte`,
  ícones de alinhamento em `tools/gerar-icones.mjs`, `tests/leitura.test.ts` e o e2e do karaokê. **PR #18.**
- **Pendente:** ver no celular; o justificado abre espaços largos nos versos que quebram (ver com hinos reais); alinhamento à
  direita para idiomas da direita para a esquerda.

## I-07 — Sons de instrumentos mais realistas
- **O que virou:** a síntese continua o som padrão, e os sons **gravados** são um pacote **opcional** baixado em Ajustes, com
  conferência de SHA-256, armazenamento no aparelho (uso offline) e alternador Sintetizado | Gravado por voz. **O banco foi
  trocado depois do texto original:** de FluidR3_GM para **GeneralUser GS** (PR #11), com o ganho de cada instrumento
  recalculado para o mesmo nível médio no ouvido.
- **Onde:** [`../pacote-de-sons.md`](../pacote-de-sons.md) (divisão, hospedagem, troca do banco, como gerar),
  [`../licencas-de-terceiros.md`](../licencas-de-terceiros.md), `src/lib/sons/`, `src/lib/realista.ts` (`ganho`),
  `tools/preparar-sons.py`, `tools/renderizar-banco.mjs`, `tools/montar-manifesto-sons.py`, `tools/analisar-timbres.py`
  (`--calibrar`), `tests/realista.test.ts`, `tests/sons-extrair.test.ts`. **PRs #9, #10, #11, #16.**
- **Pendente:** hospedagem em GitHub Releases; flugelhorn e bombardino gravados (nenhum banco livre os tem); registrar o teste de
  baixar, instalar e remover.

## I-09 — Mostrar em que parte do hino se está
- **O que virou:** o botão da parte que soa (Intro, 1ª, 2ª...) fica em destaque dourado e **enche de dourado com o tempo**, também
  no "hino todo" e com um ícone de nota (a informação não depende só da cor); o miniplayer diz a parte que soa.
- **Onde:** `src/lib/Player.svelte`, `src/lib/Miniplayer.svelte`, `src/lib/vezes.ts`, `src/lib/reproducao.svelte.ts`
  (`parteTocando`), `tests/vezes.test.ts`.
- **Pendente:** ver no aparelho.

## I-10 — Trocar instrumento, andamento e tom na pausa
- **O que virou:** com a música pausada, o instrumento, o andamento e o tom podem mudar, e ao continuar o som é reagendado a
  partir da batida em que parou. Tocando, esses controles ficam travados.
- **Onde:** `src/lib/reproducao.svelte.ts` (`continuar` e `reagendar`), `src/lib/sintetizador.ts` (`notasAPartirDe`),
  `src/lib/Player.svelte`, `tests/sintetizador.test.ts`. (O mesmo `reagendar` serve ao slider de avançar e retroceder, PR #17.)
- **Pendente:** ver no aparelho; a pergunta de trocar o instrumento **tocando**.

## I-11 — Ícones em SVG local
- **O que virou:** nenhum emoji ou símbolo de ícone na interface: um conjunto local do Google Material Icons (Apache 2.0), hoje com
  **20 ícones (4,4 KB)**, gerado por script, sem usar rede em tempo de uso. Os tamanhos são em `rem`.
- **Onde:** `src/lib/Icone.svelte`, `src/lib/icones.ts`, `src/lib/icones.json`, `tools/gerar-icones.mjs`,
  [`../licencas-de-terceiros.md`](../licencas-de-terceiros.md), prévia em `design/icones/`.
- **Pendente:** nada de função.

## I-12 (fase A) — Karaokê na letra
- **O que virou:** na aba Letra, de hinos que trazem a sincronia, a estrofe, a linha e a sílaba que soa acendem e a tela rola até
  a linha; botão de microfone no cabeçalho (ligado por padrão, lembrado). A pausa congela o destaque. A **fase B** (partitura) está
  mais abaixo, junto da I-26.
- **Onde:** [`../FORMATO.md`](../FORMATO.md) (campo `sincronia`), `tools/mscx2json/src/main.rs`, `src/lib/karaoke.ts`,
  `src/routes/hino/[numero]/+page.svelte`, `src/lib/sintetizador.ts` (`audivel`, que compensa a latência da saída),
  `tests/karaoke.test.ts` e `tests/e2e/karaoke.mjs` (o teste de ponta a ponta no Chrome; PRs #3 e #14).
- **Pendente:** ver no aparelho; mudar o andamento na pausa e manter o lugar do karaokê não tem teste automatizado.

## I-15 — Timbres sintetizados mais parecidos
- **O que virou:** os **14 instrumentos que têm gravado de referência** têm o timbre medido por altura nas amostras (tabela de
  harmônicos, filtro de brilho nos metais), e o flugelhorn e o bombardino, sem gravado, são **misturas 50/50 de instrumentos
  medidos**. O volume de cada nota foi corrigido para o mesmo volume eficaz de antes. A distância espectral à gravação caiu, em
  média, de 9,3 para 1,6 dB. (O `timbres.json` tem hoje **56 KB**, não os 28 KB do texto original.)
- **Onde:** `src/lib/timbres.ts`, `src/lib/timbres.json`, `src/lib/sintetizador.ts` (`agendarNota`), `tools/analisar-timbres.py`,
  `tools/previas-timbres.mjs` (prévias em MP3), `tests/timbres.test.ts`. **PRs #2, #6, #7.**
- **Pendente:** ouvir os sintéticos novos de flauta doce, violino, clarinete, viola, violoncelo, contrabaixo e trompa; o teste
  cego com o gravado; 4 vozes de metal no celular (custo do filtro por nota).

## I-08 — Partitura no hino
- **O que virou:** uma aba **Partitura** nos hinos que têm partitura, com zoom, nos três temas, em duas versões do mesmo desenho (retrato e paisagem, que segue a tela). As partituras
  vêm num **pacote `.zip` à parte** (`partituras-NNN.zip`), baixado em Ajustes; o Rust confere e **limpa cada SVG** antes de mostrar. O gerador usa o MuseScore (`.mscx` para MusicXML) e o
  Verovio (MusicXML para SVG). Pacotes: 003 (5 hinos), 004 e 005 (os 480).
- **Onde:** [`../pacote-de-partituras.md`](../pacote-de-partituras.md), [`../FORMATO.md`](../FORMATO.md), `tools/gerar-partituras.py`, `tools/montar-pacote.py`, `tools/montar-manifesto-partituras.py`, `src-tauri/src/svg.rs`,
  `src/lib/Partitura.svelte`, `src/lib/partitura.ts`.
- **Pendente:** a **autorização do Enéias** para publicar os pacotes; a marca de andamento do autor sai do SVG no pacote 006; as partituras dos coros 1 a 6 não foram convertidas.

## I-12 (fase B) e I-26 — Karaokê na partitura
- **O que virou:** com o karaokê ligado (o mesmo botão da letra) o **compasso que toca** fica com a barra dourada à esquerda e a partitura rola até ele; cada **nota e pausa que soa** ganha um halo
  dourado atrás (todas as vozes, a pausa também, o enfeite não); a **ligadura** leva uma faixa dourada de 0,6 rem atrás da curva, o traço fino por cima e um ponto brilhante que correm da esquerda
  para a direita enquanto a 1ª nota soa, e a 2ª nota acende no tempo dela. O tempo vai **dentro do SVG** (`data-t` e `data-f` em cada nota, pausa e curva), sem arquivo novo. Sem esses atributos
  (pacote antigo) o app cai no destaque por compasso. Nesse caminho saíram também a **introdução até o fim da última nota** (PR #89), o **coro** e o **final** em blocos próprios (I-19) e a correção
  da **ligadura no som** (PR #93: o fim da ligadura do MuseScore 2 não era reconhecido).
- **Onde:** [`../FORMATO.md`](../FORMATO.md) (`compassos`, "Notas na partitura"), `src/lib/compassos.ts`, `src/lib/notas.ts`, `src/lib/Partitura.svelte`, `tools/gerar-partituras.py`, `tools/mscx2json/src/main.rs`,
  `src-tauri/src/svg.rs`, `tests/notas.test.ts`, `tests/e2e/karaoke.mjs`. **PRs #52, #54, #82, #86 e #88 a #95.**
- **Pendente:** nenhum teste automático muda o zoom com a curva acesa (o código refaz a folga, mas só o celular conferiu); o e2e do Gravador falha com frequência no CI (outra frente, I-03).

## I-13 — Afinador, etapa 1 (dar o tom)
- **O que virou:** a aba **Afinador** na tela inicial: o **Lá 440 Hz** num botão largo e **outra nota** (12 notas, oitava), com **temporizador** (até parar, 10, 20 ou 30 s); o tom é sustentado, só um som de
  cada vez, sem volume na tela. O conversor passou a gravar `armadura`, `modo` e `tonalidade`, que aparecem na lista e no cabeçalho do hino. O **"Tom de um hino" foi descartado** pelo responsável.
- **Onde:** `src/lib/Afinador.svelte`, `src/lib/afinador.ts`, `src/lib/contagem.ts`, [`../FORMATO.md`](../FORMATO.md) (tonalidade), `tests/afinador.test.ts`, `tests/contagem.test.ts`. **PRs #66 e #67.**
- **Pendente:** a **etapa 2 (ouvir e medir)**, agora a **I-32** em [`../roadmap-ideas.md`](../roadmap-ideas.md); o Rust ainda não declara `armadura` nem `modo`.

## I-19 — Organizar como os hinos aparecem na letra
- **O que virou:** o conversor quebra a linha só onde começa um verso (regra da maiúscula), conserta sozinho o hífen de pronome e o "~", e separa o **coro** (parágrafo `Coro. ...`, estrofe 0 na sincronia, depois
  da estrofe 1, aceso depois de cada estrofe; 309 hinos) e o **final** (parágrafo `Final. ...` depois da última estrofe, aceso só na última vez; 33 dos 37 hinos com final). O app mostra o subtítulo de cada bloco
  e não os conta como uma vez a mais. Em 2026-11-19 e 20 entrou ainda a regra do refrão com a estrofe trocada.
- **Onde:** [`../FORMATO.md`](../FORMATO.md) ("Como o conversor decide as quebras", "Coro", "Final"), `tools/mscx2json/README.md`, `tools/mscx2json/src/main.rs`, `src/lib/letra.ts`, `src/lib/karaoke.ts`, `tests/letra.test.ts`. **PRs #92 e #96.**
- **Pendente:** o **negrito** do coro e do final, como no hinário impresso (I-33); os hinos **61, 162, 185 e 238** ficaram sem o bloco "Final" (letra quebrada); o **283** (versos colados) precisa da foto do impresso;
  os 45 hífens de pronome dos hinos 1 a 30 esperam o veto do responsável; pendências de letra do 61, 62, 185, 189, 198, 238 e 475.

## I-22 — Continuar tocando com a tela bloqueada
- **O que virou:** um **serviço em primeiro plano** de mídia (`ServicoAudio.kt`, com notificação que mostra o hino e tem o botão "Parar") e `WAKE_LOCK` parcial, ligados e desligados pelo estado da reprodução. **Confirmado
  no celular do responsável (2026-11-19):** o hino segue tocando com a tela bloqueada.
- **Onde:** `src-tauri/gen/android/` (`ServicoAudio.kt`, `PonteServico.kt`), `src/lib/servico.ts`, `src/routes/+layout.svelte`. **PR #68.**
- **Pendente:** MediaSession (controles na tela de bloqueio além do "Parar"); o teste longo e o "hino todo" com as pausas de 2 s não foram registrados; o emulador não imita as economias de bateria dos fabricantes.

## I-24 — Ajustes em cartões, com o cartão Conteúdo
- **O que virou:** Ajustes em **cartões** recolhíveis (Aparência, Idioma, Conteúdo, Sobre, Créditos), com o estado numa linha de cima; o cartão **Conteúdo** reúne hinário, partituras e sons; os cartões abertos são
  lembrados; "Abrir Ajustes" na aba Partitura leva direto ao Conteúdo.
- **Onde:** `src/lib/Cartao.svelte`, `src/lib/LinhaPacote.svelte`, `src/routes/ajustes/+page.svelte`, `tests/e2e/karaoke.mjs`.
- **Pendente:** nada de função.

## I-28 — Abas na tela inicial
- **O que virou:** a barra **Hinos | Afinador | Gravador** na tela inicial (o mesmo `Abas.svelte` do hino), painéis montados, busca preservada ao trocar de aba e aba reaberta ao voltar de um hino.
- **Onde:** `src/lib/Abas.svelte`, `src/routes/+page.svelte`, `tests/e2e/karaoke.mjs`.
- **Pendente:** a rolagem de cada aba é guardada mas sem teste de ponta a ponta; a ordem das abas (Hinos primeiro) espera a confirmação do responsável.
