# Pacote de exemplo embutido (5 hinos de domínio público)

O app traz dentro do binário um pacote de exemplo: **5 hinos reais de domínio público**, em quatro vozes, com letra, sincronia do karaokê e **partitura em SVG** (retrato e paisagem). Ele aparece quando **nenhum hinário foi baixado** (primeiro acesso, ou depois de Ajustes → Conteúdo → Remover) e some quando o hinário completo é instalado. É a **única exceção** à regra de que hinos reais não entram no Git; a procedência e a licença de cada música e letra estão em [`licencas-de-terceiros.md`](licencas-de-terceiros.md).

| N | Hino | Título original | Letra |
|---|---|---|---|
| 1 | Ein feste Burg | Ein feste Burg ist unser Gott | alemão (Luther, 1529) |
| 2 | Stille Nacht | Stille Nacht, heilige Nacht | alemão (Mohr, 1816) |
| 3 | Holy, Holy, Holy (Nicaea) | Holy, Holy, Holy | inglês (Heber, 1826) |
| 4 | Amazing Grace (New Britain) | Amazing Grace | inglês (Newton, 1779) |
| 5 | Ode à Alegria | An die Freude | alemão (Schiller, texto de 1808) |

Cada hino tem `titulo` (o original) e `titulos` com o nome consagrado em português, inglês e espanhol; a chave da língua original falta de propósito (ver "Campos de identificação" em [`FORMATO.md`](FORMATO.md)). **As letras não são traduzidas.**

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Partituras livres (LilyPond), **sem alteração**, do Mutopia Project | `src-tauri/exemplo/fontes/*.ly` |
| A letra, os títulos, o andamento e a escolha da fonte de cada hino | `src-tauri/exemplo/fontes/letras.json` |
| O MuseScore mínimo gerado (entrada do conversor) | `src-tauri/exemplo/fontes/mscx/` |
| O MusicXML gerado, sem letra (entrada do Verovio) | `src-tauri/exemplo/fontes/musicxml/` |
| O hinário que o app lê | `src-tauri/exemplo/hinario.json` |
| As partituras que o app embute | `src-tauri/exemplo/partituras/hino-N.svg` e `hino-N-paisagem.svg` |
| O leitor que embute os SVG (cada um passa por `svg::limpar`) | `src-tauri/src/exemplo.rs` |
| O gerador | `tools/gerar-exemplo.py` e `tools/exemplo/` |

As partituras embutidas só valem **sem hinário instalado**; com um hinário instalado, só as do disco valem (a embutida não vaza para um hino de mesmo número). Em Ajustes o card das partituras mostra "Embutidas no exemplo", sem Remover.

## Como regerar

O gerador lê as fontes e o `letras.json`, escreve os `.mscx` e o MusicXML, roda o `tools/mscx2json` (qualquer aviso dele interrompe) e, com `--partituras`, o `tools/gerar-partituras.py` (Verovio, com ids fixos: a mesma entrada dá os mesmos bytes).

```sh
python3 -m venv /tmp/venv-verovio && /tmp/venv-verovio/bin/pip install verovio   # só para os SVG
/tmp/venv-verovio/bin/python tools/gerar-exemplo.py --partituras    # regrava tudo
/tmp/venv-verovio/bin/python tools/gerar-exemplo.py --partituras --conferir   # só confere (não grava)
python3 -m pytest tools/test_gerar_exemplo.py
```

Sem `--partituras` o gerador não precisa do `verovio`. O teste `tools/test_gerar_exemplo.py` confere, sem o Verovio, que os `.mscx` e o MusicXML gravados estão em dia, que o `hinario.json` tem os 5 hinos em 4 vozes e que cada SVG tem um `g.measure` por compasso do hinário e `data-t`/`data-f` em todas as notas.

## Trocar ou somar um hino

1. **Ache uma edição livre.** Só entram edições cuja licença **da edição** (não só da obra) seja domínio público ou equivalente. Hoje a fonte é o [Mutopia Project](https://www.mutopiaproject.org) (arquivo `.ly`, SATB). Confira na página da peça a licença, o digitador e a fonte, e que o arquivo não traz nada com copyright (por exemplo um descanto ou um arranjo de terceiros). O CPDL pode servir, mas só com a licença da edição conferida.
2. **Copie o `.ly` sem alterar** para `src-tauri/exemplo/fontes/` e anote o SHA-256.
3. **Acrescente a entrada em `letras.json`:** `numero`, `titulo` (original), `titulos`, `letrista`, `compositor`, `ly`, `vozes_ly` (os nomes das 4 vozes no arquivo), `andamento` (o do `.mid` do Mutopia, em semínimas por minuto) e `estrofes`. Cada marca da letra é **uma nota do soprano que leva sílaba**: `sil-` abre ou continua a palavra, `_` é uma nota sem sílaba (a anterior segue nela) e `+` junta duas palavras numa nota. O gerador recusa, dizendo a estrofe, se a conta de marcas e notas não fecha. Notas ligadas ou sob um arco de melisma já saem do cálculo.
4. **Quebra de verso:** o conversor só quebra a linha antes de uma palavra em maiúscula (e depois de pontuação, no caso de nomes reverenciais como "Jesus"). Capitalize o início do verso se a fonte não o fizer e **registre isso** na procedência.
5. **Regere** (`--partituras`), rode os testes (Rust, Vitest, pytest, e2e) e confira a imagem de um SVG.
6. **Registre em [`licencas-de-terceiros.md`](licencas-de-terceiros.md):** música (edição, URL, licença, SHA-256 do `.ly`), letra (autor, ano, idioma, edição citada), os títulos e qualquer escolha editorial. Atualize também as listas de números nos testes (`tests/exemplo.test.ts`, `src-tauri/src/exemplo.rs`).

## Limites e escolhas de leitura

- **Ligadura:** um arco entre duas notas de **mesma altura** é lido como ligadura de prolongamento (a nota toca uma vez só e aparece ligada na partitura). Um arco entre alturas diferentes vira melisma na letra.
- **Fidelidade:** as notas de cada hino foram conferidas contra o `.mid` que o Mutopia publica (início e altura), com a única diferença das notas ligadas. A partitura desenhada não foi comparada com o PDF do Mutopia.
- **Andamento:** o do `.mid` do Mutopia (dois hinos ficam lentos, em 50); o app deixa mudar.
- **Tamanho:** os 10 SVG somam cerca de 0,87 MB (0,15 MB em zip) e entram **sem compressão** na biblioteca nativa, **uma vez por arquitetura** (arm64 e x86_64 no APK universal). O APK arm64 do `v0.3.9-rc10` tem 11,4 MiB. Cada hino a mais pesa cerca de 0,18 MB.
