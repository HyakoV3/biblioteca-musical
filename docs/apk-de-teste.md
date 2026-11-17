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

**Arrumação da pasta (pedido do responsável, 2026-11-16):** ficam **fora** só os **10 zips de APK mais recentes**; todo o resto
(zips de APK mais antigos e materiais soltos, como as comparações de bancos e as prévias de timbres) vai para a subpasta
**`archive/`**. Ao entregar um zip novo, o mais antigo que sobrar passa para `archive/` (só se move, nada se apaga). Um arquivo
de teste que acompanha o APK (por exemplo o pacote de partituras) fica ao lado dele e segue a mesma regra depois.

O **próximo número é o da última linha da tabela abaixo + 1**. A tabela, e não a pasta `~/Downloads`, é o contador,
porque os arquivos são movidos para fora da pasta depois de baixados. **Acrescente a linha a cada build.** A versão e o
commit são os que aparecem em **Ajustes, "Sobre"** (`Versão X.Y.Z (commit)`).

### Histórico dos zips

> **Os zips 020, 021 e 022 não baixam mais partituras:** os pacotes `partituras-001.zip` e `partituras-002.zip`, que eles procuram, foram apagados
> do servidor em 2026-11-16 (só o `partituras-003.zip` ficou, o do 023 em diante). O resto deles funciona como antes.

