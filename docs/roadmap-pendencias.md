# Pendências fora do produto

O que falta além das funções do app: publicação, automação (CI/CD), revisão de código e testes. As etapas do produto
estão em [`roadmap-fase-2.md`](roadmap-fase-2.md); as ideias, em [`roadmap-ideas.md`](roadmap-ideas.md).

Legenda: `[x]` feito · `[ ]` a fazer · **(depende de ...)** o que bloqueia o item.

---

## 1. Publicação no GitHub

- [x] Repositório **público** criado em 2026-11-14: <https://github.com/HyakoV3/biblioteca-musical-ccb>. Um só e-mail de autor (o `noreply` do GitHub) e sem co-autoria.
- [ ] Proteções: bloquear exclusão e *force-push* da `main`; ativar *secret scanning* e *push protection*;
      Dependabot (npm, cargo e GitHub Actions).
- [ ] Arquivos da comunidade: `CONTRIBUTING.md`, `SECURITY.md`, modelos de *issue* e de *pull request*.
- [ ] Descrição, tópicos e imagem de pré-visualização do repositório.
- [ ] **Regra de ouro:** nada sensível no Git. Conteúdo de hinários e notas locais ficam fora do Git (`content/` e `docs/privado/`, no `.gitignore`).

## 2. CI/CD (GitHub Actions)

- [ ] **CI** a cada *push* e *pull request*: `npm run check`; `tools/verificar-traducoes.py`,
      `tools/verificar-movimento.py` e `tools/contraste.py`; `cargo test` (e `fmt`/`clippy`) do conversor
      `tools/mscx2json`; cache de npm e de cargo.
- [ ] **APK de teste no GitHub** (Android): JDK 21, SDK e NDK, `npm run tauri android build -- --apk --target aarch64`,
      APK como artefato do *workflow*.
      **Sem conteúdo embutido:** o `BMCCB_PACOTE` (hinos de terceiros) nunca entra no CI nem em *release* público. Só o
      APK de teste fechado, gerado na máquina do responsável, leva conteúdo (`apk-de-teste.md`).
- [ ] **Assinatura:** criar uma chave **própria** (a de depuração só serve para teste fechado) e guardá-la como segredo
      do GitHub (keystore em base64 e senhas). *Release* assinado só em tag `v*`, publicado em *GitHub Releases* com o
      SHA-256. **(depende do responsável: criar e guardar a chave)**
- [ ] Conferir que versão e commit (`__APP_VERSAO__`, `__APP_COMMIT__`) aparecem certos no APK do CI.
- [ ] **iOS:** o GitHub tem máquinas macOS (de graça em repositório público), então o CI consegue **compilar** o app
      iOS sem Mac. Mas **instalar** em iPhone, usar o TestFlight ou publicar na App Store exige uma conta do
      **Apple Developer Program** (cerca de US$ 99 por ano), com certificado e perfil de provisionamento guardados como
      segredos. Sem a conta, só sai build de simulador. Decidir entre iOS e uma versão web instalável (PWA); com PWA, a
      página sai pelo GitHub Pages. **(depende do responsável)**

## 3. Revisão de código

- [ ] Revisão automática de código nos *pull requests*. Ferramenta a definir (o responsável citou "vandame", a
      confirmar qual é). Pontos que a revisão deve cobrir: segurança (rede só para o servidor de sons, conferência de
      SHA-256), acessibilidade (alvos de 48 px, contraste, movimento reduzido) e dados de terceiros fora do Git.

## 4. Testes automatizados

- [x] **Testes do app no repositório** (`tests/`, executor Vitest): `npm test`. 48 testes em 7 arquivos, só com dados
      **fictícios** (`tests/amostras.ts`; nenhum hino real entra no Git): partes e vezes do hino (introdução, final,
      pausas), sintetizador (reagendar na pausa, tempo audível), karaokê (validação e escolha da sílaba), pacote de
      sons (zips sintéticos adulterados, truncados e "bomba"), catálogo de sons gravados x manifesto, número do hino e
      preferências. Os tipos dos testes passam por `npm run check`.
- [x] Regressão do `smplr`: `parar()` tem de esvaziar a fila do agendador (`tests/sintetizador.test.ts`). Conferido: sem
      a correção, o teste falha.
- [x] **Ponta a ponta do karaokê** (`npm run test:e2e`, `tests/e2e/karaoke.mjs`): sobe o Vite e um Chrome mudo, entrega
      um hino fictício por um `invoke` simulado do Tauri e confere sílaba, estrofe, tempo, pausa e o botão. Precisa de
      Chrome ou Chromium (variável `CHROME` indica o executável) e não sobra processo nem pasta temporária.
- [x] O conversor `tools/mscx2json` tem testes em Rust, dentro do repositório (`cargo test`), e o leitor do app também
      (`cargo test --lib` em `src-tauri`).
- [ ] Rodar tudo isso no **CI** (seção 2). O e2e é mais pesado: avaliar rodá-lo só em `main` ou sob demanda.
- [ ] Testes de componentes Svelte e do store (`reproducao.svelte.ts`), que dependem do compilador do Svelte no
      Vitest: ficam de fora por enquanto (a lógica pura já está coberta).

## 5. Ambiente de teste (emulador)

- [ ] O emulador mostra diálogos de "não está respondendo". Investigação de 2026-11-14 (só leitura): o log do sistema
      **não tem nenhum ANR do nosso app**; o DropBox do Android tem só 8 quedas nativas desde as 16h, **todas da
      pilha de Bluetooth do emulador**; o app instalado ali é uma compilação de **depuração x86_64 de 201 MB** (a do
      `tauri android dev`), bem mais pesada que o APK de teste de ~10 MB; a imagem é Android 17 com 4 GB de RAM.
      Para melhorar: testar com uma compilação de release para x86_64, aumentar a memória do emulador, e preferir uma
      imagem sem Play Store. Falta o texto exato do diálogo e de qual app ele vem. **(depende do responsável)**

## 6. Produto (resumo)

Feito: **karaokê, fase A** (a letra acompanhando a música), a validar no celular. Depois: créditos do
FluidR3, teste das 4 vozes gravadas no celular, partitura (I-08) e, por último, o conteúdo completo. Detalhes em
[`roadmap-fase-2.md`](roadmap-fase-2.md).
