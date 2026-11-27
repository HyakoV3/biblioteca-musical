# Licenças de terceiros

O código deste projeto é MIT (`LICENSE`). Alguns materiais de terceiros acompanham o app; cada um mantém a sua licença.

## Transcrições dos hinos: Enéias Ramos (Hinário 5, em MuseScore)

- **O que é:** os arquivos `.mscx` de onde o conversor tira as notas e as letras e o gerador tira as partituras (SVG). Estão nos repositórios do autor no GitHub, um por tonalidade
  (`eneiasramos/ccb-hinario-5-do` é o usado hoje). **Não entram no Git deste projeto.**
- **Autoria:** Enéias Ramos (dono dos repositórios; as letras e músicas dos hinos têm autores próprios, que aparecem em cada hino).
- **Licença:** **nenhuma**: os repositórios dizem "todos os direitos reservados".
- **Autorização (registrada em 2026-11-26):** o Enéias Ramos **autorizou** a distribuição do hinário e das partituras gerados a partir das transcrições dele, como o app faz hoje (download pelo Release do repositório `HyakoV3/biblioteca-musical-pacotes`). A confirmação foi dada ao responsável do projeto; a **prova (a mensagem dele) fica fora do repositório**, guardada pelo responsável. **Este é o único lugar onde a autorização é registrada**: os outros documentos apontam para cá.
- **O que a autorização NÃO cobre:** as letras e as músicas dos hinos têm autores e titulares próprios, e a edição do hinário também. Esses direitos **continuam sem registro**. Antes de qualquer publicação aberta (loja ou tag final), é preciso decidir se a autorização do transcritor basta ou se há titulares a consultar.
- **No app:** Ajustes, "Créditos e licenças", com o nome, o link do perfil e o aviso de que os repositórios não trazem licença. O crédito reconhece a autoria e **não afirma** que há autorização.

## Pacote de exemplo embutido: 5 hinos de domínio público (`src-tauri/exemplo/`)

O app traz embutido (`src-tauri/exemplo/hinario.json`, lido por `src-tauri/src/hinario.rs`) um pacote de exemplo com **5 hinos reais de domínio público**, em quatro vozes (soprano, contralto, tenor e baixo), com letra, sincronia do karaokê e **partitura em SVG embutida no app** (retrato e paisagem, `src-tauri/exemplo/partituras/`, lida por `src-tauri/src/exemplo.rs`; passa pela mesma limpeza `svg::limpar` das partituras baixadas). É a **única exceção** à regra de que hinos reais não entram no Git.

- **Declaração do responsável:** o responsável pelo projeto afirmou (2026-11-26) que os cinco hinos são de domínio público. Cada linha abaixo registra o que foi **conferido de fato** (a página da edição e o texto dela); o que não pôde ser confirmado está dito.
- **Como foi gerado:** `python3 tools/gerar-exemplo.py --partituras` (os SVG precisam do pacote Python `verovio`, num venv) lê as partituras LilyPond de `src-tauri/exemplo/fontes/*.ly` (cópias **sem alteração** dos arquivos do Mutopia Project, SHA-256 abaixo) e `fontes/letras.json` (a letra, escolhida e alinhada às notas pelo responsável) e escreve: os `.mscx` (`fontes/mscx/`), que o `tools/mscx2json` valida e converte em `hinario.json` (sem avisos); e o MusicXML sem letra (`fontes/musicxml/`), que o `tools/gerar-partituras.py` (Verovio 6.4.1) desenha nos SVG de `partituras/` (a partitura é uma **obra derivada da edição do Mutopia**, que é de domínio público, e da mesma licença; o desenho não acrescenta nada que tenha direito próprio). O código do gerador está em `tools/exemplo/`. O script confere que as 4 vozes têm a mesma duração, e a ordem dos `g.measure` de cada SVG bate com a lista `compassos` do hinário (teste em `tools/test_gerar_exemplo.py`). As notas (início e altura) de cada hino foram **conferidas, uma a uma, contra o `.mid` que o Mutopia publica** para a mesma partitura: nenhuma diferença, exceto as 9 notas que são a 2ª metade de uma ligadura de prolongamento (o MIDI do Mutopia as repete; o hinário as une, como a partitura escreve). A partitura desenhada **não foi comparada** com o PDF do Mutopia (conferi só a imagem de dois hinos, a olho).
- **Duas escolhas de leitura (nas notas):** (1) um arco de ligadura entre duas notas de **mesma altura** (`a'2. ( a'4 )`) é lido como ligadura de prolongamento (desenhada como tal na partitura e tocada como uma nota só); (2) as notas sob arco de ligadura entre alturas diferentes ficam sem sílaba (melisma), e as sílabas das partes cantadas em colcheias ligadas foram postas à mão. O andamento é o do `.mid` do Mutopia (semínima: 112, 50, 110, 50 e 100), que é lento em dois hinos (50): o app deixa mudar.
- **Escolhas editoriais na letra (não são o texto "puro" da fonte):** a letra está no **idioma original** (alemão e inglês), por isso o cabeçalho do hinário não declara `idioma`; o `titulo` de cada hino é o **título original** e o campo `titulos` traz o nome consagrado em português, inglês e espanhol (o app mostra o do idioma da interface; na língua original vale o `titulo`): Castelo Forte é Nosso Deus / A Mighty Fortress Is Our God / Castillo fuerte es nuestro Dios; Noite Feliz / Silent Night / Noche de paz; Santo, Santo, Santo (pt e es); Maravilhosa Graça / Sublime gracia (pt e es); Ode à Alegria / Ode to Joy / Oda a la Alegría. **São nomes consagrados dos hinos, escolhidos pelo responsável, e a autoria da tradução de cada título não tem registro específico; as letras NÃO foram traduzidas**; o apóstrofo, a pontuação e a grafia seguem a fonte citada, com estas exceções: no hino 2 o início de cada verso foi posto em maiúscula (o conversor só quebra a linha antes de maiúscula) e foi acrescentado um ";" depois de "Stund’" (o autógrafo de Mohr traz ";"); em alguns versos duas palavras fracas dividem uma nota (`tho’ the`, `all the`, `the eye`, `before thee` etc., para a letra caber na música), e no hino 5 o travessão de "Ja – wer" foi omitido. A ordem das estrofes é a das fontes (hino 2: 1, 2 e 3 do autógrafo Gruber VII, não as três mais cantadas hoje; hino 5: só as três primeiras estrofes, sem o coro de Schiller).
- **Título longo:** nenhum dos cinco tem título longo (o mais comprido, "Castillo fuerte es nuestro Dios", tem 31 caracteres; o original mais longo, "Stille Nacht, heilige Nacht", 27). O hino fictício "Ação e coração (teste de acentos)" saiu com o exemplo antigo; a busca sem acento segue coberta por `tests/busca-hinos.test.ts` e `tests/titulo.test.ts`, com dados próprios.

