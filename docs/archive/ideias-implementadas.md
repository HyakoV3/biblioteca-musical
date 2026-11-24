# Ideias implementadas: textos originais

Aqui estão, **sem alterações de texto**, as seções de [`../roadmap-ideas.md`](../roadmap-ideas.md) das ideias que já foram
implementadas (pedido, perguntas, decisões, o que foi feito e o que se descobriu pelo caminho), movidas em 2026-11-16 para o
arquivo de ideias ficar só com o que está aberto. Só os caminhos relativos dos links foram ajustados à nova pasta.

**Para saber o que foi implementado e onde está**, comece pelo sumário [`roadmap-implementadas.md`](roadmap-implementadas.md).
Como são textos de época, alguns números envelheceram (por exemplo, a I-07 fala do banco FluidR3, trocado pelo GeneralUser GS;
a I-11 fala de 13 ícones e a I-15 de um `timbres.json` de 28 KB); o sumário traz os valores atuais.

---

## I-01 — Tocar o hino com a passada do final

- **Status:** **feita (primeira versão)**, a validar no aparelho. Veja "O que foi feito" abaixo.
- **Origem:** reclamação do responsável, 2026-11-14, sobre o aplicativo de referência (CCB Virtual Plus).
- **Prioridade:** a definir

### O problema (nas palavras do responsável)

Quando um hino é tocado em várias passadas do início ao fim e todas são iguais, funciona. Mas vários
hinos **não têm coro** e são cantados em **duas ou três passadas normais e uma última com final** (uma
conclusão diferente). No aplicativo de referência não existe a opção de tocar o hino com essa **passada do
final**, então não dá para ouvir como o hino realmente termina.

### O que se deseja

Poder tocar o hino do jeito que ele é cantado: várias passadas e, na última, o **final**.

### Ideia de comportamento (a validar)

Na aba **Ouvir**, um controle simples antes de tocar, por exemplo:

- **Passadas:** quantas vezes tocar o hino do início ao fim (1, 2, 3, 4…).
- **Terminar com o final:** liga ou desliga. Ligado, a última passada usa o final do hino.
- Valores iniciais sensatos: uma passada, sem final; e, nos hinos que tiverem final, sugerir o número de
  passadas igual ao de estrofes da letra (a confirmar).

O progresso e o miniplayer passariam a considerar a duração total (todas as passadas somadas).

### Perguntas em aberto

1. **Como o final está representado nos dados?** Nos hinos de amostra 1, 276, 283 e 398 **não há marcas de
   repetição, volta ou salto** (ritornelo, volta 1/2, coda, D.C./D.S.). O **hino 457** é o primeiro com final e
   tem tudo isso; está descrito logo abaixo.

   **Como o responsável reconhece a diferença no hinário impresso (2026-11-14):** pelas **casas de volta
   numeradas 1., 2. e 3.**; em alguns hinos a última, em vez de "3.", vem escrita **"Final"**.

   **Amostra com final: hino 457** (baixado em 2026-11-14 a pedido do responsável; 6/8,
   38 compassos, 3 estrofes, sem coro, andamento 52). O que **está no arquivo** (fato, lido do XML do MuseScore 2):

   | Compasso | Marca no arquivo |
   |---|---|
   | 1 | início de repetição; compasso incompleto de 1/8 (anacruse) |
   | 5 | texto `*` |
   | 19 | **fim de repetição** (valor 2) e uma **casa de volta** com `endings = 2` |
   | 20 | outra **casa de volta**, `endings = 3`, e **barra dupla** |
   | 21 | texto **"Final"** e outro compasso incompleto de 1/8 (anacruse do final) |
   | 38 | barra final |

   **Leitura provável (hipótese, não confirmada):** do compasso 1 ao 19 está o corpo, repetido nas passadas
   normais; o compasso 19 é a casa das passadas intermediárias e o 20 é a casa da **última** passada ("3."),
   que segue direto para o **Final** (compassos 21 a 38). O conversor atual lê tudo uma vez, em ordem, e por
   isso toca o hino 457 com 98,5 batidas, **passando pelas duas casas de volta seguidas**, o que está errado
   musicalmente. Falta confirmar com o responsável **o que cada passada toca** (ver a pergunta A abaixo).

   **Observação nos arquivos (verificada em 2026-11-14):** todos os quatro hinos têm um marcador de texto
   **`*`**, mas a posição **varia** (uma versão anterior deste texto dizia "sempre no compasso 5", o que a
   amostra do hino 276 desmentiu):

   | Hino | Tem rótulo "Coro" | Compassos | Posição do `*` |
   |---|---|---|---|
   | 1 | não | 11 | compasso 5 (cerca de 45% do hino) |
   | 276 | não | 8 | compasso 4 (50% do hino) |
   | 283 | sim (compasso 11) | 18 | compasso 5 (início) |
   | 398 | sim (compasso 28) | 56 | compasso 5 (início) |

   Nos dois hinos **sem coro** o `*` fica por volta do **meio** do hino; nos dois **com coro** fica logo no
   **início**, antes do rótulo "Coro". **Hipótese não confirmada:** o `*` marca o ponto onde o hino termina na
   passada do final (nos hinos sem coro, a metade do hino). São só 4 hinos, então o padrão pode ser
   coincidência. Faltam respostas do responsável: o que o `*` significa no hinário impresso, e se na última
   passada dos hinos 1 e 276 a música termina nele.
2. **O final é um trecho a mais no fim da partitura, ou uma volta alternativa que substitui o fim da
   passada?** No hino 457 parece ser **os dois**: uma casa de volta para a última passada (compasso 20) seguida
   de um trecho próprio rotulado "Final" (compassos 21 a 38). Muda como o conversor precisa tratar.

**Pergunta A (para o responsável): o que cada passada do hino 457 toca?** Minha leitura, para você corrigir:
- Passada 1: compassos 1 a 18 e a casa do compasso 19; volta ao início.
- Passada 2: igual à 1.
- Passada 3 (a última): compassos 1 a 18, **pula o 19**, toca o 20 e segue para o **Final** (21 a 38).
Isso bate com o que você vê no hinário? E o `*` do compasso 5, o que ele faz nesse hino?

**Pergunta B: a "Passada" corresponde a uma estrofe?** O hino 457 tem 3 estrofes e 3 passadas; é sempre assim?
3. **O número de passadas é sempre igual ao de estrofes?** Há hinos com refrão, em que a estrofe 1
   inclui o refrão (como nos hinos 283 e 398), e outros sem.
4. **A letra deve acompanhar a passada?** Ex.: ao tocar duas passadas, mostrar a estrofe correspondente.
   Hoje a aba Letra é independente do player.

### Impacto técnico (hipóteses, não verificadas)

- **Conversor (`tools/mscx2json`):** hoje **não expande repetições nem saltos** (só avisa). Teria de
  entender a estrutura de repetições e voltas do MuseScore e produzir as notas de uma passada normal e as do
  final, separadamente.
- **Formato de dados (`docs/FORMATO.md`):** precisa de um jeito de dizer "esta é a passada normal" e "este é o
  final". Alternativas a avaliar: campos como `passada` e `final` dentro de cada voz, ou uma lista de seções.
  Qualquer mudança precisa continuar compatível com os `hinario.json` já gerados, ou ter migração.
- **Reprodução (`src/lib/reproducao.svelte.ts` e `sintetizador.ts`):** o sintetizador agenda todas as notas de
  uma vez, então várias passadas viram o mesmo trecho agendado em deslocamentos diferentes, seguido do final.
- **Relação com o roadmap:** é parente do item "repetições e saltos não são expandidos" (seção 3, conteúdo e
  direitos) e da etapa 2 (player e progresso).

### Critérios de aceitação (propostos)

- Para um hino com final, é possível tocar N passadas e terminar com o final, e o som bate com o que o
  responsável espera do aplicativo de referência.
- Hinos sem final continuam tocando como hoje, sem controle extra confuso.
- Progresso, tempo total e miniplayer refletem todas as passadas.

### O que foi feito (2026-11-14)

O responsável confirmou que a leitura do hino 457 bate com o hinário impresso (passadas 1 e 2 pela casa do
compasso 19; a última pula essa casa, toca a do compasso 20 e segue para o Final).

- **Conversor:** reconhece o padrão e gera `vozes` (uma passada normal) e `final` (a última passada). O hino 457
  sai com 48 batidas na passada normal e 96 na do final, as quatro vozes terminando juntas.
- **Formato e Rust:** campo opcional `final` (ver `docs/FORMATO.md`); o importador recusa um `final` cujas vozes
  não correspondam às da passada normal.
- **Player (aba Ouvir):** controle por **parte**, como o responsável pediu (**não** é um contador de repetições): um
  botão **"Tocar o hino todo"** (introdução e todas as vezes em sequência, com 2 s de pausa entre as partes) e, numa
  linha de **botões compactos com ícone que dividem a linha inteira**, um para a **introdução** ("▶ Intro") e um para
  **cada vez** ("▶ 1ª", "▶ 2ª", "▶ 3ª ⚑", onde ⚑ marca o final). Cada um toca só aquela parte, direto; o nome completo
  ("Terceira vez · final") fica no rótulo de acessibilidade e no miniplayer. **Todos os hinos** têm uma vez por
  estrofe da letra (no mínimo 2 com final): o hino 1 tem 4 vezes e o 457 tem 3. Com uma só vez e sem introdução há um
  só "Tocar". (Uma primeira versão tinha um contador "N vezes" e um interruptor; foi trocada depois da correção do
  responsável. Depois, os botões de vez só apareciam nos hinos com final; o responsável preferiu em todos, para o
  destaque da I-09 funcionar em qualquer hino.)
- **Verificado:** testes automatizados do conversor (partitura fictícia com a mesma estrutura do 457 e casos em
  que ele deve se recusar a adivinhar), do Rust e da montagem de passadas, e o JSON real do 457 passando pelo
  importador. **Não foi ouvido:** falta o responsável tocar o hino 457 e conferir se soa como no hinário.

### O que ainda não faz

- Só reconhece **duas casas de volta** seguidas de um trecho final (o padrão do 457). Outros hinos com final podem
  ser estruturados de outro jeito (ex.: três casas, repetição sem casas, D.C./coda); nesses o conversor avisa
  "estrutura não reconhecida" e lê a partitura uma vez. Cada estrutura nova precisa de uma amostra real.
- Uma nota ligada (ligadura) que atravesse o corte entre passadas não é tratada.
- A **letra não acompanha a vez** (pergunta 4 abaixo continua em aberto).
- **Introdução: feita, com uma hipótese a confirmar.** O responsável pediu um botão **Introdução** e que "Tocar o
  hino todo" comece por ela. O conversor gera o campo `introducao` = do começo da partitura até o marcador `*`
  (que fica no meio do compasso; o corte é no instante exato, e a nota que atravessa é encurtada). O `*` aparece como
  texto de pauta (`StaffText`) ou como cifra (`Harmony`), conforme a partitura. Os 5 hinos de amostra ficaram com
  9 a 15 s de introdução. **A hipótese de que o `*` marca o fim da introdução ainda não foi confirmada** pelo
  responsável: se for outro trecho, só muda o recorte no conversor.
- **Pausa entre as partes:** em "Tocar o hino todo" há **2 segundos** entre a introdução e a 1ª vez e entre uma vez e
  a seguinte (constante `PAUSA_ENTRE_PARTES_S`). Em segundos, e não em batidas, para não variar com o andamento.
  Poderia virar ajuste (0, 1, 2, 3, 5 s) se os músicos pedirem.

### Alternativas consideradas (para não reinventar a roda)

Em 2026-11-14, antes de escrever a regra de expansão, procurei soluções prontas:

- **`ms3`** (biblioteca Python de leitura do MuseScore): lê arquivos do MuseScore **3 e 4**; os do autor das transcrições são do
  **MuseScore 2**, e não achei confirmação de que ela expanda repetições. Também trocaria a linguagem do conversor.
- **Linha de comando do MuseScore** (`mscore -o ...`): exporta MIDI e MusicXML com as regras oficiais de repetição,
  mas exige **instalar o MuseScore** em quem converte e o MIDI perde letra, título e nomes das vozes. O fórum do
  MuseScore também relata casos estranhos nas regras de volta.
- **`music21`:** não achei nada conclusivo sobre como trata casas de volta.

Decisão: manter uma regra própria, **deliberadamente estreita** (só o padrão confirmado, com testes e aviso para o
resto). Se aparecerem muitas estruturas diferentes, o caminho consolidado é usar o MuseScore (modo conversor) como
**referência de teste** para comparar a ordem de execução, em vez de crescer o código próprio.

---

## I-02 — Variante "pergaminho" nos temas claro e escuro

> **Status: feita (primeira versão), 2026-11-15, a validar no celular.** Em **Ajustes → Aparência** há agora duas
> escolhas que se combinam: **Modo** (Automático, Claro, Escuro) e **Estilo** (Normal, **Pergaminho**, **Marinho e ouro**,
> esta é a I-14). Cada estilo tem versão clara e escura, então o Automático funciona em todos (6 paletas). O Pergaminho
> vale para o **app inteiro** (não só para a letra). Claro: fundo `#f5eedb`, cartões `#fffaeb`, texto marrom `#2b1a08`,
> ações em terra `#8a3f0a`. Escuro: marrom-quente `#2b261f` (mais claro que o escuro normal), ações em âmbar `#f2b27a`.
> Todas as combinações passam em `tools/contraste.py` (4,5:1 para texto, 3:1 para componentes). Prévias lado a lado em
> `design/identidade/previa-estilos-ouvir.png` e `previa-estilos-letra.png`; detalhes em `docs/design-tokens.md`.
> **Para confirmar com o responsável:** o quanto amarelado (os valores foram escolhidos por mim, a partir da paleta
> terrosa e da conta de contraste), e o nome em cada idioma (Pergaminho, Pergamino, Parchment).

- **Status:** feita (primeira versão)
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

### O que se deseja (nas palavras do responsável)

Em cada tema, duas versões:

- **Claro:** o claro normal e uma versão **pergaminho**, mais amarelada.
- **Escuro:** o escuro normal e uma versão **mais amarelada e ligeiramente mais clara**.

Ou seja, quatro paletas no total.

Reforço do responsável (2026-11-14): o claro "mais puxado para **bege, papiro, marfim**" e o escuro **menos escuro** que o
atual. Os nomes ("bege", "papiro", "marfim") servem de referência de cor para a versão amarelada. A I-14 (paleta do
ícone, azul-marinho e dourado) mexe nas mesmas variáveis de cor: decidir as duas juntas.

**Referência de cores: a paleta de tons terrosos de um projeto do responsável**, lembrada em 2026-11-14 como candidata para esta variante:

| Papel | Claro | Escuro |
|---|---|---|
| Fundo | `#ffffff`, com `#fffbe7` (marfim) como fundo alternativo | `#211e1b` (marrom-quente, no lugar do azul-frio) |
| Superfície | `#ffffff`; linha alternada `#f7f3ec` | `#2a2622` (mais forte `#37312b`) |
| Texto | `#241300` (suave `#55361a`) | `#f4f0eb` (suave `#c4bcb2`) |
| Acento (areia) | `#dbb778` (forte `#c49f5c`), texto sobre ele `#241300` | `#e0c084` (forte `#eed9ab`), texto sobre ele `#171513` |
| Borda | `#e0d8cc` (forte `#4a3a25`) | `#3e3831` (forte `#554d44`) |

Medido em 2026-11-14 com a razão de contraste do WCAG: **todos os pares de texto passam** (de 8:1 a 18:1, o menor é o
texto suave sobre superfície escura, 8:1). **Não passam como componente (meta 3:1):** o acento areia sobre o marfim
(1,8:1), a borda comum sobre o marfim (1,4:1) e as bordas do escuro (1,4:1 e 2,0:1). É o mesmo problema que o app já
resolveu no tema atual com `--ouro-linha` (mais escuro no claro) e `--borda-controle`: a variante precisa de versões
mais escuras para linhas, bordas de controle e o dourado de "onde estou na música". O dourado do ícone (`#f8b000`)
sobre o fundo escuro terroso dá 8,9:1, então combina com esta base.

### Motivação (a confirmar)

Conforto de leitura da letra por períodos longos: fundo amarelado costuma cansar menos a vista do que o
branco puro ou o azul-marinho frio. Não há medição de conforto no projeto; é preferência do responsável e
vale testar com quem lê.

### Ideia de comportamento (a validar)

Duas escolhas independentes em **Ajustes → Aparência**, para "Automático" continuar funcionando
com as duas variantes:

1. **Modo:** Automático | Claro | Escuro (já existe).
2. **Estilo:** Normal | Pergaminho (novo).

Combinações: claro normal, claro pergaminho, escuro normal, escuro pergaminho.

### Perguntas em aberto

1. **Onde vale o pergaminho?** No app inteiro ou só na área de leitura da letra (aba Letra)? Aplicar só
   na letra é mais simples e mais seguro quanto ao contraste dos controles, mas deixa o app com duas
   "caras".
2. **O quanto amarelado?** Precisa de amostras para o responsável escolher. O pedido para o escuro é
   "mais amarelado e ligeiramente mais claro" que o escuro normal; ainda é preciso fixar os valores.
3. **Nome em cada idioma.** "Pergaminho" tem equivalente natural em espanhol ("Pergamino") e inglês
   ("Parchment"), mas vale confirmar o tom desejado (pergaminho, sépia, âmbar).
4. **Os ícones do app** (azul-marinho e dourado) combinam com a variante pergaminho? Não é bloqueio.

### Impacto técnico (hipóteses, não verificadas)

- **Tokens (`src/lib/tema.css`):** hoje há um bloco claro e dois blocos escuros idênticos. A variante
  entraria como novos conjuntos de valores, por exemplo `data-estilo="pergaminho"` combinado com o modo.
  Cuidado com a duplicação dos blocos escuros (um por `prefers-color-scheme`, outro por escolha forçada):
  com o estilo, ficam quatro combinações em vez de dois blocos.
- **Preferência (`src/lib/tema.svelte.ts` e o script do `src/app.html`):** guardar o estilo além do modo e
  aplicar antes da primeira pintura, como já é feito com o modo.
- **Contraste (`tools/contraste.py`):** hoje verifica claro e escuro. Precisa verificar as **quatro**
  paletas com as mesmas metas (4,5:1 para texto, 3:1 para componentes). O fundo amarelado muda a razão
  de todos os pares, em especial `--suave`, `--acento` e `--borda-controle`; é provável que alguns valores
  precisem de ajuste.
- **Traduções:** novas chaves para "Estilo", "Normal" e "Pergaminho" nos três idiomas.

### Critérios de aceitação (propostos)

- As quatro paletas passam em `tools/contraste.py` com as mesmas metas das paletas atuais.
- Escolher o estilo muda o app na hora e a escolha sobrevive ao fechar o app.
- "Automático" combinado com "Pergaminho" acompanha o tema claro ou escuro do aparelho.

---

## I-04 — Alinhamento e tamanho da letra

- **Status:** implementada em 2026-11-15 (primeira versão; falta ver no celular e conferir com hinos reais, ver "O que foi feito")
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

### O que se deseja (nas palavras do responsável)

Na aba da **letra**, oferecer:

- **Alinhamento** à **esquerda**, à **direita** e **justificado**.
- **Tamanho**: **diminuir**, **restaurar** (voltar ao padrão) e **aumentar**.

### Ideia de comportamento (a validar)

Uma barra pequena no topo da aba Letra (ou no menu da aba) com três botões de alinhamento e os controles **A−**,
**A** (restaurar) e **A+**. As escolhas valem para todos os hinos e ficam salvas no aparelho. O plano original já
previa "Leitura: tamanho da letra" em Ajustes; esta ideia traz o controle para perto do texto.

### O que foi feito (2026-11-15)

- **Controles na própria aba Letra**, numa barra no topo: `A−`, `A` (restaurar, desabilitado no padrão) e `A+`, e três botões de
  alinhamento (esquerda, direita, justificado) com `aria-pressed`. Alvos de 48 px, nomes acessíveis e textos em pt, es e en.
- **Tamanho:** 6 passos, de **85% a 160%** do padrão (85, 100, 115, 130, 145, 160). Multiplica o tamanho de base em `rem`
  (`--escala-letra`), então **soma** com a fonte do sistema em vez de substituí-la. Os botões desabilitam nos limites.
- **Alinhamento:** esquerda (padrão), direita e justificado, aplicado à área da letra, estrofes e títulos incluídos.
- **Preferência** em `prefs.letra` (`src/lib/preferencias.ts`; regras puras em `src/lib/leitura.ts`), valem para todos os hinos e
  sobrevivem a fechar o app. Valor inválido no armazenamento volta ao padrão, campo a campo.
- **Ícones** de alinhamento acrescentados ao conjunto `ic` pelo gerador (`tools/gerar-icones.mjs`).
- **Conferido** em Chrome mudo: nos 6 passos o texto não transborda nem é cortado, **inclusive com a fonte do sistema a 150% e a
  letra no máximo**, e a escolha continua depois de recarregar. Testes: `tests/leitura.test.ts` e o e2e do karaokê.

