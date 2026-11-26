# Biblioteca Musical

Aplicativo gratuito e de código aberto para músicos em treino: estudar hinos ouvindo cada voz (soprano, contralto,
tenor e baixo) e acompanhando a letra. Feito com **Rust + Tauri 2** e interface em **Svelte 5 (SvelteKit) +
TypeScript**. O alvo principal é o **Android**; o desktop funciona para desenvolver.

> **Aviso:** projeto **não oficial**, sem vínculo com a Congregação Cristã no Brasil. O app não é vendido e não pode
> ser usado para vender conteúdo.

**Estado:** em desenvolvimento, em teste fechado com músicos (versão 0.3.7). Ainda não há versão publicada em loja. Quer ajudar? Veja o [`CONTRIBUTING.md`](CONTRIBUTING.md); falhas de segurança, o [`SECURITY.md`](SECURITY.md).

## Sobre o conteúdo

Este repositório contém **somente código**. Nenhum hino real está aqui: letras, partituras e áudios **não fazem parte
do repositório** (ficam fora do Git, na pasta `content/`, que é ignorada) e só devem ser distribuídos com autorização de
quem detém os direitos (a do transcritor, Enéias Ramos, está registrada em [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md); a dos autores das letras e músicas e da edição, não). **O hinário e as partituras também não vêm dentro do app**: a pessoa os baixa uma vez em Ajustes
(o primeiro acesso oferece o download do hinário) e eles ficam no aparelho, conferidos por tamanho e SHA-256, com uma barra de andamento (90% o download, o resto a conferência e a instalação). Os pacotes levam o SHA-256 no nome (`hinario-<sha8>.json`, `partituras-<sha8>.zip`)
([`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md) e [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md)). Os arquivos de teste (`src-tauri/exemplo/` e `tools/mscx2json/tests/fixtures/`) são
**fictícios**. O formato dos dados está em [`docs/FORMATO.md`](docs/FORMATO.md).

O código foi escrito do zero: nenhum código ou arquivo de outros aplicativos foi copiado.

## Recursos

- **Ouvir:** o hino todo (introdução, cada vez da letra e o final, com pausa entre as partes) ou só uma parte. A parte
  que está soando fica em destaque. Pausar, trocar o andamento, o tom ou o instrumento e continuar do mesmo ponto.
- **Vozes:** volume próprio, silenciar e escolher o instrumento de cada voz (órgãos, flauta, clarinete, trompete,
  sax, trombone, tuba, cordas e outros).
- **Andamento** de 1 em 1 e de 5 em 5 bpm, e **transposição** em semitons.
- **Sons gravados (opcional):** por padrão o som é sintetizado no aparelho. Em Ajustes dá para baixar um pacote de
  instrumentos gravados (GeneralUser GS, de S. Christian Collins, com licença própria que permite redistribuir; ver [`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md)), conferido por SHA-256 e usado offline depois. O pacote não está no
  repositório nem no app. Detalhes em [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- **Lista de hinos** com busca por número ou título; o **último hino aberto** fica marcado e há o atalho **Continuar de onde parou**.
- **Letra** com as estrofes (o coro e o final em negrito), em abas na parte de baixo da tela (ao lado, com o celular deitado), com o **karaokê** acendendo cada sílaba.
- **Partitura** de cada hino (opcional, baixada em Ajustes), com o compasso e a nota que está soando em destaque.
- **Afinador:** dá o tom (Lá 440 ou outra nota, com temporizador), lembra as últimas notas usadas e, em "Qual nota é essa?", ouve o microfone e diz a nota que você toca, com os cents e as vizinhas (e a nota que se lê em instrumentos que transpõem, como o trompete em Si♭).
- **Gravador:** grava a sua voz ou o seu instrumento (segue gravando com a tela bloqueada; a escolha **Reduzir ruído** (Desligado, Baixo, Médio ou Alto: o filtro do Android, o RNNoise e o GTCRN, que rodam no próprio aparelho) vem desligada por padrão), guarda no aparelho, deixa achar, filtrar, renomear e favoritar as gravações, e compartilha pela folha do sistema. A gravação sai como **Ogg/Opus (`.ogg`)**, que o WhatsApp e o Telegram aceitam como áudio ([`docs/ideia-enviar-audio-por-app.md`](docs/ideia-enviar-audio-por-app.md)). Com fone, dá para gravar ouvindo um hino.
- **Metrônomo:** de 30 a 240 bpm, compassos simples (2, 3, 4) e compostos (6, 9, 12), pêndulo que vai e volta; segue com a tela bloqueada e lembra os últimos usados.
- **Saída de áudio:** em Ajustes, a saída em uso (alto-falante, fone com fio, USB-C ou Bluetooth) e quatro modos, **Automático e buffer alto, médio e baixo**, guardados por saída, com as medidas do que valeu, para quem ouve estalos no fone ([`docs/saida-de-audio.md`](docs/saida-de-audio.md)).
- **Tela ligada:** um botão na tela do hino (o olho) mantém a tela acesa enquanto o hino toca.
- **Aparência:** modo automático, claro ou escuro, combinado com três estilos de cor (Normal, Pergaminho e Marinho e
  ouro), com contraste conferido ([`docs/design-tokens.md`](docs/design-tokens.md)).
- Interface em português, espanhol e inglês, pronta para novos idiomas ([`docs/TRADUCOES.md`](docs/TRADUCOES.md)).
- Acessibilidade: alvos de toque de pelo menos 44 px, contraste conferido, respeito a "reduzir movimento".

## Conversor de partituras

`tools/mscx2json` (Rust) converte arquivos do MuseScore (`.mscx`) para o formato do app (`hinario.json`). Quem for usar conteúdo
próprio faz a conversão na sua máquina e publica o arquivo para o app baixar (ver [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md)).

## Roadmap

[`docs/roadmap-fase-2.md`](docs/roadmap-fase-2.md) (fase atual), [`docs/roadmap-uxui-inicial.md`](docs/roadmap-uxui-inicial.md)
(fase 1, concluída), [`docs/roadmap-pendencias.md`](docs/roadmap-pendencias.md) (publicação, CI/CD, revisão e testes)
e ideias futuras em [`docs/roadmap-ideas.md`](docs/roadmap-ideas.md) (as já implementadas, em
[`docs/archive/roadmap-implementadas.md`](docs/archive/roadmap-implementadas.md)).

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

APK de teste fechado: [`docs/apk-de-teste.md`](docs/apk-de-teste.md) (como é gerado, assinado e entregue; o zip leva o commit no nome).

Para contribuir (o que a PR precisa ter e o que o CI exige): [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licença

[MIT](LICENSE): vale para o código. Não se aplica a conteúdo de hinários. Licenças de terceiros:
[`docs/licencas-de-terceiros.md`](docs/licencas-de-terceiros.md).
