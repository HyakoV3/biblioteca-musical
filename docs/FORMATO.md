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
      "letra": ["Linha 1 fictícia", "Linha 2 fictícia"],
      "partitura": "partituras/001.pdf",
      "audio": "audios/001.mp3"
    }
  ]
}
```

`partitura` e `audio` são caminhos relativos opcionais dentro do pacote.
