# mscx2json

Converte partituras do MuseScore em XML (`.mscx`) para o `hinario.json` do app
(ver [`docs/FORMATO.md`](../../docs/FORMATO.md)).

```bash
cd tools/mscx2json
cargo run --release -- --id meu-hinario --nome "Meu hinário" /pasta/com/hino-1.mscx ... > hinario.json
# com correções explícitas da letra (opcional; ver docs/correcoes-da-letra.md):
cargo run --release -- --correcoes correcoes.json --id meu-hinario --nome "Meu hinário" /pasta/com/ > hinario.json
```

- Os arquivos devem se chamar `hino-<número>.mscx` (os demais são ignorados com aviso).
- Tempo em batidas (semínima = 1), notas em MIDI. A saída é JSON compacto.
- Entende o `.mscx` do **MuseScore 2** (vozes soltas no compasso, com `<tick>`/`<track>`) e a
  estrutura do MuseScore 3 (`<voice>`).
- Suporta pontos, pausas, anacruse, ligaduras, quiálteras, acordes e várias pautas.
  Apojaturas são ignoradas. Dinâmica **não** é extraída.
- **Tonalidade (I-13):** grava `armadura` (−7 a +7, do **primeiro** `KeySig`; sem o elemento, 0; modulações ficam de fora),
  `modo` (`"maior"`/`"menor"`) e `tonalidade` em texto (pt, ex.: "Mi♭ maior"). O modo vem do `<mode>` do arquivo, quando houver;
  senão da **nota final do baixo** (última voz; da passada final, se existir): se for a tônica menor, menor; senão, maior. Se o
  baixo não terminar numa tônica, usa a primeira nota do baixo; se ainda assim não bater, assume maior e **avisa**.
- **Letra:** lida da primeira pauta que tiver `<Lyrics>`. Cada estrofe (`<no>`) vira uma
  sequência de linhas, estrofes separadas por linha vazia e a primeira linha numerada ("1. ..."). A linha acompanha o
  **verso**: quebra na respiração (`<Breath>`) em que a próxima palavra começa em **maiúscula** (a continuação do verso vem em
  minúscula), com as ressalvas descritas em [`docs/FORMATO.md`](../../docs/FORMATO.md) ("Como o conversor decide as quebras de
  linha"). Num hino com final, o coro (o texto do trecho final, que o autor costuma escrever sob a estrofe 1) vai para a **última
  estrofe**.
- **Letra: o que o conversor faz com as sílabas.** Lê a sílaba inteira, inclusive formatação interna. A **elisão**
  do MuseScore (`go‿es`, duas palavras cantadas numa nota só) vira um espaço ("go es"). O número da estrofe que o
  autor escreve dentro da primeira sílaba ("1. Pa") é removido, porque o app já numera as estrofes. Uma sílaba só
  é descartada como repetida se for **idêntica**, no mesmo instante e vier de **outra camada**.
- **Letra: o que o conversor conserta sozinho** (só onde há regra segura): pronome colado ao verbo acentuado sem hífen (-lo, -la,
  -los, -las, -lhe, -lhes, com o "I" maiúsculo no lugar do "l" que ele traz às vezes) e "~" literal (vira espaço). O que tem mais de uma
  leitura possível o conversor **não adivinha**: fica para o arquivo de correções. Detalhes em `docs/FORMATO.md`.
- **Letra: o que só se conserta com o arquivo de correções.** O conversor une as sílabas só onde o arquivo marca início, meio e
  fim da palavra. Partitura que não marca ("Pa" e "ra," saem separados), letra trocada, ou dois versos colados sem respiração
  produzem isso na letra. Para esses casos, `--correcoes arquivo.json` aplica trocas **explícitas** do responsável (juntar,
  separar, trocar, quebrar antes de), cada uma com um aviso; ver [`docs/correcoes-da-letra.md`](../../docs/correcoes-da-letra.md).
- **Título e autoria:** o título vem do texto de moldura com estilo `Title` (se não houver, do metadado
  `workTitle`, e por último "Hino N"). A autoria junta os textos com estilo `Lyricist` e `Composer`
  (letrista primeiro, sem repetir). Hinos sem esses textos ficam sem `autoria`.
- **Idioma do conteúdo:** `--idioma pt-BR` declara o idioma de título e letra no hinário gerado.
- **Nomes das vozes:** "Parte I", "II", "III" e "IV" viram Soprano, Contralto, Tenor e Baixo.
  Use `--nomes-originais` para manter os nomes do arquivo.

## Como as vozes são formadas

Cada pauta vira uma ou mais vozes **pela altura das notas que soam juntas** (as camadas e
vozes internas do MuseScore são juntadas): a mais aguda é a voz 1 e a mais grave a última.
Se uma pauta se chama "Parte I e II", as vozes saem como "Parte I" e "Parte II". Quando só
uma nota soa, ela é repetida nas demais vozes (uníssono). Se em algum trecho soarem mais notas
do que o nome da pauta indica, ficam a mais aguda e a mais grave, e o conversor **avisa**
quantos trechos tiveram notas do meio omitidas.

## Hinos com final (passadas)

Reconhece um único padrão de repetição, confirmado no hino 457: início de repetição → fim de repetição junto
da 1ª casa de volta → 2ª casa de volta → trecho final. Gera `vozes` (uma passada normal) e `final` (a última
passada), e avisa "estrutura de repetição reconhecida" com os compassos de cada uma. Veja `docs/FORMATO.md`.
Qualquer outra estrutura de repetição ou salto é lida **uma vez, em ordem**, com um aviso.

## Limitações conhecidas

- **Repetições e saltos (ritornelo, D.C., coda) não são expandidos**: o conversor avisa e
  lê a partitura uma vez, em ordem.
- **Ligaduras:** o conversor entende as duas marcações. No MuseScore 3 (os `.mscx` do hinário) o início é `<Tie id="N">` dentro da nota
  e o fim é `<endSpanner id="N"/>` dentro da nota seguinte; no MuseScore 4 é `<Spanner type="Tie">` com `next`/`prev`. Até 2026-11-20 só a marcação do
  MuseScore 4 tinha o fim reconhecido, e a nota ligada soava duas vezes (148 dos 480 hinos do Dó; achado no final da introdução do 457).
- A separação em vozes é uma aproximação por altura: se as vozes se cruzam, uma nota longa pode
  trocar de voz.
- Arquivos compactados `.mscz` precisam ser exportados como `.mscx` (Arquivo → Salvar como…).

## Direitos autorais

A ferramenta é código MIT e funciona com qualquer partitura. **Quem converte é responsável
por ter autorização para usar a partitura de origem.** Não coloque o resultado em repositório
público sem a permissão de quem detém os direitos da transcrição e da obra.
