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
cd "<pasta de entrega dos zips>"   # a pasta de entrega dos zips do responsável
zip -j BibliotecaMusical-CCB-teste-NNN.zip BibliotecaMusical-CCB-teste.apk   # NNN = próximo número, com 3 dígitos
sha256sum BibliotecaMusical-CCB-teste-NNN.zip
rm BibliotecaMusical-CCB-teste.apk BibliotecaMusical-CCB-teste.apk.idsig     # o apksigner deixa um .idsig ao lado
```

Os zips (e os pacotes de sons, `docs/pacote-de-sons.md`) vão **direto para a pasta de entrega**, a pedido do
responsável (antes iam para `~/Downloads`, e ele os movia para lá).

O **próximo número é o da última linha da tabela abaixo + 1**. A tabela, e não a pasta `~/Downloads`, é o contador,
porque os arquivos são movidos para fora da pasta depois de baixados. **Acrescente a linha a cada build.** A versão e o
commit são os que aparecem em **Ajustes, "Sobre"** (`Versão X.Y.Z (commit)`).

### Histórico dos zips

| Zip | Versão (commit) | Data | Conteúdo | SHA-256 |
|---|---|---|---|---|
| **012** | 0.3.0 (91c8f32) | 2026-11-15 | **Interface toda em `rem`** (PR #21): botões, ícones, barra de progresso, cartões e traços acompanham o tamanho da fonte do sistema; com a fonte padrão fica idêntico ao 011. Mesmo conteúdo e mesmos sons do 011. Compilado do ramo do PR #21, ainda não mergeado. Entregue em `<pasta de entrega dos zips>/` | `a87b886a…ed59c` |
| **011** | 0.3.0 (45551b4) | 2026-11-15 | **Avançar e retroceder pela barra de progresso** (aba Ouvir e miniplayer; arrastar, tocar ou setas), barra no **dourado do tema**; **tamanho e alinhamento da letra** (I-04: `A−`, `A`, `A+` e esquerda, direita, justificado); andamento com − e + e título **Andamento e Tom**; transposição com o mesmo desenho do andamento; mensagens de erro de importação **traduzidas**; o FluidR3 saiu do card de créditos. Os sons gravados e o pacote não mudaram (continua o GeneralUser GS do 010). Entregue em `<pasta de entrega dos zips>/` | `0d010a2b…2e44f` |
| **010** | 0.3.0 (3fa27c1) | 2026-11-15 | **Sons gravados trocados: FluidR3 → GeneralUser GS** (16 instrumentos, todos no mesmo nível médio no ouvido); card **Créditos e licenças** em Ajustes. **O pacote de sons novo (36 MB baixados) já está no servidor: baixe de novo em Ajustes**, pois os hashes mudaram e este APK recusa o pacote antigo. O 009 e anteriores não baixam o pacote novo. Entregue em `<pasta de entrega dos zips>/` | `7d07701a…57e7` |
| **009** | 0.3.0 (daa38db) | 2026-11-15 | **Órgão de tirantes gravado mais alto** (ganho 7,1 → 9,5, +2,5 dB; no 008 ainda soava abaixo dos outros). Tudo o mais igual ao 008. Entregue em `<pasta de entrega dos zips>/` | `22c8d1ff…a7e0` |
| **008** | 0.3.0 (54b7909) | 2026-11-15 | **Sons sintetizados melhores (I-15):** os 14 instrumentos que têm gravado de referência (trompete, trombone, tuba, fagote, oboé, sax alto e tenor, flauta doce, violino, clarinete, viola, violoncelo, contrabaixo e trompa) com o timbre medido por altura; flugelhorn e bombardino por mistura de instrumentos medidos; órgão de tirantes gravado **mais alto** (ganho 2,65 → 7,1). Os 16 sons gravados e o pacote de sons não mudaram. Entregue em `<pasta de entrega dos zips>/` | `d2ffb451…b95c` |
| **007** | 0.3.0 (c53524c) | 2026-11-15 | **Estilos de cor** (Ajustes, Aparência: Modo e Estilo, com Normal, Pergaminho e Marinho e ouro); **botões Intro, 1ª, 2ª... que enchem de dourado** com o tempo e recomeçam do zero na parte seguinte; botão do karaokê num **ícone de microfone no cabeçalho** (só na aba Letra). Os 5 hinos de teste embutidos já com a sincronia do karaokê. Entregue em `<pasta de entrega dos zips>/` | `0c5f4c3c…cc1d3` |
| **006** | 0.3.0 (c14825e) | 2026-11-14 | **Karaokê da letra (fase A):** na aba Letra, botão "Karaokê" (ligado por padrão) que acende a estrofe da vez, a linha e a sílaba que soa, e rola até a linha. Os 5 hinos de teste embutidos já trazem a sincronia. Entregue em `<pasta de entrega dos zips>/` | `6888156a…67a29` |
| **005** | 0.3.0 (ef561d7) | 2026-11-14 | **Abas Ouvir \| Letra embaixo** (barra lateral à esquerda com o celular deitado; o miniplayer sobe acima da barra); **andamento de 1 em 1 e de 5 em 5** (`−5 −1 +1 +5`); **correção:** ao parar ou pausar e tocar de novo, as notas do andamento antigo das vozes **gravadas** seguiam soando por cima das novas. Entregue em `<pasta de entrega dos zips>/` | `93c61549…8e053` |
| **001** | 0.2.0 (c0f6699) | 2026-11-14 | 5 hinos e 5 sons gravados embutidos; cards, ganhos de volume, versão em Ajustes | `617af79f…d25f99` |
| **004** | 0.3.0 (0a4aa2a) | 2026-11-15 | **Sons gravados por download** (Ajustes, "Sons gravados": baixa o pacote do File Browser, confere o SHA-256 e guarda no aparelho) e alternador Sintetizado \| Gravado por voz; **sem sons embutidos** (o APK só leva os 5 hinos de teste); cabeçalho com logo; botão de Ajustes em engrenagem. Entregue em `<pasta de entrega dos zips>/` | `633d5d41…a23f5` |
| **003** | 0.2.0 (238a103) | 2026-11-14 | Ajustes: "Sobre o app" num card fechado, aviso de independência à parte e versão centralizada fora do card; tema "Automático"; botões "Importar hinário" e "Remover importação"; seletor de idioma na largura toda | `52ceec38…01e50` |
| **002** | 0.2.0 (bc7ba9b) | 2026-11-14 | Nome "Biblioteca Musical CCB"; ícones SVG (conjunto `ic`); cards em grupo (abrir um fecha os outros); "Redefinir vozes" e "Redefinir instrumentos" separados; lista com 001, 002; Ajustes como botão hambúrguer | `47944215…0a665` |

## Instalar no celular

Copie o `.apk` para o aparelho e abra. O Android pede para permitir "instalar apps desconhecidos" daquela origem, e o
Play Protect pode avisar que o app não é conhecido (esperado num APK de teste).
