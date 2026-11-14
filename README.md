# BibliotecaMusical CCB

Aplicativo gratuito e de código aberto (Android, iOS e desktop) para músicos em treino:
consulta e estudo de hinos. Feito com **Rust + Tauri 2** e interface em **Svelte (SvelteKit) + TypeScript**.

> **Aviso:** projeto **não oficial**, sem vínculo com a Congregação Cristã no Brasil.
> O app não é vendido e não pode ser usado para vender conteúdo.

## Sobre o conteúdo

Este repositório contém **somente código**. Letras, partituras e áudios dos hinários
**não fazem parte do repositório** (ficam fora do controle de versão, em `content/`,
que é ignorado pelo Git) e só devem ser distribuídos com autorização de quem detém os direitos.
O formato esperado dos dados está em [`docs/FORMATO.md`](docs/FORMATO.md).

O código foi escrito do zero (clean room): nenhum código ou arquivo de outros aplicativos foi copiado.

## Recursos

- Player por síntese, sem gravações: cada voz (Soprano, Contralto, Tenor e Baixo) pode ter seu
  instrumento (3 órgãos, flauta doce, violino, clarinete, trompete, sax, flugelhorn, trombone,
  tuba e outros), volume próprio e ser silenciada durante a execução.
- Andamento e transposição ajustáveis.
- Interface em português, espanhol e inglês, pronta para novos idiomas
  ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).

Prioridades e próximas etapas: [`docs/roadmap-uxui-inicial.md`](docs/roadmap-uxui-inicial.md).
Ideias para o futuro: [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md).

## Desenvolvimento

Requisitos: Rust, Node.js e as [dependências do Tauri](https://tauri.app/start/prerequisites/)
(no Linux: webkit2gtk e rsvg2).

```bash
npm install
npm run tauri dev            # desktop
npm run tauri android init   # uma vez
npm run tauri android dev    # Android
```

## Licença

[MIT](LICENSE) — vale para o código. Não se aplica a conteúdo de hinários.
