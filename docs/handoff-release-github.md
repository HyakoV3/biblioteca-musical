# Handoff: gerar APK/AAB no GitHub (feito no Nicska, para refazer aqui)

Resumo do que foi montado no repositório **Nicska** (`HyakoV3/nicska`, 2026-11-24) para o GitHub compilar, assinar e publicar o APK e o AAB do Android, e o que muda para o BibliotecaMusical. O vandame (revisão do Claude nos PRs) **já existe aqui**: não precisa refazer.

Referência pronta para copiar: `~/Development/nicska/.github/workflows/release.yml` e `~/Development/nicska/docs/release-e-apk-no-github.md`, `docs/lojas.md`, `docs/privacidade.md`.

## 1. O que o Nicska ganhou

| Peça | Arquivo no Nicska | Para quê |
|---|---|---|
| Workflow de release | `.github/workflows/release.yml` | Tag `vX.Y.Z` → APK + AAB assinados + `SHA256SUMS` + GitHub Release. Sob demanda (`workflow_dispatch`) → só um APK de teste, como artefato. |
| Assinatura condicional | `src-tauri/gen/android/app/build.gradle.kts` | Lê `keystore.properties` ou as variáveis `NICSKA_KEYSTORE`, `NICSKA_KEYSTORE_PASSWORD`, `NICSKA_KEY_ALIAS`, `NICSKA_KEY_PASSWORD`; sem elas, o release sai sem assinatura. |
| Exemplo de chave | `src-tauri/gen/android/keystore.properties.example` | Modelo (nunca com valores reais). |
| `.gitignore` | `.gitignore` | `*.jks`, `*.keystore`, `keystore.properties`, `*.idsig`, `/docs/privado/`. |
| Dependabot agrupado | `.github/dependabot.yml` | 1 PR por ecossistema (menores e patches) e `ignore` das majors problemáticas. |
| Docs de loja e privacidade | `docs/lojas.md`, `docs/privacidade.md` | Passo a passo da Play Store e do iOS; política de privacidade para a ficha da loja. |
| Comunidade | `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/*`, `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS` | Repositório público. |

## 2. Estado do BibliotecaMusical (conferido em 2026-11-24)

