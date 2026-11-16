# Pacote de sons gravados

Os sons gravados são **opcionais**: a síntese continua sendo o som padrão (leve, funciona offline desde o primeiro uso) e
cada instrumento gravado é baixado só se a pessoa quiser. Decisão do responsável em 2026-11-14 (ver I-07 em
`archive/ideias-implementadas.md`). Banco de sons: **GeneralUser GS** desde 2026-11-15 (antes FluidR3_GM), ver `docs/licencas-de-terceiros.md`.

## Divisão

**Um arquivo por instrumento** (cada um confere o seu SHA-256), **organizados em quatro grupos na tela** para baixar tudo
de um grupo de uma vez:

| Grupo | Instrumentos (nome no banco) | Tamanho aproximado |
|---|---|---|
| **Órgão** | órgão de tirantes (`drawbar_organ`), o escolhido | 1,6 MB |
| **Madeiras** | flauta (`flute`), flauta doce (`recorder`), clarinete (`clarinet`), oboé (`oboe`), sax alto (`alto_sax`), sax tenor (`tenor_sax`), fagote (`bassoon`) | ~13 MB |
| **Metais** | trompete (`trumpet`), trompa (`french_horn`), trombone (`trombone`), tuba (`tuba`) | ~7 MB |
| **Cordas** | violino (`violin`), viola (`viola`), violoncelo (`cello`), contrabaixo (`contrabass`) | ~8 MB |

Sem equivalente no banco General MIDI: **flugelhorn** e **bombardino** (em inglês, *euphonium*). Ficam só na síntese até
haver uma amostra com licença livre. O responsável quer o bombardino gravado ("vai ter"); busca feita em 2026-11-14:

| Fonte | Resultado |
|---|---|
| FluidR3_GM / MusyngKite (banco anterior) e GeneralUser GS (banco atual) | Não têm euphonium nem flugelhorn (o padrão General MIDI não os inclui; só `tuba`, `trombone`, `french_horn` e `trumpet`). |
| VCSL (CC0) | Lista de arquivos lida no repositório: **nenhum instrumento de metal**. |
| Philharmonia Orchestra (amostras gratuitas) | Os termos oficiais permitem uso em obra comercial, mas **proíbem tornar as amostras disponíveis como estão ou como instrumento de amostras**; um espelho no GitHub diz CC BY-SA 3.0, o que **não bate** com o texto oficial. Não se confirmou que o euphonium esteja na biblioteca. **Não usar sem autorização por escrito.** |
| MuseScore_General (MIT) | Tem um preset "Euphonium", mas é uma **tuba reprocessada** com a extensão ampliada, não um euphonium amostrado. A licença é clara; falta extrair o preset do arquivo SF3 (ferramenta ainda não escolhida). |

Nada foi baixado para essa busca. **Não rotular outro instrumento (tuba, trombone) como "Bombardino".**

Cada arquivo tem as notas MIDI 30 a 86 (a faixa dos hinos mais a transposição de ±6 semitons e folga), no mesmo formato
que o `smplr` já lê. Tamanho depois do corte: de 1,6 a 2,1 MB por instrumento.

## Troca do banco: FluidR3 → GeneralUser GS (2026-11-15)

O responsável achou que os gravados do FluidR3 "não parecem o instrumento" e, depois de ouvir a comparação dos 16 nos dois
bancos (mesma escala, volume igualado), decidiu trocar todos pelo **GeneralUser GS v2.0.3** (S. Christian Collins).
- **Como se gera:** `node tools/renderizar-banco.mjs <GeneralUser-GS.sf2> <saida>` (precisa do `spessasynth_core` fora do
  projeto e de ffmpeg; indique o `index.js` dele em `SPESSASYNTH`). Cada nota: programa General MIDI do instrumento,
  velocidade 100, **sem reverb nem coro**, 2,6 s ligada e 0,5 s de cauda, mono, MP3 a 80 kbps, notas 30 a 86, no mesmo
  formato `<instrumento>-mp3.js` do banco anterior (o app não precisa de carregador novo; conferido no `smplr` real).
  Depois `tools/preparar-sons.py --entrada <saida> --banco GeneralUserGS-2.0.3 --pacote sons-002 --instrumentos ...` por
  grupo e `tools/montar-manifesto-sons.py --link todos=<link>`.
