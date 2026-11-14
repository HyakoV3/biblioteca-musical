# Formato de dados

O app lê um pacote de conteúdo local (pasta `content/`, não versionada). Exemplo com
dados **fictícios**, só para mostrar a estrutura:

```json
{
  "versao": 1,
  "hinario": { "id": "exemplo", "nome": "Hinário de exemplo" },
  "hinos": [
    {
      "numero": 1,
      "titulo": "Título de exemplo",
      "tonalidade": "Dó",
      "andamento": 90,
      "letra": ["Linha 1 fictícia", "Linha 2 fictícia"],
      "partitura": "partituras/001.pdf",
      "vozes": [
        { "nome": "Soprano", "notas": [[0, 1, 72], [1, 1, 74]] },
        { "nome": "Baixo",   "notas": [[0, 2, 48]] }
      ]
    }
  ]
}
```

## Campos de identificação

- No cabeçalho `hinario`: `idioma` (opcional) é o **idioma do conteúdo** (título e letra), em código BCP 47
  (`"pt-BR"`, `"es"`, `"en"`). Ele é independente do idioma da interface. Com ele, a tela marca o título e a
  letra no idioma certo, e o leitor de tela pronuncia corretamente mesmo com a interface em outra língua.
  Sem ele, o app não marca o idioma do texto dos hinos.
- Em cada hino: `autoria` (opcional) é o crédito como aparece na partitura, por exemplo
  `"Fulana de Tal"`. Aparece sob o título do hino e na lista. O conversor monta esse campo a partir dos
  textos de moldura com estilo `Lyricist` e `Composer` do MuseScore (letrista primeiro, sem repetir).
  O `titulo` vem do texto com estilo `Title`.

## Áudio por síntese

Não há arquivos de áudio. O som é gerado por um sintetizador dentro do app a partir das
notas de cada voz. Cada nota é `[inicio, duracao, midi]`:

- `inicio` e `duracao` em **batidas** (o `andamento` em bpm converte para segundos);
- `midi` é o número da nota MIDI (60 = Dó central, 69 = Lá 440 Hz).

O player permite silenciar vozes, mudar o andamento e transpor em semitons.
`letra` é uma lista de linhas. Uma linha vazia (`""`) separa as estrofes, e a primeira linha
de cada estrofe pode começar com o número ("1. ..."). O app mostra as linhas como estão.

`partitura` é um caminho relativo opcional dentro do pacote. Todos os campos além de
`numero` e `titulo` são opcionais.

## Importar

Na tela inicial, o botão **Importar hinário (.json)** escolhe o arquivo. O app valida
(versão, ao menos um hino, números de hino sem repetição, limite de 20 MB) e só então grava em
`content/hinario.json`, de forma atômica: um arquivo inválido nunca substitui o conteúdo atual.
**Remover conteúdo importado** apaga o arquivo e volta ao pacote de exemplo.
Por enquanto só o `hinario.json` é importado; arquivos de partitura ainda não.

## Onde o app lê

O app procura `hinario.json` em `<pasta de dados do app>/content/` (no Linux:
`~/.local/share/br.pro.bibliotecamusical.ccb/content/`). Se o arquivo não existir,
mostra o pacote de exemplo embutido (`src-tauri/exemplo/hinario.json`, dados fictícios).
Se o arquivo existir mas estiver inválido, o app mostra o erro em vez de esconder com o exemplo.
Apenas `versao: 1` é suportada.
