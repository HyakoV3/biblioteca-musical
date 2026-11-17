# Licenças de terceiros

O código deste projeto é MIT (`LICENSE`). Alguns materiais de terceiros acompanham o app; cada um mantém a sua licença.

## Ícones: Google Material Icons (conjunto `ic`) e Material Symbols (conjunto `material-symbols`)

- **Onde:** `src/lib/icones.json` (22 ícones em SVG), gerado por `tools/gerar-icones.mjs` a partir do Iconify. A maioria vem do
  `ic`; o marca-texto do karaokê vem do `material-symbols`, a família nova do mesmo projeto (o `ic` não tem esse desenho). O gerador
  só aceita esses dois conjuntos.
- **Autoria:** Material Design Authors (Google), nos dois conjuntos.
- **Licença:** [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). A licença pede que o aviso de copyright e o
  texto da licença acompanhem a redistribuição; este arquivo registra a origem. Os desenhos não foram alterados.

## Fonte Leipzig, dos símbolos de texto das partituras (I-08)

- **Onde:** `src/lib/fonts/Leipzig.woff2` (43.824 bytes), carregada por `src/lib/partitura.css` só na aba Partitura. O SVG das
  partituras traz texto em `font-family="Leipzig"` (a figura de nota do andamento, por exemplo); notas, pautas e claves são
  desenhos e não dependem dela.
- **Origem do arquivo:** o woff2 que o **Verovio 6.4.1** distribui como "Leipzig" (`data/Leipzig.css` do pacote Python; é o mesmo
  que ele embutia em cada SVG). Não foi alterado por nós. *Não foi possível provar daqui que é byte a byte o `Leipzig.woff2`
  do repositório `rism-digital/leipzig` (não baixei o arquivo de lá); os dois têm os mesmos autores, e a OFL permite redistribuir
  o arquivo sem modificação.*
- **Autoria e licença:** Etienne Darbellay, Jean-François Marti e Laurent Pugin (RISM Digital / Verovio), **SIL Open Font License
  1.1**, com **nome reservado "Leipzig"** (o que a licença proíbe é chamar de "Leipzig" uma versão **modificada**; o app só
  redistribui o arquivo como veio). O README do repositório confirma a OFL 1.1; o texto padrão mostrado em Ajustes ("Créditos e
  licenças") veio de um arquivo `OFL-1.1.txt` real (26/02/2007) e a linha de copyright foi lida no `LICENSE.txt` do repositório
  por um agente de leitura de páginas ("Copyright (c) 2014, Etienne Darbellay, Jean-Francois Marti[ ]and Laurent Pugin
  (info@rism.digital)"; no arquivo, a palavra "and" aparece colada a "Marti", e o app a mostra com o espaço). **A conferir pelo
  responsável**, num clique: <https://github.com/rism-digital/leipzig/blob/master/LICENSE.txt>.
- **Ferramentas que só geram o conteúdo (não vão no app):** MuseScore 4 (GPL-3.0) e Verovio (LGPL-3.0).

## Sons gravados (pacote opcional, ver I-07)

**Banco atual (desde 2026-11-15): GeneralUser GS v2.0.3**, de S. Christian Collins (repositório oficial
`mrbumpy409/GeneralUser-GS`, arquivo `GeneralUser-GS.sf2`, 32,3 MB). Os sons gravados do pacote são **renderizados por nota
a partir desse banco** (`tools/renderizar-banco.mjs`, secos, sem reverb) e cortados às notas dos hinos. Licença do autor
(v2.0, `LICENSE.txt` do repositório, mostrada na íntegra em Ajustes, "Créditos e licenças"): uso livre, "private or
commercial", e **"Please feel free to use it in your software projects, and to modify the SoundFont bank or its packaging"**.
Ressalvas dele: (1) a origem de algumas amostras é incerta (nenhuma veio de pacote comercial; ele nunca recebeu queixa
desde 2000); (2) não linkar o arquivo dele diretamente, e sim hospedar a própria cópia, o que fazemos. A renderização usa o
`spessasynth_core` (Apache 2.0), instalado **fora do projeto**: é só ferramenta de manutenção, não vai no app.

### Créditos exibidos no app

Ajustes, "Créditos e licenças" (`src/lib/licencas.ts`, textos em `src/lib/licencas-textos.ts`), com o autor, a licença e o
texto integral da licença de cada item. A lista: GeneralUser GS, smplr, ícones Google Material (Apache 2.0, texto
integral), fflate, Svelte e SvelteKit, e Tauri (linhas de copyright lidas nos arquivos de licença dos pacotes instalados).
Os arquivos de som ficam fora do Git (`sons-fonte/`).

- **Biblioteca que toca as amostras:** `smplr`, MIT (campo `license` do pacote e seção "License" do README). O pacote não
  publica arquivo `LICENSE` nem linha de copyright; o app registra "Author: danigb", como o pacote declara.
- **Fora desta lista, por ora:** as dependências indiretas do JavaScript e os crates do Rust do Tauri (cada uma com o seu
  aviso). Se o app for publicado em loja, vale gerar essa lista por ferramenta (por exemplo `cargo about` e um gerador
  de avisos do npm), em vez de mantê-la à mão.

### FluidR3_GM: só o registro de origem das medições do timbre sintético (não aparece no app)

O FluidR3 deixou de ser distribuído e **foi retirado do card de créditos** (decisão do responsável, 2026-11-15): nenhuma
amostra dele está no app nem no pacote de sons. Ele só serviu, **uma vez e fora do app**, para MEDIR o timbre dos
instrumentos sintetizados (espectro e ataque, salvos como números em `src/lib/timbres.json`). A origem dessas medições
fica registrada **só aqui**, para o caso de a dúvida voltar.

- **Banco:** FluidR3_GM, de Frank Wen. O autor o libera sob a **licença MIT** (README original: "I hereby release Fluid
  under the MIT license"; aviso lido no arquivo de copyright do pacote `fluid-soundfont` da Debian, que cita o texto do
  README e a linha "Copyright © 2000-2002, 2008 Frank Wen").
- **Amostras em MP3 por instrumento:** geradas do FluidR3 pelo repositório `midi-js-soundfonts`, de Benjamin Gleitzman. O
  código do repositório é **MIT** ("Copyright (C) 2012 Benjamin Gleitzman", `LICENSE.txt`), **mas o README dele rotula as
  amostras geradas do FluidR3 como Creative Commons Atribuição 3.0 (CC BY 3.0)**, o que diverge da licença MIT do autor
  do banco. Como as duas pedem **atribuição**, o app as cumpria enquanto distribuía essas amostras (até 2026-11-15):
  creditava o autor, citava a licença com o link e declarava as alterações (conversão em MP3 e corte às notas dos
  hinos). Se um dia a dúvida importar (por exemplo, se alguém voltar a usar essas amostras), vale perguntar ao Gleitzman
  qual licença vale.

## Conteúdo dos hinos

Letras e partituras **não fazem parte do repositório** e têm direitos de terceiros: ver `docs/roadmap-uxui-inicial.md`,
seção 3, e `docs/apk-de-teste.md`.
