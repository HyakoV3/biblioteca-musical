# Rascunho: APK no GitHub (sob demanda e em release)

> **Status: rascunho.** Consolidado, junto com os pacotes de conteúdo e o iOS, na **I-34** de [`roadmap-ideas.md`](roadmap-ideas.md). Nada disto roda ainda. Descreve o que vai ser construído, para o responsável revisar antes.
> Itens marcados "(a confirmar)" não foram verificados.

## O que se quer

Compilar o APK do Android no GitHub, sem depender da máquina do responsável, de duas formas:

| Gatilho | O que gera | Para quê |
|---|---|---|
| **Sob demanda** (botão "Run workflow", `workflow_dispatch`) | APK de **teste**, como arquivo do job | Baixar um APK do que está na `main` ou num PR |
| **Tag `v*`** (um *release*) | APK **assinado** com a chave própria, anexado ao *release* do GitHub com o SHA-256 | Distribuir uma versão |

A cada PR ou push **não** compila o Android: leva uns 10 minutos ou mais e não vale o gasto.

**Release e tag são o mesmo gatilho.** Criar a tag `v0.3.1` (por `git tag v0.3.1 && git push origin v0.3.1`, ou em
*Releases, Draft a new release* pela interface) dispara o fluxo, que compila e anexa o APK ao *release*.

## Esboço do fluxo (conceitual, não é o arquivo final)

```yaml
name: apk
on:
  workflow_dispatch:        # sob demanda: APK de teste
  push:
    tags: ["v*"]            # release: APK assinado
jobs:
  apk:
    runs-on: ubuntu-24.04
    steps:
      - checkout, setup-node 22, setup-java 21
      - rustup target add aarch64-linux-android
      - npm ci
      - se for tag: conferir que a tag bate com a versão (tauri.conf.json, package.json, Cargo.toml)
      - npm run tauri android build -- --apk --target aarch64     # sem BMCCB_PACOTE: nenhum hino embutido
      - zipalign -c -P 16 4, assinar com apksigner e conferir com apksigner verify
      - SHA-256 do APK
      - sob demanda: upload-artifact   |   tag: criar o release (rascunho) e anexar o APK e o SHA-256
```

O SDK e o NDK do Android já vêm na imagem do Ubuntu do GitHub (a confirmar a versão do NDK que o Tauri pede, hoje
`30.0.16248370` na máquina do responsável). O Tauri precisa de `JAVA_HOME` (Java 21), `ANDROID_HOME` e `NDK_HOME`.

## Versão

- A tag `vX.Y.Z` tem de bater com a versão em `tauri.conf.json`, `package.json` e `Cargo.toml`; se não bater, o job
  falha antes de compilar. Assim o app mostra o número certo em Ajustes (versão e commit).
- O `versionCode` do Android sai da versão (hoje 0.3.0 vira 3000).
- Versões `0.x` saem como **pré-lançamento** (*pre-release*) no GitHub.

## Assinatura

- **Release:** chave **própria**, criada e guardada pelo responsável (quem perde a chave não consegue mais atualizar o
  app). Entra no GitHub como segredos, por exemplo `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`. O job grava o arquivo da chave só durante a execução, assina, confere e
  apaga; nada disso é impresso no log.
- **Sob demanda, sem chave própria:** o APK de teste sai assinado com uma chave de depuração **criada no próprio job**,
  diferente a cada execução (e diferente da `~/.android/debug.keystore` da máquina). Consequência: um APK baixado do GitHub
  **não atualiza por cima** de um APK compilado na máquina, nem de outra execução; é preciso desinstalar antes. Por isso
  serve só para teste.
- Recomendado: *environment* `release` com aprovação do responsável e **proteção de tags** para só quem tem permissão
  criar `v*`.

## Conteúdo

Os APKs do GitHub saem **sem os hinos embutidos** (o `BMCCB_PACOTE` nunca entra no CI): o repositório é público e o
conteúdo é de terceiros. Depois de instalar, o hinário é importado pelo app. O APK de teste fechado, com os 5 hinos,
continua sendo gerado na máquina do responsável (`docs/apk-de-teste.md`).

## Segurança

- Segredos não chegam a PRs de *forks*; o fluxo só roda por `workflow_dispatch` ou tag, que exigem permissão de escrita.
- Criar o *release* como **rascunho** e publicar à mão evita publicar um APK sem querer.
- Anexar o SHA-256 ao *release* para quem baixa conferir.

## Perguntas em aberto

1. **Só arm64** (quase todos os celulares; é o que os zips de teste já usam) **ou também x86_64** (para o emulador)?
2. Nome do arquivo no *release*: `BibliotecaMusical-CCB-X.Y.Z.apk`?
3. O iOS entra no mesmo fluxo? **Não**: depende da conta paga da Apple (ver `docs/roadmap-pendencias.md`, seção 2).

## Para ligar

1. O responsável cria a chave de assinatura e cadastra os segredos (só o fluxo de release precisa deles).
2. Escrever o `apk.yml` num PR para o vandame revisar; começar só com o gatilho **sob demanda** (não precisa de chave).
3. Testar o release com uma tag de pré-lançamento (por exemplo `v0.3.1-rc1`) antes de uma tag de verdade.
