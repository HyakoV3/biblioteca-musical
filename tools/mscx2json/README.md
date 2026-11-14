# mscx2json

Converte partituras do MuseScore em XML (`.mscx`) para o `hinario.json` do app
(ver [`docs/FORMATO.md`](../../docs/FORMATO.md)).

```bash
cd tools/mscx2json
cargo run --release -- --id meu-hinario --nome "Meu hinário" /pasta/com/hino-1.mscx ... > hinario.json
```

- Os arquivos devem se chamar `hino-<número>.mscx` (os demais são ignorados com aviso).
- Tempo em batidas (semínima = 1), notas em MIDI, uma voz por pauta/voz do MuseScore.
- Suporta pontos, pausas, anacruse, ligaduras, quiálteras, acordes e várias pautas/vozes.
  Apojaturas são ignoradas.
- Dinâmica, letra e tonalidade **não** são extraídas.

## Limitações conhecidas

- **Repetições e saltos (ritornelo, D.C., coda) não são expandidos**: o conversor avisa e
  lê a partitura uma vez, em ordem.
- Entende o formato `.mscx` do MuseScore 3. Foi testado apenas com partituras fictícias
  escritas à mão; arquivos reais, principalmente do MuseScore 4, podem exigir ajustes
  (em especial a marcação de ligaduras).
- Arquivos compactados `.mscz` precisam ser exportados como `.mscx` (Arquivo → Salvar como…).

## Direitos autorais

A ferramenta é código MIT e funciona com qualquer partitura. **Quem converte é responsável
por ter autorização para usar a partitura de origem.** Não coloque o resultado em repositório
público sem a permissão de quem detém os direitos da transcrição e da obra.
