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
  `#ffffcc` e `#ffffe0` com contraste AAA medido por `tools/contraste.py`, espessuras maiores de foco, bordas e barra de progresso, links
  sempre sublinhados e destaques em bloco preto com texto amarelo. Detalhes e a tabela de contrastes em [`../design-tokens.md`](../design-tokens.md).
- Respostas às perguntas acima: (1) amarelo `#ffffcc` no fundo e `#ffffe0` nos cartões, **a validar com quem tem baixa visão**; (2) a
  versão invertida **não** entrou; (3) o modo **ignora o estilo** (o grupo Estilo fica desativado, com uma nota); (4) o nome é "Alto
  contraste" nos três idiomas; (5) o ícone do app e a barra de status do Android **não** mudam.
- **Não feito:** o Automático seguir `prefers-contrast: more` (decisão: segunda etapa, depois de saber se a WebView repassa a preferência);
  "texto um pouco maior por padrão" (a I-04 e o `rem` já cobrem).
- Achado do parecer prévio, confirmado no navegador: o escuro "do sistema" de cada estilo (especificidade 0,3,0) **vencia** o bloco novo
  (0,2,0) com o aparelho no escuro. Os três usam agora `:not(..., [data-tema="alto-contraste"])`; o e2e confere nos três estilos.
- Falta (seção 7 de [`../roadmap-pendencias.md`](../roadmap-pendencias.md)): ver no celular e a revisão por uma pessoa com baixa visão.

---