**Edições da música (Mutopia Project, verificadas em 2026-11-26).** Em todas, a página da peça diz "Public Domain" (marca CC "No rights reserved") e o arquivo `.ly` traz `copyright = "Public Domain"`: a licença da **edição** é a declaração de quem digitou (o rodapé diz "placed in the public domain by the typesetter"). **Não foi possível provar** quem fez a harmonização de cada uma: as páginas do Mutopia não a creditam (a fonte citada por Dunlop é o cyberhymnal.org, não conferido). As obras (melodias e letras) têm autores mortos há mais de 70 anos, ou são anônimas de 1831.

| N | Hino (música) | Edição / digitador | Página da peça | Arquivo (SHA-256 da cópia em `fontes/`) | Licença |
|---|---|---|---|---|---|
| 1 | Ein feste Burg, melodia atribuída a Martin Luther (c. 1529; atribuição segundo o próprio arquivo) | Mutopia, "Ein' Feste Burg (hymntune)", Steve Dunlop, 2008 | <https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1237> | `ein_feste_burg.ly`, `db6a3526fb4b3114adb5f97884bf486d81d4be656391260b17bb54a8ec2b2263` | Public Domain |
| 2 | Stille Nacht, Franz Xaver Gruber (1787-1863) | Mutopia, "Stille Nacht (hymntune)", Steve Dunlop, 2008 (id 1295) | <https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1295> | `stille_nacht.ly`, `41ac15027dc4626bd7d18beae68ef8a23fe2359e5f6ac618d5a2366e81aa4151` | Public Domain |
| 3 | Nicaea, John Bacchus Dykes (1823-1876), 1861 | Mutopia, "Nicaea (hymntune)", Steve Dunlop, 2008. **Sem o descanto de Jack den Haan** (o do CPDL, de 2020, com copyright, não foi usado) | <https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1284> | `nicaea.ly`, `dfb2f95db15dee1423ec51d5d5d48df7d0e892984fd4d011508c1a35a70b6890` | Public Domain |
| 4 | New Britain (Amazing Grace), anônima (Virginia Harmony, 1831) | Mutopia, "New Britain (hymntune)", Steve Dunlop, 2008 (**não** é o arranjo de David R. King do CPDL) | <https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1283> | `new_britain.ly`, `98d91c76395a37fd0379896f6fee83f61386de08dd544ef188bc98251c513f4c` | Public Domain |
| 5 | Ode an die Freude, Ludwig van Beethoven (1770-1827) | Mutopia, "Ode to Joy", Peter Chubb, 2009 (fonte "Various": arranjo de hinário, sem arranjador creditado) | <https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528> | `ode.ly`, `a0c865aa9f71221605362622d281405071e0734540e86ce131131757cc803a71` | Public Domain |

Arquivos baixados de `https://www.mutopiaproject.org/ftp/` (LutherM/ein_feste_burg, GruberFX/stille_nacht, DykesJB/nicaea, Anonymous/new_britain, BeethovenLv/ode). O CPDL (cpdl.org) **não pôde ser consultado** daqui (a página responde com um desafio anti-robô do Cloudflare, que não foi contornado), por isso nenhuma edição do CPDL foi usada.

**Letras (verificadas em 2026-11-26).**