- **Tamanho:** **38,2 MB** (os 16), contra 29,4 MB do FluidR3 (o MP3 a 80 kbps é mais alto que o do banco anterior, ~65 kbps).
  Para voltar a ~30 MB basta baixar o `KBPS` do renderizador para 64.
- **Volume:** `ganho` de cada instrumento recalculado para **todos no mesmo nível médio no ouvido**, −24,6 dB (a mediana de
  antes, então o volume geral não mudou): `python3 tools/analisar-timbres.py --fonte <amostras> --calibrar --escrever`.
  Refazer sempre que as amostras mudarem.
- **Compatibilidade:** o `manifesto.json` do app guarda o SHA-256 de cada arquivo. APKs até o 009 esperam os arquivos do
  FluidR3, então **recusam os novos** até serem atualizados (e o contrário também). A pasta compartilhada do servidor guarda
  uma versão por vez.
- **Não muda:** flugelhorn e bombardino (nenhum dos dois bancos tem), a divisão em grupos e o link público.

## Gerar

```sh
sh tools/baixar-sons-teste.sh        # baixa os arquivos originais do banco para sons-fonte/ (fora do Git)
python3 tools/preparar-sons.py --pacote sons-001 --saida <pasta de saída>/sons-001
# ou só alguns:  --instrumentos drawbar_organ flute clarinet
```

Saem os `*-mp3.js` e um `manifesto.json` (instrumento, notas, bytes e SHA-256 de cada arquivo).

## Hospedagem

- **Agora (testes):** uma **pasta dedicada** só com os sons, no **File Browser** que o responsável hospeda
  (`https://fb.hm.hv2.xyz`, **hv2**), com **link público de leitura** (sem senha, sem validade). Decisão de 2026-11-15:
  **sem o Nextcloud**. A pasta é **`BibliotecaMusicalSons/`** no servidor (chamava-se `BibliotecaMusical/` até 2026-11-16, quando o responsável a
  renomeou depois do upgrade do File Browser para a 2.0.2; o link público continuou o mesmo). Hoje ela tem `orgao/`, `madeiras/`, `metais/` e
  `cordas/`, cada uma com o `manifesto.json` e os `*-mp3.js` (o banco GeneralUser GS, de 2026-11-15); o primeiro pacote de teste, com `sons-001/`,
  foi substituído por ele. **Só a pasta `BibliotecaMusicalSons` é compartilhada**; nada mais fica exposto.
- **Estado (2026-11-15):** pasta, arquivos e **link público criados e testados**. O link expõe só a pasta
  (então `BibliotecaMusical`, hoje `BibliotecaMusicalSons`; conferido pela API pública). O endereço do link fica na configuração do app, não neste documento.

### O que o link público do File Browser permite (testado)

- **Baixa a pasta compartilhada inteira em um `.zip`:** `https://fb.hm.hv2.xyz/public/api/resources/download?hash=<hash>`.
  Resultado (no teste de 2026-11-15, com o primeiro pacote): 5,5 MB em 9,9 s, e os 3 arquivos de dentro conferem com o SHA-256 do manifesto. Dentro
  do zip os arquivos vêm com o prefixo da pasta (naquela época `BibliotecaMusical/sons-001/`; hoje `BibliotecaMusicalSons/`), que o app ignora.
- **Não baixa um arquivo avulso:** cinco formas de endereço (`raw` e `resources/download`, com `path` ou `files`)
  devolveram **sempre a pasta inteira em zip**, ignorando o arquivo pedido.
- **Listagem:** `.../public/api/resources?path=/&hash=<hash>` devolve o conteúdo em JSON.
- **Limite de banda do link:** ~500 KB/s no teste de 2026-11-15 (`maxBandwidth: 500`); depois subiu para **750 KB/s**, que é o de hoje (medido: ~0,8 MB/s). Um pacote de 2 MB
  leva ~4 s; o conjunto todo (~23 MB), ~46 s. Dá para aumentar nas opções do compartilhamento.

