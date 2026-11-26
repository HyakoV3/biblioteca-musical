# Tema e tokens de cor

O app tem duas escolhas de aparência, em **Ajustes → Aparência**, que se combinam:

- **Modo:** **Automático** (padrão, segue o sistema com `prefers-color-scheme`), **Claro**, **Escuro**
  (forçam o tema, ignorando o sistema; `data-tema` no `<html>`) ou **Alto contraste** (I-06, para baixa visão; veja abaixo).
- **Estilo de cor:** **Normal** (o visual de sempre), **Pergaminho** (I-02) ou **Marinho e ouro** (I-14)
  (`data-estilo` no `<html>`; o normal não leva atributo). Cada estilo tem versão clara e escura, então o
  Automático continua funcionando em todos: são **6 paletas**.

As duas escolhas são guardadas no aparelho. O `src/app.html` aplica as salvas antes da primeira pintura, para
a tela não piscar.

## Tokens

As cores só existem como variáveis CSS em [`src/lib/tema.css`](../src/lib/tema.css). Nenhum componente
usa cor fixa; todos usam estes nomes.

| Token | Função |
|---|---|
| `--fundo` | Fundo das telas |
| `--superficie` | Cartões, campos, lista, miniplayer |
| `--texto` | Texto principal |
| `--suave` | Texto secundário (legendas, rótulos) |
| `--borda` | Divisórias e trilhas **decorativas** (não delimitam controles) |
| `--borda-controle` | Limite de campos, botões, abas, listas e interruptores |
| `--acento` / `--acento-texto` | **Ações**: botão principal, links; e o texto sobre ele |
| `--ouro` / `--ouro-sobre` | **Onde estou na música**: preenchimento da parte que toca (Intro, 1ª, 2ª...); e o texto sobre ele |
| `--ouro-linha` | Linhas e marcas douradas: barra de progresso, aba selecionada, ⚑ do final e contorno da parte que toca. No claro é mais escuro (`#946200`) porque o `#f8b000` tem só 1,8:1 sobre o fundo claro |
| `--perigo` | Ações destrutivas e avisos de erro |
| `--sucesso` | Avisos de sucesso |
| `--foco` | Anel de foco |

## Cor de destaque: azul para agir, dourado para a posição

O azul (`--acento`, no estilo normal) continua nas **ações**. O dourado (o mesmo do ícone) marca **onde se está na música**: a parte que toca, a barra de progresso, a aba selecionada e o ⚑ do final. Prévia lado a lado em [`design/identidade/previa-dourado.png`](../design/identidade/previa-dourado.png).

## Estilos de cor

| Estilo | Claro | Escuro | Ações (`--acento`) |
|---|---|---|---|
| **Normal** | cinza-azulado `#f7f8fa`, cartões brancos | azul-noite `#10151d` | azul (`#1768b3` no claro, `#7bbcff` no escuro) |
| **Pergaminho** | bege e marfim: fundo `#f5eedb`, cartões `#fffaeb`, texto marrom `#2b1a08` | marrom-quente `#2b261f`, **mais claro** que o normal, cartões `#373028` | terra `#8a3f0a` no claro, âmbar `#f2b27a` no escuro |
| **Marinho e ouro** | azul-gelo `#e9eef7`, cartões brancos, texto marinho `#0b1d3f` | azul-marinho `#041a3b`, cartões `#0b2a56` | marinho `#173f7a` no claro, azul claro `#8fbaf7` no escuro |

Em **todos** os estilos o dourado do ícone (`--ouro`, `#f8b000`) continua marcando só **onde se está na música**, e as
ações usam a cor do estilo. A paleta do Pergaminho parte da paleta terrosa lembrada na I-02 e a do Marinho, do
azul-marinho (`#012352`) e do dourado do ícone. As bordas e linhas ganharam versões mais escuras que as da fonte
original (`--borda-controle`, `--ouro-linha`), porque o sand e as bordas claras não chegavam a 3:1.

Prévias lado a lado (hino fictício, claro em cima e escuro embaixo, na ordem Normal, Pergaminho e Marinho e ouro):
[aba Ouvir](../design/identidade/previa-estilos-ouvir.png) e [aba Letra tocando](../design/identidade/previa-estilos-letra.png).
*Imagens tiradas em 2026-11-15, antes da #198 (controles em pílulas e steppers padrão): servem para as cores, não para o desenho atual dos controles.*