| N | Letra | Autor (morte) | Ano e idioma | Edição citada (fonte usada) | Licença |
|---|---|---|---|---|---|
| 1 | "Ein feste Burg ist unser Gott", 4 estrofes | Martin Luther (1546) | 1529, alemão | Wikisource (de), texto de *Deutsche Gedichte I*, Insel 1984, a partir de *Die deutschen und geistlichen Lieder*, ed. G. Hahn, 1967 (Niemeyer): <https://de.wikisource.org/wiki/Ein_feste_Burg_ist_unser_Gott> | Domínio público (autor morto há mais de 70 anos). A transcrição da Wikisource tem a licença própria dela; o app usa só o texto de Luther |
| 2 | "Stille Nacht! Heilige Nacht!", estrofes 1 a 3 | Joseph Mohr (1848) | 1816, alemão | Wikisource (de), autógrafo nº VII de Gruber (c. 1860): <https://de.wikisource.org/wiki/Stille_Nacht!_Heilige_Nacht!_(Gruber_VII)>; o ";" vem do autógrafo de Mohr: <https://de.wikisource.org/wiki/Weyhnachts-Lied> | Domínio público |
| 3 | "Holy, Holy, Holy! Lord God Almighty", 4 estrofes | Reginald Heber (1826) | 1826, inglês | Wikisource (en), *The Army and Navy Hymnal* (1920), ed. Henry Augustine Smith: <https://en.wikisource.org/wiki/The_Army_and_Navy_Hymnal/Hymns/Holy,_Holy,_Holy,_Lord_God_Almighty> | Domínio público (autor morto há mais de 70 anos; edição de 1920) |
| 4 | "Amazing Grace" ("Faith's Review and Expectation"), estrofes 1 a 4 | John Newton (1807) | 1779, inglês | Wikisource (en), *Olney Hymns* (edição de 1840), Livro I, hino 41: <https://en.wikisource.org/wiki/Olney_Hymns_(1840)/Book_1/Hymn_41> | Domínio público |
| 5 | "An die Freude", estrofes 1 a 3 (sem o coro) | Friedrich Schiller (1805) | 1785; texto de 1808, alemão | Wikisource (de), *Gedichte, Zweiter Theil*, 3ª ed., Crusius, Leipzig 1808: <https://de.wikisource.org/wiki/Ode_an_die_Freude> | Domínio público |

**Traduções para o português: nenhuma usada.** "Castelo Forte é o Nosso Deus" (tradução de Jacob Eduardo von Hafe, 1886, a partir da versão espanhola de Juan Bautista Cabrera Ibarz) aparece na Wikisource em português (<https://pt.wikisource.org/wiki/Castelo_Forte_%C3%A9_o_Nosso_Deus>), mas **não foi possível confirmar a data de morte do tradutor** (não achei a página de autor dele) nem que o texto da página é o de 1886 sem as variações dos hinários; por isso ficou de fora. Para "Noite Feliz", "Santo, Santo, Santo", "Maravilhosa Graça" e "Ode à Alegria" não busquei tradução em português com fonte datada.

**Não conferido:** quem fez a harmonização em quatro vozes de cada edição (item acima); se o `.ly` de cada peça é idêntico ao que o Mutopia serve hoje (foram baixados em 2026-11-26 e conferidos por SHA-256 acima).

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

**Hospedagem (desde 2026-11-24):** o zip com os sons renderizados fica no repositório público `HyakoV3/biblioteca-musical-pacotes` (Release), com o texto da licença junto e o crédito ao autor; a licença permite redistribuir e modificar o banco e o empacotamento, e pede cópia própria em vez de link para o arquivo dele.

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
integral), fflate, Svelte e SvelteKit, Tauri, os crates do Rust do app (zip, MIT; roxmltree, base64, serde e serde_json, MIT ou Apache 2.0; as linhas de copyright do zip, do roxmltree e do base64 foram lidas nos arquivos de licença deles, e o serde e o serde_json não publicam linha de copyright: o serde entra com os autores declarados e o serde_json sem autor), Pitchy (MIT), web-noise-suppressor (MIT), RNNoise (BSD 3-Clause) com rnnoise-wasm (Apache 2.0) e GTCRN com gtcrn-wasm (MIT) (linhas de copyright lidas nos arquivos de licença dos pacotes instalados).
Os arquivos de som ficam fora do Git (`sons-fonte/`).

- **Biblioteca que toca as amostras:** `smplr`, MIT (campo `license` do pacote e seção "License" do README). O pacote não
  publica arquivo `LICENSE` nem linha de copyright; o app registra "Author: danigb", como o pacote declara.
- **Fora desta lista, por ora:** as dependências indiretas do JavaScript e os crates indiretos do Rust (os que o Tauri e o zip puxam, como `zlib-rs`, `typed-path` e `constant_time_eq`, e o `zmij`, do `serde_json`; os plugins `opener` e `http` do Tauri entram no crédito do Tauri: mesma licença e mesmo copyright) (cada uma com o seu
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

Letras e partituras **não fazem parte do repositório** (a exceção são os 5 hinos de domínio público do pacote de exemplo, acima) e têm direitos de terceiros: ver `docs/roadmap-uxui-inicial.md`,
seção 3, e `docs/apk-de-teste.md`.