| Zip | Versão (commit) | Data | Conteúdo | SHA-256 |
|---|---|---|---|---|
| **024** | 0.3.0 (d11126a) | 2026-11-16 | **Ícone novo, logo maior, miniplayer sem linha e "Nivelar as notas"** (PRs #47 e #50, na `main`): (1) o **ícone novo** do app (o símbolo, gerado do SVG: adaptativo do Android com fundo azul liso e só o símbolo, monocromático para o ícone temático do Android 13; **desinstale o app antes de instalar**, por causa do cache do ícone); (2) a **logo da tela inicial** do tamanho do botão de Ajustes; (3) o **miniplayer sem a linha** de cima (a divisa é a trilha do slider); (4) **I-23, etapa A: "Nivelar as notas"** em Ajustes, no card dos sons gravados (padrão ligado): iguala o volume de cada nota de cada instrumento gravado (dentro de um instrumento as notas variam de 2,5 a 10 dB). **A comparar de ouvido, com ele ligado e desligado**, tocando um hino com as 4 vozes gravadas, no celular e, quando puder, no **fone**. Não mexe no balanço entre as vozes nem no compressor. **(Depois do teste, o responsável não sentiu diferença na caixinha e o "Nivelar as notas" foi removido: só o 024 o tem.)** As partituras seguem as do 023 (`partituras-003.zip`). Entregue em `<pasta de entrega dos zips>/` | `3bddd220…14e5` |
| **023** | 0.3.0 (6999e4e) | 2026-11-16 | **Partitura em duas versões, retrato e paisagem** (PR #46): o 022 deixava 1 compasso por linha e "cortava". Agora cada hino tem a versão de **retrato** (largura 700, ~2 a 3 compassos por linha nos hinos de amostra) e a de **paisagem** (1200, ~4 compassos por linha); o app escolhe pela largura da tela, **troca sozinho ao girar o celular**, e na tela deitada a partitura usa a largura toda. Baixa o `partituras-003.zip` (228 KB, as mesmas 5 partituras). **Toque em Remover e Baixar de novo** (o app não troca o que já está instalado). Compilado do ramo do PR #46, ainda não mergeado. **A ver no celular**: o retrato ficou bom de ler? deitado, os 4 compassos por linha ficam pequenos demais? o zoom (+/−) ainda serve nas duas? Entregue em `<pasta de entrega dos zips>/` | `b6cf2cb3…75f0` |
| **022** | 0.3.0 (2c5bacd) | 2026-11-16 | **Partitura sem letra, mais larga e com zoom para menos** (PR #44): a letra cantada sai da partitura (tem a aba Letra), a página fica mais estreita no gerador e as **notas ficam 1,4x maiores** no celular em pé; o **zoom vai de 50% a 400%** (o "−" agora diminui: 80%, 65%, 50%; o 100% continua o padrão, no meio), com a folha centralizada quando menor que a tela. O app baixa o `partituras-002.zip` (125 KB, as mesmas 5 partituras), já no servidor. **Se já tinha as partituras do 020 ou 021 instaladas, toque em Remover e Baixar de novo** (o app não troca o que já está instalado). Compilado do ramo do PR #44, ainda não mergeado. **A ver no celular**: as notas ficaram boas de ler? a rolagem vertical (hino longo) incomoda? o zoom para menos serve? Entregue em `<pasta de entrega dos zips>/` | `796d1beb…9686` |
| **021** | 0.3.0 (1743550) | 2026-11-16 | **O mesmo conteúdo do 020, compilado da `main`** com a #42 já mergeada (card Partituras com Baixar e Remover, Importar hinário só `.json`, pacote de partituras publicado em `BibliotecaMusicalPartituras/partituras-001.zip`). Muda só de onde vem a build: o 020 saiu do ramo da PR. **O roteiro do 020 vale para o 021.** Entregue em `<pasta de entrega dos zips>/` | `6ece8cae…cc72` |
| **020** | 0.3.0 (3dd1dfc) | 2026-11-16 | **Card Partituras em Ajustes com Baixar e Remover** (PR #42), no molde dos sons gravados: o app baixa o pacote do servidor (`BibliotecaMusicalPartituras/partituras-001.zip`, 155 KB, as 5 partituras de teste), confere o tamanho e o SHA-256 e instala. **Importar hinário agora só aceita `.json`** (o zip com partituras não é mais aceito, e o pacote antigo do 018/019 não serve). Compilado do ramo do PR #42, ainda não mergeado. **A ver no celular** (roteiro abaixo; precisa de internet para baixar). Entregue em `<pasta de entrega dos zips>/` | `1d6188df…d3ea` |
| **019** | 0.3.0 (ea939a2) | 2026-11-16 | **Corrige o importar do `.zip` no Android** (PR #40): no 018 ele recusava tudo com "a chamada não trouxe os bytes do arquivo", porque o Android não entrega corpo binário ao Rust; agora o zip vai como **texto base64**. O resto igual ao 018 (aba Partitura, hino 283 corrigido). **Usa o mesmo `BibliotecaMusical-CCB-pacote-partituras-018.zip`** (continua na pasta; não precisa de outro). Compilado do ramo do PR #40, ainda não mergeado. **A ver no celular** (roteiro abaixo; o pacote chega a ~0,2 MB, então a primeira prova é só se o importar funciona). Entregue em `<pasta de entrega dos zips>/` | `b0c4fda2…495d` |
| **018** | 0.3.0 (72b22f8) | 2026-11-16 | **Aba Partitura** (I-08, PRs #35 a #37): o app importa um **pacote `.zip`** (hinário + partituras em SVG), mostra a partitura de cada hino numa aba (zoom de 100% a 400%, nos temas claro, escuro e alto contraste, com a fonte Leipzig) e, sem nenhuma partitura instalada, mostra a aba com um aviso e um botão para Ajustes. **Hino 283** com as correções da foto (versos separados, "esplendor", "Contigo ao céu"). O resto igual ao 017. Compilado da `main`. **O importar do `.zip` falhou no Android (corrigido no 019).** **Acompanha o `BibliotecaMusical-CCB-pacote-partituras-018.zip`** (os mesmos 5 hinos com partituras; SHA-256 `775b7fc6…2741`, 165.629 bytes), que **não** deve ser aberto: é importado em Ajustes. **A ver no celular** (roteiro abaixo). Entregue em `<pasta de entrega dos zips>/` | `fafa75f6…b6bd` |
| **017** | 0.3.0 (b3615ac) | 2026-11-16 | **Alto contraste em amarelo vivo sobre preto** (PR #33), como o Alto contraste do site da Tokai: no 016 era preto sobre amarelo claro, e o responsável pediu o inverso. Fundo preto; texto, bordas e acento em `#ffff00`; foco branco; trilha da barra em oliva. O resto igual ao 016 (slider do miniplayer em cima, letra com as 12 correções). Compilado da `main`. **A ver no celular** e com quem tem baixa visão. Entregue em `<pasta de entrega dos zips>/` | `25b2d8ee…e8be` |
| **016** | 0.3.0 (57b03a4) | 2026-11-16 | **Modo Alto contraste** (I-06, PR #31): em Ajustes → Aparência, 4º Modo, preto sobre amarelo bem claro, com foco, bordas e barra de progresso mais grossos; o estilo não vale nele. Mesmo conteúdo do 015: slider do miniplayer em cima, letra com as 12 correções explícitas e **sem** a regra automática "ãc" vira "ãe". Compilado da `main`. **A ver no celular**, com a fonte do sistema grande. Entregue em `<pasta de entrega dos zips>/` | `bb343aff…4786` |
| **015** | 0.3.0 (fac50cb) | 2026-11-16 | **Slider do miniplayer em cima** (I-21, PR #27) e **letra com as correções explícitas** (I-05, PR #28): os 5 hinos de teste embutidos agora passam pelo arquivo de correções (12 correções: palavras partidas, "dar-nos", "mão", "servir"...), e **sem** a regra automática "ãc" vira "ãe", que errava (PR #30). Compilado do ramo do PR #30, ainda não mergeado. Entregue em `<pasta de entrega dos zips>/` | `fb91faed…d90f` |
| **014** | 0.3.0 (b2b3fbf) | 2026-11-16 | **Coro do hino 457 na última estrofe** (PRs #24 e #25, já na `main`): os 5 hinos de teste embutidos saem do conversor final, com uma linha por verso, hífens e erros de digitação conhecidos consertados e o coro do final depois da estrofe 3, como no impresso. O app em si é o mesmo do 012; muda só o conteúdo embutido. Compilado da `main`. Entregue em `<pasta de entrega dos zips>/` | `f791b46b…2145` |
| **013** | 0.3.0 (f2e3a18) | 2026-11-16 | **Letra por verso** (PR #24): os 5 hinos de teste embutidos agora saem do conversor novo, com uma linha por verso (como no hinário impresso), hífen em "-lo/-la/-lhe" e erros de digitação conhecidos consertados. O app em si é o mesmo do 012; muda só o conteúdo embutido. Compilado do ramo do PR #24, ainda não mergeado. Entregue em `<pasta de entrega dos zips>/` | `cf2bc0d7…c71d` |
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

### Roteiro das partituras (APK **020**)

Precisa de **internet** (o pacote vem do servidor). O hinário de teste (5 hinos) já vem no app, então o pré-requisito está cumprido.
1. Instale o **020** (`BibliotecaMusical-CCB-teste-020.zip`, extraia o `.apk`) e abra um hino. A aba **Partitura** aparece com o aviso e o botão
   **Abrir Ajustes**, que deve levar a Ajustes.
2. Em **Ajustes**, ache o card **Partituras**: "0,2 MB · Não instaladas" e o botão **Baixar (0,2 MB)**. Toque nele: aparece o progresso, depois
   "Conferindo o arquivo…" e "Instalando…", e o card passa a "Instaladas: 5 partituras" com o botão **Remover**. Se aparecer um erro, **anote o
   texto exato** (ele diz a etapa: rede, arquivo que não confere, ou o motivo de uma partitura recusada).
3. Abra os hinos 1, 276, 283, 398 e 457: a aba Partitura mostra a partitura. Conferir: **notas, letra e o andamento** ("♩ = 58", com a figura da
   nota) legíveis; as **bandeirolas** das colcheias na mesma cor das notas; o **zoom** (− / 100% / +) e **rolar para os lados** quando ampliada;
   trocar para o tema **escuro** e o **Alto contraste** em Ajustes.
4. Com a **fonte do sistema grande**, a aba continua utilizável? E com o celular **deitado** (barra de abas na lateral)?
5. **Remover** no card apaga só as partituras (o hinário fica): a aba volta ao aviso e o card a "Não instaladas".
6. **Importar hinário** só mostra arquivos `.json` agora.

**Histórico (018 e 019):** o 018 falhou ao importar o zip no Android ("a chamada não trouxe os bytes do arquivo": o Android não entrega corpo
binário ao Rust) e o 019 corrigiu isso mandando o zip em base64; o 020 troca esse fluxo pelo download automático, e o pacote combinado
(com `hinario.json`) **não funciona mais**.

## Instalar no celular

Copie o `.apk` para o aparelho e abra. O Android pede para permitir "instalar apps desconhecidos" daquela origem, e o
Play Protect pode avisar que o app não é conhecido (esperado num APK de teste).