**Consequência para o desenho:** o app baixa **um zip por compartilhamento**, então **cada grupo é uma pasta
compartilhada própria, com o seu link** (Órgão, Madeiras, Metais, Cordas), e não um link só para tudo. O manifesto dentro
do app lista, por grupo, o endereço do link e o SHA-256 de cada arquivo. O app baixa o zip pelo lado nativo, extrai
**com limite de tamanho** (contra zip malicioso), ignora o prefixo das pastas e confere cada arquivo contra o manifesto
antes de guardar.
- **Depois:** GitHub Releases quando o código for público; o servidor do responsável vira espelho.
- O app **baixa pelo lado nativo** (Rust), porque servidores de link público costumam não liberar o acesso do navegador
  interno (CORS); **confere o SHA-256** contra o manifesto que vem dentro do app, então um arquivo trocado no servidor é
  recusado; e aceita **uma lista de endereços** (espelhos).

## Segurança do formato

O `smplr` lê o arquivo com `JSON.parse` e decodifica o áudio; **não executa** o conteúdo (conferido em 2026-11-14: nenhum
`eval`, `Function` nem criação de script). Um arquivo adulterado só pode dar erro ou um som estranho.

## Como funciona no app (implementado em 2026-11-15, versão 0.3.0)

- **Manifesto** em `src/lib/sons/manifesto.json`, gerado por `tools/montar-manifesto-sons.py` (junta os manifestos dos
  grupos e os links). Hoje há **um pacote só, `todos`**, com os 16 instrumentos, no link da pasta `BibliotecaMusical`
  (29,4 MB). Quando cada grupo tiver o seu link: `python3 tools/montar-manifesto-sons.py --link orgao=URL --link madeiras=URL ...`.
- **Ajustes, "Sons gravados":** lista os pacotes do manifesto com o tamanho, o estado (instalado ou não), o botão
  **Baixar** (com barra de progresso) e **Remover**, e traduz os erros.
- **Download** pelo lado nativo (`@tauri-apps/plugin-http`; o link do File Browser não manda CORS), com a rede **restrita ao
  endereço do servidor** em `src-tauri/capabilities/default.json`.
- **Conferência:** o zip é aberto em memória (`fflate`), só os arquivos que o manifesto espera são extraídos (as pastas do
  zip são ignoradas) e **cada um precisa bater com o tamanho e o SHA-256 do manifesto**; zip adulterado, incompleto ou
  "bomba" (mais de 100 MB descompactados) é recusado inteiro.
- **Armazenamento** no Cache do navegador interno do app (chaves virtuais `/sons/<arquivo>`), com pedido de persistência;
  funciona **offline** depois de baixado. O `smplr` lê dali pelo seu `storage` próprio, sem rede.
- **Escolha por voz** (card Instrumentos): sem nenhum som gravado instalado, um seletor só (sintetizado). Com algum
  instalado, cada voz ganha um alternador **Sintetizado | Gravado**; o seletor mostra só os instrumentos do modo e da voz
  (4 a 7 itens, não 30). Trocar de modo mantém o instrumento quando há equivalente. Remover o pacote devolve as vozes ao
  sintetizado.
- **Volume:** cada gravado tem um ganho (em `src/lib/realista.ts`) medido contra o sintetizado equivalente.

Testado com o zip **real** do servidor (16 arquivos conferidos em 41 ms) e com zips adulterados, intrusos, truncados e
"bomba". **Ainda não testado em aparelho**: o download dentro do app (plugin HTTP, Cache e smplr) só se confirma no
emulador ou no celular.

## O que falta

- [ ] Testar o download, a instalação e a remoção no emulador e no celular.
- [ ] Um link por grupo (`orgao`, `madeiras`, `metais`, `cordas`) no File Browser, e regerar o manifesto.
- [ ] Aumentar o limite de banda do link (hoje ~500 KB/s: 29 MB levam ~60 s).
- [x] Créditos e licenças em Ajustes (GeneralUser GS com a licença do autor na íntegra; o FluidR3 saiu do card em 2026-11-15, ver `docs/licencas-de-terceiros.md`).
- [ ] Substituto do flugelhorn e do bombardino (ver a busca de euphonium acima).
