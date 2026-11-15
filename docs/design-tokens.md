# Tema e tokens de cor

O app tem três modos de aparência, escolhidos em **Ajustes → Aparência**:

- **Automático** (padrão, segue o sistema): usa o tema claro ou escuro do aparelho (`prefers-color-scheme`).
- **Claro** e **Escuro**: forçam o tema, ignorando o sistema (`data-tema` no `<html>`).

A escolha é guardada no aparelho. O `src/app.html` aplica o tema salvo antes da primeira pintura, para
a tela não piscar de claro para escuro.

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

O azul (`--acento`) continua nas **ações**. O dourado (o mesmo do ícone) marca **onde se está na música**: a parte que toca, a barra de progresso, a aba selecionada e o ⚑ do final. Prévia lado a lado em [`design/identidade/previa-dourado.png`](../design/identidade/previa-dourado.png).

## Contraste verificado

Rode `python3 tools/contraste.py` depois de mexer em qualquer cor. Ele lê os tokens do `tema.css`, mede
cada par usado, falha (código de saída 1) se algum ficar abaixo da meta e confere que os dois blocos do
tema escuro têm os mesmos valores. Metas: **4,5:1** para texto e **3:1** para componentes e ícones
(WCAG 2.2, critérios 1.4.3 e 1.4.11).

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

A paleta de partida sugerida no início do redesenho tinha **bordas que reprovavam** como limite de
componente (1,27:1 no claro e 1,59:1 no escuro). Por isso existe o token `--borda-controle`, separado da
borda decorativa.

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