## Modo alto contraste (I-06)

Quarto **Modo**, para baixa visão: **amarelo vivo sobre preto** (`data-tema="alto-contraste"`), como o Alto contraste do site da Tokai. É uma paleta **própria, de um
bloco só**: não tem versão clara e ignora o **estilo** (em Ajustes, o grupo Estilo fica desativado com uma nota explicando). Vale
mesmo com o aparelho no claro. O fundo e os cartões são **pretos** (`#000000`); o texto, os títulos, as bordas dos controles, o acento
e o dourado são **amarelo vivo** (`#ffff00`, 19,56:1 sobre o preto); o texto "suave" também é amarelo; o botão cheio e a parte que
toca levam texto **preto** sobre o amarelo; o anel de foco é **branco** (21:1). A divisória e a trilha da barra de progresso usam um
amarelo-oliva escuro (`#666600`), para a barra se distinguir do amarelo que a enche. Vermelho (`#ff7777`) e verde (`#66ff66`) só
aparecem em avisos de erro e sucesso, sempre com texto.

Além da cor: o anel de foco passa de 0,1875rem a **0,25rem**, a borda dos botões a **0,125rem**, os links ficam **sempre sublinhados**
e a trilha da barra de progresso engrossa. Os destaques "dourados" (a sílaba do karaokê, a parte que toca) são **bloco amarelo com
texto preto**, e o sublinhado e o contorno que já existiam continuam, então nada depende só de cor.

**Decisões:** (1) o **Automático não liga o alto contraste sozinho** (`prefers-contrast: more`): não se sabe se a WebView do Android repassa
essa preferência, e mudar a cor de quem não escolheu seria uma surpresa; fica para uma segunda etapa, depois de testar no aparelho. (2) A
**versão invertida** (amarelo sobre preto) ficou de fora por ora. (3) A cor foi escolhida pelo contraste medido; **falta a revisão de quem
tem baixa visão**.

Prévias (hino fictício, celular em pé): [aba Ouvir](../design/identidade/previa-alto-contraste-ouvir.png) e
[aba Letra tocando](../design/identidade/previa-alto-contraste-letra.png), com o karaokê aceso e o miniplayer.
*Imagens anteriores à #198: servem para as cores, não para o desenho atual dos controles.*

Cuidado de CSS: o escuro "do sistema" de cada estilo tem seletor mais específico que o bloco do modo; por isso os três usam
`:not([data-tema="claro"], [data-tema="alto-contraste"])`, e o bloco do modo fica no **fim** do `tema.css`. O teste de ponta a ponta
(`tests/e2e/karaoke.mjs`) confere isso num Chrome emulado no escuro, nos três estilos.

## Contraste verificado

Rode `python3 tools/contraste.py` depois de mexer em qualquer cor. Ele lê os tokens do `tema.css`, mede cada par
usado **nos três estilos, claros e escuros**, falha (código de saída 1) se algum ficar abaixo da meta e confere que
os dois blocos do escuro de cada estilo têm os mesmos valores. Metas: **4,5:1** para texto e **3:1** para componentes
e ícones (WCAG 2.2, critérios 1.4.3 e 1.4.11). O **modo alto contraste** tem metas mais rígidas, **AAA** (7:1 no texto e 4,5:1 nos
componentes; critério 1.4.6). O CI roda esta verificação.

