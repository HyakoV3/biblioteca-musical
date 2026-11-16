# Arquivo de correções da letra

Alguns arquivos de partitura (`.mscx`) trazem a letra com defeitos que **nenhuma regra segura** conserta: uma sílaba sem o marcador
de continuação ("Pa" e "ra" saem separados), uma letra trocada, dois versos colados na mesma linha. O conversor
[`mscx2json`](../tools/mscx2json/README.md) conserta sozinho o que tem regra segura (ver [`FORMATO.md`](FORMATO.md)); o resto se
conserta com um **arquivo de correções**: trocas **explícitas**, escritas e mantidas pelo responsável.

- O texto de um hino **nunca muda sem estar listado** nesse arquivo.
- Cada correção aplicada vira um **aviso** na conversão. Correção que **não achou** o que procurava também avisa ("NÃO
  aplicada"), para ela não envelhecer em silêncio.
- O arquivo traz texto de hino, então fica **só no computador** de quem converte (fora do Git), como o resto do conteúdo.

## Como usar

```bash
cd tools/mscx2json
cargo run --release -- --correcoes correcoes.json --id meu-hinario --nome "Meu hinário" /pasta/com/hinos/ > hinario.json
```

## Formato

Todos os exemplos abaixo são **fictícios**.

```json
{
  "versao": 1,
  "hinos": {
    "7": [
      { "estrofe": 1, "juntar": "al fa" },
      { "estrofe": 2, "separar": "be,_ta gama" },
      { "estrofe": 2, "trocar": "dlta", "por": "delta" },
      { "estrofe": 3, "quebrar_antes": "Épsilon zeta" },
      { "estrofe": 1, "juntar": "ka pa", "ocorrencia": 2, "comentario": "só a 2ª vez que aparece" }
    ]
  }
}
```

`hinos` leva o **número do hino** e a lista de correções dele. Cada correção tem `estrofe` e **exatamente um** destes verbos:

| Verbo | O que faz |
|---|---|
| `juntar` | As sílabas viram **uma palavra só** (falta o marcador de continuação no arquivo do autor). |
| `separar` | O contrário: viram **palavras separadas** (o autor marcou continuação onde não devia). |
| `trocar` + `por` | Troca o texto de cada sílaba. `trocar` e `por` precisam ter o **mesmo número de sílabas**. |
| `quebrar_antes` | Começa uma **linha nova** antes dessas sílabas (dois versos colados, sem respiração na partitura). |

Campos opcionais: `ocorrencia` (qual das vezes em que o texto aparece na estrofe; sem ele vale a **primeira** e, se houver mais de
uma, o aviso diz quantas havia) e `comentario` (para você; é ignorado).

## Como o texto é procurado

- **Cada palavra separada por espaço é uma sílaba**, na ordem em que são cantadas. `"al fa"` procura a sílaba "al" seguida da
  sílaba "fa". Pontuação conta: se o arquivo tem "fa,", escreva `"al fa,"`.
- **`_` é um espaço dentro de uma sílaba.** Quando duas palavras caem numa nota só (a elisão), o conversor as junta com um espaço
  numa sílaba só ("be, ta"); escreva `be,_ta`. É o mesmo sinal do hinário impresso ("sobre_a").
- O texto procurado é **o da sílaba no arquivo de partitura**, antes de qualquer conserto automático, sem o número da estrofe
  que o autor às vezes escreve na primeira sílaba ("1. Al" é procurado como `Al`).
- **`estrofe` é a do arquivo de partitura** (1 = a primeira, o `<no>` 0 do MuseScore). Num hino com final, o coro costuma estar
  escrito sob a estrofe 1 **no arquivo**; escreva `"estrofe": 1`, mesmo que o app o mostre na última estrofe.
- A busca ignora a cópia da mesma sílaba vinda de outra camada (como o conversor faz ao montar a letra).

## Erros no arquivo de correções

O conversor **recusa** o arquivo (e não converte) se houver chave desconhecida, dois verbos na mesma correção, `trocar` sem `por`,
número de sílabas diferente, `estrofe` ou `ocorrencia` menor que 1 ou `versao` diferente de 1. A mensagem diz o hino e o número
da correção. Isso é de propósito: um arquivo do responsável não deve falhar em silêncio.

## Dica: achar os suspeitos

A conversão mostra a letra como está. Para achar palavras partidas ou trocadas, passe a letra por um corretor ortográfico em
português (por exemplo `aspell -l pt_BR list`) e compare com o hinário impresso, quando houver. Fragmentos que são palavras
válidas ("Sem" e "pre") o corretor **não** pega; só a comparação com o impresso.