**Limite conhecido do justificado.** A letra é em versos curtos, um por linha, então o justificado só age nos versos que
**quebram de linha**, e aí abre **espaços largos** entre as palavras, principalmente com a letra grande ("para &nbsp; ver &nbsp;
como &nbsp; cada"). A hifenização automática (`hyphens: auto`) está ligada, mas depende de o aparelho ter o dicionário da
língua. É a ressalva que a própria ideia anotava; **falta ver com hinos reais** e, se ficar feio, justificar só estrofes de
versos longos ou desistir do justificado.

### Perguntas em aberto

1. **Onde ficam os controles?** Na própria aba Letra (mais rápido para quem está lendo) ou só em Ajustes?
2. **Quantos passos de tamanho** e qual o mínimo e o máximo? Sugestão inicial: 6 passos, de 85% a 160% do padrão.
3. **Justificado em versos curtos:** a letra é em linhas curtas (um verso por linha), então o justificado pode abrir
   espaços feios. Vale conferir com hinos reais e talvez justificar só a última linha da estrofe, ou aplicar só
   quando houver quebra de linha. Precisa de teste visual.
4. **Alinhamento à direita** pode fazer sentido para idiomas lidos da direita para a esquerda (hoje não tratados).

### Impacto técnico (hipóteses, não verificadas)

- **Tamanho:** o texto da letra já usa `rem`; basta uma variável CSS (por exemplo `--escala-letra`) aplicada a
  `.estrofe p`. Respeitar também o tamanho de fonte do sistema (acessibilidade), multiplicando por ele em vez de
  substituí-lo.
- **Alinhamento:** `text-align: left | right | justify` na área da letra (`src/routes/hino/[numero]/+page.svelte`);
  para o justificado, `text-align-last` e `hyphens: auto` com o `lang` do conteúdo já marcado.
- **Preferência:** guardar no aparelho, como já é feito com idioma e tema (`src/lib/tema.svelte.ts` é o modelo).
- **Acessibilidade:** botões com 48 dp e nome acessível ("Diminuir letra", "Aumentar letra", "Restaurar tamanho da
  letra"); o estado do alinhamento escolhido precisa ser anunciado (botões de alternância com `aria-pressed`).
- **Traduções:** novas chaves nos três idiomas.

### Critérios de aceitação (propostos)

- Cada alinhamento muda a letra na hora, e a escolha sobrevive ao fechar o app.
- Aumentar, diminuir e restaurar funcionam, com limites mínimo e máximo, sem cortar texto nem quebrar o layout.
- Com a fonte do sistema no máximo mais o tamanho da letra no máximo, nada fica cortado.

---

## I-07 — Sons de instrumentos mais realistas

> **Origem:** pergunta do responsável ("tem como colocar sons mais realistas para os instrumentos?").

### Situação atual
O som é **síntese aditiva**: cada instrumento é uma `PeriodicWave` (uma receita de harmônicos) com envelope e
vibrato, gerada no próprio app. Não há gravações nem banco de sons: por isso o app é pequeno e funciona sem rede, mas
o timbre é aproximado ("tipo um órgão eletrônico"), principalmente em sopros e cordas.

### O que se deseja
Timbres que lembrem mais o instrumento de verdade (flauta, clarinete, violino, órgão, sax...).

### Pesquisa de 2026-11-14 (fontes e o que ficou sem confirmar)

Legenda: **[lido]** = conferido no próprio repositório ou arquivo de licença; **[busca]** = só em resultados de busca
ou resumos; **[?]** = não confirmado. Nada disto é parecer jurídico.

**Bibliotecas para tocar SoundFont/amostras no navegador**

| Biblioteca | Licença | Agenda notas com hora marcada? | Pontos de atenção |
|---|---|---|---|
| **smplr** | MIT **[busca]** (o arquivo `LICENSE` não foi lido: o caminho tentado deu 404) | **Sim [lido]**: `start({ note, velocity, time, duration })`, e `output.volume` muda o volume de um instrumento que já toca | Amostras ficam **online** por padrão (precisa de rede); dá para hospedar as nossas com `baseUrl`/`instrumentUrl` **[busca]**. O conjunto padrão vem do pacote de Benjamin Gleitzman (MusyngKite e FluidR3_GM); a **licença desses conjuntos não está declarada** na página **[?]**. Lê `.sf2` direto; `.sf3` **[?]** |
| **SpessaSynth** (`spessasynth_lib`) | **Apache-2.0 [lido]**, compatível com um app MIT | **Não vi [lido]**: `noteOn` toca na hora; o agendamento exigiria nosso próprio relógio (jitter) ou usar o sequenciador de MIDI | SF2, **SF3** e DLS **[lido]**. Exige **AudioWorklet** e carregar o SoundFont como `ArrayBuffer` (dá para empacotar no app). Volume por canal (CC7) **[?]**. Tamanho da biblioteca e funcionamento no WebView do Android e do iOS **[?]**: testar no aparelho |
| **WebAudioFont** | **GPL-3.0 [busca]** | (não avaliado) | Licença **copyleft**: incluí-la obrigaria o app a ser GPL, o que **não combina com a nossa MIT**. O autor diz considerar outra licença sob pedido. **Descartada**, salvo acordo com ele |

**Bancos de som (SoundFonts)**

| Banco | Licença | Tamanho | Instrumentos que o app precisa |
|---|---|---|---|
| **MuseScore_General** | **MIT [lido]**, herdada do FluidR3 (Frank Wen), com **avisos de copyright obrigatórios** e uma lista de créditos por preset (alguns de domínio público, CC0 ou sem licença declarada, em instrumentos que não usamos) | SF3 **38 MB**, SF2 206 MB; não há versão pequena nem arquivos por instrumento | Tem órgãos, flauta, clarinete, violino, trompete, sax alto e seção de metais. **Flugelhorn não existe** no padrão (o mais próximo é trompete ou Brass 2) |
| **GeneralUser GS** | Licença **própria** do autor **[lido]**: uso livre, sem exigir crédito, mas **não diz "redistribuir" explicitamente** nem cita APK; o autor não garante a origem de todas as amostras | SF2 **30,8 MB**; existe uma versão SF3 com menos de um terço do tamanho (tamanho exato **[?]**) | (não conferido) |
| **FluidR3_GM** | MIT **[busca]** | 141 MB (SF2) | GM completo |

**Android (MIDI nativo) [busca]:** a API `android.media.midi` só conecta **dispositivos** MIDI e **não gera som**. O
`MediaPlayer` toca `.mid` com o sintetizador **Sonivox**, de banco pequeno e qualidade modesta. Não há um banco GM de
boa qualidade para apps. A documentação oficial do Android **não foi lida diretamente** nesta pesquisa **[?]**.

### Conclusão provisória (a validar com um protótipo)

1. **Descartar** WebAudioFont (GPL-3.0) e o MIDI nativo do Android.
2. **Protótipo com o smplr**, usando o conjunto **FluidR3_GM** (licença MIT, a mais simples de cumprir) **hospedado
   dentro do app**, só com os instrumentos de que precisamos. Motivos: ele **agenda notas com hora marcada**, que é
   como o nosso sintetizador e a I-10 (reagendar na pausa) já funcionam, e tem volume por instrumento.
3. **Plano B: SpessaSynth** com um SoundFont **reduzido** a poucos instrumentos (SF3), se o smplr não servir. Exige
   resolver o agendamento das notas.
4. **O tamanho decide.** O MuseScore_General inteiro (38 MB) deixaria o APK com ~44 MB; vale reduzir o banco aos
   ~20 instrumentos do app. Não sei ainda quanto isso rende (**[?]**: medir no protótipo).
5. **O que o protótipo precisa responder:** (a) o smplr é mesmo MIT (ler o `LICENSE`) e qual a licença exata do
   conjunto de amostras; (b) tamanho por instrumento; (c) 4 vozes ao mesmo tempo no celular do responsável, sem estalos nem
   atraso; (d) funciona offline, com a hospedagem própria; (e) pausar, reagendar (I-10) e o destaque (I-09) seguem certos.

### Resultado do protótipo e decisão (2026-11-14)

**Protótipo:** smplr + FluidR3_GM (licença MIT), com três instrumentos gravados (órgão de igreja, flauta e clarinete)
como opção por voz. Medido em tempo real: o arquivo carrega do próprio app, as notas agendadas soam na hora certa, o
volume da voz governa o instrumento e a nota termina na duração pedida. O responsável ouviu: **"ficou bem mais real"**
e o **órgão soa como o órgão clássico de igreja** que se usa na CCB. Nesse nível, está satisfeito.

**Decisão do responsável:** a **síntese atual continua sendo o padrão** (leve, funciona offline desde o primeiro uso). Os
sons gravados entram como **pacote opcional, baixado sob demanda** (ou como pacote extra importado). O app só mostra a
opção quando os arquivos existem e, se um som gravado não carregar, a voz toca na síntese em vez de falhar.

**Números medidos nos arquivos baixados:**

| Medida | Resultado |
|---|---|
| Tamanho de um instrumento no formato do Gleitzman (JavaScript com base64) | 2,8 a 3,0 MB |
| Qualidade do áudio original | mp3 estéreo de ~65 kbps, 3 s por nota, 88 notas |
| Recodificar (Opus mono) | 48 kbps: **106%** do tamanho (pior); 32 kbps: 78%, com perda de qualidade. **Não compensa** |
| Cortar as notas que os hinos não usam | Os 5 hinos usam MIDI 39 a 77 (33 a 83 com transposição de ±6): ficam 57 das 88 notas, **~35% menos** |
| Tamanho de um instrumento cortado, em mp3 binário (sem o invólucro base64) | **~1,5 MB** |
| Os 19 instrumentos do app, cortados | **~28 MB** (todos); o app base continua em ~6 MB |

Alavanca ainda não medida: usar uma nota a cada duas (o smplr transpõe a vizinha), o que reduziria à metade, mas só se
decide **de ouvido**.

**Desenho proposto para o pacote de sons (a construir):**
1. `tools/preparar-sons.py`: gera, a partir do FluidR3_GM, um arquivo por instrumento já cortado e em binário.
2. **Ajustes, "Sons gravados":** lista de instrumentos com o tamanho de cada um, baixar e remover. Os arquivos ficam na
   pasta de dados do app e funcionam **offline** depois de baixados. Prioridade: o **órgão** primeiro.
3. **Hospedagem própria** (Releases ou Pages do repositório, quando ele for público), e não o site do Gleitzman. Antes
   disso, o APK de teste leva os sons dentro (como já leva o conteúdo) e dá para importar de um arquivo.
4. Carregar do armazenamento do app (via `Blob`/URL local) em vez do endereço fixo do protótipo.
5. Página de **créditos e licenças** (aviso de copyright do FluidR3, com a lista de origem das amostras).
6. O **flugelhorn não existe** no padrão General MIDI: decidir o substituto (trompete, trompa ou manter a síntese).
7. **Comparação feita (2026-11-14):** o responsável achou o **órgão de tirantes (`drawbar_organ`) o mais parecido com o da
   igreja**, e ele vai na frente da lista. Seu volume estava baixo, e os ganhos por instrumento foram calibrados.
   **Confirmado depois da calibração: "faz mais sentido esse de tirantes, agora ficou bom".** O órgão de tirantes é o
   **escolhido** para o pacote de sons (os outros dois órgãos eram só para comparar).
   Antes disso: o responsável não sabe a "configuração" do órgão que a igreja usa. Para achar o mais parecido, comparar de ouvido
   outros órgãos do banco (`reed_organ`, `drawbar_organ`); cada um é mais um download de ~3 MB (pedir permissão).

**Ainda pendente:** o arquivo `LICENSE` do repositório do smplr (o pacote no npm declara MIT), a licença do pacote de
amostras do Gleitzman, e tocar 4 vozes gravadas no celular do responsável para ver se há estalos.

### Caminho inicial (anterior à pesquisa)
- **SoundFont (`.sf2`) ou amostras gravadas**, tocadas no navegador/WebView com uma biblioteca pronta, em vez de
  construir o nosso próprio tocador de amostras. Candidatas a avaliar: **SpessaSynth**, **smplr**, **WebAudioFont**.
- O banco de sons precisa de **licença livre compatível com MIT** e não pode ir no repositório se for grande: seguiria
  o mesmo modelo do conteúdo (baixado/importado pelo usuário ou empacotado só no app).
- Mantém-se a síntese atual como **padrão leve** e opção "sons realistas" nos Ajustes.

### Perguntas em aberto
1. Qual o limite de tamanho aceitável do app e do download? (bancos de sons completos têm dezenas a centenas de MB;
   dá para usar só os 8 a 10 instrumentos que o app oferece.)
2. Precisa funcionar 100% offline? (hoje funciona)
3. Qual o aparelho mais fraco que precisa rodar? (amostras gastam mais memória)

### Critérios de aceitação (propostos)
- Pelo menos 3 pessoas preferem o timbre novo ao atual em um teste cego curto.
- Sem estalos nem atrasos perceptíveis ao tocar 4 vozes ao mesmo tempo no aparelho mais fraco.
- Licença de cada som registrada em `docs/`.

---

## I-09 — Mostrar em "Tocar o hino todo" em que parte da música se está

> **Situação: feita** (decisão do responsável: botões de vez em todos os hinos). O destaque dourado anda de Intro
> para 1ª, 2ª... conforme o tempo decorrido (`parteTocando` no store, `partesDoTudo` e `parteNaBatida` em
> `vezes.ts`, com testes). **Escolhas feitas, fáceis de trocar:** na pausa de 2 s vale a parte que acabou de terminar
> (muda quando a próxima começa); o ícone **♪** marca a parte que soa dentro do hino todo (sinal que não depende só
> da cor) e o botão ganha `aria-current`; **sem aviso falado** de mudança de parte, para não competir com o áudio.
> Falta ver no aparelho.

> **Origem:** sugestão do responsável: quando toca o hino todo, o botão da parte que está tocando muda de cor, e a
> cor passa de um botão para o seguinte (Intro, depois 1ª, 2ª...), "para o músico saber onde está dentro da música".

### O que se deseja
Em **"Tocar o hino todo"**, o destaque dourado (hoje só aparece quando se toca uma parte sozinha) acompanha a
música: começa na **Intro**, passa para a **1ª** quando ela começa, depois a **2ª**, e assim por diante até o final.

### Impacto técnico (hipóteses)
- `montarTudo` já sabe onde cada parte começa e termina (a duração de cada uma mais a pausa de 2 s). Basta devolver
  também a lista de **limites em batidas**, e a tela comparar o tempo decorrido com ela.
- O tempo decorrido já existe no store (`decorrido`), e a conversão para batidas usa o andamento escolhido.
- A pausa entre partes pode ficar com o destaque da parte que acabou, ou sem destaque; decidir ao olhar.
- Acessibilidade: o destaque não pode depender só de cor (já há o ícone ❚❚ e `aria-pressed`). Avisar a mudança de
  parte para leitor de tela de forma discreta (região `aria-live="polite"`), ou deixar sem aviso para não atrapalhar
  o áudio.
- Combina com o cursor da partitura da **I-08**: as duas dependem de saber o instante de cada parte.

### Perguntas em aberto
1. Na pausa de 2 s, o destaque some, fica na parte anterior ou já passa para a seguinte?
2. Avisar a mudança de parte para leitor de tela, ou só visual?

### Critérios de aceitação (propostos)
- No 457, tocando o hino todo, o destaque vai de Intro para 1ª, 2ª e 3ª ⚑ nos instantes certos (conferido por
  teste com o tempo de cada parte).
- Pausar e continuar mantêm o destaque correto; parar tira o destaque.
- Com "reduzir movimento" ligado, a troca de cor continua sem animação.

---

## I-10 — Trocar instrumento, andamento e tom com a música pausada

> **Situação: feita** (2026-11-14), liberando **instrumento, andamento e tom** na pausa (a recomendação do
> assistente, que o responsável aprovou ao seguir o plano). Ao **continuar**, se algo mudou, `continuar()` em
> `reproducao.svelte.ts` reagenda as notas a partir da posição em batidas (`Sintetizador.tocar(..., { aPartirDe,
> pausado })` e `notasAPartirDe`), testado com um `AudioContext` falso. **Tocando**, os controles continuam
> travados (pergunta 1 abaixo, ficou para depois). **Detalhe conhecido:** em "Tocar o hino todo", a pausa de 2 s
> entre as partes é contada em batidas no momento em que a música começa; se o andamento mudar na pausa, as
> pausas seguintes passam a durar um pouco mais ou menos que 2 s. Falta ver no aparelho.

> **Origem:** observação do responsável ao testar no celular: "quando pausado ele não deixa eu trocar as vozes do
> sintetizador e ele poderia deixar; só deixa eu trocar quando eu paro".

### Como é hoje
- **Com a música tocando ou pausada**, ficam travados: o **instrumento de cada voz**, o **andamento**, a
  **transposição** e o "Restaurar padrão" (`disabled={!parado}` em `Player.svelte`). Para mexer é preciso **parar**,
  o que volta a música ao começo.
- **Funcionam ao vivo**, inclusive pausado: o **volume** e o **silenciar** de cada voz.

### O que se deseja
Poder trocar o **instrumento** (o pedido) com a música **pausada**, e continuar de onde parou. O mesmo valeria para
andamento e tom, por coerência, se for simples.

### Por que é assim (hipótese a confirmar no código)
O sintetizador **agenda todas as notas de uma vez**, no começo, já com o timbre escolhido. A pausa só **suspende o
relógio** do `AudioContext`, então as notas continuam agendadas com o timbre antigo. Volume e silenciar passam por
um controle de volume por voz (`GainNode`), que dá para mexer a qualquer momento; o timbre, não.

### Caminho provável
Ao **continuar** depois de uma mudança, **reagendar** as notas a partir da **posição atual** (em batidas) com os
ajustes novos, em vez de retomar o agendamento antigo:
- guardar a posição em **batidas**, e não em segundos, para ela valer mesmo se o andamento mudar;
- `Sintetizador.tocar` ganha um parâmetro "começar em N batidas", que descarta as notas anteriores e corta as que
  atravessam esse ponto;
- sem mudança nenhuma, "continuar" segue como hoje (sem reagendar).

### Perguntas em aberto
1. Trocar o instrumento **tocando**, e não só pausado? Dá para fazer do mesmo jeito (reagendar na hora), mas pode
   causar um corte curto no som. Começar só pelo pausado, como pedido.
2. Andamento e tom também liberados na pausa, ou só o instrumento?
3. O destaque da parte que soa (I-09) precisa continuar certo depois de trocar o andamento: depende da posição em
   batidas, o que o caminho acima já resolve.

### Critérios de aceitação (propostos)
- Pausar, trocar o instrumento de uma voz e continuar: a música segue do mesmo ponto, com o novo timbre.
- Pausar, mudar o andamento e continuar: segue do mesmo ponto musical, no novo andamento.
- Sem mudança durante a pausa, o som continua idêntico ao de hoje.
- Teste automatizado da conversão posição em batidas e novo corte das notas.

---

## I-11 — Ícones em SVG local (subset), no lugar de emojis e símbolos

> **Situação: feita** (2026-11-14), com o conjunto **`ic`** (Material Icons, contorno), **escolha confirmada pelo
> responsável** ("pode ser o Material Icons, contorno está bom"). `Icone.svelte` lê `src/lib/icones.json` (13 ícones, **1,9 KB**), gerado por
> `tools/gerar-icones.mjs` (busca no Iconify uma vez). Trocados: tocar, pausar, parar, música (introdução), bandeira
> (final), alto-falante ligado e mudo, voltar, ok, mais, menos e a seta dos cards (que muda de baixo para cima quando o
> card abre). Ficam como letra o `!` e o `i` dos avisos de erro e informação. **Para trocar de conjunto:** mude
> `CONJUNTO` e os nomes em `tools/gerar-icones.mjs` e rode `node tools/gerar-icones.mjs --escrever`. Os créditos da
> licença estão em `docs/licencas-de-terceiros.md`.

> **Origem:** o responsável acha os ícones atuais "zuados" e sugeriu usar o sistema de ícones de outro projeto do responsável
> (lista de ícones e `icons-subset.json` locais).

### Como é hoje
Os "ícones" são caracteres de texto e emojis: ▶ ❚❚ ■ ♪ ⚑ 🔊 🔇 ← ✓ + − (cerca de 12 distintos). A aparência depende do
aparelho e da fonte (no emulador o 🔊 vira um desenho colorido de clip-art) e **os emojis ignoram os temas** (não herdam a
cor dos tokens, nem a de baixa visão quando existir).

### Como esse projeto faz (referência, lido sem alterar nada)
- `admin-web/public/icons.js` varre o DOM atrás de `<span class="material-symbols-outlined">nome</span>` e troca por um
  `<svg>` inline, tirado de `icons-subset.json`.
- `icons-subset.json` guarda só os ícones usados: 4 temas (`material-symbols-light` padrão, `ic`, `fluent-color`,
  `withicons-pastel`), uns 100 ícones por tema, 373 KB no total (cerca de 0,9 KB por ícone).
- Gerado por `admin-web/scripts/build-icons-subset.mjs`, que busca os desenhos no Iconify (precisa de rede, uma vez) e
  grava o arquivo. Em uso, tudo é local.

### Proposta (pequena)
1. Componente Svelte `Icone.svelte` (`nome`, `tamanho`) que lê de `src/lib/icones.json`, **um só tema** (sugestão:
   `material-symbols-light`, o padrão desse projeto) e só os ~12 ícones que usamos (**~11 KB**, contra os 373 KB desse projeto,
   que carrega 4 temas). `fill="currentColor"`: herda a cor dos tokens (claro, escuro, dourado, baixa visão).
2. `tools/gerar-icones.mjs`, adaptado do script desse projeto (buscar no Iconify uma vez e gravar o JSON no repositório).
3. Trocar os glifos: play, pause, stop, música (introdução), bandeira (final), alto-falante ligado e mudo, voltar, ok,
   mais e menos, e a seta dos cards.
4. Ícone decorativo com `aria-hidden`; o nome acessível continua no botão (`aria-label`).

### Prévia feita (2026-11-14)
Prévia lado a lado em [`design/icones/previa-icones.png`](../../design/icones/previa-icones.png): os 12 ícones, nos temas
claro e escuro, em três conjuntos desse projeto, mais uma tira que imita o player (botão principal, partes com uma tocando em
dourado, linha de voz). O `fluent-color` ficou de fora: esse projeto documenta que ele é voltado a objetos e marcas, sem
equivalente para ícones de ação. Os desenhos vieram da API pública do Iconify (a mesma fonte do script desse projeto).

| Conjunto | Licença | Cobre os 12? | Cor |
|---|---|---|---|
| `ic` (Google Material Icons, contorno) | Apache-2.0 | **Sim** | `currentColor`: **herda os temas** |
| `material-symbols-light` (Google) | Apache-2.0 | **Sim** | `currentColor`: herda os temas |
| `withicons-pastel` (Evergrow) | MIT | **Não**: falta o alto-falante ligado | **Cores fixas** (roxo, rosa, verde): ignora os temas, como os emojis de hoje |

**Recomendação do assistente: `ic`.** Cobre tudo, herda a cor dos tokens (azul, dourado, escuro, e a baixa visão
futura) e tem traço mais firme em tamanhos pequenos que o `material-symbols-light`, que é fino e leve (elegante, mas
fraco a 20 px). O `withicons-pastel` não serve ao esquema azul e dourado nem à baixa visão (contraste não controlável).
Decisão do responsável: **pendente**.

### Decisões que faltam
1. **Qual conjunto?** (recomendação acima: `ic`.)
2. **Créditos:** Apache-2.0 pede manter o aviso de copyright e a licença; vão na mesma página de créditos dos sons (I-07).
3. **Reaproveitar o `icons.js` ou fazer um componente Svelte?** Recomendação: componente Svelte com o mesmo subset e o
   mesmo script de geração, porque o `icons.js` foi feito para HTML sem framework (observa o DOM e troca texto).

### Critérios de aceitação (propostos)
- Nenhum emoji nem glifo de ícone na interface.
- Contraste dos ícones conferido (3:1) em todos os temas, por `tools/contraste.py`.
- Leitor de tela não lê o ícone duas vezes.
- O APK cresce menos de 30 KB.

---

## I-12 — Karaokê: acompanhar a música na letra e na partitura

> **Origem:** sugestão do responsável: "uma possibilidade de fazer meio que um karaokê, tanto na letra das músicas como nas
> partituras". Nasce da I-09 (que já destaca a parte que está soando) e da I-08 (partitura em SVG).

> **Status:** **fase A (letra) feita** em 2026-11-14, a validar no aparelho. **Fase B (partitura)** continua pendente e
> depende da I-08.
>
> **O que a fase A faz:** no cabeçalho, só na aba **Letra** e em hino que traz a sincronia, há um **botão de ícone**
> (microfone cheio com borda dourada = ligado; microfone riscado = desligado; ligado por padrão e lembrado entre as
> aberturas). A posição foi escolhida pelo responsável entre três propostas (ícone no cabeçalho, botão flutuante e
> faixa fixa): fica sempre à vista e não gasta espaço da letra.
> Tocando, acende a **estrofe da vez** (barra dourada na borda), a **linha** (as outras da estrofe esmaecem) e o **trecho
> (sílaba)** que soa (fundo dourado e sublinhado, sem mudar o tamanho do texto). A tela **rola até a linha** quando ela
> sai da vista, e só nesse momento (a pessoa pode rolar à vontade entre uma linha e outra); a rolagem é suave só para
> quem não pediu menos movimento. Pausa congela o destaque (testado). Trocar o andamento na pausa deve manter o lugar,
> porque a posição é lida do relógio do áudio em batidas, mas **isso ainda não foi testado**. O conversor grava o campo `sincronia` (`docs/FORMATO.md`), com a passada normal e a do final.
>
> **Respostas que adotei às perguntas em aberto (a confirmar):** (1) granularidade: **sílaba**, com a linha atual em
> destaque; (2) o destaque aparece **só na aba Letra** (na Ouvir já há os controles e o botão de cada parte); (3) a
> rolagem acompanha sozinha quando o karaokê está ligado, e o botão desliga tudo.
>
> **Medido (Chrome real, mudo, hino 457):** troca de sílaba com desvio máximo de **27 ms** em relação ao tempo da
> sincronia e **−2 ms** acumulados em 23 s; pausa congela o destaque; desligar apaga tudo. Na **vez do final** o destaque
> segue a estrofe 3 e, no trecho final (escrito sob a estrofe 1), passa para lá. Nas 5 amostras reais, **0 erros** de
> posição e de ordem do tempo. No celular a latência da saída de áudio é descontada (`AudioContext.outputLatency`).
>
> **Limites conhecidos:** cobre só o que a partitura traz como sílaba; letras com erro na partitura aparecem no destaque
> (ver I-05); numa estrofe sem número ("1.") não acende; sem aviso falado a cada sílaba, de propósito.

### O que se deseja
Enquanto o hino toca, o app mostra **onde a música está**: na **letra**, a sílaba ou palavra que está sendo cantada (e a
estrofe da vez); na **partitura**, o compasso ou a nota atual, com a página rolando junto.

### O que já existe
- **O dado de tempo da letra já passa pelo conversor:** cada sílaba é lida com o instante (em batidas) da nota a que
  pertence, a estrofe e se a palavra continua na sílaba seguinte (`Silaba` em `tools/mscx2json/src/main.rs`). Hoje isso só
  serve para montar as linhas, e os tempos são descartados na saída.
- **A posição da música em batidas já existe no app** (`parteTocando` da I-09: tempo decorrido × andamento ÷ 60) e já
  considera mudança de andamento na pausa (I-10).
- **A estrofe que soa é a da vez:** a vez N canta a estrofe N, e `partesDoTudo` sabe em que instante cada vez começa.

### Proposta em duas fases
**Fase A: letra (não depende de nada novo).**
1. Conversor: gravar, por estrofe, a lista de sílabas com início e fim em batidas (campo opcional novo no
   `hinario.json`, por exemplo `sincronia`; `docs/FORMATO.md` e o leitor em Rust acompanham).
2. App: na aba Letra (com o miniplayer para pausar), destacar a estrofe que soa, a linha atual e a sílaba atual, e rolar a
   tela para a linha atual. O destaque **não pode depender só de cor** (negrito ou sublinhado) e a rolagem respeita
   "reduzir movimento".
3. Atualização suave: ler o relógio do áudio a cada quadro, e não só a cada 200 ms, para a sílaba não ficar atrasada.

**Fase B: partitura (junto da I-08).**
1. O MuseScore exporta, além do SVG, as **posições dos compassos e das notas** (arquivos de posição usados por apps
   com cursor de reprodução); alternativa sem o MuseScore: a biblioteca OpenSheetMusicDisplay já tem cursor, mas exige
   MusicXML. Decidir junto com a escolha de ferramenta da I-08.
2. Mapa **tempo tocado para compasso**: hinos com final tocam um caminho diferente na última vez (compassos puladas e
   repetidas). O conversor já conhece esse plano e pode gravar, por versão (normal e final), em que instante começa cada
   compasso.
3. App: cursor ou compasso destacado e rolagem automática da página.

### Pontos de atenção
- **Qualidade da letra:** o karaokê expõe erros de sílaba e de alinhamento que hoje passam despercebidos (I-05).
- **Hinos com estrutura diferente** (bis, estrofes com notas diferentes): o conversor deve avisar e deixar sem
  sincronia em vez de adivinhar, como já faz com as repetições.
- **Tamanho do JSON:** cerca de uma sílaba por nota; acompanhar quanto cresce nos 480 hinos.
- **Acessibilidade:** sem aviso falado a cada sílaba (competiria com o áudio); o leitor de tela segue lendo a letra
  normalmente.

### Perguntas em aberto
1. Granularidade da letra: **sílaba**, **palavra** ou **linha**? (Sílaba é o mais "karaokê"; linha é o mais calmo.)
2. O destaque também aparece na aba Ouvir, ou só na Letra?
3. A rolagem acompanha sozinha, ou só quando a pessoa pede ("seguir a letra")?

### Critérios de aceitação (propostos)
- No 457, tocando o hino todo, a estrofe 1 acende na 1ª vez, a 2 na 2ª e a 3 na 3ª (final), e a sílaba atual acompanha
  a música dentro de meio compasso.
- Pausar, continuar e trocar o andamento na pausa mantêm o destaque certo.
- Hino sem sincronia continua mostrando a letra normalmente, sem erro.

---

## I-14 — Variante de tema com a paleta do ícone (azul-marinho e dourado)

> **Status: feita (primeira versão), 2026-11-15, a validar no celular.** É o estilo **Marinho e ouro** de
> **Ajustes → Aparência** (junto do Pergaminho, ver a I-02). **Respostas que adotei às perguntas em aberto (a
> confirmar):** (1) as ações **não** viram douradas: ficam em azul (marinho `#173f7a` no claro, azul claro `#8fbaf7` no
> escuro) e o dourado do ícone segue só para "onde estou na música", como nos outros estilos; (2) **duas** paletas, clara
> e escura, para o Automático funcionar (o claro usa um fundo azul-gelo `#e9eef7`, para não se confundir com o
> Pergaminho); (3) é **escolha da pessoa**, e o padrão continua o Normal. Escuro: fundo `#041a3b`, cartões `#0b2a56`. Todas
> as combinações passam em `tools/contraste.py`. Prévias em `design/identidade/previa-estilos-*.png`.

- **Status:** feita (primeira versão)
- **Origem:** pedido do responsável, 2026-11-14 ("Quero sim"), depois de perguntar se o tema segue as cores do ícone.
- **Prioridade:** a definir

### O problema

Hoje o **dourado do ícone** (`#f8b000`) já marca "onde estou na música" (parte que toca, barra de progresso, aba
selecionada, ⚑ do final), mas a **base do tema não vem do ícone**: fundo, cartões e bordas são neutros, e as ações são
azuis (`#1768b3` no claro, `#7bbcff` no escuro). O ícone é **azul-marinho (`#012352`) com dourado**. O app e o ícone
parecem de famílias diferentes.

### O que se deseja

Uma opção de aparência em que a **base é a paleta do ícone**: fundos e superfícies em tons do **azul-marinho**, e o
**dourado** como cor de destaque. Seria um tema além de Claro, Escuro e Automático.

### Ideia de comportamento (a validar)

- Em **Ajustes → Aparência**, uma escolha nova (nome a definir, por exemplo "Ícone" ou "Marinho e ouro").
- Provavelmente **escura** (o marinho pede texto claro), com o dourado nos destaques. Pergunta: precisa de uma versão
  clara (marfim com marinho nos textos) ou basta uma?
- Convive com as ideias I-02 (variantes "pergaminho") e I-06 (baixa visão): as três mexem nas mesmas variáveis de cor
  (`src/lib/tema.css`, `docs/design-tokens.md`). Convém decidir juntas como as escolhas se combinam, para não explodir o
  número de paletas.

### Perguntas em aberto

1. **Papel do azul das ações** (`--acento`): vira dourado também? O dourado já marca "onde estou na música"; usar o
   mesmo dourado para ações apagaria essa distinção. Alternativa: ações em azul-claro do marinho, dourado só na música.
2. **Uma paleta (escura) ou duas** (escura e clara)?
3. É um tema de **escolha da pessoa** ou o **padrão** do app?
4. **Base azul-marinho (ícone) ou base terrosa (a de um projeto do responsável, ver a I-02)?** O dourado do ícone combina com as duas.
   A terrosa atende ao pedido de um claro "bege, papiro, marfim" e de um escuro menos escuro e menos frio; a marinho
   é a que mais lembra o ícone. Dá para oferecer as duas como aparências separadas, se não explodir o número de paletas.

### Impacto técnico (hipóteses)

- Só variáveis de cor em `tema.css`; nenhum componente muda.
- **Contraste:** todas as combinações passam por `tools/contraste.py` (4,5:1 para texto, 3:1 para componentes). O dourado
  `#f8b000` sobre claro tem só 1,8:1 (por isso o app usa `#946200` como `--ouro-linha` no tema claro); sobre o
  marinho, deve passar com folga, mas precisa ser medido.
- O logo e a tela de abertura já usam as cores do ícone, então a coerência visual melhora sem trabalho extra.

### Critérios de aceitação (propostos)

- A nova aparência aparece em Ajustes e persiste, sem quebrar "Automático".
- Todos os pares de cor passam em `tools/contraste.py` com as metas atuais.
- Parte que toca, aba selecionada e barra de progresso continuam distintas das ações.

---

## I-15 — Timbres sintetizados mais parecidos com os instrumentos

- **Status:** implementada em 2026-11-15 (falta o responsável conferir de ouvido, ver "O que foi feito")
- **Origem:** observação do responsável no teste, 2026-11-15: "os áudios sintetizados do trompete, trombone, tuba,
  fagote, oboé, sax alto e sax tenor estão ruins, nem parece o som do instrumento".
- **Prioridade:** a definir (o responsável pediu antes o CI e os temas I-02 e I-14)

### O problema

O som **sintetizado** é o padrão do app (não pesa nada e funciona sem rede). Para estes sete instrumentos ele não
lembra o instrumento. Quem não baixa o pacote de sons gravados só ouve a síntese. Os gravados desses mesmos
instrumentos existem e soam bem; o problema é só do padrão.

### Como é hoje (fato, lido do código)

Cada instrumento é uma **tabela fixa de harmônicos** (`PeriodicWave`), uma envoltória simples (ataque e soltar) e, em
alguns, vibrato. A mesma tabela vale para qualquer altura da nota.

### Hipóteses do que falta (não medidas)

Instrumentos de sopro de metal e de palheta mudam de timbre com a altura e com o ataque. A síntese de hoje não tem:
1. **brilho que muda com a altura** (notas graves e agudas têm espectros diferentes: uma tabela por região);
2. **o brilho que sobe no ataque** nos metais (filtro com envoltória, o "buá" do começo da nota);
3. **ruído de sopro e um ataque com transiente**, que dão o caráter de sopro;
4. **ressonâncias fixas (formantes)** nas palhetas (oboé, fagote e saxes), que fazem o som "anasalado".

### Caminhos possíveis, a pesquisar antes de construir

- **Extrair os espectros das próprias amostras gravadas** (as do pacote, licença MIT): analisar, por FFT, o espectro de
  cada instrumento em algumas alturas e gerar tabelas por região para a síntese. Reaproveita dado real, sem pesar no
  app (são só alguns números por instrumento). É a que eu tentaria primeiro.
- Conferir se alguma biblioteca já resolve (síntese por FM ou por filtro subtrativo, por exemplo nos sintetizadores do
  Tone.js), com licença e tamanho. Registrar o que foi lido, como na I-07. Sem reinventar a roda.
- Oferecer o gravado como padrão **se já estiver baixado** (o app já faz o alternador por voz).

### O que foi feito (2026-11-15)

Seguiu-se o primeiro caminho: **medir as amostras gravadas** (FluidR3_GM, MIT) e usar os números na síntese.

- `tools/analisar-timbres.py` mede, em uma âncora a cada 3 semitons da faixa natural de cada um dos sete instrumentos, o
  espectro de harmônicos na parte sustentada, o ataque, o quanto o brilho abre no começo e o ruído. Grava
  `src/lib/timbres.json` (28 KB). O resto do catálogo não muda.
- `src/lib/timbres.ts` interpola as duas âncoras vizinhas e devolve o perfil da nota (tabela, ataque, nível, abertura).
  Fora da faixa medida vale a âncora da ponta. É função pura, sem Web Audio.
- `agendarNota()` (em `sintetizador.ts`) agora monta cada nota e serve ao app e às prévias offline. Uma onda por
  (instrumento, altura), guardada. Nos metais (trompete, trombone, tuba) entra um passa-baixa que abre em ~40 a 100 ms:
  um filtro a mais por nota, só nesses três.
- **O volume não muda**: o `nivel` de cada nota é corrigido para o mesmo volume eficaz da tabela antiga (o Web Audio
  normaliza o pico, e uma tabela mais cheia soaria mais alta). Assim os `ganho` dos gravados, calibrados contra a síntese,
  seguem valendo.
- O ataque vem da mediana medida, limitado a 20 a 80 ms (o oboé gravado "incha" em 200 ms, o que atrasaria a nota).

**O que ficou de fora, de propósito:** ruído de sopro (a energia fora dos harmônicos medida é menor que 2%, na prática
inaudível) e formantes (as ressonâncias das palhetas já vêm no espectro medido por altura). O brilho que abre no
começo só entra nos metais: nas palhetas a medida é inconclusiva (a maioria das amostras já nasce aberta).

**Medida objetiva** (`python3 tools/analisar-timbres.py --distancia`): distância espectral entre a síntese e a gravação,
em notas que **não** são âncoras (162 notas; dB, ponderada pela energia de cada harmônico; menor = mais parecido):

| instrumento | antes | agora |
|---|---|---|
| trompete | 5,1 | 0,6 |
| trombone | 15,8 | 1,4 |
| tuba | 9,8 | 0,9 |
| fagote | 9,2 | 2,3 |
| oboé | 4,6 | 0,9 |
| sax alto | 5,8 | 2,9 |
| sax tenor | 14,3 | 2,9 |
| **todos** | **9,3** | **1,7** |

Limite da medida: o banco reaproveita amostras entre notas vizinhas, então ela é em parte "fácil", e a meta é parecer com a
**gravação**, não com o instrumento real. No áudio renderizado, o centroide espectral ficou mais perto do gravado nos sete
(tuba, tenor e trombone os que mais; o sax alto e o trompete ainda ficam ~400 Hz abaixo do gravado, o que o ruído e as
ressonâncias não modeladas explicam).

**Segunda leva (2026-11-15):** o mesmo método foi aplicado aos outros 7 sintetizados que têm gravado no banco (flauta doce,
violino, clarinete, viola, violoncelo, contrabaixo e trompa; a trompa ganha também o filtro de abertura, por ser metal).
Distância à gravação: flauta doce 1,4 → 0,3; violino 3,4 → 1,2; clarinete 18,6 → 1,7; viola 5,6 → 2,2; violoncelo
5,4 → 2,5; contrabaixo 10,2 → 1,4; trompa 9,3 → 1,0 (média dos 14: 8,7 → 1,6 dB). Os órgãos suave e pleno ficam com a tabela
fixa. **Flugelhorn e bombardino** não têm gravado no banco (não há o que medir), então o timbre deles é uma **mistura
50/50, nota a nota, de instrumentos medidos**: flugelhorn = trompete + trompa; bombardino = trombone + tuba (`MISTURAS` em
`src/lib/timbres.ts`). É aproximação, não medida, e os pesos são palpite a ajustar de ouvido. Vibrato e volume eficaz dos
perfis seguem os de antes. Falta ouvir.

**Para ouvir:** `node tools/previas-timbres.mjs <pasta>` gera, por instrumento, um MP3 com a mesma escala de duas oitavas
em **antes → agora → gravado** (o gravado vai igualado ao "agora" em volume, para comparar só o timbre). Roda o código
real do app num Chrome mudo, sem tocar som.

**Órgão de tirantes (gravado):** o `ganho` subiu de 2,65 para 7,1. Medido com `python3 tools/analisar-timbres.py
--niveis`, era o mais baixo dos 16 gravados (−8,6 dB no ouvido e −9,8 dB no celular em relação à mediana), porque a
calibração por RMS escondia que o registro de 16' dele tem 1,9× a energia da nota, grave que o ouvido e o alto-falante do
celular quase não reproduzem. Agora fica na mediana do ouvido (pico 0,62). Falta o responsável conferir de ouvido.

### Perguntas em aberto

1. Quais dos sete importam mais para o uso real (por voz: tuba e trombone costumam ir no baixo)?
2. ~~Aceita-se um pouco mais de processamento no celular?~~ Só os três metais ganharam um filtro por nota; o custo é
   pequeno, mas **falta conferir num celular com 4 vozes** de metal ao mesmo tempo.
3. Os outros 15 gravados também devem ser equalizados pelo nível no ouvido? Flautas, clarinete e trompa estão 4 a 12 dB
   acima da mediana.

### Critérios de aceitação (propostos)

- Comparação **às cegas, de ouvido**, pelo responsável: cada um dos sete soa mais parecido com o instrumento que a
  versão de hoje, e o ranking vira um item no documento.
- O espectro médio de cada instrumento sintetizado fica mais perto do da amostra gravada do que o de hoje (medida
  objetiva, em `tools/`), sem aumentar de forma relevante o tamanho do app nem o uso de CPU com 4 vozes.

## I-05 — Arquivo de correções para a letra (proposta do assistente)

- **Status:** anotada
- **Origem:** observação do assistente, 2026-11-14, a partir do hino 1.
- **Prioridade:** a definir

### O problema

Algumas partituras trazem a letra com marcas incompletas ou erros de digitação: numa partitura, "Pa" e "ra," sem marca de continuação (saem "Pa ra,") e "Ia" com "I" maiúsculo no lugar de "la" ("cantêIa"). O
conversor mostra o texto como está no arquivo. Corrigir isso por heurística seria arriscado (poderia alterar o texto
de um hino sem ninguém perceber).

### Ideia

Um arquivo de **correções explícitas**, mantido pelo responsável (por exemplo `content/correcoes.json`, fora do Git
como o resto do conteúdo): uma lista de "trocar este texto por este, neste hino". O conversor aplica só o que estiver
listado e **avisa** cada correção aplicada. Assim o texto dos hinos nunca muda sem registro.

### Perguntas em aberto

1. As correções devem ficar no repositório (úteis a todos, mas são texto do hinário) ou só locais?
2. Prefere corrigir direto nos `.mscx` (sem arquivo de correções)? Isso diverge dos arquivos do autor das transcrições.
3. Vale uma ferramenta que liste os suspeitos (palavras com "I" maiúsculo no meio, sílabas sem marca de continuação)
   para o responsável revisar, em vez de procurar à mão?

### Como ficou (2026-11-16)
- Feito: opção `--correcoes arquivo.json` no `mscx2json` e o documento [`../correcoes-da-letra.md`](../correcoes-da-letra.md). Quatro
  verbos, todos **explícitos**: `juntar`, `separar`, `trocar` (+ `por`) e `quebrar_antes`; cada correção aplicada (ou que não achou o
  texto) vira um aviso, e o arquivo é recusado se tiver chave desconhecida ou verbo duplicado. Código em
  `tools/mscx2json/src/correcoes.rs`; as correções entram nas sílabas **antes** de montar as linhas, então o karaokê continua batendo.
- Respostas às perguntas acima: (1) o arquivo fica **só no computador** de quem converte, fora do Git, porque traz texto de hino;
  (2) não se corrige nos `.mscx` (ficam como o autor os fez); (3) a ferramenta de suspeitos **não** foi feita: o documento sugere
  passar a letra por um corretor ortográfico (`aspell -l pt_BR`), que acha palavras inexistentes mas não fragmentos que são palavras
  ("Sem" e "pre").
- Nos 5 hinos de amostra, 10 correções deixaram as palavras iguais ao hinário impresso (hinos 1, 276, 398 e 457).
- Falta (seção 7 de [`../roadmap-pendencias.md`](../roadmap-pendencias.md)): escrever as correções dos hinos reais conforme os defeitos
  aparecem, e o hino 283 (versos colados) depende da foto do impresso.

---

## I-21 — Slider do miniplayer em cima

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-16: "o miniplayer, o slide dele fica embaixo... na janela colocar ele em cima".
- **Prioridade:** a definir

### O problema
No miniplayer (`src/lib/Miniplayer.svelte`) a linha com o botão de tocar, o título e o botão de parar vem primeiro, e o slider de
progresso (`Busca`, no modo `fino`) vem **embaixo** dela, colado à barra de abas. O responsável quer o slider **em cima**, e deu o
motivo (2026-11-16): embaixo ele fica **muito perto da marcação das abas** e **confunde** (parece parte da barra de abas, e o dedo
pode acertar uma coisa pensando na outra).

### O que se deseja
O slider de progresso no **topo** do miniplayer, acima da linha de botões e título (como a barra de progresso de muitos
tocadores, que fica na borda superior da faixa).

### Perguntas em aberto
1. **"Na janela":** o motivo (colado às abas) existe onde há **barra de abas embaixo** (celular). Numa janela larga, a navegação
   vai para a **barra lateral** (`--largura-trilho`) e o miniplayer não encosta nela por baixo. Então vale em **toda tela** (mais
   simples e igual em todo lugar) ou só onde a barra de abas fica embaixo? A frase "na janela" pode ter os dois sentidos.
2. **Toque:** em cima, o slider fica junto da borda superior do miniplayer, perto do conteúdo da página. Confirmar que o alvo de
   toque continua confortável (a barra é fina) e que não dispara por engano ao rolar a página. A separação das abas deve **ficar
   evidente** (o objetivo do pedido): conferir no celular.
3. **Prévia do tempo:** a prévia da posição (`previaBusca`) hoje aparece junto do slider; em cima, precisa continuar legível e sem
   sair da tela.

### Impacto técnico (hipóteses, não verificadas)
- Mudança de ordem no `Miniplayer.svelte` (mover o `<Busca fino …/>` para antes da `div.linha`) e o ajuste do `padding`/`min-height`
  (hoje: 3,5rem da linha + 1,25rem do slider). A altura que o miniplayer reporta (`altura`, usada para reservar espaço na página)
  não muda.
- Só medidas em `rem` e cores do tema, como no resto do app. O teste de ponta a ponta `tests/e2e/karaoke.mjs` (perto da linha
  275) já confere que a **área de toque do slider fica dentro do miniplayer e livre dos outros controles**; ele deve continuar
  valendo com o slider em cima e é a base para checar a pergunta 2.

### Como ficou (2026-11-16)
- Feito: o `<Busca fino …/>` passou para o **topo** do `Miniplayer.svelte`, antes da linha de botões, em **toda tela** (o mesmo
  componente serve a todas, sem regra para tela larga). **Nenhuma medida mudou**: a altura continua 4,8rem (0,0625rem de borda +
  3,5rem da linha + 1,25rem do slider), então a hipótese acima de ajustar `padding`/`min-height` não se confirmou.
- A causa do "confunde": o preenchimento do slider e o traço da aba ativa usam a mesma cor, `--ouro-linha`, e ficavam a cerca de
  0,5rem um do outro. Agora ficam a cerca de 3,5rem.
- Teste: `tests/e2e/karaoke.mjs` confere que o slider fica **acima** da linha de botões e, com abas embaixo, a pelo menos 2,5rem
  delas (verificado por mutação: com o slider de volta embaixo, as duas conferências falham).
- Falta ver no aparelho (seção 7 de [`../roadmap-pendencias.md`](../roadmap-pendencias.md)).

## I-06 — Modo de baixa visão: preto sobre amarelo bem claro

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14, como requisito de acessibilidade.
- **Prioridade:** a definir (é acessibilidade, então vale tratar como importante)

### O que se deseja (nas palavras do responsável)

Uma versão de **baixa visibilidade**: **preto sobre amarelo bem claro**.

### Contraste medido (2026-11-14)

Preto puro (`#000000`) sobre os candidatos a fundo, contra a meta **AAA de 7:1** para texto comum (WCAG 1.4.6):

| Fundo | Contraste com preto |
|---|---|
| `#FFFFE0` (amarelo claro) | 20,63 : 1 |
| `#FFFDE7` (creme amarelado) | 20,46 : 1 |
| `#FFFFCC` (amarelo bem claro) | 20,43 : 1 |
| `#FFFF99` (amarelo mais forte) | 20,02 : 1 |
| `#FFF9C4` (amarelo suave) | 19,60 : 1 |

Para comparar, o texto principal do tema claro atual dá 14,73 : 1. Qualquer um desses fundos passa com folga. Texto
secundário em cinza também passaria se ficar escuro (`#333333` sobre `#FFFFCC` dá 12,29 : 1; `#4D4D4D` dá 8,22 : 1), mas
num modo de baixa visão vale usar preto também no secundário.

### Ideia de comportamento (a validar)

Uma nova opção em **Ajustes → Aparência**, ao lado de Automático, Claro e Escuro: **Alto contraste** (preto sobre
amarelo claro). Além das cores, o modo reforça o resto do visual:

- Borda dos controles mais grossa e preta; foco com contorno grosso e bem visível.
- Links sempre sublinhados; nada de informação só por cor (o app já segue isso).
- Sem sombras, degradês ou tons intermediários; barras de progresso e interruptores em preto e branco.
- Texto um pouco maior por padrão, combinando com a ideia I-04 (tamanho da letra).

### Aproveitar o padrão da plataforma (não reinventar)

O navegador e o sistema já têm o conceito: a media query CSS **`prefers-contrast: more`** indica que a pessoa pediu mais
contraste, e **`forced-colors`** cobre o modo de cores forçadas. A ideia é: em "Automático", se o aparelho pedir
mais contraste, o app usa esta paleta automaticamente; e a opção manual existe para quem quer o modo sem mexer no
sistema. **Não verificado:** se o WebView do Android e o do iOS repassam essa preferência; precisa de teste no aparelho.

### Perguntas em aberto

1. **Qual amarelo?** Os cinco acima passam; falta escolher no olho, de preferência com quem tem baixa visão.
2. **Ter também a versão invertida** (amarelo ou branco sobre preto)? Muita gente com baixa visão prefere fundo escuro;
   o pedido foi só preto sobre amarelo claro, então fica como pergunta.
3. **Combina com o "pergaminho" (I-02)?** Provavelmente não: é um modo próprio, e juntar os dois complicaria o desenho.
4. **Nome na interface:** "Alto contraste", "Baixa visão" ou outro? Em espanhol e inglês também.
5. **O ícone do app e a barra de status do Android** não mudam com este modo; aceitável?

### Impacto técnico (hipóteses, não verificadas)

- **Tokens (`src/lib/tema.css`):** novo conjunto de valores para `data-tema="alto-contraste"`, e um bloco
  `@media (prefers-contrast: more)` para "Automático".
- **Preferência e primeira pintura:** estender `src/lib/tema.svelte.ts` (os temas passam de 3 para 4) e o script do
  `src/app.html` que aplica o tema antes da primeira pintura.
- **Contraste (`tools/contraste.py`):** conferir esta paleta com a meta **AAA** (7:1 para texto, e 4,5:1 ou mais para
  componentes), mais exigente que a das outras.
- **Traduções:** nova chave nos três idiomas.

### Critérios de aceitação (propostos)

- Todos os pares de texto da paleta passam de 7 : 1 em `tools/contraste.py`.
- Escolher o modo muda o app inteiro na hora e a escolha sobrevive ao fechar o app.
- Com a fonte do sistema no máximo, nada fica cortado.
- Revisado por pelo menos uma pessoa com baixa visão antes de ser dado como pronto.

### Como ficou (2026-11-16)
- Feito: 4º **Modo** "Alto contraste" em Ajustes (pt "Alto contraste", es "Alto contraste", en "High contrast"), paleta própria preto sobre
  **amarelo vivo (`#ffff00`) sobre preto**, com contraste AAA medido por `tools/contraste.py`, espessuras maiores de foco, bordas e barra de progresso, links
  sempre sublinhados e destaques em bloco preto com texto amarelo. Detalhes e a tabela de contrastes em [`../design-tokens.md`](../design-tokens.md).
- Respostas às perguntas acima: (1) **amarelo vivo (`#ffff00`) sobre preto**, no padrão do Alto contraste do site da Tokai. A frase original da ideia dizia "preto sobre amarelo bem claro" e a primeira versão (APK 016) fez isso; o responsável, ao testar, mostrou o site da Tokai e confirmou que o que queria era o **amarelo vivo sobre preto**; **a validar com quem tem baixa visão**; (2) a
  versão invertida **não** entrou; (3) o modo **ignora o estilo** (o grupo Estilo fica desativado, com uma nota); (4) o nome é "Alto
  contraste" nos três idiomas; (5) o ícone do app e a barra de status do Android **não** mudam.
- **Não feito:** o Automático seguir `prefers-contrast: more` (decisão: segunda etapa, depois de saber se a WebView repassa a preferência);
  "texto um pouco maior por padrão" (a I-04 e o `rem` já cobrem).
- Achado do parecer prévio, confirmado no navegador: o escuro "do sistema" de cada estilo (especificidade 0,3,0) **vencia** o bloco novo
  (0,2,0) com o aparelho no escuro. Os três usam agora `:not(..., [data-tema="alto-contraste"])`; o e2e confere nos três estilos.
- Falta (seção 7 de [`../roadmap-pendencias.md`](../roadmap-pendencias.md)): ver no celular e a revisão por uma pessoa com baixa visão.

---

---

## I-08 — Mostrar a partitura no hino

> **Arquivada em 2026-11-20:** feita: a aba Partitura existe (pacotes 003 a 005); ver o sumário.


> **Origem:** sugestão do responsável: "como temos letras, mostrarmos a partitura também". Não estava no escopo
> inicial. O formato já tem o campo opcional `partitura` (caminho de arquivo), mas nunca foi usado.

### O que se deseja
Uma aba **Partitura** no hino (ao lado de Ouvir e Letra) para o músico ler a música enquanto ouve.

### Decisões (responsável, 2026-11-16)
1. **Ferramentas:** MuseScore 4 (Flatpak) e Verovio (pacote Python) instalados **fora do repositório**: só geram o conteúdo.
2. **Diagramação:** **Verovio, pensada para o celular** (a página tem a largura da tela e reflui em sistemas curtos), no lugar de
   copiar a diagramação do MuseScore, que é de página larga e exigiria rolagem lateral.
3. **Entrega:** as partituras vão **dentro do pacote `.zip`** (o `hinario.json` e os SVGs), fora do Git.
4. **Aba Partitura:** com o pacote já importado, aparece **só nos hinos que têm partitura**. Quem acabou de instalar e ainda não
   importou nada vê a aba **com um aviso e um botão para Ajustes**, onde baixa o arquivo. (Cursor na partitura, I-12 fase B: fica
   para depois, mas o instante de cada nota já sai no **timemap**, para não regerar tudo mais tarde.)

### Caminho
1. **Gerar fora do app** (`python3 tools/gerar-partituras.py ENTRADA SAIDA`): `.mscx` → **MusicXML** (MuseScore 4, sem janela) →
   **SVG** (Verovio), uma página por hino, mais um `hino-N.timemap.json`.
2. **Empacotar** no `.zip` junto do `hinario.json`, usando o campo `partitura` (PR 2: importador em Rust e **sanitização do SVG**).
3. **Aba "Partitura"** com zoom e rolagem (PR 3). SVG fica nítido em qualquer tamanho, o que ajuda quem tem baixa visão.
4. **Teste no emulador e no celular** num APK (PR 4).

**Por que não desenhar a partitura a partir do JSON:** o JSON guarda só altura e duração. Faltam armadura, fórmula
de compasso, acidentes, ligaduras, cifras e casas de volta. Reconstruir isso seria reinventar a roda.

### Primeiro teste (PR 1, feito nos 5 hinos de amostra)
O MuseScore converte cada hino em MusicXML em menos de 1 s, e o Verovio o desenha em segundos. Medido com `largura=700`, `escala=40`:

| Hino | SVG | SVG comprimido (gzip) | timemap |
|---:|---:|---:|---:|
| 1 | 134 KB | 23 KB | 7 KB |
| 276 | 71 KB | 14 KB | 3 KB |
| 283 | 167 KB | 28 KB | 11 KB |
| 398 | 304 KB | 50 KB | 20 KB |
| 457 | 243 KB | 40 KB | 26 KB |

Média de **184 KB por hino**, ou **uns 31 KB comprimido**. Para 480 hinos: ~88 MB sem compressão e **uns 15 MB num zip** (o pacote
real de 5 hinos, com o `hinario.json`, tem 166 KB). Os números da primeira medição (400 KB por hino) incluíam, em **cada** SVG, a
fonte Leipzig embutida (58 KB em base64, igual em todos) e a indentação; sem elas o arquivo cai a menos da metade (ver a PR 2). O
limite de 20 MB de hoje, para o `hinario.json`, não serve para o pacote com partituras: a PR 2 aceita o `.zip`. (No aparelho, o SVG
gravado depois da limpeza fica uns **14% maior** que o do zip: o prefixo dos `id` e as tags fechadas por extenso; para 480 hinos,
uns 100 MB em disco.)

O que se aprendeu, e que a ferramenta já faz:
- **Largura 700 em vez de 1000:** olhando num celular de 412 px, as notas ficam bem maiores e há poucos compassos por linha; o
  arquivo só cresce 3%.
- **Elisão ("sempre_em", duas palavras numa nota):** o MuseScore escreve o sinal como um texto solto numa fonte privada, que a página
  mostra como um quadrado (▯). A ferramenta o troca pelo `<elision>` padrão do MusicXML, e o Verovio o desenha como a ligação "‿",
  como no hinário impresso.
- **Espaço entre as palavras da letra:** com o padrão do Verovio, onde duas vozes cantam letras diferentes as palavras se colam
  ("bemu-", "ComJe-sus"). `lyricWordSpace` em 2,5 resolve.
- **O SVG usa só `svg`, `g`, `path`, `use`, `text`, `tspan`, `rect`, `ellipse`, `style`, `defs` e `desc`**, e todo `href` é interno
  (`#id`). Isso permite sanitizar por **lista de permitidos** (o app roda com `csp: null`, então um SVG com `<script>` ou
  referência externa não pode passar): é o `src-tauri/src/svg.rs`, da PR 2, que lê, confere e **reescreve** o SVG.
- **A fonte embutida:** o Verovio coloca em cada SVG um `<style>` com um `@font-face` da fonte Leipzig, 58 KB em base64
  (`url(data:...)`), igual em todos os hinos. A primeira versão da limpeza recusou os 5 hinos reais por causa desse `url(`; e
  liberar `url(data:` seria abrir a porta que a limpeza existe para fechar. Em vez disso, `smuflTextFont: "none"` tira a fonte do
  SVG, e o app a traz uma vez só (licença OFL 1.1). Conferido no Chrome: com a Leipzig vinda da página, o desenho fica **idêntico,
  byte a byte**, ao do SVG com a fonte embutida; sem ela, só os glifos de **texto** da fonte falham (a figura de nota do andamento, "♩ = 58", vira um quadrado ▯); as notas, pautas e claves são `path` e ficam. O `<style>` que sobra era só de negrito, itálico e `stroke:currentColor`, e é **descartado** na importação (um `<style>` em SVG embutido vale para a página inteira, e o vandame mostrou que isso deixaria um pacote malicioso falsificar botões); o CSS equivalente vai no app, escopado à partitura (ver `FORMATO.md`).
- **Cor pelo tema:** o `<svg>` vem com `color="black"` e o preenchimento padrão é preto, então uma cor no contêiner de fora **não**
  pinta nada (testado: preto sobre preto). O que funciona, testado no Chrome com o SVG **embutido na página** (inline, depois de
  sanitizado), é uma regra de CSS no próprio `svg`: `color: var(--texto); fill: currentColor`. Aí pauta, notas, letra e andamento
  seguem o tema escuro e o alto contraste (amarelo sobre preto) sem regerar nada. Como `<img>`, não dá: a CSS da página não entra
  no SVG.
- **Andamento esquisito no topo ("( - 84) ♩ = 63")** vem do próprio arquivo do autor (o texto do andamento está assim na
  transcrição), não é defeito da geração.
- O Verovio avisa quando um sistema fica muito apertado (razão de justificação < 0,8); nos 5 hinos a leitura não foi prejudicada.

### Pontos de atenção
- **Direitos:** as partituras vêm das mesmas transcrições, então a resposta do autor vale aqui também. As
  imagens ficam **fora do Git**, como as letras (e as capturas de tela de partituras reais também).
- **Importação:** hoje o app importa um só JSON (limite de 20 MB). Com imagens, é preciso um **pacote de vários
  arquivos** (um `.zip`). É a parte de maior trabalho (PR 2).
- **Licenças das ferramentas:** MuseScore (GPL-3.0) e Verovio (LGPL-3.0) só **geram** o conteúdo; nenhum dos dois entra no app.
  O SVG gerado é do conteúdo, não das ferramentas.

### Critérios de aceitação (propostos)
- A partitura de um hino de amostra aparece nítida na aba, com zoom e rolagem, no emulador e no desktop.
- O pacote importa sem passar de um tamanho combinado e sem ir para o Git.
- Com a fonte do sistema no máximo e nos temas claro, escuro e baixa visão, a aba continua utilizável.

---

## I-12 — Karaokê na partitura (fase B)

> **Arquivada em 2026-11-20:** feita (fase B): o compasso que toca fica com a barra dourada, e o karaokê por nota (I-26) acende cada nota; ver o sumário.


- **Status:** **escolhida como a próxima frente** pelo responsável (2026-11-16); **passo 0 (medição) feito**; **etapa 1 (os dados) feita**: o conversor emite `compassos` e o app os lê (`docs/FORMATO.md`); **etapa 2 (a interface) feita e testada no celular pelo responsável (APK 025/026: "funcionou")**: o compasso que toca fica destacado na aba Partitura, com rolagem e o mesmo botão do karaokê da letra. **Ele esperava a NOTA, e não o compasso**: o cursor por nota virou a **I-26** (a **fase A**, o karaokê na letra, está feita: ver [`archive/roadmap-implementadas.md`](roadmap-implementadas.md))
- **Origem:** sugestão do responsável: um karaokê "tanto na letra das músicas como nas partituras".
- **Prioridade:** depende da I-08 (aba Partitura)

### O que se deseja
Um cursor ou destaque de compasso na **partitura** acompanhando a música, como a letra já faz na aba Letra.

### Perguntas em aberto
1. Cursor por **nota** ou destaque por **compasso**? (O campo `sincronia` do hinário traz tempos por **sílaba**, não por
   compasso: o conversor precisaria gerar também os tempos de cada compasso ou nota.)
2. O histórico e as decisões da fase A (posição do botão, como a sílaba acende, latência da saída de áudio) estão em
   [`archive/ideias-implementadas.md`](ideias-implementadas.md), seção I-12.

### Passo 0: casar o tempo do app com o `timemap` do Verovio (2026-11-16, medido)
Antes de construir, mediu-se nos 5 hinos de amostra se o tempo das notas que o app toca casa com o `timemap` que o Verovio gera (`tools/gerar-partituras.py` já o grava por hino e por versão).

- **A escala é a mesma.** O `qstamp` do `timemap` conta semínimas; no app a colcheia vale 0,5 batida e a semínima 1. Não há conversão de unidade.
- **O app tem até 3 fluxos de notas por hino:** a vez normal, a introdução e o final. Pareando cada nota do soprano com os eventos do `timemap` pela altura, **100% das notas de cada fluxo casam num único deslocamento constante** (`qstamp - t`): a vez normal e a introdução em **0**, e o **final do 457 em 48 batidas** (a duração da vez normal). Hinos 1, 276, 283, 398: normal 48/48, 25/25, 80/80, 138/138 e introdução 18/18, 11/11, 20/20, 12/12 em 0; 457: normal 55/55, introdução 13/13 e final 110/110.
- **Mas o `timemap` expande as repetições com ids que não existem no SVG.** No 457 o desenho tem 38 compassos e o `timemap` lista 56 compassos de ids **únicos**. O destaque **não pode usar os ids do `timemap`** (os dos compassos repetidos não estão no SVG).

**Decisão proposta (a confirmar com o responsável):**
1. **Destaque por compasso**, não cursor por nota (pergunta 1): é o que dá para fazer de forma robusta e legível; o cursor por nota fica para depois.
2. **Quem diz qual compasso toca em cada instante é o conversor** (`tools/mscx2json`), que já conhece o instante de cada compasso e as repetições e casas de volta de cada passada (`Estrutura`: `inicio_compasso`, a passada normal e a do final). Ele emitiria, por fluxo, uma lista `[batida local, índice do compasso escrito]`, no mesmo molde da `sincronia` da letra. O app marca o N-ésimo `g.measure` do SVG (a ordem no documento seria a ordem escrita). **Sem o `timemap` no pacote.**
3. **A rolagem** que acompanha o compasso tem de respeitar "reduzir movimento" (`tools/verificar-movimento.py`), e o liga/desliga é o mesmo do karaokê da letra.

**Riscos (verificados na etapa 1, nos 5 hinos de amostra):** a ordem dos `g.measure` no SVG **é** a ordem escrita dos compassos do `.mscx`. O número de compassos do SVG é o que o conversor usa (11, 8, 18, 56 e 38), e cada início da passada normal do conversor corresponde ao `g.measure[i]` pelo id que o Verovio atribui; no final do 457 (só existe expandido no `timemap`), os 37 compassos têm início e comprimento idênticos aos do `timemap`. **Verificado na etapa 2:** o `class="measure"` sobrevive à limpeza do SVG no Rust (10 de 10 arquivos, mesmo número de compassos antes e depois), e o retrato e a paisagem de cada hino têm o mesmo número de compassos, então o índice vale nas duas versões.

### Critérios de aceitação (propostos)
- O destaque na partitura e o da letra andam juntos, na pausa congelam e ao mudar o andamento seguem no lugar certo.

---

## I-19 — Organizar como os hinos aparecem na letra

> **Arquivada em 2026-11-20:** feita: quebras de verso, correção de digitação, **coro** e **final** em blocos próprios (PR #92 e #96). Faltam o negrito (I-33) e os hinos 61, 162, 185 e 238.


- **Status:** **em andamento**: as **quebras de verso** já foram corrigidas no conversor (2026-11-16); falta o **coro** e o resto
  (ver "O que se descobriu")
- **Origem:** pedido do responsável, 2026-11-16: organizar "como os hinos aparecem no hinário, na parte de letra", a partir de
  fotos que ele vai tirar.
- **Prioridade:** a definir

### O que se deseja
Que a aba Letra apresente cada hino como ele aparece no hinário impresso (ordem e numeração das estrofes, coro, quebras de
verso, títulos). O desenho exato depende das fotos.

### O que se descobriu (2026-11-16, com 4 fotos: hinos 1, 276, 398 e 457)
- **Versos partidos:** o conversor quebrava a linha em **toda respiração** da partitura, mas o hinário imprime **um verso por
  linha**, e a partitura respira também no meio do verso. Das quebras do conversor nos 4 hinos, só 36 de 57 eram fim de verso. A
  pista confiável é o **texto**: o verso novo começa em maiúscula, e a continuação, em minúscula (com exceção dos nomes
  reverenciais). Com essa regra, **46 dos 48 versos impressos** conferidos passaram a sair iguais (**48 de 48** depois dos consertos
  de hífen e de digitação, abaixo), e as quebras acertaram 57 de 57. Descrita em `docs/FORMATO.md`. A regra foi ajustada olhando esses 4 hinos, então vale **validar com mais fotos**.
- **Coro (refrão):** nos hinos 398 e 457 o hinário imprime o coro **em negrito e separado** da estrofe, sem número. **Posição:**
  no 457 (hino com final) o coro vem **depois da última estrofe**, e o autor o escreveu sob a estrofe 1; o conversor agora o
  passa para a última (2026-11-16; desde 2026-11-20, `separar_o_final`, como bloco "Final" depois dela). No 398 o coro vem logo **depois da estrofe 1**, e já saía
  ali. **Feito (2026-11-20, pedido do responsável ao testar o hino 5):** o coro virou um parágrafo `Coro. ...` (estrofe 0 na sincronia), mostrado à parte, com o subtítulo "Coro" e aceso depois de cada estrofe; 309 dos 480 hinos têm coro (ver `docs/FORMATO.md`). **Falta:** negrito, como no impresso.
- **Versos colados:** no hino 283 a partitura não tem respiração entre dois versos, e eles saem na mesma linha. A regra de
  maiúscula não resolve (a letra tem frases com maiúscula no meio de um verso); o **arquivo de correções** (I-05, feita) tem o verbo
  `quebrar_antes`, mas falta a foto do hino 283 para saber onde ficam os versos.
- **Erros de digitação do autor** nos arquivos `.mscx`. **O conversor já conserta, por regra segura** (2026-11-16): pronome
  colado sem hífen depois de vogal acentuada (com o "I" no lugar do "l") e "~" literal. A regra "ãc" vira "ãe" **foi removida** (2026-11-16): o
  autor tinha escrito "mãc" para "mão"; o que é ambíguo não se adivinha. **O resto** (sílaba
  sem o marcador de continuação, a palavra que sai partida em duas, letras trocadas) **conserta-se com o arquivo de correções**
  (I-05, feita 2026-11-16, [`correcoes-da-letra.md`](../correcoes-da-letra.md)); nos 5 hinos de amostra, 10 correções deixaram as palavras
  iguais ao impresso (hinos 1, 276, 398 e 457) e sem palavras desconhecidas para o dicionário (exceto uma palavra do 283, sem foto).
- **A pauta no topo** de cada hino impresso é o **começo da melodia**, no tom e no compasso do hino; o tamanho dela é o do
  primeiro verso. Não está no `.mscx`, então não serve de régua para as quebras.

### Perguntas em aberto
1. Quais diferenças entre os hinos existem (coro, estribilho, estrofes numeradas ou não, repetições)?
2. O justificado da I-04 ainda faz sentido com esse desenho? (hoje ele abre espaços largos nos versos que quebram)

---

## I-13 — Afinador: dar o tom e mostrar se a nota está baixa ou alta

> **Arquivada em 2026-11-20:** etapa 1 feita (a aba Afinador dá o tom); o "Tom de um hino" foi descartado; a **etapa 2 (ouvir e medir) continua aberta na I-32** de `roadmap-ideas.md`.


- **Status:** **etapa 1 pronta, sem o "Tom de um hino".** **DESCARTADO (2026-11-17, o responsável): o "Tom de um hino" (digitar o número do hino e ouvir a tônica) não é necessário e não será feito;** o código foi escrito, testado e **retirado** (commit `c8a81d4`, só local, sem PR). O que ficou: o conversor grava `armadura`, `modo` e `tonalidade` (PR #66) e a tonalidade aparece na lista e no cabeçalho do hino. O Rust do app ainda **não declara** `armadura` nem `modo` (o serde os descarta sem erro); quem os quiser usar um dia, declare-os como `Option<i64>` e `Option<String>` e valide depois de ler. Onde a spec abaixo fala de "Tom de um hino" (decisão 2, o esboço da tela, o item "Tom de um hino" e as etapas de entrega), **vale o descarte**. Fora isso, segue: Feito (2026-11-17): a aba **Afinador** com o **Lá 440 Hz** (botão largo, fora de cartão) e **outra nota** (12 notas num cartão fechado, oitava), o **temporizador** (cartão fechado: até parar, 10, 20 ou 30 s; o tom para sozinho; o botão mostra o que falta e uma barra de progresso; vale para o Lá e para outra nota e recomeça a cada nota nova; não é lembrado), tom sustentado com contexto de áudio próprio, um som de cada vez, sem volume na tela (o do celular), o `afinador.ts` e a `contagem.ts` puros e testados, e o teste de ponta a ponta que **mede o som gerado** (440,3 Hz) e a contagem em tempo real. **Falta:** a **etapa 2** (ouvir e medir), que começa pelo teste do microfone no aparelho. Especificada e revisada por subagente Opus 5 em 2026-11-17 (18 achados, aplicados; ver "Revisão").
- **Origem:** pedido do responsável, 2026-11-14; especificada em 2026-11-17.
- **Prioridade:** a definir. Depende da **I-28** (a aba Afinador na tela inicial), que entra **junto** com a primeira tela do afinador.

### O que se deseja (nas palavras do responsável, 2026-11-14)

Um **afinador** que **dá o tom** e, se a pessoa estiver de **fone de ouvido**, oferece **escutar o som** do instrumento
ou da voz e mostrar se está **baixo ou alto**, num **medidor (gauge) parecido com o de um acelerador**, com o ponteiro
indo para baixo ou para cima da nota certa.

### Decisões do responsável (2026-11-17)

1. **Duas etapas.** Primeiro **dar o tom** (não usa microfone nem permissão), depois **ouvir e medir**.
2. **O tom do hino vem da partitura.** O conversor passa a ler a **tonalidade** do arquivo do MuseScore e a gravá-la no hinário (ver "Dados: a tonalidade").
3. **Onde fica:** uma **aba da tela inicial** (`Hinos | Afinador | Gravador | …`), no mesmo estilo do `Ouvir | Letra | Partitura` de dentro do hino. É a **I-28**, que reaproveita o componente de abas.

### Etapa 1 — Dar o tom

**A aba Afinador** (esboço, no celular em pé; a barra de baixo é a da I-28):

```
┌──────────────────────────────────────────────┐
│ Biblioteca Musical                      ⚙    │
├──────────────────────────────────────────────┤
│ Afinador                                     │
│                                              │
│   ┌──────────────────────────────────┐       │
│   │      ▶  Lá 440 Hz                │       │
│   └──────────────────────────────────┘       │
│                                              │
│   ▸ Outra nota                Dó4 · 262 Hz   │
│     (fechado; abre para escolher a nota,     │
│      a oitava e tocar)                       │
│                                              │
│   Tom de um hino                             │
│   Hino nº [ 276 ]        Mi♭ maior           │
│   ┌──────────────────────────────────┐       │
│   │      ▶  Dar o tom                │       │
│   └──────────────────────────────────┘       │
├──────────────────────────────────────────────┤
│    Hinos        ▌ Afinador ▐    Gravador     │
└──────────────────────────────────────────────┘
```

**O que faz**
- **Lá 440 Hz.** Um botão toca o lá central (A4) e **sustenta** a nota até ser apertado de novo (botão de ligar e desligar, com `aria-pressed`).
- **Outra nota.** É um **cartão fechado** (o mesmo `Cartao.svelte` de Ajustes): a linha de cima mostra a nota e a frequência ("Dó4 · 262 Hz") e quem quiser o abre. Dentro, a pessoa escolhe a nota entre **12 botões** e a **oitava** (2 a 6), vê o nome e a frequência e toca; o mesmo botão toca e para. O cartão **não é lembrado** (começa fechado) e **fechá-lo com a nota soando a para**, porque o botão de parar fica dentro dele. **Grafia fixa dos 12:** Dó, Dó♯, Ré, Mi♭, Mi, Fá, Fá♯, Sol, Lá♭, Lá, Si♭, Si (os bemóis dos tons que os hinos mais usam e os sustenidos só onde faltam). Os botões formam um `radiogroup`, e cada um leva um `aria-label` **por extenso** ("Mi bemol"), porque o leitor de tela pode ler "♭" e "♯" como símbolos.
- **Tom de um hino.** A pessoa escolhe o hino (campo com o número, a mesma busca da lista) e a tela mostra a **tonalidade** ("Mi♭ maior", no idioma da interface). **Dar o tom** toca a **tônica** dessa tonalidade. A **oitava padrão é a 4** (de Dó4 a Si4); abaixo da 3 o alto-falante do celular quase não reproduz o som, e a tela **avisa**. Hino sem tonalidade no hinário (conteúdo importado antes desta mudança) deixa o botão desligado com a explicação "importe um hinário atualizado".
- **Som.** Timbre **sintetizado** `orgao_suave` (`src/lib/instrumentos.ts`: quase uma onda simples, **sem vibrato**, fácil de afinar de ouvido). Os instrumentos gravados ficam de fora porque o afinador **tem de funcionar sem nenhum pacote baixado** (o `smplr` até tem laço, `loadLoopData`, mas isso não muda o motivo).
- **Temporizador.** Um segundo cartão, fechado, com a escolha atual na linha de cima ("Até parar" / "20 s"). O padrão é o de sempre: o tom soa até a pessoa parar. Com 10, 20 ou 30 s o tom **para sozinho** (sai com a envoltória) e o botão volta a "tocar". Vale para o Lá e para outra nota (uma escolha só) e **a contagem recomeça a cada nota ou oitava nova**; mudar o tempo com o tom soando vale a partir de agora, e voltar a "até parar" cancela a contagem sem parar o tom. A escolha **não é lembrada**. O botão de parar mostra "Parar · faltam 14 s" e um fio de progresso na borda de baixo (só visual: o leitor de tela só é avisado do fim, "Tom encerrado pelo temporizador", e não ouve a contagem segundo a segundo; a barra anda em passos de 1 s, sem animação).
- **Sem controle de volume na tela** (decisão do responsável, 2026-11-17: "como é celular, não faz sentido ter volume ali; a pessoa controla nos botões físicos"). O tom tem ganho fixo e quem ajusta é o volume de mídia do celular. Afinação de referência fixa em **440 Hz** nesta etapa (temperamento igual).

**Áudio: um contexto próprio e um som de cada vez** (achado de bloqueio da revisão)
- O hino toca num `AudioContext` **privado** do `Sintetizador` (nasce dentro de `tocar()`), e a pausa do hino é `ctx.suspend()`. Se o afinador usasse o mesmo contexto, **pausar o hino calaria o tom**. Logo o afinador tem o **seu próprio** `AudioContext`, criado e retomado **no toque** (o áudio só inicia depois de um gesto do usuário). **Reaproveita os perfis e a construção das ondas, não o contexto.**
- **Nota sustentada é código novo:** `agendarNota` exige a duração e agenda a soltura de antemão. A nota do afinador precisa de rampa de entrada, nota sem fim, rampa de saída e `stop` do oscilador só depois da soltura (sem estalo).
- **Dar o tom para o hino** que estiver tocando. Como `reproducao.pausar()` **não faz nada enquanto o hino ainda carrega** (`trocando`), o afinador **observa `reproducao.estado`** e só toca quando o hino não está tocando nem carregando.
- **O caminho inverso também vale:** se a pessoa der "Tocar" no miniplayer (ou na tela do hino) **com o tom soando**, o tom **se cala**. O hino **não volta sozinho** depois que o tom para.
- **Quando o tom para:** ao apertar de novo, ao sair da aba, quando a página vai para segundo plano (`visibilitychange`) e quando o hino começa.

**Dados: a tonalidade** (o conversor e o formato)

Hoje o conversor **não grava `tonalidade`**: o campo existe no formato (`docs/FORMATO.md`, e `Hino.tonalidade` no Rust) e a tela já o mostra, mas nos 5 hinos de amostra ele vem vazio. O arquivo do MuseScore traz a **armadura** (`<KeySig><accidental>-3</accidental>`: número de bemóis, negativo, ou de sustenidos, positivo) e, nos arquivos de amostra, **não traz o modo** (todos são do MuseScore **2.06**; que o MuseScore 4 grave `<concertKey>` e um `<mode>` **não foi confirmado**: aceitar o que existir e usar o modo escrito quando houver).

- **Armadura:** a do **primeiro** `KeySig` da partitura (um braço `"KeySig"` em `percorrer`, como o `"Tempo"`, que também guarda só o primeiro); sem o elemento, armadura 0. Modulações no meio da peça são ignoradas (documentar).
- **Tônica e modo (hipótese a validar):** a tônica **maior** da armadura é `(armadura × 7)` módulo 12 (em Rust, **`rem_euclid`**, porque o resto de um número negativo é negativo); a da **relativa menor** fica 3 semitons abaixo. O modo sai da **nota final do baixo**: se bate com a menor, **menor**; senão, **maior**. A "nota final" é a da passada **final**, se o hino tiver uma, ou a da normal. Se não bater com nenhuma, usa a **primeira** nota do baixo; se ainda não bater, assume maior e o conversor **avisa** na saída.
- **Medido nos 5 hinos de amostra:** 4 trazem `KeySig` (−3, −3, +1 e −2) e o 457 não traz o elemento (a primeira nota do baixo é Dó: armadura 0). Nos 4 com armadura, a nota final do baixo é a tônica **maior** (Mi♭, Mi♭, Sol e Si♭) e igual à primeira nota do baixo. **Nenhum hino de amostra é menor**, então o ramo "menor" ainda não foi visto em dado real.
- **O nome vem da armadura, não da tônica** (a mesma classe de nota tem dois nomes: +6 é Fá♯ maior e −6 é Sol♭ maior). Tabela, da armadura à tonalidade (maior / relativa menor):

  | Armadura | −7 | −6 | −5 | −4 | −3 | −2 | −1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Maior | Dó♭ | Sol♭ | Ré♭ | Lá♭ | Mi♭ | Si♭ | Fá | Dó | Sol | Ré | Lá | Mi | Si | Fá♯ | Dó♯ |
  | Menor | Lá♭ | Mi♭ | Si♭ | Fá | Dó | Sol | Ré | Lá | Mi | Si | Fá♯ | Dó♯ | Sol♯ | Ré♯ | Lá♯ |

- **O que se grava no hinário** (opcional; hinários antigos continuam válidos): `armadura` (−7 a +7), `modo` (`"maior"` ou `"menor"`) e, por compatibilidade com versões antigas do app, `tonalidade` em texto no idioma do hinário. **A tônica não é gravada:** o app a deriva de `armadura` e `modo` (função pura e testada em `afinador.ts`).
- **Nomes por idioma:** o app **monta o nome** a partir de `armadura` e `modo` no idioma da **interface** (pt "Mi♭ maior", en "E♭ major", es "Mi♭ mayor"), e usa o texto `tonalidade` só se os campos faltarem. Efeito colateral a decidir: a **lista de hinos** e o cabeçalho do hino passam a mostrar a tonalidade de cada hino (o código já existe e hoje não aparece nada).
- **Rust (`src-tauri/src/hinario.rs`):** declarar `armadura: Option<i64>` e `modo: Option<String>` (não um tipo mais estreito): um **tipo errado** num campo declarado faz o serde **recusar o hinário inteiro** (`json_invalido`), ao contrário de `compassos`, cujo descarte só acontece com o tipo certo e o conteúdo inválido. Validar **depois** de ler (armadura em −7 a 7, modo em `maior`/`menor`) e, se algo estiver inválido, **descartar os dois sem recusar o hino**. Sem declarar, o serde os descartaria em silêncio na ida ao front.
- **`docs/FORMATO.md`:** o exemplo traz `"tonalidade": "Dó"`, sem modo; atualizar.
- **Reconverter e reimportar o hinário** é parte do teste (a mesma lição dos `compassos`).

**Impacto técnico da etapa 1 (hipóteses)**
- `tools/mscx2json`: o braço `"KeySig"`, o modo, os campos novos (`armadura`, `modo`, `tonalidade`) e testes com armaduras de −7 a +7, ausência de `KeySig`, hino menor e caso ambíguo.
- `src-tauri/src/hinario.rs` e `src/lib/biblioteca.svelte.ts`: os campos e a validação.
- `src/lib/afinador.ts` (**funções puras**, testáveis no Vitest): `tonicaDe(armadura, modo)`, nome da nota e da tonalidade por idioma (pt, en, es), frequência de uma nota dada a afinação (`440 × 2^((n−69)/12)`; já existe `frequencia` em `sintetizador.ts`), cents entre duas frequências e nota mais próxima. Serve também à etapa 2.
- Um módulo do **tom sustentado** (com o `AudioContext` próprio), usando os perfis de `src/lib/instrumentos.ts`.
- Componente `Afinador.svelte` com a prop `ativa`, como a `Partitura.svelte`. Textos nos 3 idiomas, tamanhos em `rem`, botões com `aria-pressed`.
- **Teste de ponta a ponta:** o teste de hoje não alcança o grafo de áudio privado do app, e o Chrome do `tests/e2e/karaoke.mjs` roda com `--autoplay-policy=no-user-gesture-required`, o que **esconde** o problema do gesto. Então: (1) conferir a frequência com um **nó de teste** exposto só em modo de teste, ou com um `OfflineAudioContext` que renderiza o mesmo perfil, e (2) rodar o trecho do gesto **sem essa flag** (mantendo `--mute-audio`) para provar que o toque inicia o áudio.

### Etapa 2 — Ouvir e medir

O app escuta o microfone, descobre a nota e mostra **quantos cents** ela está acima ou abaixo (1 semitom = 100 cents), num **ponteiro** que vai de "baixo" a "alto" passando pelo centro ("afinado").

**O medidor**
- Mostra o **nome da nota** mais próxima, o **número de cents** (com sinal) e a **palavra** ("baixo", "alto", "afinado"); o ponteiro nunca depende só da cor, e respeita "reduzir movimento".
- **"Afinado":** ±5 cents (a banda mais comum nos afinadores; o limiar de percepção fica em 5 a 6 cents), com **histerese** para a palavra não piscar na borda. A tolerância fica configurável.
- **Faixa:** de cerca de 65 Hz (Dó2) a 2100 Hz (Dó7); fora dela, "sem nota".
- Sem som ou com sinal fraco, o medidor **descansa** e diz "toque ou cante uma nota", em vez de inventar uma leitura.
- **Leitor de tela:** o medidor leva `aria-live` com **taxa limitada** (anunciar a mudança de nota e de palavra, no máximo uma vez por segundo, e não cada leitura em cents).

**Como detecta (pesquisado em 2026-11-17)**
- **Biblioteca: `pitchy`** (algoritmo MPM, de McLeod): tipos TypeScript, cerca de 2,8 KB comprimida (com a dependência `fft.js`), versão 4.1.0 de janeiro de 2024. Licença **MIT** no pacote do npm e **0BSD** no repositório (conferidos na revisão): as duas servem a um projeto MIT. API: `PitchDetector.forFloat32Array(N).findPitch(buffer, taxa)` devolve a frequência e uma **clareza** de 0 a 1. Ressalva: o último lançamento tem quase 3 anos (há commits recentes e uma issue de lançamento automático aberta), mas é pequeno o bastante para **copiar para o repositório** se for abandonado.
- **Recusadas:** `pitchfinder` (a licença é "GNU v3" no `package.json`, sem arquivo de licença, e o YIN vem do aubio, que é GPL), `aubiojs` (aubio é GPL-3.0; 427 KB) e CREPE (precisa do TensorFlow.js e de um modelo; pesado demais). `@audio/pitch` (MIT, 2026) é uma alternativa **muito nova** (3 estrelas) e de cálculo O(N²).
- **Janela:** 2048 amostras (de 42,7 a 46,4 ms a 48 e 44,1 kHz) cobrem dois períodos até ~65 Hz. **Ler a cada quadro** (~16 ms), com janelas sobrepostas, e não a cada 50 a 100 ms: a mediana abaixo precisa de várias leituras e, com leituras espaçadas, o atraso passaria de 400 ms. A latência de captura pesa pouco perto da janela, então **começar com `AnalyserNode`** (`getFloatTimeDomainData`), mais simples que um `AudioWorklet`, e só passar ao `AudioWorklet` se o teste no aparelho pedir.
- **Filtros por cima do detector** (a biblioteca não os traz): corte por **clareza** (começar em 0,9 e calibrar entre 0,7 e 0,9, como relatam usuários do `pitchy`), corte por **volume** (RMS), **mediana sobre ~200 ms** (cerca de 12 leituras a ~16 ms) para o vibrato da voz (taxa de 4 a 7 Hz) e **regra de oitava**: travar a faixa e ignorar saltos de ~1200 cents até que persistam por N quadros. São **inferências**, a calibrar com voz e instrumentos reais.
- **Precisão em voz cantada e metais não tem número publicado** que eu tenha achado (o mantenedor do `pitchy` nunca testou voz; há relatos de picos espúrios), então o desempenho **só se confirma testando** com a voz e os instrumentos do responsável.

**Microfone no Tauri 2 para Android (pesquisado em 2026-11-17)**
- O **wry trata o pedido de permissão da WebView** (`RustWebChromeClient.kt`, conferido na revisão): para captura de áudio ele pede `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` em tempo de execução e só concede se a pessoa aceitar; senão nega. As versões atuais são wry 0.57.2 e tauri 2.12.6.
- **O manifesto precisa declarar** `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` (hoje só tem `INTERNET`, em `src-tauri/gen/android/app/src/main/AndroidManifest.xml`, que está versionado; nada em `capabilities/` nem em `tauri.conf.json` afeta o microfone). Sem a segunda há relato de `NotReadableError` (discussão tauri-apps/tauri#12732). Essa discussão sugere código extra na `MainActivity`; **não foi possível confirmar se ainda é necessário**.
- Chamar `getUserMedia` **uma vez só, a partir de um toque**, sem chamadas paralelas: há uma issue aberta no wry (#1917) em que um resultado de permissão vazio é tratado como concedido e dois pedidos simultâneos se sobrescrevem.
- **Não mudar `useHttpsScheme`:** muda a origem do armazenamento da WebView (e os dados do app). Que `http://tauri.localhost` conte como contexto seguro **não foi confirmado**, embora a discussão indique que funciona.
- iOS: `NSMicrophoneUsageDescription` em `src-tauri/Info.ios.plist` (fora do escopo agora).
- Não há plugin oficial; o plugin de comunidade encontrado **grava** nativamente e não serve para Web Audio. **Nada disso foi testado em Android 12 a 15**: é o motivo do teste de aparelho antes de construir o medidor.

**Restrições de áudio**
- Pedir `echoCancellation`, `noiseSuppression` e `autoGainControl` como `false` (como `ideal`), `channelCount: 1`, e **conferir o que valeu** com `track.getSettings()`. No código atual do Chromium para Android, sem o cancelamento de eco ele **não usa o caminho de chamada** (que mexe no sinal). Há um relato isolado de que desligar o AGC e o NS não evitou quedas de volume em vogais sustentadas; **testar com a voz**.

**Casos de borda da escuta**
- **Permissão negada "para sempre":** o app só pode **explicar** e mandar a pessoa para os ajustes do aparelho (não há plugin para abri-los daqui). **Dar o tom continua funcionando.**
- **Segundo plano e bloqueio de tela:** soltar o microfone em `visibilitychange`.
- **Chamada telefônica e foco de áudio:** o comportamento da WebView com Web Audio **não foi confirmado**; testar no aparelho.

**Fone, Bluetooth e o ciclo de áudio** (a premissa original muda; **proposta minha, não decisão do responsável**: ver a pergunta 1)
- O rascunho dizia "só com fone". Se os dois modos forem **exclusivos** (ao escutar, a nota de referência **para**; ao tocar a nota, o microfone **fecha**), o app não cria o ciclo alto-falante → microfone por conta própria e **não precisa detectar fone** na v1. Ao ligar a escuta, o app também **pausa** o hino que estiver tocando.
- Ouvir e tocar **ao mesmo tempo** (a ideia original, com fone) exige saber se há fone. No navegador isso é **pouco confiável** na WebView do Android (o evento `devicechange` só existe a partir do Chrome 132, os nomes dos dispositivos podem vir vazios, relatos de só aparecer o dispositivo `default`). O caminho sustentável é um **plugin Tauri pequeno em Kotlin** com `AudioManager.getDevices` e `registerAudioDeviceCallback`, que avisa o JavaScript (não achei plugin pronto). Fica para uma etapa 3, junto com o gravador (I-03), que tem a mesma necessidade.
- **Fone Bluetooth:** quando o microfone usado é o do fone Bluetooth, o Chromium coloca o Android em **modo de comunicação** e a saída passa do perfil de música (A2DP) para o de voz (SCO), de qualidade de chamada (commit `78d0de138346e6edfc8c33bdd22c45b3eec4f3d0` do Chromium, "android audio: Set communication mode when using Bluetooth microphone"; a revisão leu a mensagem do commit, não o código). Recomendação: **fone com fio (ou USB-C)** ou o microfone do próprio aparelho. Forçar o microfone do aparelho por `deviceId` quando houver Bluetooth é uma ideia **não testada**.

### Perguntas em aberto (com a minha recomendação)

1. **Abandonar a premissa "só com fone" na v1** (modos exclusivos, sem detectar fone)? É **proposta minha**; o responsável pediu a escuta "se a pessoa estiver de fone". **Recomendo sim**: entrega a escuta sem depender de um plugin nativo, e a escuta e o tom ao mesmo tempo ficam para a etapa 3.
2. **Atalho "Dar o tom" dentro do player do hino**, usando a **transposição** escolhida (o cartão "Andamento e Tom")? **Recomendo sim, depois da etapa 1**: é a hora em que a pessoa mais precisa.
3. **Nota inicial de cada voz** (soprano, contralto, tenor e baixo) além da tônica? **Recomendo sim, é barato**: os dados já existem em `vozes`.
4. **Tocar o acorde da tônica** (tônica, terça e quinta), e não só a nota? **Recomendo só a nota na v1.**
5. **Mostrar a tonalidade na lista de hinos** e no cabeçalho do hino (o código já existe)? **Recomendo sim**, é pequena e útil a quem canta.
6. **Instrumentos que transpõem** (si bemol, mi bemol, fá): **mostrar a nota real** (a que soa) na etapa 2, e uma opção "instrumento" depois.
7. **Afinação de referência** de 440 para 442 Hz: **fixa em 440 Hz** na etapa 1; configurável na etapa 2.
8. **Voz cantada** também? **Sim desde a etapa 2** (a mediana trata o vibrato); validar com a voz do responsável.
9. **Escolher o microfone** (aparelho, fio, Bluetooth) numa lista? **Só se o teste de aparelho mostrar o problema do Bluetooth.**

### Etapas de entrega (pull requests, nesta ordem)

1. **Conversor, Rust e formato:** `armadura`, `modo` e `tonalidade` (com testes e `docs/FORMATO.md`). Sozinha já é útil: a tonalidade aparece nos hinos reconvertidos.
2. **Aba Afinador, "dar o tom", junto com a I-28** (a barra de abas só aparece com mais de uma aba, então a I-28 sozinha não mostraria nada): `afinador.ts`, o tom sustentado, a tela e os testes. **Fim da etapa 1.**
3. **Teste do microfone no aparelho (spike, antes de qualquer medidor):** um APK de teste com as duas permissões no manifesto e uma tela mínima que chama `getUserMedia`, mostra `track.getSettings()` e o nível do sinal. Confere, no aparelho do responsável, se pede a permissão, se funciona e como fica com fone com fio e Bluetooth.
4. **Medição e medidor:** detector (`pitchy`), filtros e o ponteiro.
5. **Mais tarde:** escuta e nota ao mesmo tempo com fone (plugin Kotlin), junto com o gravador.

### Critérios de aceitação (propostos)

**Etapa 1**
- O Lá toca a 440 Hz (medido no teste, com folga de 1 Hz) e para ao apertar de novo, ao sair da aba, ao ir para segundo plano e quando o hino começa.
- **Pausar o hino não cala o tom**, e o tom não começa **por cima** de um hino que está tocando ou carregando; dar "Tocar" no miniplayer com o tom soando **cala o tom**; o hino **não volta sozinho** depois do tom.
- O toque inicia o áudio **sem** a flag de autoplay do Chrome de teste.
- Para uma nota escolhida e para a tônica de um hino de amostra, a frequência bate com a fórmula do temperamento igual.
- A tonalidade dos hinos de amostra sai certa no hinário (hinos 1, 276, 283, 398 e 457: Mi♭ maior, Mi♭ maior, Sol maior, Si♭ maior e Dó maior), os nomes saem corretos em pt, en e es, e um hino sem ela tem o botão desligado com a explicação.
- Nenhum estalo ao ligar e desligar. Legível em todos os temas, em `rem`, com o teclado e o leitor de tela (o nome da nota é anunciado por extenso).

**Etapa 2**
- Com um tom puro de 440 Hz vindo de outra fonte, o medidor marca **afinado** (±5 cents); a 20 cents abaixo ou acima, marca **baixo** ou **alto** com o número certo (±3 cents).
- Funciona com a voz do responsável e com pelo menos um instrumento de sopro, sem pular de oitava de forma visível.
- Ao negar a permissão de microfone, **dar o tom continua funcionando** e a tela explica o que aconteceu.
- Ao escutar, a nota de referência está parada; ao tocar a nota, o microfone está fechado; o hino que tocava é pausado.
- O medidor se entende sem cor (número e palavra) e com "reduzir movimento".

### Revisão

Revisão por subagente **Opus 5** em 2026-11-17, só leitura, com o código aberto: **18 achados** (1 bloqueio, 15 a corrigir e 2 sugestões), todos aplicados acima; os mais pesados foram conferidos por mim no código antes de aplicar.
- **Bloqueio:** o `AudioContext` do hino é privado e a pausa dele é `ctx.suspend()`; um afinador no mesmo contexto calaria ao pausar o hino. Agora o afinador tem contexto próprio.
- **Mudou o desenho:** `reproducao.pausar()` não age enquanto o hino carrega (o afinador observa o estado); o serde **recusa o hinário inteiro** se um campo declarado vier com tipo errado (campos `Option<i64>` e `Option<String>`, validados depois); nomes de tonalidade pela armadura (tabela) e montados no idioma da interface; a I-28 entra junto com a aba Afinador; leitura a cada quadro, não a cada 50 a 100 ms.
- **Corrigido por engano meu:** "as amostras gravadas não fazem laço" (o `smplr` tem laço); trocada a justificativa do timbre sintetizado.
- **Confirmado pela revisão:** a matemática (fórmula, 65 a 2093 Hz, janela de 42,7 a 46,4 ms, relativa menor 3 semitons abaixo), os dados medidos nas amostras, a licença do `pitchy` (MIT no npm, 0BSD no repositório), o tratamento de permissão no wry e o commit do Chromium (hash completo acima).
- **Não confirmado:** o `<mode>`/`<concertKey>` do MuseScore 4, o foco de áudio da WebView em chamada, o "desde 2022" do wry e a duração de ~3 s das amostras gravadas (que deixei de usar como argumento).
- **Risco que mais preocupava o revisor:** o contexto compartilhado, que deixaria a etapa 1 muda justamente no caso "pausar o hino". Resolvido pelo contexto próprio e pelos critérios de aceitação acima.

---

## I-22 — Continuar tocando com a tela bloqueada

> **Arquivada em 2026-11-20:** feita e confirmada no celular do responsável (APK 030); falta MediaSession (controles na tela de bloqueio).


- **Status:** **implementada (APK 030) e confirmada no celular do responsável (2026-11-19): com o hino tocando no miniplayer, o som segue com a tela bloqueada.** Histórico: teste no emulador e implementação do caminho 1 em 2026-11-17. **Teste (emulador Android 17, APK 029 em diante, sem nada de segundo plano):** o hino 1 tocou com a tela **bloqueada** por mais de 1 minuto e o som **não cortou**: o stream de áudio do app seguiu `started` (`dumpsys audio`) e, ao desbloquear, o hino estava em 1:14, na 2ª estrofe (o relógio do JavaScript seguiu). **(Na época não valia como prova para o celular do responsável; hoje vale, pela confirmação acima.)** Detalhes do que o emulador não cobria: o emulador não imita as economias de bateria dos fabricantes nem o Doze depois de vários minutos no bolso, e não deu para testar o "hino todo" com as pausas de 2 s. O teste de trocar de aplicativo (Home) foi **inconclusivo** (a tela apagou por tempo). **Implementado (e já confirmado no aparelho, ver acima; a duração do teste e o "hino todo" com as pausas de 2 s não foram registrados):** serviço em primeiro plano de mídia (`ServicoAudio.kt`) com notificação (título do hino e botão "Parar"), `WAKE_LOCK` parcial e a ponte `window.BmServico` (`PonteServico.kt`), ligada e desligada pelo `reproducao.estado` no layout (`servico.ts`). Ainda **não há** MediaSession (controles na tela de bloqueio além do "Parar" e botões do fone).
- **Origem:** pedido do responsável, 2026-11-16: "o miniplayer, mesmo com a tela do celular bloqueada, se ele estiver ativo, deve continuar tocando o som... com a tela bloqueada etc."
- **Prioridade:** a definir (para quem estuda ouvindo o hino com o celular no bolso, é quase requisito)

### O problema
Hoje o som é gerado **dentro da WebView** do app (Web Audio: `AudioContext` em `src/lib/sintetizador.ts`, com as notas agendadas por JavaScript
em `src/lib/reproducao.svelte.ts`). O app **não tem nada para segundo plano**: nem MediaSession, nem wake lock, nem serviço em primeiro plano, e
o manifesto Android só pede `INTERNET`. A hipótese forte é que, **com a tela bloqueada ou o app em segundo plano, o Android pausa o JavaScript
da WebView e o som para** (ainda **não foi testado** no aparelho; precisa ser o primeiro passo). O miniplayer fica no app e para junto.

### O que se deseja
Com um hino tocando (miniplayer ativo), **bloquear a tela ou trocar de aplicativo não interrompe o som**. Idealmente há também **controles
na tela de bloqueio e na barra de notificações** (tocar/pausar, parar, o título do hino), como qualquer tocador de música, e os botões do
fone de ouvido funcionam.

### Perguntas em aberto
1. **Só Android por enquanto?** Os APKs de teste são Android; o iOS tem outro mecanismo (modo de fundo de áudio) e outra política. Começar pelo Android?
2. **Controles na tela de bloqueio:** só continuar tocando, ou também a notificação com tocar/pausar/parar? (O Android **exige** uma notificação
   para um serviço em primeiro plano, então, na prática, ela existe de qualquer jeito.)
3. **O karaokê e a letra:** ao desbloquear, a aba Letra deve estar **no ponto certo** da música (o relógio do áudio continua, então a posição
   deve voltar certa; conferir).
4. **Quando o hino termina ou a pessoa para:** o serviço e a notificação **somem** (sem consumir bateria à toa).
5. **Interrupções:** chamada telefônica ou outro aplicativo tocando (foco de áudio): pausar, e voltar depois?
6. **Tocar o hino todo com as pausas de 2 s entre as partes** e a transição entre as vezes dependem de temporizadores do JavaScript, os mais
   sujeitos a parar em segundo plano. Precisam seguir funcionando.

### Caminhos possíveis (hipóteses, não verificadas)
A pesquisa inicial (2026-11-16) não achou um guia específico para o Tauri; os relatos de Capacitor, Ionic e React Native em WebView
apontam sempre o mesmo padrão: o Android **pausa o JavaScript com a tela desligada**, e o remédio usual é um **serviço em primeiro plano**,
mas há relatos de que **a WebView sozinha pode não ser coberta por esse serviço**, então o áudio talvez precise tocar **fora da WebView**.
1. **Serviço em primeiro plano + Web Audio** (menor mudança): iniciar um serviço (tipo de mídia, com notificação) quando o hino começa
   a tocar, mais `WAKE_LOCK`, e manter o `AudioContext`. **Pode não bastar**: falta saber se o JavaScript da WebView continua rodando.
   É o teste mais barato e deve vir primeiro.
2. **Renderizar o hino em um buffer de áudio e tocar por um elemento `<audio>` + MediaSession.** Navegadores tratam a mídia de um
   `<audio>` como reprodução de verdade (controles de bloqueio e segundo plano), ao contrário de um grafo Web Audio. Custa: o som deixa de
   ser gerado em tempo real (mudar andamento, tom e silenciar vozes passaria a exigir **renderizar de novo**), então mexe nos controles
   do player (I-10) e no karaokê, que hoje seguem o relógio do `AudioContext`.
3. **Player nativo** (Kotlin com ExoPlayer/Media3 num serviço de mídia, via plugin do Tauri): o mais robusto no Android e o que dá controles de
   bloqueio e fone de graça, mas é **reescrever o motor de som fora da WebView** (sintetizador e pacote de sons gravados), muito mais trabalho, e
   só no Android.
- **Permissões prováveis** (a confirmar): `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS` (Android 13+) e `WAKE_LOCK`.
  Do Android 12 em diante, o serviço em primeiro plano só pode ser **iniciado com o app visível** (o toque em "tocar" serve).
- **Pesquisar antes de construir** (regra do projeto): ler a documentação de plugins móveis do Tauri e de MediaSession, e registrar o que for lido.
  Fontes da pesquisa inicial: fóruns de Capacitor e Ionic sobre áudio em segundo plano, o README do `tauri-plugin-native-audio` (permissões) e
  relatos de WebView no React Native.

### Critérios de aceitação (propostos)
- Tocando um hino no aparelho, **bloquear a tela por 2 minutos e desbloquear**: o som não cortou nenhuma vez e a letra está no ponto certo.
- **Trocar de aplicativo** durante o hino também não corta; o hino todo (com as pausas entre as partes) chega ao fim com a tela apagada.
- Parar ou terminar o hino **remove a notificação** e o serviço (conferir no Android que o app deixou de estar em primeiro plano).
- Teste manual registrado no `docs/apk-de-teste.md` (aparelho, versão do Android, o que aconteceu): não há como provar isso só no e2e do Chrome.

---

## I-24 — Ajustes em cartões, com um cartão de Conteúdo (hinário, partituras e sons gravados)

> **Arquivada em 2026-11-20:** feita (fatias 1 a 4): Ajustes em cartões com o cartão Conteúdo.


- **Status:** **implementada** (2026-11-17, fatias 1 a 4): `Cartao.svelte` e `LinhaPacote.svelte` (o player e Ajustes migraram sem mudar a aparência); Ajustes em cartões, com a linha de estado e o cartão **Conteúdo** (o Hinário sem caixa, com os botões lado a lado, por pedido do responsável ao testar); Aparência, Idioma e Conteúdo **lembram** se ficaram abertos (`prefs.ajustes`; Sobre e Créditos abrem sempre fechados); e o botão "Abrir Ajustes" da aba Partitura leva a `/ajustes?abrir=partituras`, que abre o Conteúdo e rola até as partituras **sem gravar** essa abertura. O título de cada cartão é um `<h2>` dentro do resumo (navegação por títulos do leitor de tela). Reescrita em 2026-11-17 sobre o estado atual da tela (a primeira versão, de 2026-11-16, era anterior à PR #42) e revisada por subagente Opus 5 no mesmo dia (12 achados, aplicados; ver "Revisão"). Pode ir para `docs/archive/` depois que o responsável testar.
- **Origem:** pedido do responsável, 2026-11-16: "no Ajustes já cabe uns cards... o de temas, o de importação (importar hinário agora, apesar de que no futuro não existe, mas teria o importar partituras e importar sons gravados dentro)". E, em 2026-11-17: "tá me atrapalhando já um pouco o Ajustes".
- **Prioridade:** **a próxima**, depois da I-13 (o responsável, 2026-11-17).

### O problema
Hoje **Ajustes** é uma coluna de **sete blocos soltos** mais a versão. Só "Sobre o app" e "Créditos e licenças" são cartões que se recolhem (`<details class="cartao">`):

```
┌──────────────────────────────────────────────────────┐
│ Ajustes                                              │
│ APARÊNCIA                                            │
│   Modo    [Automático][Claro][Escuro][Alto contr.]   │
│   Estilo  [Normal][Pergaminho][Marinho]              │
│ IDIOMA                                               │
│   [ Português                                  ▾ ]   │
│ BIBLIOTECA                                           │
│   Amostra de teste · 5 hinos                         │
│   [Importar hinário]  [Remover importação]           │
│ PARTITURAS                             (#partituras) │
│   ┌────────────────────────────────────────────┐     │
│   │ Todas as partituras                        │     │
│   │ Instaladas: 5                    [Remover] │     │
│   └────────────────────────────────────────────┘     │
│ SONS GRAVADOS                                        │
│   ┌────────────────────────────────────────────┐     │
│   │ Todos os sons gravados                     │     │
│   │ 36 MB · Não instalado    [Baixar (36 MB)]  │     │
│   └────────────────────────────────────────────┘     │
│ ⓘ Aplicativo não oficial (sem ligação com a CCB)     │
│ ▸ Sobre o app                                        │
│ ▸ Créditos e licenças                                │
│         Versão 0.3.0 (…)                             │
└──────────────────────────────────────────────────────┘
```

O que incomoda:
1. **A tela é comprida**, e fica mais ainda com a fonte do sistema grande (tudo cresce em `rem`). Cada pacote novo (a I-25 acrescenta um estado "atualização" a cada linha) piora.
2. **A mesma coisa, desenhos diferentes.** Hinário, partituras e sons gravados são **conteúdo que se instala e remove**, mas o hinário é um texto com botões soltos, enquanto partituras e sons usam o bloco `.pacote`.
3. **Código duplicado.** O bloco `.pacote` está escrito **duas vezes** (Partituras e Sons) e o cartão com resumo (`.cartao` + `<summary>`) também (Ajustes e o **player**, que já tem "Andamento e Tom" com resumo na linha de cima). Um terceiro uso seria uma terceira cópia.

### O que já está decidido (não reabrir)
- **Partituras não têm importação manual.** O app **baixa** o pacote do servidor e confere o SHA-256 (PR #42; `docs/FORMATO.md`; o teste de ponta a ponta exige que o cartão não tenha campo de arquivo).
- **O pacote de partituras é separado do hinário.** O `.zip` só aceita `partituras/…` e grava a marca `.hinario` com o `id` do hinário instalado (`src-tauri/src/pacote.rs`); baixar ou remover partituras **nunca** troca o hinário.
- **"Importar hinário" aceita só `.json`** ("no futuro não existe": o hinário virá de um pacote). O teste confere o `accept`.

### O que se deseja
Ajustes em **cartões recolhíveis**, cada um com uma **linha de estado quando fechado** (recolher não esconde o que importa), e um cartão **Conteúdo** com as três coisas instaláveis. **Decisão do responsável ao testar (2026-11-17):** o **Hinário** não leva caixa (o texto do hinário e os dois botões **lado a lado**); as **partituras** e os **sons** ficam no desenho de linha (`LinhaPacote`):

```
┌──────────────────────────────────────────────────────┐
│ Ajustes                                              │
│ ⓘ Aplicativo não oficial (aviso sempre à vista)      │
│ ▸ Aparência        Automático · Normal               │
│ ▸ Idioma           Português                         │
│ ▾ Conteúdo         Amostra · 5 partituras · sem sons │
│   HINÁRIO                                            │
│   Amostra de teste                                   │
│   5 hinos                                            │
│   [Importar hinário]    [Remover importação]         │
│   PARTITURAS                                         │
│   ┌────────────────────────────────────────────┐     │
│   │ Todas as partituras                        │     │
│   │ Instaladas: 5                    [Remover] │     │
│   └────────────────────────────────────────────┘     │
│   SONS GRAVADOS                                      │
│   ┌────────────────────────────────────────────┐     │
│   │ Todos os sons gravados                     │     │
│   │ 36 MB · Não instalado    [Baixar (36 MB)]  │     │
│   └────────────────────────────────────────────┘     │
│ ▸ Sobre o app                                        │
│ ▸ Créditos e licenças                                │
│         Versão 0.3.0 (…)                             │
└──────────────────────────────────────────────────────┘
```

O aviso "aplicativo não oficial" continua **sempre à vista** (não é cartão).

**Princípios do projeto:** medidas em `rem`; cores só das variáveis do tema; estado por **texto e ícone**, nunca só por cor; vale nos temas claro, escuro e alto contraste; **teclado e leitor de tela** (o `<details>` e o `<summary>` já dão isso); textos nos 3 idiomas.

### O que se reaproveita
- **`Cartao.svelte`** (novo, extraído do que já existe): props `titulo`, `resumo`, `aberto` (ligável) e `name` (opcional, para o acordeão nativo que o player usa). Substitui o `.cartao` duplicado do player (`Player.svelte`) e o de Ajustes; **o player migra junto**, para não ficarem três cópias.
- **`LinhaPacote.svelte`** (novo, do bloco `.pacote`): título, detalhe, e a ação (baixar, andamento, remover, **atualizar**: a I-25). A **lógica** de baixar, conferir e instalar **já está separada** (`src/lib/sons/pacotes.svelte.ts`, `src/lib/partituras/partituras.svelte.ts`, os dois sobre `baixarZip`) e **não muda**: a duplicação é só do desenho.
- **O molde de preferências** de `lerCartoes` (`src/lib/preferencias.ts`): leitura validada, valor ruim volta ao padrão, `try/catch`.

### Comportamento
- **Linha de estado dos cartões fechados:**
  - **Aparência:** "{modo} · {estilo}"; com Alto contraste (que ignora o estilo), só "Alto contraste".
  - **Idioma:** o nome do idioma, na própria língua.
  - **Conteúdo:** hinário em uso, partituras instaladas e sons instalados (por exemplo "Amostra · 5 partituras · sem sons"). **Durante um download ou um erro**, a linha mostra "baixando N%" ou "erro" com ícone (não só cor), porque o `<Aviso>` e o progresso **ficam dentro** do cartão e sumiriam se ele estivesse fechado.
- **Estado lembrado** (só Aparência, Idioma e Conteúdo): uma **chave nova** `prefs.ajustes` (a `prefs.cartoes` **já é do player**), com um objeto de booleanos, validado como `lerCartoes`. **Sobre e Créditos não entram** (continuam abrindo fechados). Padrão: **todos fechados**.
- **"Abrir Ajustes" da aba Partitura** (hoje `<a href="/ajustes">`, em `Partitura.svelte`): passa a `/ajustes?abrir=partituras`. A tela lê o parâmetro ao montar, **abre o cartão Conteúdo**, espera (`tick`) e rola até `#partituras`. **Essa abertura forçada não é gravada.** O texto `partitura.sem_pacote_texto` ("… no cartão Partituras") muda nos 3 idiomas. Não conto com a abertura automática do `<details>` ao seguir um `#hash` (depende da versão da WebView); abro por código.
- **Remover:** "Remover importação" (hinário) **tem diálogo** e apaga o hinário **e** as partituras (volta ao exemplo); o "Remover" das partituras e o dos sons **apagam na hora**, sem confirmar (o pacote se baixa de novo). Ver a pergunta 5.

### Perguntas em aberto (com a minha recomendação)
1. **Um cartão "Conteúdo" com as três linhas, ou três cartões?** **Um:** é a mesma coisa para a pessoa e o desenho da linha é o mesmo.
2. **Cartões livres ou acordeão** (abrir um fecha os outros, como no player)? **Livre**, para comparar Conteúdo com Aparência; lembra só o que a pessoa abriu.
3. **Padrão e a abertura pelo link da aba Partitura:** todos fechados no primeiro uso; quem chega pelo link vê o Conteúdo aberto e rolado, sem gravar isso. **Concordo.**
4. **A linha "Hinário":** "Importar arquivo" (`.json`) como hoje, e, quando o hinário passar a vir de um pacote, ele **vai para um submenu "Avançado"**, em vez de sumir (serve para testar hinários sem servidor). **Concordo.**
5. **"Remover" de partituras e de sons pede confirmação?** Hoje nenhum pede. **Recomendo não:** o pacote se baixa de novo; o diálogo fica só no "Remover importação", que **não** é recuperável.
6. **O player migra para o `Cartao.svelte` na primeira fatia?** **Sim**: senão ficam três cópias do mesmo cartão. É o trecho mais arriscado (o player usa `name` e guarda o estado em `prefs.cartoes`).

### Impacto técnico (hipóteses, a verificar)
- `src/routes/ajustes/+page.svelte` (a tela): trocar as seções por `Cartao` e `LinhaPacote`; o resumo de cada cartão é `$derived`.
- `src/lib/preferencias.ts` e `tests/preferencias.test.ts`: a chave `prefs.ajustes`, com testes de valor ruim.
- `src/lib/i18n/pt.ts`, `en.ts` e `es.ts`: as chaves novas (resumos, rótulos); o `Dicionario` tipado faz o `svelte-check` exigir a paridade.
- `src/lib/Partitura.svelte` e o texto `partitura.sem_pacote_texto`: o link com `?abrir=partituras`.
- **Não muda:** o Rust (`remover_partituras` **já é** um comando, em `lib.rs`), o formato do pacote e as lojas de estado dos sons e das partituras.
- **Teste de ponta a ponta** (`tests/e2e/karaoke.mjs`) depende de Ajustes: do `id="partituras"` (**manter na linha**), do `innerText` do cartão (com o `<details>` fechado o texto some: **abrir o cartão antes de ler**), de `href === "/ajustes"` (passa a `/ajustes?abrir=partituras`) e do primeiro `input[type=file]` da página (fica na linha Hinário, dentro de Conteúdo). Ajustar sem afrouxar o que ele afirma (sem campo de arquivo nas partituras; `accept` só `.json`).
- **Cruza com a I-25:** a `LinhaPacote` precisa do estado "atualização disponível" (texto e ícone), e o interruptor de "verificar atualização" (pergunta 5 da I-25) precisa de um lugar: no cartão Conteúdo. A I-28 (abas da tela inicial) **não interage** com Ajustes.

### Fatias de entrega (pull requests, nesta ordem)
1. **`Cartao.svelte` e `LinhaPacote.svelte`**, migrando o player e Ajustes **sem mudar o comportamento** (o teste de ponta a ponta passa como está).
2. **Ajustes em cartões, com a linha de estado** (o teste ajustado).
3. **Estado lembrado** (`prefs.ajustes`) e os testes de preferências.
4. **O link `?abrir=partituras`** da aba Partitura, com o texto nos 3 idiomas.

### Critérios de aceitação (propostos)
- Com todos os cartões fechados, **cada um mostra a linha de estado correta** (modo e estilo, ou só Alto contraste; idioma; hinário, partituras e sons), **inclusive durante o download e depois de um erro**. É testável no e2e pelo texto do `<summary>`.
- A aba Partitura sem partituras leva a **Conteúdo → Partituras**, com o cartão aberto e a linha à vista; a abertura não fica gravada.
- **Teclado:** cada cartão abre e fecha com Enter e Espaço; a ordem de foco é a visual. **Leitor de tela:** o estado é lido junto do nome do cartão.
- **Capturas conferidas** (nada cortado nem sobreposto): fonte do sistema a **200%**, os **3 temas** (claro, escuro, alto contraste) e largura de **360 dp**.
- O que ficou aberto é lembrado entre aberturas (só Aparência, Idioma e Conteúdo); valor ruim na chave volta ao padrão; as regras de `rem`, tema e i18n do projeto passam nos verificadores.
- O e2e cobre: abrir e fechar, a linha de estado, o caminho da aba Partitura até o cartão, o importar do hinário (só `.json`) e que as partituras **seguem sem** campo de arquivo.

### Revisão
Revisão por subagente **Opus 5** em 2026-11-17, só leitura, com o código aberto: **12 achados** (4 bloqueios), todos aplicados; **os quatro bloqueios eu conferi no código** antes de reescrever.
- **A seção original estava desatualizada**: foi escrita antes da PR #42 e descrevia um app que já mudou. O diagrama "hoje" não tinha a seção Partituras (que já existe, com estado, Baixar, progresso e Remover); o "problema 1" dizia que as partituras entravam pelo "Importar hinário" (falso: ele só aceita `.json`); a pergunta 4 e o desenho propunham um **"Importar .zip" de partituras**, que **reabria uma decisão tomada**; a pergunta 5 propunha **separar** o pacote de partituras do hinário, que **já é separado**; e o texto dizia que `remover_partituras` "não é um comando", mas é.
- **Acrescentado pela revisão:** a chave `prefs.cartoes` já é do player (a nova é `prefs.ajustes`); o cartão com resumo **já existe** no player (extrair `Cartao.svelte` e migrar os dois); a abertura por link precisa ser feita por código; o e2e depende de `#partituras` e do texto dos cartões; o `<Aviso>` e o progresso dentro de um cartão fechado somem; a pergunta certa sobre remover é "pede confirmação?".
- **Risco que mais preocupava o revisor:** implementar a partir da versão antiga, reabrindo decisões já tomadas e quebrando o teste de `#partituras` sem ninguém entender o porquê. Resolvido pela seção "O que já está decidido".

---

## I-26 — Karaokê na partitura por NOTA (cursor por nota)

> **Arquivada em 2026-11-20:** feita e testada no celular pelo responsável até o APK 045 (halo por nota, barra do compasso, luz que corre pela ligadura).


- **Status:** **revisada com o responsável (2026-11-19) e implementada na branch `karaoke-por-nota`** (gerador, limpeza do SVG no Rust, interface, testes unitários e de ponta a ponta); **pacote `partituras-004.zip` (480 hinos) no servidor e APK 036 entregues (2026-11-19)**; **falta o teste no celular**; amplia a I-12 (fase B), que hoje destaca o **compasso**
- **Origem:** pedido do responsável, 2026-11-17, ao testar o APK 025/026: "tu tá marcando no karaokê apenas o compasso né? Achei que tu marcaria a nota."
- **Prioridade:** a definir (o destaque do compasso funciona; a nota é o que ele esperava)

### O problema
O destaque de hoje (I-12, etapa 2) pinta o **compasso inteiro**. Quem acompanha cantando ou tocando tem várias notas por compasso, e o compasso aceso não diz **qual nota soa agora**.

### O que se deseja
A(s) nota(s) que soa(m) **agora** ficam destacadas na partitura, **no instante em que soam**, e o destaque anda **nota a nota**.

### O que já se sabe (medido em 2026-11-17, nos 5 hinos de amostra)
- O `timemap` do Verovio traz, para cada instante, os ids das notas que **começam** (`on`) e que **terminam** (`off`): é a matéria-prima.
- **A dificuldade das repetições, a mesma do compasso:** o `timemap` é expandido, e nas repetições traz ids de notas **copiadas** que não existem no SVG (hino 457: **669** notas distintas no `timemap` contra **459** desenhadas).
  **A função `getExpansionIdsForElement` do Verovio resolve as 669 para ids reais do desenho (100%), e nenhuma nota do desenho fica sem evento.** Nos outros 4 hinos (sem repetição) os ids do `timemap` já são os do SVG.
  Isso torna o destaque por nota **viável e robusto**.
- **Os ids mudam a cada desenho:** o retrato e a paisagem **não têm nenhum id em comum** (medido na I-12), então o mapa de notas é **por versão** (2 por hino).

### Decisões (responsável, 2026-11-19)
1. **Quais vozes:** **todas as que estão soando agora.** Se soam soprano e tenor, os dois acendem; não há filtro de voz.
2. **Como destacar:** a nota **continua preta** (cor do tema) e ganha um **halo dourado atrás**, com contorno e preenchimento translúcido, a mesma ideia do retângulo do compasso (que hoje já é desenhado atrás das notas). Um mecanismo só, sem recolorir cabeça, haste, bandeirola e acidente (peças separadas no desenho). **O destaque do compasso fica, mais fraco, como contexto.** No **alto contraste** (amarelo sobre preto) vale só o contorno do halo, para não apagar a nota (como o compasso já faz).
3. **Casos especiais:** **pausa acende** (o mesmo halo no lugar do símbolo); **enfeite (nota de adorno) não acende**; **ligadura não precisa de tratamento**: a segunda nota de uma ligadura **não acende de novo**, e a primeira fica acesa pela duração somada (interpretação do assistente; **o responsável pode corrigir**).
4. **Ajustes:** **sem opção nova**. Continua só o botão do karaokê, e o padrão passa a ser nota + compasso fraco. Uma opção (compasso, nota, desligado) só entra se alguém achar a nota demais.

### Como ficou (implementação, 2026-11-19)
Mudou em relação ao rascunho: **o tempo de cada nota vai dentro do próprio SVG**, e não num arquivo `.notas.json` à parte. Cada `<g class="note">` e `<g class="rest">`
ganha `data-t` e `data-f` (começo e fim, em batidas, dentro do compasso). Vantagens: **nenhum arquivo novo no zip nem comando novo no Rust** (só os dois atributos entram
na lista de permitidos, com valor numérico conferido), **nenhum mapa de ids** (o tempo está no elemento, então retrato e paisagem se resolvem sozinhos e o prefixo
`bm-p-` não importa) e o pacote antigo continua funcionando (sem os atributos, só o compasso). Formato em `docs/FORMATO.md` ("Notas na partitura").
- **Gerador** (`tools/gerar-partituras.py`): lê o `timemap` do Verovio com `includeRests`, traduz os ids das cópias das repetições para os do desenho
  (`getExpansionIdsForElement`), calcula o instante dentro do compasso (`qstamp` da nota menos o `qstamp` do `measureOn`), junta as **ligaduras** (`startid` e `endid`
  de cada `<g class="tie">`: a segunda nota não leva tempo, a primeira soma a duração) e ignora duração zero (enfeite). Conferido nos 5 hinos de amostra: todas as notas
  desenhadas têm tempo, menos as 43 segundas de ligadura do 457; o instante de cada nota somado ao início do compasso bate com as notas do hinário (as diferenças são só
  ligaduras e uníssonos). O SVG cresce uns 5% (uns 1,5% comprimido).
- **Rust** (`src-tauri/src/svg.rs`): `data-t` e `data-f` permitidos, só com número como o gerador escreve; qualquer outro `data-*` continua recusado.
- **App**: `src/lib/notas.ts` (lê os atributos, acha as notas que soam em cada batida, incluindo a ligada que atravessa a barra) e `Partitura.svelte` (halo dourado
  atrás da nota, só quando o conjunto muda; quando a partitura traz as notas, o compasso perde o fundo amarelo e fica só com um **contorno fino e uma barra dourada à esquerda** (pedido do responsável depois de testar o APK 036: o fundo apagava o halo); no alto contraste só o contorno do halo).
- **Testes**: unitários (`tests/notas.test.ts`, `tools/test_gerar_partituras.py`, `svg.rs`) e o e2e do karaokê (notas em sequência, duas vozes, pausa, pausa entre as partes,
  pausado, desligado e fora da aba).
- **Feito depois:** o **pacote `partituras-004.zip`** (480 hinos) está no servidor e no manifesto (PR #86) e o **APK 036** foi entregue.

### Depois do teste no celular (2026-11-20, APKs 036 a 045)
O responsável testou e pediu ajustes; todos feitos e testados por ele no 044 e no 045 ("ficou bom"):
- **Compasso só com a barra dourada** (PR #88 e #90): o fundo amarelo apagava o halo.
- **Introdução até o fim da última nota** (PR #89): o `*` fica sobre a última nota, e a introdução a cortava em 477 dos 480 hinos.
- **Coro separado** (PR #92): o refrão vira um parágrafo `Coro. ...` (estrofe 0 na sincronia), com o subtítulo "Coro" e aceso depois de cada estrofe; 309 hinos.
- **Final separado** (PR #96): nos hinos com final, o texto cantado só na última vez vira o bloco "Final" depois da última estrofe; 33 dos 37 hinos (ficam como estavam 61, 162, 185 e 238, de letra pendente).
- **Ligadura no som** (PR #93): os `.mscx` do hinário são do MuseScore 2, com o fim da ligadura em `<endSpanner id>` dentro da nota, que o conversor não reconhecia; a nota ligada tocava **duas vezes** (148 dos 480 hinos). Achado no final da introdução do 457.
- **Halo que acompanha a ligadura** (PR #94, #95 e pacote **005**): cada nota acende no seu tempo (a segunda também) e a curva leva o tempo da primeira; no app, uma **faixa dourada de 0,6 rem** atrás da curva, o traço fino por cima e um **ponto brilhante** correm da esquerda para a direita enquanto a primeira nota soa, e a segunda acende no tempo dela. A folga acompanha o zoom.
- **Andamento no topo** (aba Letra e Partitura): um botão com o valor de agora abre o mesmo controle da aba Ouvir (`ControleAndamento.svelte`, usado nos dois lugares), com a mesma regra (só parado ou pausado). A marca de andamento que o autor escreveu na partitura (`g.tempo`) fica escondida.
- **Pendente:** o e2e do **Gravador** falha com frequência no CI (a gravação para e nada entra na lista, sem erro na tela); a causa não foi achada (não reproduz fora do runner). Retirar `g.tempo` do SVG de vez fica para um próximo pacote.

### Critérios de aceitação (propostos)
- A nota destacada é a que soa, em cada instante, nos 5 hinos de amostra, **inclusive nas repetições e no final do 457**; **todas as vozes que soam acendem**, a **pausa acende**, o **enfeite não**.
- Pausado, congela; ao arrastar o slider, acompanha; fora da aba, some.
- Sem o mapa de notas (pacote antigo), o app **cai no destaque por compasso**.
- Legível em todos os temas (contraste).

---

## I-28 — Abas na tela inicial (Hinos | Afinador | Gravador | …)

> **Arquivada em 2026-11-20:** feita: a tela inicial tem as abas Hinos, Afinador e Gravador.


- **Status:** **implementada** (2026-11-17) junto com a aba Afinador (I-13, etapa 1): a barra `Hinos | Afinador` na tela inicial, o mesmo `Abas.svelte` do hino, os painéis montados, a busca preservada ao trocar de aba e a aba reaberta ao voltar de um hino. **Em aberto:** a rolagem de cada aba é guardada e restaurada, mas isso ainda não tem teste de ponta a ponta; e a ordem das abas (assumi `Hinos` primeiro) espera a confirmação do responsável. Revisada por subagente Opus 5 em 2026-11-17 (achados aplicados).
- **Origem:** pedido do responsável, 2026-11-17: "o Afinador vai ser o primeiro tab na tela inicial de lista, lá vai ter Hinos | Afinador | Gravador... entre outras, no mesmo estilo do que temos dentro do hino para Ouvir | Letra | Partituras", e "podemos até reaproveitar o frontend do componente, talvez o backend".
- **Prioridade:** a definir (a primeira peça das ferramentas de estudo: afinador I-13, gravador I-03 e, talvez, metrônomo I-20)

### O problema
A tela inicial é só a lista de hinos. As ferramentas de estudo que pedimos (afinador, gravador, metrônomo) não pertencem a um hino específico, e não há onde pô-las. Dentro do hino o app já resolveu o problema parecido com **abas** (`Ouvir | Letra | Partitura`).

### O que se deseja
A tela inicial ganha uma **barra de abas** igual à do hino: **`Hinos | Afinador | Gravador | …`**. A aba **Hinos** é a lista de hoje (busca e lista); cada ferramenta nova entra como uma aba. A engrenagem de Ajustes continua no cabeçalho.

**Atenção à frase do responsável:** "o Afinador vai ser o **primeiro** tab" pode querer dizer a **primeira aba nova** (depois de Hinos) ou a **primeira da barra**. Os dois exemplos dele listam `Hinos | Afinador | Gravador`, então leio como a primeira nova; **confirmar** (pergunta 1).

### O que se reaproveita (conferido no código na revisão)
- **`src/lib/Abas.svelte`, como está:** não tem nada preso ao hino. Barra fixa embaixo, **trilho lateral** com o celular deitado, as variáveis `--altura-navegacao` e `--largura-trilho` (o `.conteudo` do layout e o `Miniplayer` já as leem e abrem espaço) e a semântica WAI-ARIA de abas (`aba-<id>` e `painel-<id>`).
- **O padrão de painéis do hino:** todos ficam **montados** e só um fica visível (`hidden`), então a **busca** (que mora em `biblioteca.busca`) **não se perde** ao trocar de aba. A lógica é a mesma do hino (`aba` como `$state`, lista de abas derivada, rótulos pelo i18n); **não** pede abstração nova agora, só a segunda ocupação do mesmo padrão.
- **A barra só aparece com mais de uma aba**, como no hino: enquanto só existir **Hinos** e **Afinador**, são duas; o Gravador entra quando existir (I-03).

### Comportamento
- **A aba Afinador existe sempre**, também **fora** do `{#if biblioteca.pacote}` de `+page.svelte`: o Lá 440 não depende de hinário carregado (hoje essa condição envolve a tela toda).
- **Cada ferramenta recebe `ativa`**, como a `Partitura.svelte`, e **solta o que usa** quando a aba não está à vista (nota do afinador, microfone).
- **A rolagem não é do contêiner, é do documento:** a lista de hinos é longa e a aba Afinador é curta; ao trocar para ela, a página encurta e o navegador **corta a rolagem**, que se perde. Então a tela **guarda e restaura o `scrollY` de cada aba**.
- **Voltar de um hino para a lista** reabre a aba em que a pessoa estava (estado guardado em módulo, como a busca), em vez de sempre voltar a **Hinos**.
- **Áudio:** uma ferramenta que toca ou escuta **pausa** o hino que estiver tocando no miniplayer (um som de cada vez; ver as regras do tom na I-13).
- O miniplayer continua aparecendo **acima** da barra de abas, como já faz dentro do hino.

### Perguntas em aberto
1. **Ordem e aba inicial:** `Hinos` à **esquerda** e aberta ao iniciar o app, com o Afinador em seguida? **Recomendo sim** (e confirmar a frase do responsável acima).
2. A aba escolhida **fica lembrada** ao fechar o app, ou o app sempre abre em Hinos? **Recomendo abrir sempre em Hinos.**
3. Com o celular **deitado**, o trilho lateral divide a largura com a lista (que já respeita `--largura-trilho`): conferir se a lista fica confortável.

### Impacto técnico (hipóteses, a verificar)
- `src/routes/+page.svelte`: envolver a lista num painel e acrescentar a barra; o componente `Afinador.svelte` (I-13) como segundo painel, **fora** da condição do pacote carregado.
- **i18n:** a chave do rótulo de cada aba (`rotulo` de `Abas`) nos 3 idiomas, e o `aria-labelledby` **condicional** nos painéis (como no hino, que só o põe quando há mais de uma aba).
- Teste de ponta a ponta: trocar de aba mantém a busca, o foco e a **rolagem de cada aba**, e a barra some se houver uma só aba.
- O que a barra publica (`--altura-navegacao`) já é lido pelo `.conteudo` e pelo miniplayer.

### Critérios de aceitação (propostos)
- A tela inicial mostra a barra com as abas existentes, no celular em pé (embaixo) e deitado (trilho), igual à do hino.
- Trocar de aba não apaga a busca nem a rolagem da lista (cada aba volta onde estava); o teclado e o leitor de tela se comportam como no hino.
- A aba Afinador abre **sem hinário carregado**.
- Sair da aba de uma ferramenta a solta (sem som, sem microfone aberto).
- O miniplayer não cobre a barra nem o conteúdo.

---

## I-03 — Gravador de áudio para estudo e envio aos instrutores

- **Status:** **em implementação (2026-11-17; atualizado em 2026-11-20: o teste de ponta a ponta do Gravador falha com frequência no CI, sem erro na tela; a causa não foi achada).** Feito: a aba **Gravador** (só microfone; formato Opus/webm a 64 kbps; permissão pedida só ao gravar; microfone devolvido ao parar, ao sair da aba e ao esconder o app; **medidor de som no botão** e aviso de "sem som"; **gravações guardadas** no armazenamento do app, **sem limite**, em lista paginada (10 por vez, carrega mais quando o fim chega perto da tela), com nome de data e hora, resumo de quantidade e espaço usado, "Ouvir" e "Apagar" com confirmação e "Apagar todas"). **Testado no aparelho do responsável:** a gravação e o medidor (a gravação funcionou). **Enviar o áudio** já funciona (botão **Enviar**, folha de compartilhamento do Android, PR #77; testado no WhatsApp do responsável em 2026-11-18). **Gravar em segundo plano (2026-11-20, a confirmar no aparelho):** a gravação seguia só até a tela bloquear (~30 s) porque o app a parava ao esconder a página e o Android corta o microfone de quem sai da tela; agora o serviço em primeiro plano ganha o tipo microfone (`FOREGROUND_SERVICE_MICROPHONE`, notificação "Gravando" com "Parar") e a gravação segue até a pessoa parar. **Gravar com o hino no fone (2026-11-20, a confirmar):** a ponte `temFone` (AudioManager: fone com fio, USB, Bluetooth) deixa o hino tocar durante a gravação só com fone; sem fone segue um som de cada vez. **Falta:** renomear a gravação e ligá-la a um hino, e o fone Bluetooth (atraso).
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir
- **Nota (2026-11-17):** o responsável quer o Gravador como uma **aba da tela inicial** (`Hinos | Afinador | Gravador | …`): ver a **I-28** (feita e arquivada). A permissão de microfone e a detecção de fone se decidem **junto com o afinador** (I-13, etapas 2 e 3): a pesquisa de 2026-11-17 está lá.

### O que se deseja (nas palavras do responsável)

Um **gravador de áudio** para gravar os hinos **enquanto o celular toca** e **enviar os áudios para os instrutores
pelo WhatsApp**.

### Ideia de comportamento (a validar)

Na aba **Ouvir**, um botão **Gravar** que grava enquanto o hino toca (por exemplo, a pessoa tocando ou cantando junto),
com **parar**, **ouvir de volta**, **descartar** e **enviar**. Ao enviar, abre a folha de compartilhamento do sistema
para escolher o WhatsApp e o instrutor; o app não precisa conhecer contatos.

**Com fone ou sem fone (ideia do responsável, 2026-11-14):** o app percebe se há **fone de ouvido conectado**.
- **Sem fone:** o app **só grava** o microfone. Não toca o hino, porque o som do alto-falante entraria no microfone
  (eco e mistura ruim).
- **Com fone:** o app **toca o hino no ouvido da pessoa** e **grava no mesmo celular**, na mesma hora. A pessoa toca ou
  canta acompanhando a música, e o microfone não capta o hino.

### Perguntas em aberto

1. **O que gravar?** Com a ideia acima, o hino no fone não vaza para o microfone, então a gravação pode levar **só a
   voz ou o instrumento da pessoa**. Falta decidir se, **com fone**, o arquivo enviado deve levar também **o hino
   misturado** (como o som do hino é gerado dentro do app, dá para mixar o microfone com a saída do sintetizador direto,
   sem passar pelo ar) ou só o microfone. O instrutor talvez prefira ouvir os dois juntos. Precisa de decisão do
   responsável.
   **Cuidado com fone Bluetooth:** ele atrasa o som em 100 a 300 ms, e a pessoa tocaria **atrasada** em relação ao
   hino que está gravado junto. Medir o atraso e compensar, ou avisar que o fone com fio é melhor (a I-13 tem a mesma
   questão).
2. **Formato do arquivo.** Preferência do responsável (2026-11-14): gravar num formato **compacto, que não ocupe
   espaço**, como o **Opus** (`.opus`/OGG). O responsável lembra que WhatsApp e Telegram costumam **reconverter** o áudio
   de qualquer forma ao enviar; **a confirmar**, porque pode valer só para mensagem de voz e não para áudio anexado
   como arquivo. O WhatsApp precisa conseguir tocar o áudio recebido; o formato gerado pelo navegador
   (por exemplo WebM/Opus) pode não ser aceito, e talvez seja preciso converter (por exemplo para M4A ou OGG/Opus).
   Não verificado: o que `MediaRecorder` produz no WebView do Android, e como o WhatsApp e o Telegram tratam o arquivo
   enviado. Testar com um contato real, olhando o tamanho e se o áudio toca.
3. **Onde ficam as gravações** e por quanto tempo; apagar depois de enviar?
4. **Quem grava.** Há jovens e menores entre os músicos: definir o aviso de privacidade (as gravações ficam só no
   aparelho; o app não envia nada sozinho).
5. **Iniciar a gravação junto com o hino** ou separado (a pessoa aperta Gravar e depois Tocar)? Sem fone não há hino
   tocando, então só vale a segunda forma.
6. **Como saber que há fone?** O navegador não diz com segurança: `enumerateDevices()` lista as saídas e o evento
   `devicechange` avisa das trocas, mas num WebView pode ser preciso código nativo (no Android, `AudioManager`).
   Não verificado. Ver também a I-13, que precisa da mesma detecção.

### Impacto técnico (hipóteses, não verificadas)

- **Permissão de microfone** no Android (`RECORD_AUDIO`) e no iOS (`NSMicrophoneUsageDescription`). Num WebView, o
  acesso ao microfone (`getUserMedia`) depende de o aplicativo nativo conceder a permissão; precisa ser testado no
  Tauri Mobile e pode exigir um plugin ou código nativo.
- **Gravação:** a API padrão do navegador é `MediaRecorder`. Para mixar microfone e sintetizador, ligar as duas
  fontes a um `MediaStreamAudioDestinationNode` do mesmo `AudioContext` que o sintetizador já usa
  (`src/lib/sintetizador.ts`).
- **Envio:** o caminho consolidado é a **folha de compartilhamento do sistema** (Android `ACTION_SEND` com
  `FileProvider`; iOS `UIActivityViewController`), em vez de integrar com a API do WhatsApp. Verificar se existe
  plugin do Tauri 2 para compartilhar arquivos antes de escrever código nativo.
- **Armazenamento:** arquivos no diretório de dados do app, pela API do Tauri.
- **Segundo plano:** gravar com a tela apagada não está garantido num WebView (mesma ressalva do áudio em segundo
  plano na seção 4 do roadmap).

### Critérios de aceitação (propostos)

- Gravar um hino de ponta a ponta, ouvir de volta no app e enviar pelo WhatsApp a um contato de teste, que
  consegue tocar o áudio.
- A permissão de microfone é pedida só ao gravar, com explicação, e o app funciona normalmente se for negada.
- Nenhuma gravação sai do aparelho sem a pessoa escolher enviar.

---

---

## I-20 — Metrônomo embutido

- **Status:** **implementada (2026-11-21), nas PRs #103 a #112**: aba própria, serviço Kotlin com a tela bloqueada, Gravador em segundo plano, pêndulo que vai e volta, compassos simples (2, 3, 4) e compostos (6, 9, 12), lista dos últimos usados (hoje limitada ao que cabe na tela). **Em aberto, como futuro:** o gauge de ponteiro, e os compassos irregulares 5 e 7 (com agrupamentos, ver "Decisões do responsável").
- **Origem:** pedido do responsável, 2026-11-16: "fazer um metrônomo também, embutido".
- **Prioridade:** a definir
- **Nota (2026-11-17):** a tela inicial vai ter abas de ferramentas (I-28: `Hinos | Afinador | Gravador | …`, "entre outras"). Se o metrônomo também for uma aba, a pergunta 3 ("onde fica") se resolve por ela.
- **Decisão do responsável (2026-11-20):** o metrônomo é uma **aba própria** (`Hinos | Afinador | Gravador | Metrônomo`). A pergunta 3 está respondida.

### O problema
Quem estuda uma voz precisa de um pulso firme, e hoje o app só dá o pulso dentro da música tocada. Para praticar sem o hino
tocando, ou para entrar no tempo certo, é preciso outro aplicativo.

### O que se deseja
Um **metrônomo dentro do app**: um clique regular no andamento do hino (e ajustável), com o primeiro tempo do compasso
acentuado, que se liga e desliga.

### Desenho (2026-11-20, revisado pelo Opus 5 e decidido pelo responsável: aba própria, primeira etapa sem tocar junto com o hino, mas com tela bloqueada)
Escopo da **primeira etapa**: uma ferramenta de estudo independente do player. Fica de fora (etapa 2): tocar por cima do hino, contagem de entrada
antes da música, o compasso vindo do hino e ligar ao andamento do hino aberto. Em princípio é front (Svelte/TypeScript); **não mexe no conversor nem no
`hinario.json`**. **Exceção, decidida (A):** o clique continua com a tela bloqueada, e isso exige **Kotlin** (serviço em primeiro plano); a etapa 1 deixa de ser só front.

#### Tela (aba Metrônomo)
- **Andamento:** reaproveitar o `ControleAndamento.svelte` (− −5 valor +5 +, com `aria-live`), que hoje usa 40 a 160 (`ANDAMENTO_MIN/MAX` em `reproducao.svelte.ts`):
  passar `min`/`max` por propriedade. **Sem slider** (210 valores no celular é impreciso). Faixa a decidir (pergunta C). Muda **na hora**, sem parar o clique.
- **Compasso:** botões com o número de tempos (2, 3, 4, 6), 1º tempo acentuado. Mudar o compasso reinicia a contagem no 1º tempo.
- **Iniciar/Parar:** botão grande (mesma linguagem do Afinador e do Gravador). **Sem volume na tela**: quem ajusta é o volume de mídia (decisão do Afinador, `Afinador.svelte`
  e `tom.ts`); sem a música junto não há o que equilibrar. Revisitar na etapa 2.
- **Indicador de tempo:** uma bolinha por tempo, a atual acesa. O 1º tempo **não** se distingue só pela cor (regra do projeto, como o ✓/negrito/borda do Afinador):
  bolinha maior ou outra forma. O "pisca" fica **só nas bolinhas** (área pequena), com troca de cor sem animação, o que já passa por `movimento.css` e `verificar-movimento.py`;
  nada de pisca de tela cheia (WCAG 2.3.1: no máximo 3 piscadas por segundo, e a 180 bpm ou mais já passaria disso).
- **Leitor de tela:** um `role="status"` só com início, parada, bpm e compasso (como o Afinador). **Sem anúncio por tempo.**
- **Alvos:** 3rem (48 px) como o resto do app.
- **Quando o hino toca:** valem as mesmas regras do Afinador: Iniciar chama `reproducao.parar()` (um som de cada vez) e um `$effect` para o metrônomo quando um hino começa a tocar.

#### Som
Clique sintetizado (oscilador curto com envoltória rápida; o 1º tempo mais agudo e um pouco mais forte, a diferença confirmada pelo `hz` no teste). Nada para baixar.

#### Como agendar os cliques (o ponto técnico)
- O padrão conhecido é o do "A Tale of Two Clocks" (Chris Wilson): um temporizador **grosso** (~25 ms) só **olha adiante** (~100 ms) e agenda no relógio de áudio
  (`AudioContext.currentTime`) os cliques que caem na janela (`osc.start(tempo)`). Nunca usar `setInterval` para soar o clique.
- **Estado e cálculo (corrigido na revisão):** guardar `ultimoTempo` (instante do último clique agendado) e `tempoAtual` (0 a n−1). O próximo instante é calculado
  **só na hora de agendar**: `ultimoTempo + 60 / bpmAtual`. (Somar `60 / bpm` logo depois de agendar fixaria o intervalo com o bpm antigo e atrasaria a troca em um clique.)
  A troca de bpm vale a partir do **primeiro clique ainda não agendado**; o que já está na janela de ~100 ms soa como estava.
- **Atraso do temporizador:** se o temporizador acorda tarde (coleta de lixo, aparelho lento), o `start(t)` com `t` no passado soaria **na hora, todos juntos**. Se
  `proximoTempo < currentTime`, pular para o próximo ponto da grade (`n = ceil(atraso / período)`), avançando `tempoAtual` em `n % compasso` (mantém a fase), sem rajada.
- **Cancelar o que ainda não soou:** guardar os osciladores agendados. Ao parar, ou ao mudar compasso/bpm de modo que invalide a janela, `stop()`/`disconnect()` nos que ainda
  não soaram e esvaziar a fila visual (senão soam cliques fantasmas ao reiniciar, e o acento antigo sai depois de trocar o compasso).
- **Visual alinhado ao som:** fila `(tempoDeÁudio, índice)` consumida no `requestAnimationFrame` quando `currentTime − outputLatency ≥ tempo` (com detecção da propriedade; há o precedente
  `audivel()` em `sintetizador.ts`), para a bolinha não adiantar o som no Bluetooth (100 a 300 ms). Ao voltar à tela, descartar a fila velha e mostrar só o tempo atual.
- **Início:** depois do `await resume()`, começar em `currentTime + 0,1 s` (como o `ATRASO_INICIAL` do sintetizador), sempre com `tempoAtual = 0`. Limitação conhecida: o Bluetooth pode engolir o 1º clique.
- **`AudioContext`:** **próprio** (não o do sintetizador: o `ctx` é privado e pausar o hino faz `ctx.suspend()`, que calaria o clique; `tom.ts` já registra essa decisão), criado no **toque** em Iniciar,
  com a mesma guarda de geração do `TomSustentado` (Iniciar→Parar rápido e sair da aba durante o `await resume()`). `parar()` mantém o contexto e `sair()` o fecha com atraso, como o Afinador.
  Ouvir `ctx.onstatechange`: se sair de `running` com o metrônomo ligado (ligação telefônica, outro app com o foco de áudio), **parar e avisar** na tela, sem tentar `resume()` sozinho (sem gesto falha).
- **Segundo plano:** sem serviço, o Chrome limita os temporizadores da página escondida (a ~1 por segundo; com som nos últimos 30 s a limitação é mínima) e o Android pode congelar o processo.
  **Decisão A (substitui a ideia de "parar ao esconder"):** o metrônomo **continua com a tela bloqueada** até a pessoa parar. Para isso entra um terceiro motivo no `ServicoAudio.kt` (como `gravando`), a
  notificação "Metrônomo · Parar", o wake lock sem limite enquanto ligado e uma janela de agendamento adaptativa (~100 ms com a tela à vista, ~2 s escondido; `JANELA`/`JANELA_ESCONDIDA` em `metronomo.ts`).
  `sincronizarServico` **não** serve como está (`ligadoCom` é um só e o layout o desliga sempre que `reproducao.estado` muda).
- **Módulo puro e testável:** "dado o bpm, o compasso, o último instante e o agora, quais cliques agendar" fica numa função pura (`agendar(estado, agora, janela)` → `[{tempo, indice}]`),
  testada no vitest com relógio falso; o `AudioContext` entra só na casca fina.

#### Arquivos que a aba nova toca (não estavam no rascunho)
`src/lib/inicio.svelte.ts` (tipo `AbaInicio` e `rolagem`), `src/routes/+page.svelte` (`ABAS`, `ROTULOS`, painel), `src/lib/Abas.svelte` (cabem 4 abas? "Metrônomo"/"Metrónomo" em 412 px
com a fonte do sistema a 130% e 200%, e na barra lateral com o celular deitado), `ControleAndamento.svelte` (`min`/`max` por propriedade), `src/lib/preferencias.ts` e `tests/preferencias.test.ts`
(se lembrar bpm e compasso: chave `prefs.metronomo`, validada na leitura: bpm limitado, compasso ∈ {2,3,4,6}), os 3 dicionários i18n (`inicio.aba_metronomo`, `metronomo.*`; o tipo `Dicionario` e o
`npm run check` garantem as chaves, e textos com `{n}` pedem um teste como o de `erros.test.ts`) e o **e2e** (`karaoke.mjs` confere a lista exata de abas e vai quebrar).

#### Critérios de aceitação (revisados: mensuráveis)
- **vitest (função pura, relógio falso):** 1000 cliques com `t_n = t0 + n·p` (±1e-9), sem deriva; troca de bpm e de compasso no meio da janela; recuperação depois de 3 s sem rajada; reinício no 1º tempo.
- **e2e (Chrome mudo):** interceptar `AudioScheduledSourceNode.prototype.start` guardando `{when, agora: context.currentTime, hz}` (há precedente de trocar `AudioContext` em `karaoke.mjs`). A 240 bpm
  (30 cliques ≈ 7,5 s): (a) todo `when − agora > 0`; (b) intervalos = 60/bpm ± 1 ms e nenhum `when` repetido; (c) o mesmo com um laço ocupado de 150 ms; (d) acento a cada n cliques, conferido pelo `hz`
  (substitui o "audivelmente diferente"); (e) **escondido, o clique continua** (decisão A): com a página escondida os `start` seguem, a janela passa a ~2 s e os intervalos continuam em 60/bpm; e `context.state === "closed"` só ao **parar** (não ao esconder).
  O Chrome do e2e roda com `--autoplay-policy=no-user-gesture-required`, então o gesto não é provado por ele: contar as chamadas a `new AudioContext` antes do clique em Iniciar (devem ser 0).
- Uma sonda `window.__bmMetronomo` só em desenvolvimento (como `__bmTom` em `tom.ts`), com estado, fila e um analisador. Também amostrar a bolinha acesa a cada 25 ms contra `currentTime − outputLatency`.
- **Serviço em primeiro plano (A):** ligar o metrônomo liga o serviço (`iniciarMetronomo`/`pararMetronomo` na ponte), a notificação "Metrônomo · Parar" aparece e o botão para o clique de verdade (como o "Parar" do hino e da gravação);
  o serviço só se encerra quando hino, gravação e metrônomo estão todos parados; o wake lock não expira com o metrônomo ligado; se o Android recusar o serviço, o JavaScript é avisado e o metrônomo para com um aviso na tela.
- Para só quando a pessoa manda (botão na tela ou na notificação), quando o sistema tira o áudio (ligação, outro app: aviso na tela) ou quando um hino começa a tocar (sem fone, regra F). **Sair da aba não o para** (B: gravar com o clique no fone);
  ao desmontar a tela o `AudioContext` fica enquanto o clique estiver ligado, e é liberado ao parar.
- Respeita tema, `rem` e movimento reduzido; alvos de 3rem; textos nos 3 idiomas.

#### Decisões do responsável (2026-11-20, depois da revisão)
- **A. Tela bloqueada:** o clique **continua com a tela bloqueada e só para quando a pessoa pedir** (botão Parar, no app ou na notificação). Isso **entra na etapa 1** e
  exige **Kotlin**: um terceiro motivo no `ServicoAudio.kt`/`PonteServico.kt` (ao lado de `tocando` e `gravando`), tipo `mediaPlayback`, notificação "Metrônomo · Parar", wake lock sem limite
  enquanto ligado e uma janela de agendamento adaptativa (~100 ms com a tela à vista, ~2 s escondida, com o andamento e o compasso travados enquanto escondida). Deixa de valer o "só front".
- **B. Gravar com o clique no fone:** é um caso de uso. Regra igual à do hino: **com fone** o metrônomo e a gravação andam juntos (`foneConectado()`); **sem fone**, um som de cada vez
  (o clique do alto-falante entraria no microfone). Para isso a gravação **não pode parar ao trocar de aba** quando está protegida pelo serviço: o Gravador passa a seguir gravando em
  segundo plano e a tela mostra um aviso fixo "● Gravando 0:34 · Parar" fora da aba (a decidir onde: na barra de abas ou no miniplayer). Mexe no `Gravador.svelte` (`sair()`) e no layout.
- **C. Faixa de andamento:** de **30 a 240** bpm. O `ControleAndamento` recebe `min`/`max` por propriedade (o do player segue em 40 a 160).
- **D. Acento:** o **1º tempo é forte** e todos os outros são fracos; ao voltar ao 1º tempo, forte de novo. **Sem apoio médio** (nem no 4º tempo do 6). Compassos de 2, 3, 4 e 6 tempos.
- **E. Lembrar:** o app guarda o último andamento e compasso usados **e uma lista dos 5 a 10 últimos** (andamento + compasso, sem repetir; o mais recente no topo). Tocar num item da lista **substitui
  na hora** o que está tocando (e, se estiver ligado, segue tocando no novo). Entra na lista ao tocar em Iniciar. Chave `prefs.metronomo` `{bpm, compasso, recentes: [{bpm, compasso}]}`, validada na leitura.
- **F. Hino no miniplayer:** Iniciar o metrônomo **para** o hino que toca (e um hino que começa a tocar para o metrônomo), a menos que haja fone (aí vale a regra do B para a gravação; o hino
  continua sendo um som de cada vez com o metrônomo).
- **G. Indicador de tempo (atualizado em 2026-11-21):** o responsável quer, no futuro, um **gauge de ponteiro** (como os de painel de carro) e mais de um tipo, escolhido pela pessoa. **Feito: pêndulo que vai e
  volta** (como um metrônomo de verdade: **cada clique é uma ponta**, par à esquerda e ímpar à direita; a posição vem do relógio de áudio; com movimento reduzido a bolinha só pula de ponta em ponta), com **uma
  bolinha por tempo do compasso embaixo** (a do 1º tempo maior, a do tempo atual acesa). A versão anterior (uma trilha que desliza só para a direita) segue no código (`progressoNoCompasso`) para uma opção futura.
- **Compassos (2026-11-21, decididos): 2, 3, 4 (simples) e 6, 9, 12 (compostos).** Fora: o **1** (não existe como fórmula de compasso: nenhuma fonte séria o confirma) e o **5 e o 7** (irregulares, não aparecem nos hinos). O levantamento das
  partituras do hinário (480 hinos) deu 4/4 em 235, 6/8 em 90, 3/4 em 84, 6/4 em 34, 9/8 em 18, 2/4 em 10, 2/2 em 10, 12/8 em 6, 9/4 em 4 e 3/2 em 1; 12 hinos mudam de compasso no meio (94, 296, 342, 346, 348, 350, 352, 359, 368,
  415: só importa na etapa 2). Em 6/8, 9/8 e 12/8 os músicos contam o pulso da semínima pontuada (2, 3 e 4 tempos); as opções 6, 9 e 12 servem para contar as colcheias. Valores antigos guardados (1, 5, 7) voltam ao padrão na leitura.
- **Compassos irregulares (5 e 7), etapa futura (pesquisado em 2026-11-21):** o 5 e o 7 **existem** como compassos (quintuple e septuple meter) e ficaram **fora da etapa 1** por decisão do responsável. Só valem a pena **com os agrupamentos**, porque
  sem acento interno soariam como 5 ou 7 batidas iguais, e a etapa 1 decidiu não ter apoio médio. Agrupamentos usuais: **5 = 3+2 ou 2+3**; **7 = 2+2+3** (o mais comum na música popular americana), 3+2+2 ou, mais raro, 2+3+2. Exemplos reais:
  5/4 em "Take Five" (Brubeck, 3+2), no tema de *Missão Impossível* (Schifrin), em "Marte" (Holst) e no 2º movimento da *Pateticá* (Tchaikovsky, 2+3 que às vezes vira 3+2); 7/4 em *Unsquare Dance* (Brubeck). **Nenhum dos 480 hinos usa 5 ou 7**, e a pesquisa
  não achou hino tradicional nesses compassos (só canções de louvor contemporâneas). Ao fazer: um acento **médio** (timbre e ganho entre o forte e o fraco) no início de cada grupo, e uma escolha do agrupamento (3+2 ou 2+3 no 5; 2+2+3, 3+2+2 ou 2+3+2 no 7). Em `agendar`
  o acento viria de uma lista de inícios de grupo, no lugar de só o índice 0. Fontes: [Wikipedia, Septuple meter](https://en.wikipedia.org/wiki/Septuple_meter); [Baylor, cap. 16, Quintuple and Septuple Meters](https://openbooks.library.baylor.edu/rhythm/chapter/16/);
  [Univ. of Iowa, Meter](https://pressbooks.uiowa.edu/twentieth-and-twenty-first-century-music/chapter/meter/); [Soundbrenner, 5/4](https://www.soundbrenner.com/blogs/articles/5-4); [NPR, cinco tempos por compasso](https://www.npr.org/2008/09/26/94723908/playing-five-beats-to-the-measure);
  [John D. Cook, Music in 5/4 time](https://www.johndcook.com/blog/2009/02/27/music-in-54-time/); [BBC Music Magazine, It's good to be irregular](https://www.pressreader.com/uk/bbc-music-magazine/20210121/281904480817070).

### Perguntas em aberto
1. **Compasso:** o formato do hino traz o `andamento` (bpm), mas **não o compasso** (2/4, 3/4, 4/4, 6/8). Para acentuar o 1º
   tempo, o conversor teria de ler o compasso da partitura e gravá-lo no `hinario.json` (ver `docs/FORMATO.md`), ou a pessoa
   escolhe o número de tempos no próprio metrônomo.
2. **Sozinho ou junto com a música?** Só como ferramenta de estudo (sem o hino tocando), também **tocando por cima da música**
   (para quem quer o pulso marcado), ou com uma **contagem inicial** de um compasso antes de a música começar?
3. **Onde fica?** Um card no player (junto de "Andamento e Tom"), uma tela própria, ou um botão no miniplayer?
4. **Aviso visual:** além do som, um pisca na tela (útil com o celular no mudo ou para quem tem dificuldade de ouvir o clique).
5. **O andamento é o do hino ou independente?** Mudar o andamento do player (−5 −1 +1 +5) muda o do metrônomo junto?
6. **Que som?** Um clique sintetizado curto (o mais leve, sem baixar nada) ou amostras de madeira e sino.

### Impacto técnico (hipóteses, não verificadas)
- **Pesquisar antes de construir** (regra do projeto): metrônomo em Web Audio é um problema conhecido, e o padrão é agendar os
  cliques com **antecedência** no relógio do `AudioContext`, e não com `setInterval`, que oscila. Registrar o que for lido.
- Compartilhar o `AudioContext` do sintetizador (`src/lib/sintetizador.ts`) para o clique ficar **alinhado à música**, e o `volume`
  independente do das vozes.
- Reaproveitar o que já existe: o `andamento` do hino e o reagendamento a partir de uma posição (`reproducao.irPara`).
- Um oscilador curto com envoltória rápida basta para o clique (o 1º tempo, mais agudo ou mais forte); nada novo para baixar.

### Critérios de aceitação (propostos)
- O intervalo entre cliques fica estável (medir o desvio no teste de ponta a ponta, como o do karaokê faz com as sílabas).
- Mudar o andamento com o metrônomo ligado vale na hora e sem estalo; o primeiro tempo é audivelmente diferente dos outros.
- Ligar e desligar o metrônomo não interrompe nem desalinha a música que está tocando.
- Respeita o tema, o `rem` e o movimento reduzido no aviso visual (o pisca não pode ser a única indicação).

---

---

## I-17 — Lembrar o último hino e a posição

- **Status:** anotada
- **Origem:** ideia do assistente, 2026-11-15.
- **Prioridade:** a definir

### O que se deseja
Ao reabrir o app, oferecer "continuar de onde parou": o último hino aberto e, se estava tocando, a posição.

### Perguntas em aberto
1. Só **mostrar** o atalho ou já abrir o hino? (nunca tocar sozinho, por causa do áudio inesperado)
2. Guardar também o andamento, o tom e os instrumentos escolhidos (hoje só os instrumentos e volumes por voz são lembrados)?

### Impacto técnico (hipóteses)
- Preferência no aparelho (`src/lib/preferencias.ts`), como a do karaokê e a da letra; nada sai do aparelho.

---

---

## I-33 — Negrito para o coro e o final

- **Status:** anotada (2026-11-20)
- **Origem:** o hinário impresso mostra o coro **em negrito e separado** da estrofe, sem número (hinos 398 e 457); o coro e o final já saem como blocos próprios (I-19), mas ainda em texto normal.
- **Prioridade:** a definir (pequena)
- **O que se deseja:** que o bloco "Coro" e o bloco "Final" apareçam em negrito na aba Letra, como no impresso. Só o app (`+page.svelte`, CSS do `.estrofe`), sem mexer no hinário nem nos pacotes. Ver o contraste
  nos temas (alto contraste) e se o negrito atrapalha o destaque da sílaba que soa.

---
