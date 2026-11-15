# APK de teste fechado (com conteúdo embutido)

Para dar a outros músicos algo para testar, o build pode levar um `hinario.json` **dentro do binário**. O
conteúdo **nunca entra no Git**: só o caminho do arquivo é informado na hora do build.

> **Direitos.** O conteúdo são transcrições de terceiros, ainda sem autorização (ver `docs/roadmap-uxui-inicial.md`,
> seção 3). Use só em **teste fechado**. **Não publique** o APK (loja, redes, link aberto) antes da autorização.

## Como funciona

- `src-tauri/build.rs` lê a variável `BMCCB_PACOTE` (caminho de um `hinario.json`) e a copia para dentro do binário.
  Sem a variável, o app não leva conteúdo nenhum além do pacote de exemplo fictício.
- Na primeira abertura, o app grava esse conteúdo como se a pessoa o tivesse importado (`hinario::semear`).
  Ela pode removê-lo ou trocá-lo em **Ajustes**, como qualquer importação.
- Uma versão nova do APK com **conteúdo diferente** o substitui. Quem importou um hinário próprio **antes** de existir
  conteúdo embutido não perde o seu (só é sobrescrito por uma atualização posterior com conteúdo novo).

## Gerar

```sh
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64          # o Java padrão (25) pode não servir ao Gradle
export ANDROID_HOME=~/Android/Sdk ANDROID_SDK_ROOT=~/Android/Sdk
export NDK_HOME=~/Android/Sdk/ndk/30.0.16248370
BMCCB_PACOTE=/caminho/do/hinario.json npm run tauri android build -- --apk --target aarch64
```

Sai `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk` (~6 MB).
**Não use `--debug`**: o APK fica com ~270 MB.

`--target aarch64` gera só para `arm64` (quase todos os celulares atuais; aparelhos de 32 bits não instalam).

## Assinar (obrigatório para instalar)

O Android não instala APK sem assinatura. Para **teste fechado**, assine com a chave de depuração que o Android
Studio cria em `~/.android/debug.keystore` (senha padrão `android`, alias `androiddebugkey`):

```sh
BT=~/Android/Sdk/build-tools/36.0.0
$BT/zipalign -c -P 16 4 app-universal-release-unsigned.apk
$BT/apksigner sign --ks ~/.android/debug.keystore --ks-pass pass:android --key-pass pass:android \
  --ks-key-alias androiddebugkey --out BibliotecaMusical-CCB-teste.apk app-universal-release-unsigned.apk
$BT/apksigner verify --verbose BibliotecaMusical-CCB-teste.apk
```

**Esta assinatura não serve para loja.** Para publicar é preciso uma chave **própria**, criada e guardada pelo
responsável (quem perde a chave não consegue mais atualizar o app).

## Entregar em zip numerado

O APK é entregue **dentro de um `.zip` numerado**, para o responsável distinguir um build do outro:

```sh
cd ~/Downloads
zip -j BibliotecaMusical-CCB-teste-NNN.zip BibliotecaMusical-CCB-teste.apk   # NNN = próximo número, com 3 dígitos
sha256sum BibliotecaMusical-CCB-teste-NNN.zip
```

O **próximo número é o da última linha da tabela abaixo + 1**. A tabela, e não a pasta `~/Downloads`, é o contador,
porque os arquivos são movidos para fora da pasta depois de baixados. **Acrescente a linha a cada build.** A versão e o
commit são os que aparecem em **Ajustes, "Sobre"** (`Versão X.Y.Z (commit)`).

### Histórico dos zips

| Zip | Versão (commit) | Data | Conteúdo | SHA-256 |
|---|---|---|---|---|
| **001** | 0.2.0 (c0f6699) | 2026-11-14 | 5 hinos e 5 sons gravados embutidos; cards, ganhos de volume, versão em Ajustes | `617af79f…d25f99` |
| **002** | 0.2.0 (bc7ba9b) | 2026-11-14 | Nome "Biblioteca Musical CCB"; ícones SVG (conjunto `ic`); cards em grupo (abrir um fecha os outros); "Redefinir vozes" e "Redefinir instrumentos" separados; lista com 001, 002; Ajustes como botão hambúrguer | `47944215…0a665` |

## Instalar no celular

Copie o `.apk` para o aparelho e abra. O Android pede para permitir "instalar apps desconhecidos" daquela origem, e o
Play Protect pode avisar que o app não é conhecido (esperado num APK de teste).
