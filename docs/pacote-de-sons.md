# Pacote de sons gravados

Os sons gravados são **opcionais**: a síntese continua sendo o som padrão (leve, funciona offline desde o primeiro uso) e
cada instrumento gravado é baixado só se a pessoa quiser. Decisão do responsável em 2026-11-14 (ver I-07 em
`roadmap-ideas.md`). Banco de sons: FluidR3_GM (MIT), ver `docs/licencas-de-terceiros.md`.

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
| FluidR3_GM / MusyngKite (banco atual) | Não tem euphonium (só `tuba`, `trombone`, `french_horn`). |
| VCSL (CC0) | Lista de arquivos lida no repositório: **nenhum instrumento de metal**. |
| Philharmonia Orchestra (amostras gratuitas) | Os termos oficiais permitem uso em obra comercial, mas **proíbem tornar as amostras disponíveis como estão ou como instrumento de amostras**; um espelho no GitHub diz CC BY-SA 3.0, o que **não bate** com o texto oficial. Não se confirmou que o euphonium esteja na biblioteca. **Não usar sem autorização por escrito.** |
| MuseScore_General (MIT) | Tem um preset "Euphonium", mas é uma **tuba reprocessada** com a extensão ampliada, não um euphonium amostrado. A licença é clara; falta extrair o preset do arquivo SF3 (ferramenta ainda não escolhida). |

Nada foi baixado para essa busca. **Não rotular outro instrumento (tuba, trombone) como "Bombardino".**

Cada arquivo tem as notas MIDI 30 a 86 (a faixa dos hinos mais a transposição de ±6 semitons e folga), no mesmo formato
que o `smplr` já lê. Tamanho depois do corte: de 1,6 a 2,1 MB por instrumento.

## Gerar

```sh
sh tools/baixar-sons-teste.sh        # baixa os arquivos originais do banco para static/sons/ (fora do Git)
python3 tools/preparar-sons.py --pacote sons-001 --saida <pasta de saída>/sons-001
# ou só alguns:  --instrumentos drawbar_organ flute clarinet
```

Saem os `*-mp3.js` e um `manifesto.json` (instrumento, notas, bytes e SHA-256 de cada arquivo).

## Hospedagem

- **Agora (testes):** uma **pasta dedicada** só com os sons, no **File Browser** que o responsável já roda no servidor do responsável, com
  **link público de leitura** (sem senha). A pasta é a mesma do Nextcloud (`<pasta de saída>/sons-001`), que
  sincroniza com o servidor. Nada mais do servidor pessoal fica exposto.
- **Depois:** GitHub Releases quando o código for público; o servidor do responsável vira espelho.
- O app **baixa pelo lado nativo** (Rust), porque servidores de link público costumam não liberar o acesso do navegador
  interno (CORS); **confere o SHA-256** contra o manifesto que vem dentro do app, então um arquivo trocado no servidor é
  recusado; e aceita **uma lista de endereços** (espelhos).

## Segurança do formato

O `smplr` lê o arquivo com `JSON.parse` e decodifica o áudio; **não executa** o conteúdo (conferido em 2026-11-14: nenhum
`eval`, `Function` nem criação de script). Um arquivo adulterado só pode dar erro ou um som estranho.

## O que falta no app

- [ ] Manifesto dentro do app (`instrumento`, `arquivo`, `bytes`, `sha256`, endereços) e a lista de instrumentos por voz.
- [ ] Download pelo lado nativo, conferência do SHA-256 e armazenamento no aparelho (funciona offline depois).
- [ ] Ajustes, "Sons gravados": lista por grupo com o tamanho de cada instrumento, baixar, remover, baixar o grupo, e
      quanto espaço ocupa.
- [ ] O seletor de instrumento de cada voz mostrar só os gravados que já foram baixados (já é assim no protótipo).
- [ ] Texto de créditos com o aviso de copyright do FluidR3 (`docs/licencas-de-terceiros.md`).