#### Estilo `normal`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 14.73:1 ✓ | 16.74:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 15.65:1 ✓ | 14.44:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 5.96:1 ✓ | 10.57:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 6.33:1 ✓ | 9.12:1 ✓ |
| `acento` / `fundo` | Links e destaques sobre o fundo | 4.5:1 | 5.39:1 ✓ | 9.14:1 ✓ |
| `acento` / `superficie` | Links e destaques sobre cartões | 4.5:1 | 5.73:1 ✓ | 7.88:1 ✓ |
| `acento-texto` / `acento` | Texto do botão principal | 4.5:1 | 5.73:1 ✓ | 9.14:1 ✓ |
| `perigo` / `fundo` | Texto de ação destrutiva sobre o fundo | 4.5:1 | 6.19:1 ✓ | 8.48:1 ✓ |
| `perigo` / `superficie` | Texto de ação destrutiva sobre cartões | 4.5:1 | 6.57:1 ✓ | 7.32:1 ✓ |
| `sucesso` / `superficie` | Ícone de sucesso | 3.0:1 | 5.08:1 ✓ | 8.20:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.74:1 ✓ | 4.67:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 3.97:1 ✓ | 4.03:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 5.39:1 ✓ | 9.14:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 5.73:1 ✓ | 7.88:1 ✓ |
| `ouro-linha` / `borda` | Preenchimento da barra de progresso sobre a trilha | 3.0:1 | 3.87:1 ✓ | 5.29:1 ✓ |
| `ouro-linha` / `fundo` | Marca do final e aba selecionada sobre o fundo | 4.5:1 | 4.93:1 ✓ | 9.77:1 ✓ |
| `ouro-linha` / `superficie` | Marca do final e contorno da parte que toca sobre cartões | 4.5:1 | 5.24:1 ✓ | 8.42:1 ✓ |
| `ouro-sobre` / `ouro` | Texto da parte que está tocando | 4.5:1 | 9.77:1 ✓ | 9.77:1 ✓ |

#### Estilo `pergaminho`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 14.46:1 ✓ | 13.00:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 16.05:1 ✓ | 11.26:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 8.00:1 ✓ | 8.89:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 8.88:1 ✓ | 7.70:1 ✓ |
| `acento` / `fundo` | Links e destaques sobre o fundo | 4.5:1 | 6.49:1 ✓ | 8.16:1 ✓ |
| `acento` / `superficie` | Links e destaques sobre cartões | 4.5:1 | 7.20:1 ✓ | 7.07:1 ✓ |
| `acento-texto` / `acento` | Texto do botão principal | 4.5:1 | 7.20:1 ✓ | 8.16:1 ✓ |
| `perigo` / `fundo` | Texto de ação destrutiva sobre o fundo | 4.5:1 | 6.53:1 ✓ | 7.34:1 ✓ |
| `perigo` / `superficie` | Texto de ação destrutiva sobre cartões | 4.5:1 | 7.24:1 ✓ | 6.36:1 ✓ |
| `sucesso` / `superficie` | Ícone de sucesso | 3.0:1 | 6.36:1 ✓ | 6.88:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.87:1 ✓ | 4.21:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 4.30:1 ✓ | 3.65:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 6.49:1 ✓ | 8.16:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 7.20:1 ✓ | 7.07:1 ✓ |
| `ouro-linha` / `borda` | Preenchimento da barra de progresso sobre a trilha | 3.0:1 | 4.07:1 ✓ | 5.26:1 ✓ |
| `ouro-linha` / `fundo` | Marca do final e aba selecionada sobre o fundo | 4.5:1 | 5.22:1 ✓ | 8.00:1 ✓ |
| `ouro-linha` / `superficie` | Marca do final e contorno da parte que toca sobre cartões | 4.5:1 | 5.79:1 ✓ | 6.93:1 ✓ |
| `ouro-sobre` / `ouro` | Texto da parte que está tocando | 4.5:1 | 9.73:1 ✓ | 9.73:1 ✓ |

#### Estilo `marinho`

