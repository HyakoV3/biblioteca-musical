# Release e APK no GitHub

O workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) compila, assina e publica o Android no GitHub, sem depender da máquina do responsável. **Status (2026-11-24):** **funcionou no GitHub**. A tag `v0.3.0-rc1` gerou o APK e o AAB assinados, o `SHA256SUMS` e o pré-lançamento (conferido baixando: `sha256sum -c`, `apksigner verify`, `aapt dump badging`: `br.pro.bibliotecamusical`, `versionCode 3000`). **Ainda não** foi instalado no aparelho, a tag final `v0.3.0` não saiu e o envio à Play Store não foi testado (seção "Para ligar").

| Gatilho | O que gera | Para quê |
|---|---|---|
| **Tag `vX.Y.Z`** (ex.: `v0.3.1`) | APK **e AAB assinados** com a chave de envio, `SHA256SUMS` e o **GitHub Release** com tudo anexado | Distribuir uma versão |
| **Tag com sufixo** (`v0.3.1-rc1`) | O mesmo, mas o release sai como **pré-lançamento** | **Entregar um APK de teste aos testadores** (substitui o zip numerado do Nextcloud, que deixou de ser usado) |
| **Sob demanda** (Actions → release → Run workflow) | APK de **teste** com chave descartável de 3 dias, só como artefato do job (baixar exige entrar no GitHub). **Mesmo com os segredos cadastrados, esta execução nunca vê a chave de envio**: só as tags usam os segredos | Conferir o que está na `main` ou numa branch |

A cada PR ou push o `ci.yml` roda (tipos, testes, e2e, Rust). O release **não** roda a cada push (leva uns 15 minutos).

## Como lançar uma versão (ou um APK de teste)

1. Suba a versão **nos três lugares** (têm de ser iguais; o workflow confere): `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json`. **Use `tools/bump.py X.Y.Z`** (sem opção só mostra o que mudaria; **`--aplicar`** grava): ele sobe os três, os lockfiles e os textos que dizem "versão X" (READMEs, exemplo de nome do APK, modelo de bug), recusa versão que não seja maior, e **injeta no `CHANGELOG.md` o bloco "🔬 Code Quality" do Tezcat** (`tzt --changelog-inject`, o mesmo resumo condensado dos outros projetos; precisa do `tzt` instalado, `--sem-tezcat` pula, junto com `--aplicar`). Não mexe no histórico (tags rc, tabela de versões de `docs/apk-de-teste.md`): a linha dessa tabela leva o hash do commit e é à mão. O `versionCode` do Android sai da versão (`0.3.0` vira 3000, `0.3.1` vira 3001); **nunca reutilize** uma versão que já foi para a Play Store.
2. Passe `npm run check`, `npm test` e `npm run test:e2e`.
3. `git tag -a v0.3.1-rc1 -m "..." && git push origin v0.3.1-rc1` (teste) ou `v0.3.1` (versão). O sufixo **não conta** na conferência: `v0.3.1-rc1` vale quando as três versões são `0.3.1`.
4. O workflow confere a tag × versões, o portão (tipos e testes), compila, roda `apksigner verify` e confere as **permissões** do APK, e publica o release com notas geradas dos commits.

