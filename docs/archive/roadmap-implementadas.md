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
| **I-07** | Sons de instrumentos mais realistas | feita (pacote opcional) | [`../pacote-de-sons.md`](../pacote-de-sons.md), [`../licencas-de-terceiros.md`](../licencas-de-terceiros.md), PRs #10, #11, #16 |
| **I-09** | Mostrar em que parte do hino se está | feita, a ver no aparelho | `src/lib/Player.svelte`, `src/lib/vezes.ts` |
| **I-10** | Trocar instrumento, andamento e tom na pausa | feita, a ver no aparelho | `src/lib/reproducao.svelte.ts`, `src/lib/sintetizador.ts` |
| **I-11** | Ícones em SVG local | feita | `src/lib/Icone.svelte`, `src/lib/icones.json`, `tools/gerar-icones.mjs` |
| **I-12 (fase A)** | Karaokê na letra | feita, a ver no aparelho | [`../FORMATO.md`](../FORMATO.md) (`sincronia`), `src/lib/karaoke.ts`, `tests/e2e/karaoke.mjs` |
| **I-14** | Estilo de cor Marinho e ouro | feita, a ver no celular | [`../design-tokens.md`](../design-tokens.md), `src/lib/tema.css`, PR #4 |
| **I-15** | Timbres sintetizados mais parecidos | feita, aprovada de ouvido em parte | `src/lib/timbres.ts`, `tools/analisar-timbres.py`, PRs #2, #6, #7 |
| **I-21** | Slider do miniplayer em cima (embaixo, confundia com as abas) | feita, a ver no celular | `src/lib/Miniplayer.svelte`, `tests/e2e/karaoke.mjs`, PR #27 |

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
  a linha; botão de microfone no cabeçalho (ligado por padrão, lembrado). A pausa congela o destaque. A **fase B**, na partitura,
  continua aberta em [`../roadmap-ideas.md`](../roadmap-ideas.md) (I-12).
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
