# Licenças de terceiros

O código deste projeto é MIT (`LICENSE`). Alguns materiais de terceiros acompanham o app; cada um mantém a sua licença.

## Ícones: Google Material Icons (conjunto `ic`)

- **Onde:** `src/lib/icones.json` (13 ícones em SVG), gerado por `tools/gerar-icones.mjs` a partir do Iconify.
- **Autoria:** Material Design Authors (Google).
- **Licença:** [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). A licença pede que o aviso de copyright e o
  texto da licença acompanhem a redistribuição; este arquivo registra a origem. Os desenhos não foram alterados.

## Sons gravados (pacote opcional, ver I-07)

**Banco atual (desde 2026-11-15): GeneralUser GS v2.0.3**, de S. Christian Collins (repositório oficial
`mrbumpy409/GeneralUser-GS`, arquivo `GeneralUser-GS.sf2`, 32,3 MB). Os sons gravados do pacote são **renderizados por nota
a partir desse banco** (`tools/renderizar-banco.mjs`, secos, sem reverb) e cortados às notas dos hinos. Licença do autor
(v2.0, `LICENSE.txt` do repositório, mostrada na íntegra em Ajustes, "Créditos e licenças"): uso livre, "private or
commercial", e **"Please feel free to use it in your software projects, and to modify the SoundFont bank or its packaging"**.
Ressalvas dele: (1) a origem de algumas amostras é incerta (nenhuma veio de pacote comercial; ele nunca recebeu queixa
desde 2000); (2) não linkar o arquivo dele diretamente, e sim hospedar a própria cópia, o que fazemos. A renderização usa o
`spessasynth_core` (Apache 2.0), instalado **fora do projeto**: é só ferramenta de manutenção, não vai no app.

**O FluidR3 deixou de ser distribuído**, mas as suas amostras ainda são **medidas** (espectro e ataque, `timbres.json`)
para os instrumentos sintetizados. A atribuição abaixo continua no card por honestidade.

### FluidR3_GM (usado só para medir o timbre dos sintéticos)

- **Banco:** FluidR3_GM, de Frank Wen. O autor o libera sob a **licença MIT** (README original: "I hereby release Fluid
  under the MIT license"; aviso lido no arquivo de copyright do pacote `fluid-soundfont` da Debian, que cita o texto do
  README e a linha "Copyright © 2000-2002, 2008 Frank Wen").
- **Amostras em MP3 por instrumento:** geradas do FluidR3 pelo repositório `midi-js-soundfonts`, de Benjamin Gleitzman. O
  código do repositório é **MIT** ("Copyright (C) 2012 Benjamin Gleitzman", `LICENSE.txt`), **mas o README dele rotula as
  amostras geradas do FluidR3 como Creative Commons Atribuição 3.0 (CC BY 3.0)**, o que diverge da licença MIT do autor
  do banco. Como as duas pedem **atribuição**, o app cumpre as duas: credita o autor, cita a licença com o link e declara
  as alterações (conversão em MP3 e corte às notas dos hinos). Se um dia a dúvida importar (por exemplo, publicação em
  loja), vale perguntar ao Gleitzman qual vale.
- **Biblioteca que toca as amostras:** `smplr`, MIT (campo `license` do pacote e seção "License" do README). O pacote não
  publica arquivo `LICENSE` nem linha de copyright; o app registra "Author: danigb", como o pacote declara.
- **Onde aparece:** Ajustes, "Créditos e licenças" (`src/lib/licencas.ts`, textos em `src/lib/licencas-textos.ts`), com o
  texto da licença de cada item. Lista: FluidR3_GM, midi-js-soundfonts, smplr, ícones Google Material (Apache 2.0, texto
  integral), fflate, Svelte e SvelteKit, e Tauri (linhas de copyright lidas nos arquivos de licença dos pacotes
  instalados). Os arquivos de som ficam fora do Git (`sons-fonte/`).
- **Fora desta lista, por ora:** as dependências indiretas do JavaScript e os crates do Rust do Tauri (cada uma com o seu
  aviso). Se o app for publicado em loja, vale gerar essa lista por ferramenta (por exemplo `cargo about` e um gerador
  de avisos do npm), em vez de mantê-la à mão.

## Conteúdo dos hinos

Letras e partituras **não fazem parte do repositório** e têm direitos de terceiros: ver `docs/roadmap-uxui-inicial.md`,
seção 3, e `docs/apk-de-teste.md`.