**Permissões:** este app **baixa** os pacotes, então `INTERNET` é esperada. O passo "Reunir, conferir e somar" falha se aparecer qualquer permissão **fora da lista** (`INTERNET`, serviço em primeiro plano de mídia e de microfone, notificações, `WAKE_LOCK`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`), porque um plugin novo pode trazer uma sem ninguém notar. Se uma permissão nova for **intencional**, acrescente-a na lista do workflow na mesma PR.

## Chave e segredos (uma vez, num terminal normal)

**Proteja as tags:** só tags usam a chave de envio, então vale restringir quem pode criar `v*` (Settings → Rules → Rulesets → tags), para que quem tem acesso de escrita não assine código por uma tag qualquer. O workflow também não grava as senhas no ambiente dos outros passos (só nos dois passos de compilação), não deixa o token no `.git/config` (`persist-credentials: false`) e não usa cache do npm, que num fluxo que assina seria um risco de envenenamento.

**A chave nunca entra no Git** (`*.jks`, `*.keystore`, `keystore.properties` e `*.idsig` estão no `.gitignore`). Guarde uma cópia do `.jks` e das senhas num cofre seu.

```sh
# 1. a chave de envio (fora do repositório; escolha uma senha forte e guarde-a)
keytool -genkeypair -keystore ~/.android/bibliotecamusical-upload.jks -alias bibliotecamusical \
  -keyalg RSA -keysize 4096 -validity 9125 -dname "CN=Biblioteca Musical, O=Biblioteca Musical, C=BR"

# 2. os segredos (cada comando de senha pergunta o valor; use um terminal normal: no `!` do Claude o prompt grava valor VAZIO)
base64 -w0 ~/.android/bibliotecamusical-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo HyakoV3/biblioteca-musical
gh secret set ANDROID_KEYSTORE_PASSWORD --repo HyakoV3/biblioteca-musical
gh secret set ANDROID_KEY_ALIAS --repo HyakoV3/biblioteca-musical        # bibliotecamusical
gh secret set ANDROID_KEY_PASSWORD --repo HyakoV3/biblioteca-musical
```

| Nome | O quê |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a chave de envio (`.jks`) em base64 |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore |
| `ANDROID_KEY_ALIAS` | alias da chave (`bibliotecamusical`) |
| `ANDROID_KEY_PASSWORD` | senha da chave (se omitida, vale a do keystore) |
| `PLAY_SERVICE_ACCOUNT_JSON` | (opcional) conta de serviço do Play Console, para enviar o AAB |

Variável (não secreta): `ENVIAR_PLAY_STORE=true`, que liga o envio à faixa **interna** da Play Store, como rascunho, **só nas tags finais** (a `-rc` tem o mesmo `versionCode` da final e travaria o envio dela); sem o segredo `PLAY_SERVICE_ACCOUNT_JSON` o job falha com uma mensagem clara. O `applicationId` é fixo no Gradle. **Depois de cadastrar, confira** (o GitHub só mostra "Set": um segredo vazio só aparece como erro no workflow, "The 'client-id' input must be set to a non-empty string" ou "a chave de assinatura não abriu"). Com a Play App Signing ativa, a chave guardada é só a de **envio**: se for perdida, o Google permite trocá-la.

**No Gradle** (`src-tauri/gen/android/app/build.gradle.kts`): o release é assinado **só** se existirem `keystore.properties` (modelo em `src-tauri/gen/android/keystore.properties.example`) ou as variáveis `BM_KEYSTORE`, `BM_KEYSTORE_PASSWORD`, `BM_KEY_ALIAS` e `BM_KEY_PASSWORD` (o workflow as define a partir dos segredos). **Sem elas** o release continua saindo `unsigned`, e o fluxo dos APKs de teste da máquina do responsável (`apk-de-teste.md`: `zipalign` e `apksigner` com a chave de depuração) **não muda**.

## Release imutável e portões (onda 11 da auditoria)

O que o `release.yml` passou a exigir, e o que **só o responsável** liga no GitHub (nada disso se aplica por código):

| O que | Como funciona | Ação do responsável |
|---|---|---|
| Disparo manual numa tag | Recusado no início do job (o release é imutável); sob demanda só vale num branch | — |
| Release já existente | O job `publicar` falha em vez de sobrescrever (`--clobber` saiu). Para refazer um envio que falhou no meio: apague o release e a tag e gere de novo | — |
| Tag na `main` com o CI verde | O job confere que o commit da tag é ancestral da `main` e que os 4 checks de build passaram naquele commit. Se o CI da `main` ainda roda, espere e reexecute | — |
| Certificado fixado | Com a variável `ANDROID_CERT_SHA256`, o APK e o AAB assinados têm de trazer esse certificado (sem a variável, só avisa) | Cadastrar a variável (Settings → Secrets and variables → Actions → **Variables**) com a impressão digital SHA-256 do certificado de envio, só hexadecimal |
| Auditoria no release | `npm audit --audit-level=high` (com as dependências de build) e `cargo audit` no `src-tauri/Cargo.lock` antes de compilar | — |
| Rust fixo | `rust-toolchain.toml` com a versão exata (hoje 1.99.1), usado no CI, nas PRs do Android e no release. Subir a versão é um commit | — |
| Gradle fixo | `distributionSha256Sum` no `gradle-wrapper.properties` e validação do `gradle-wrapper.jar` no CI. Ao subir o Gradle, atualize a soma (a oficial está em `services.gradle.org/distributions/gradle-X-bin.zip.sha256`) | — |
| Proteção de tags | Regra do repositório (Settings → Rules → Rulesets) que só deixa criar tags `v*` a quem tem permissão e proíbe apagá-las e movê-las | **Feito em 2026-11-27**: ruleset "Proteger tags de versão" em `refs/tags/v*` (sem apagar, atualizar nem mover). A criação segue liberada a quem tem escrita |

Fica para depois: fixar por SHA as actions dos workflows do Claude e dar o escopo de PR ao token da revisão (CICD-009), que depende da ação A-03 do responsável.

## Conteúdo

Os APKs do GitHub saem **só com o pacote de exemplo embutido** (5 hinos de domínio público, ver [`pacote-de-exemplo.md`](pacote-de-exemplo.md)), nunca com o hinário real (o `BM_PACOTE` nunca entra no CI): o repositório é público e o conteúdo é de terceiros. Depois de instalar, o hinário e as partituras são **baixados pelo app** (ver `docs/pacote-do-hinario.md`). O AAB da Play Store tem teto de 200 MB (o APK arm64 tem ~11,4 MiB: a `v0.3.9-rc10` tem 11.958.353 bytes e o AAB 7.074.619).

## O que a assinatura muda para quem testa

- O APK de **release** (chave de envio) e o de **teste da máquina** (chave de depuração) têm assinaturas **diferentes**: o Android **não instala um por cima do outro**. Quem passar do zip de teste para o APK do GitHub precisa desinstalar antes (os dados do app, como as gravações, vão junto: exportar antes).
- O APK sob demanda usa uma chave descartável **diferente a cada execução**, então também não atualiza por cima de nenhum outro.

## Identificador do app (applicationId)

`br.pro.bibliotecamusical` (`tauri.conf.json` e `build.gradle.kts`). **Não pode mudar depois de publicado na Play Store.**

## Dependabot

`.github/dependabot.yml` agrupa as atualizações menores e patches em **um PR por ecossistema** (npm, cargo no `src-tauri` e no `tools/mscx2json`, GitHub Actions e Gradle) e **ignora as majors problemáticas**: SvelteKit e adapter-static (andam juntos) e TypeScript (conflita com o `svelte-check`). As dependências do Android (Gradle, Kotlin, androidx) **não são compiladas pelo CI normal**: antes de mesclar um PR delas, rode o release sob demanda na branch.

## Armadilhas já vividas (no Nicska, o app irmão)

- **`cargo install cargo-audit` passa de 30 minutos** no CI (compila do zero): use `taiki-e/install-action`.
- **Dependabot só roda o CI com a `main` atual:** peça `@dependabot rebase`. Em lote os PRs conflitam no lockfile.
- **Token do Claude sem crédito** derruba o passo da revisão em 2 s, sem mensagem (o `review` e o `resolve` não bloqueiam o merge).
- **Actions fixadas por SHA** (como no `release.yml`): resolva o SHA da tag com `gh api repos/<dono>/<repo>/git/ref/tags/<tag>` (e, se for tag anotada, `git/tags/<sha>`). Os SHAs do `release.yml` foram conferidos em 2026-11-24.

## Limites conhecidos

- Só **arm64** (`aarch64`); aparelhos de 32 bits e emuladores x86 não instalam. Dá para acrescentar `--target armv7` quando fizer falta.
- O alinhamento de 16 KB das bibliotecas nativas (exigido pela Play Store em Android 15 ou mais) é **conferido com um aviso** (`zipalign -c -P 16 4`), que não derruba o release; o fluxo manual dos APKs de teste já alinha com `zipalign -P 16 4`.
- iOS **não** entra neste fluxo: depende da conta paga da Apple e de um Mac (ver `docs/roadmap-pendencias.md`, seção 2).

## Para ligar (estado e o que falta)

1. **Feito (2026-11-24):** chave de envio gerada e 4 segredos cadastrados (`~/.android/bibliotecamusical-upload.jks` e `.senha`, só do responsável; **guardar cópia num cofre**), nenhum vazio.
2. **Feito:** execução sob demanda na `main` (APK de teste) e a tag `v0.3.0-rc1` (APK + AAB assinados, `SHA256SUMS`, pré-lançamento) passaram no GitHub. Na primeira execução sob demanda apareceu um bug (o passo de conferência caía sem AAB), corrigido na PR #157.
3. **Falta:** instalar o APK do release no aparelho e testar (downloads de hinário, partituras e sons pelo GitHub; navegação com o SvelteKit 3). Quem tem um APK de teste antigo precisa **desinstalar antes** (a chave é outra).
4. **Falta:** a tag final (sem sufixo) e, se for o caso, `ENVIAR_PLAY_STORE=true` (o primeiro envio à Play é manual: o app precisa existir no Play Console, e é preciso o segredo `PLAY_SERVICE_ACCOUNT_JSON`). A versão subiu para 0.3.1 (`v0.3.1-rc2`, `versionCode` 3001), para **0.3.2** (`v0.3.2-rc3`, `versionCode` 3002), para **0.3.3** (`v0.3.3-rc4`, `versionCode` 3003) para **0.3.4** (`v0.3.4-rc5`, `versionCode` 3004) e para **0.3.5** (`v0.3.5-rc6`, `versionCode` 3005) em 2026-11-25 e para **0.3.6** (`v0.3.6-rc7`, `versionCode` 3006) e para **0.3.7** (`v0.3.7-rc8`, `versionCode` 3007) em 2026-11-26 e para **0.3.8** (`v0.3.8-rc9`, `versionCode` 3008) em 2026-11-26 e para **0.3.9** (`v0.3.9-rc10`, `versionCode` 3009) em 2026-11-27; o certificado é o mesmo em todos, então um atualiza por cima do outro.
5. **Feito:** o zip numerado no Nextcloud deixou de ser o caminho; `docs/apk-de-teste.md` descreve a entrega pelo GitHub.