- **Já tem:** `ci.yml` (web, conversor, leitor), vandame (`claude-code-review.yml`, `claude-resolve-threads.yml`) e os segredos `VANDAME_APP_ID`, `VANDAME_APP_PRIVATE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN_ENTERPRISE` e `_PESSOAL`.
- **Falta:** workflow de release, assinatura no `build.gradle.kts`, chave de envio, segredos do Android.
- **Versão** hoje `0.3.0` (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`; `tauri.properties` gera `versionCode=3000`).
- **applicationId** `br.pro.bibliotecamusical` (`tauri.conf.json` e `build.gradle.kts`). Não muda depois de ir para a Play Store.
- **Diferença importante:** este app **declara `INTERNET`** (baixa os pacotes de conteúdo). O `release.yml` do Nicska **falha o build se o APK pedir INTERNET**; aqui isso precisa ser **removido ou invertido** (ver passo 4).
- Não há `rust-toolchain.toml` aqui (o Nicska tem, e o workflow usa `rustup show`).

## 3. Passo a passo

1. **Assinatura no Gradle.** Em `src-tauri/gen/android/app/build.gradle.kts`, copie do Nicska o bloco que lê `keystore.properties`/variáveis (as linhas com `keystoreProps`, `segredo(...)`, `assinaturaConfigurada`), o `signingConfigs { ... }` e o `signingConfig` dentro de `getByName("release")`. Use o mesmo prefixo de variáveis `NICSKA_*` (ou renomeie para `BM_*` no Gradle **e** no workflow, em conjunto). Copie também `keystore.properties.example` e as linhas do `.gitignore`.
2. **Chave de envio** (uma vez, fora do repositório, guarde cópia e a senha num cofre):
   ```
   keytool -genkeypair -keystore ~/.android/bibliotecamusical-upload.jks -alias bibliotecamusical -keyalg RSA -keysize 4096 -validity 9125 -dname "CN=Biblioteca Musical, O=Biblioteca Musical, C=BR"
   ```
   Com a Play App Signing ativa, essa é só a chave de **envio**; se for perdida, o Google permite trocá-la.
3. **Segredos** (Settings → Secrets and variables → Actions). **Cadastre com `gh secret set` num terminal normal**; dentro do `!` do Claude o prompt não funciona e grava valor vazio:
   ```
   base64 -w0 ~/.android/bibliotecamusical-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 --repo HyakoV3/biblioteca-musical
   gh secret set ANDROID_KEYSTORE_PASSWORD --repo HyakoV3/biblioteca-musical
   gh secret set ANDROID_KEY_ALIAS --repo HyakoV3/biblioteca-musical      # bibliotecamusical
   gh secret set ANDROID_KEY_PASSWORD --repo HyakoV3/biblioteca-musical
   gh variable set ANDROID_APPLICATION_ID --repo HyakoV3/biblioteca-musical --body br.pro.bibliotecamusical
   ```
4. **Workflow.** Copie `.github/workflows/release.yml` do Nicska e ajuste:
   - o passo **"Reunir, conferir e somar"**: apague o `if ... grep -q 'android.permission.INTERNET' ... exit 1` (este app precisa de internet);
   - os nomes `nicska-$v.apk`/`.aab` e `nicska-*` (padrões do `upload-artifact`, `download-artifact` e `pattern:`) para `bibliotecamusical-...`;
   - o título do release (`--title "Nicska ..."`);
   - **conteúdo grande no APK?** os pacotes de partituras/sons/hinário ficam fora do app (baixados); confirme que `npm run build` não os embute. O limite do AAB na Play Store é 200 MB;
   - se faltar o `rust-toolchain.toml`, o passo `rustup show active-toolchain` instala o `stable`; para fixar a versão como no Nicska, crie o arquivo (`channel = "<versão>"`, `components = ["rustfmt","clippy"]`, `profile = "minimal"`).
5. **Versão.** Mantenha as três versões iguais (o workflow compara a tag `vX.Y.Z` com `package.json`, `tauri.conf.json` e `Cargo.toml`). O `versionCode` vem da versão (`0.3.0` → 3000, `0.3.1` → 3001).
6. **Testar sem risco:** Actions → release → *Run workflow* (cria um APK de teste com chave descartável, sem release). Depois: `git tag -a v0.3.1 -m ... && git push origin v0.3.1`.
7. **Conferir o resultado** baixando o release: `sha256sum -c SHA256SUMS`, `apksigner verify --print-certs` (o SHA-256 do certificado deve ser o da sua chave) e `aapt dump badging` (versionName/versionCode).
8. **Dependabot:** copie o `groups` e os `ignore` do `dependabot.yml` do Nicska (SvelteKit, adapter-static, TypeScript e `@types/node` majors ignorados). Sem isso aparecem 10 a 15 PRs de uma vez, e alguns quebram o `npm ci`.

## 4. Armadilhas que já custaram tempo

- **`cargo install cargo-audit` passa de 30 minutos** no CI (compila do zero). Use `taiki-e/install-action` com `tool: cargo-audit`.
- **Majors que quebram o `npm ci`:** `@sveltejs/adapter-static` 4 exige SvelteKit 3; TypeScript 7 conflita com o `svelte-check`; `@types/node` 26 não combina com o Node 22. A `main` chegou a ficar vermelha por mesclar esses PRs sem esperar o CI.
- **Dependabot só roda o CI com `main` atual:** peça `@dependabot rebase`. Em lote os PRs conflitam no lockfile: aplique os patches juntos numa branch e feche os PRs originais.
- **Dependências do Android** (Gradle, Kotlin, material, appcompat) não são compiladas pelo CI normal: rode o release sob demanda na branch antes de mesclar.
- **Segredo vazio:** `gh secret set` com prompt dentro do `!` do Claude grava vazio, e `echo -n "NUMERO"` grava literalmente `NUMERO`. O GitHub só mostra "Set". Sintoma: `The 'client-id' (or deprecated 'app-id') input must be set to a non-empty string`.
- **Token do Claude sem crédito** ("weekly limit") derruba o passo em 2 s com custo 0 e sem mensagem. Teste um token fora do GitHub: `CLAUDE_CODE_OAUTH_TOKEN="..." claude -p "diga oi"`. Nunca cole tokens no chat; gere outros com `claude setup-token` se isso acontecer.
- **App do vandame precisa estar instalado no repositório** (Settings → GitHub Apps → Install), além dos segredos.
- **Porta do e2e** ocupada por outro Vite (o e2e usa 5199): o Nicska aceita `NK_PORTA_VITE`. Duas execuções simultâneas do e2e também se atrapalham (microfone falso).
- **Actions fixadas por SHA** (padrão do Nicska, atualizadas pelo Dependabot): resolva o SHA da tag com `gh api repos/<dono>/<repo>/git/ref/tags/<tag>` (e, se for tag anotada, `git/tags/<sha>`).
- **Assinatura mudou** entre APK de teste (chave de debug) e release (chave de envio): o Android **não instala por cima**; exporte os dados e reinstale uma vez.

## 5. Publicar o repositório limpo (se for abrir ao público)

No Nicska foi feito assim, nesta ordem:
1. Auditar dados sensíveis: `git grep` por e-mail, nome, caminhos `/home/...`, `Nextcloud`, IPs, chaves (`BEGIN PRIVATE KEY`, `ghp_`, `AKIA`), e `git ls-files | grep -E "jks|keystore|pem|env|privado"`.
2. Mover o que é privado para `docs/privado/` (gitignored) com `git rm -r --cached`.
3. Backup do histórico: `git bundle create ../backup/historico.bundle --all`.
4. Commit inicial limpo: `git checkout --orphan limpo && git add -A && git commit ...` (autor com o e-mail noreply `ID+usuario@users.noreply.github.com`), `git branch -D main && git branch -m main`, `git gc --prune=now`.
5. `gh repo create ... --public --source . --push`, e ativar *secret scanning*, *push protection*, alertas do Dependabot e relato privado de vulnerabilidades.

(O BibliotecaMusical **já está no GitHub**: só use isto se for reescrever o histórico, o que muda os hashes e quebra links de PRs e issues.)

## 6. Play Store e iOS

Detalhes e a lista de pendências em `~/Development/nicska/docs/lojas.md`. O que vale para este app:
- **Conta de desenvolvedor** (US$ 25); conta pessoal nova exige **teste fechado com 12 testadores por 14 dias** antes da produção.
- **Segurança dos dados**: como o app baixa pacotes, declare o uso de rede e que não coleta dados pessoais; publique uma política de privacidade numa URL (modelo: `docs/privacidade.md` do Nicska, trocando permissões e o texto da rede).
- **Direitos de conteúdo:** hinos, partituras e sons têm regras de direitos próprias; a ficha da loja e a revisão do Google podem pedir comprovação. Confira antes de enviar.
- **Primeiro envio é manual** (o Play exige o app criado com uma versão); depois ligue `ENVIAR_PLAY_STORE=true` e cadastre `PLAY_SERVICE_ACCOUNT_JSON` para o job `play` enviar o AAB à faixa interna como rascunho.
- **iOS** é uma frente separada: `tauri ios init` num Mac, equivalentes em Swift das pontes Kotlin, e conferir áudio, MediaRecorder e AudioWorklet no WKWebView.

## 7. Checklist

- [ ] `build.gradle.kts` com a assinatura condicional; `.gitignore` e `keystore.properties.example` copiados
- [ ] Chave de envio gerada e copiada num cofre
- [ ] 4 segredos Android + variável `ANDROID_APPLICATION_ID` cadastrados (e conferidos, sem valor vazio)
- [ ] `release.yml` copiado e ajustado (INTERNET, nomes, título)
- [ ] Release sob demanda testado; depois tag `v0.3.1` e conferência do APK baixado
- [ ] `dependabot.yml` com `groups` e `ignore`
- [ ] Política de privacidade publicada e ficha da loja preparada