| Par (texto / fundo) | Uso | Meta | Claro | Escuro |
|---|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 4.5:1 | 14.30:1 ✓ | 15.50:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 4.5:1 | 16.64:1 ✓ | 12.74:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 4.5:1 | 6.24:1 ✓ | 10.20:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 4.5:1 | 7.27:1 ✓ | 8.38:1 ✓ |
| `acento` / `fundo` | Links e destaques sobre o fundo | 4.5:1 | 8.89:1 ✓ | 8.66:1 ✓ |
| `acento` / `superficie` | Links e destaques sobre cartões | 4.5:1 | 10.35:1 ✓ | 7.12:1 ✓ |
| `acento-texto` / `acento` | Texto do botão principal | 4.5:1 | 10.35:1 ✓ | 8.66:1 ✓ |
| `perigo` / `fundo` | Texto de ação destrutiva sobre o fundo | 4.5:1 | 5.61:1 ✓ | 8.46:1 ✓ |
| `perigo` / `superficie` | Texto de ação destrutiva sobre cartões | 4.5:1 | 6.54:1 ✓ | 6.95:1 ✓ |
| `sucesso` / `superficie` | Ícone de sucesso | 3.0:1 | 5.40:1 ✓ | 7.72:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 3.0:1 | 3.56:1 ✓ | 5.31:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 3.0:1 | 4.15:1 ✓ | 4.36:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 3.0:1 | 8.89:1 ✓ | 8.66:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 3.0:1 | 10.35:1 ✓ | 7.12:1 ✓ |
| `ouro-linha` / `borda` | Preenchimento da barra de progresso sobre a trilha | 3.0:1 | 4.17:1 ✓ | 5.42:1 ✓ |
| `ouro-linha` / `fundo` | Marca do final e aba selecionada sobre o fundo | 4.5:1 | 5.19:1 ✓ | 9.21:1 ✓ |
| `ouro-linha` / `superficie` | Marca do final e contorno da parte que toca sobre cartões | 4.5:1 | 6.04:1 ✓ | 7.57:1 ✓ |
| `ouro-sobre` / `ouro` | Texto da parte que está tocando | 4.5:1 | 8.88:1 ✓ | 9.21:1 ✓ |

A paleta de partida sugerida no início do redesenho tinha **bordas que reprovavam** como limite de
componente (1,27:1 no claro e 1,59:1 no escuro). Por isso existe o token `--borda-controle`, separado da
borda decorativa.

#### Modo `alto-contraste` (metas AAA)

| Par (texto / fundo) | Uso | Meta | Contraste |
|---|---|---|---|
| `texto` / `fundo` | Texto principal sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `texto` / `superficie` | Texto principal sobre cartões e campos | 7.0:1 | 19.56:1 ✓ |
| `suave` / `fundo` | Texto secundário sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `suave` / `superficie` | Texto secundário sobre cartões e campos | 7.0:1 | 19.56:1 ✓ |
| `acento` / `fundo` | Links e destaques sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `acento` / `superficie` | Links e destaques sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `acento-texto` / `acento` | Texto do botão principal | 7.0:1 | 19.56:1 ✓ |
| `perigo` / `fundo` | Texto de ação destrutiva sobre o fundo | 7.0:1 | 8.16:1 ✓ |
| `perigo` / `superficie` | Texto de ação destrutiva sobre cartões | 7.0:1 | 8.16:1 ✓ |
| `sucesso` / `superficie` | Ícone de sucesso | 4.5:1 | 16.06:1 ✓ |
| `borda-controle` / `fundo` | Limite de controles sobre o fundo | 4.5:1 | 19.56:1 ✓ |
| `borda-controle` / `superficie` | Limite de controles sobre cartões | 4.5:1 | 19.56:1 ✓ |
| `foco` / `fundo` | Anel de foco sobre o fundo | 4.5:1 | 21.00:1 ✓ |
| `foco` / `superficie` | Anel de foco sobre cartões | 4.5:1 | 21.00:1 ✓ |
| `ouro-linha` / `borda` | Preenchimento da barra de progresso sobre a trilha | 4.5:1 | 5.64:1 ✓ |
| `ouro-linha` / `fundo` | Marca do final e aba selecionada sobre o fundo | 7.0:1 | 19.56:1 ✓ |
| `ouro-linha` / `superficie` | Marca do final e contorno da parte que toca sobre cartões | 7.0:1 | 19.56:1 ✓ |
| `ouro-sobre` / `ouro` | Texto da parte que está tocando | 7.0:1 | 19.56:1 ✓ |

## O que a medição não cobre

- Estados desabilitados não têm exigência de contraste na WCAG; usam opacidade reduzida.
- O contraste de texto sobre `--acento` foi medido só para `--acento-texto`.
- Não há teste automatizado de contraste na tela renderizada: o verificador mede os tokens, não o
  resultado final. Vale conferir visualmente nos dois temas e com fonte ampliada.

## Regras de uso

- **Estado nunca só por cor.** Voz silenciada tem rótulo "silenciada", nome riscado e interruptor
  tracejado; a aparência escolhida tem "✓" e borda dupla; avisos têm ícone (✓, ! ou i) além da cor.
- Foco visível em todo controle (`--foco`, 3 px).
- Movimento reduzido: o indicador de carregamento para de girar com `prefers-reduced-motion`.
