# Tema e tokens de cor

O app tem três modos de aparência, escolhidos em **Ajustes → Aparência**:

- **Seguir o sistema** (padrão): usa o tema claro ou escuro do aparelho (`prefers-color-scheme`).
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
| `--acento` / `--acento-texto` | Botão principal, aba selecionada, progresso; e o texto sobre ele |
| `--perigo` | Ações destrutivas e avisos de erro |
| `--sucesso` | Avisos de sucesso |
| `--foco` | Anel de foco |

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
| `acento` / `borda` | Preenchimento da barra de progresso sobre a trilha | 3.0:1 | 4.23:1 ✓ | 4.95:1 ✓ |

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
