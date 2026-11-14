# mscx2json

Converte partituras do MuseScore em XML (`.mscx`) para o `hinario.json` do app
(ver [`docs/FORMATO.md`](../../docs/FORMATO.md)).

```bash
cd tools/mscx2json
cargo run --release -- --id meu-hinario --nome "Meu hinário" /pasta/com/hino-1.mscx ... > hinario.json
```

- Os arquivos devem se chamar `hino-<número>.mscx` (os demais são ignorados com aviso).
- Tempo em batidas (semínima = 1), notas em MIDI. A saída é JSON compacto.
- Entende o `.mscx` do **MuseScore 2** (vozes soltas no compasso, com `<tick>`/`<track>`) e a
  estrutura do MuseScore 3 (`<voice>`).
- Suporta pontos, pausas, anacruse, ligaduras, quiálteras, acordes e várias pautas.
  Apojaturas são ignoradas. Dinâmica e tonalidade **não** são extraídas.
- **Letra:** lida da primeira pauta que tiver `<Lyrics>`. Cada estrofe (`<no>`) vira uma
  sequência de linhas, com quebra a cada respiração (`<Breath>`), estrofes separadas por linha
  vazia e a primeira linha numerada ("1. ..."). O refrão, quando está guardado na estrofe 1,
  continua nela, como no arquivo.
- **Nomes das vozes:** "Parte I", "II", "III" e "IV" viram Soprano, Contralto, Tenor e Baixo.
  Use `--nomes-originais` para manter os nomes do arquivo.

## Como as vozes são formadas

Cada pauta vira uma ou mais vozes **pela altura das notas que soam juntas** (as camadas e
vozes internas do MuseScore são juntadas): a mais aguda é a voz 1 e a mais grave a última.
Se uma pauta se chama "Parte I e II", as vozes saem como "Parte I" e "Parte II". Quando só
uma nota soa, ela é repetida nas demais vozes (uníssono). Se em algum trecho soarem mais notas
do que o nome da pauta indica, ficam a mais aguda e a mais grave, e o conversor **avisa**
quantos trechos tiveram notas do meio omitidas.

## Limitações conhecidas

- **Repetições e saltos (ritornelo, D.C., coda) não são expandidos**: o conversor avisa e
  lê a partitura uma vez, em ordem.
- A leitura de ligaduras foi escrita para a marcação do MuseScore 3; a amostra real testada
  (MuseScore 2) não tinha ligaduras de nota, então esse caso ainda não foi validado com
  arquivo real.
- A separação em vozes é uma aproximação por altura: se as vozes se cruzam, uma nota longa pode
  trocar de voz.
- Arquivos compactados `.mscz` precisam ser exportados como `.mscx` (Arquivo → Salvar como…).

## Direitos autorais

A ferramenta é código MIT e funciona com qualquer partitura. **Quem converte é responsável
por ter autorização para usar a partitura de origem.** Não coloque o resultado em repositório
público sem a permissão de quem detém os direitos da transcrição e da obra.
