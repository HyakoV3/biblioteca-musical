# Biblioteca Musical CCB

Aplicativo gratuito e de código aberto para músicos em treino: estudar hinos ouvindo cada voz (soprano, contralto,
tenor e baixo) e acompanhando a letra. Feito com **Rust + Tauri 2** e interface em **Svelte 5 (SvelteKit) +
TypeScript**. O alvo principal é o **Android**; o desktop funciona para desenvolver.

> **Aviso:** projeto **não oficial**, sem vínculo com a Congregação Cristã no Brasil. O app não é vendido e não pode
> ser usado para vender conteúdo.

**Estado:** em desenvolvimento, em teste fechado com músicos (versão 0.3.0). Ainda não há versão publicada em loja.

## Sobre o conteúdo

Este repositório contém **somente código**. Nenhum hino real está aqui: letras, partituras e áudios **não fazem parte
do repositório** (ficam fora do Git, na pasta `content/`, que é ignorada) e só devem ser distribuídos com autorização de
quem detém os direitos. Os arquivos de teste (`src-tauri/exemplo/` e `tools/mscx2json/tests/fixtures/`) são
**fictícios**. O formato dos dados está em [`docs/FORMATO.md`](docs/FORMATO.md).

O código foi escrito do zero: nenhum código ou arquivo de outros aplicativos foi copiado.

## Recursos

- **Ouvir:** o hino todo (introdução, cada vez da letra e o final, com pausa entre as partes) ou só uma parte. A parte
  que está soando fica em destaque. Pausar, trocar o andamento, o tom ou o instrumento e continuar do mesmo ponto.
- **Vozes:** volume próprio, silenciar e escolher o instrumento de cada voz (órgãos, flauta, clarinete, trompete,
  sax, trombone, tuba, cordas e outros).
- **Andamento** de 1 em 1 e de 5 em 5 bpm, e **transposição** em semitons.
- **Sons gravados (opcional):** por padrão o som é sintetizado no aparelho. Em Ajustes dá para baixar um pacote de
  instrumentos gravados (FluidR3, licença MIT), conferido por SHA-256 e usado offline depois. O pacote não está no
  repositório nem no app. Detalhes em [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- **Letra** com as estrofes, em abas na parte de baixo da tela (ao lado, com o celular deitado).
- **Aparência:** modo automático, claro ou escuro, combinado com três estilos de cor (Normal, Pergaminho e Marinho e
  ouro), com contraste conferido ([`docs/design-tokens.md`](docs/design-tokens.md)).
- Interface em português, espanhol e inglês, pronta para novos idiomas ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).
- Acessibilidade: alvos de toque de 48 px, contraste conferido, respeito a "reduzir movimento".

## Conversor de partituras

`tools/mscx2json` (Rust) converte arquivos do MuseScore (`.mscx`) para o formato do app. Quem for usar conteúdo
próprio faz a conversão na sua máquina e importa o arquivo em Ajustes.

## Roadmap

[`docs/roadmap-fase-2.md`](docs/roadmap-fase-2.md) (fase atual), [`docs/roadmap-uxui-inicial.md`](docs/roadmap-uxui-inicial.md)
(fase 1, concluída), [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md) (publicação, CI/CD, revisão e testes)
e ideias futuras em [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md).

## Desenvolvimento

Requisitos: Rust, Node.js e as [dependências do Tauri](https://tauri.app/start/prerequisites/)
(no Linux: webkit2gtk e rsvg2).

```bash
npm install
npm run tauri dev            # desktop
npm run tauri android init   # uma vez
npm run tauri android dev    # Android
npm run check                # tipos (svelte-check, inclui tests/)
npm test                     # testes da lógica (Vitest), só com dados fictícios
npm run test:e2e             # karaokê num Chrome de verdade (precisa de Chrome ou Chromium)
```

Os testes do conversor e do leitor em Rust: `cargo test` em `tools/mscx2json` e `cargo test --lib` em `src-tauri`.

APK de teste fechado: [`docs/apk-de-teste.md`](docs/apk-de-teste.md).

## Licença

[MIT](LICENSE): vale para o código. Não se aplica a conteúdo de hinários. Licenças de terceiros:
[`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md).
