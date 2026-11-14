# Ideias e pedidos para o futuro

Este arquivo guarda ideias, reclamações e pedidos que ainda **não** entraram no plano das etapas
([`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md)). Ele existe para nada se perder. Uma ideia só vira
trabalho depois de ser avaliada e priorizada.

Como usar: cada ideia tem um código (`I-01`, `I-02`…), a origem, o problema, o que se deseja e as perguntas
em aberto. Ao implementar, mude o status e aponte para a etapa ou o commit.

Status possíveis: **anotada** · **em análise** · **planejada** · **feita** · **descartada**.

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
  linha de **botões compactos com ícone**, um para a **introdução** ("▶ Intro") e um para **cada vez** ("▶ 1ª",
  "▶ 2ª", "▶ 3ª ⚑", onde ⚑ marca o final). Cada um toca só aquela parte, direto; o nome completo ("Terceira vez ·
  final") fica no rótulo de acessibilidade e no miniplayer. Só aparecem nos hinos que têm introdução ou final; os
  outros têm um só "Tocar". Há uma vez por estrofe da letra (no mínimo 2): no 457, 3 vezes, e o hino todo dura cerca
  de 4:00 a 52 bpm. (Uma primeira versão tinha um contador "N vezes" e um interruptor; foi trocada depois da
  correção do responsável.)
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

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

### O que se deseja (nas palavras do responsável)

Em cada tema, duas versões:

- **Claro:** o claro normal e uma versão **pergaminho**, mais amarelada.
- **Escuro:** o escuro normal e uma versão **mais amarelada e ligeiramente mais clara**.

Ou seja, quatro paletas no total.

### Motivação (a confirmar)

Conforto de leitura da letra por períodos longos: fundo amarelado costuma cansar menos a vista do que o
branco puro ou o azul-marinho frio. Não há medição de conforto no projeto; é preferência do responsável e
vale testar com quem lê.

### Ideia de comportamento (a validar)

Duas escolhas independentes em **Ajustes → Aparência**, para "Seguir o sistema" continuar funcionando
com as duas variantes:

1. **Modo:** Seguir o sistema | Claro | Escuro (já existe).
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
- "Seguir o sistema" combinado com "Pergaminho" acompanha o tema claro ou escuro do aparelho.

---

## I-03 — Gravador de áudio para estudo e envio aos instrutores

- **Status:** anotada
- **Origem:** pedido do responsável, 2026-11-14.
- **Prioridade:** a definir

### O que se deseja (nas palavras do responsável)

Um **gravador de áudio** para gravar os hinos **enquanto o celular toca** e **enviar os áudios para os instrutores
pelo WhatsApp**.

### Ideia de comportamento (a validar)

Na aba **Ouvir**, um botão **Gravar** que grava enquanto o hino toca (por exemplo, a pessoa tocando ou cantando junto),
com **parar**, **ouvir de volta**, **descartar** e **enviar**. Ao enviar, abre a folha de compartilhamento do sistema
para escolher o WhatsApp e o instrutor; o app não precisa conhecer contatos.

### Perguntas em aberto

1. **O que gravar?** Só o **microfone** (a voz ou o instrumento da pessoa), ou a **mistura** do microfone com o som do
   hino? Tocar o hino no alto-falante e gravar pelo microfone gera eco e mistura ruim; como o som do hino é gerado dentro
   do app, dá para **mixar o microfone com a saída do sintetizador direto**, sem passar pelo ar. Isso pede fone de
   ouvido para a pessoa se ouvir sem eco. Precisa de decisão do responsável.
2. **Formato do arquivo.** O WhatsApp precisa conseguir tocar o áudio recebido; o formato gerado pelo navegador
   (por exemplo WebM/Opus) pode não ser aceito, e talvez seja preciso converter (por exemplo para M4A ou OGG/Opus).
   Não verificado.
3. **Onde ficam as gravações** e por quanto tempo; apagar depois de enviar?
4. **Quem grava.** Há jovens e menores entre os músicos: definir o aviso de privacidade (as gravações ficam só no
   aparelho; o app não envia nada sozinho).
5. **Iniciar a gravação junto com o hino** ou separado (a pessoa aperta Gravar e depois Tocar)?

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

## I-04 — Alinhamento e tamanho da letra

- **Status:** anotada
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

---

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

Uma nova opção em **Ajustes → Aparência**, ao lado de Seguir o sistema, Claro e Escuro: **Alto contraste** (preto sobre
amarelo claro). Além das cores, o modo reforça o resto do visual:

- Borda dos controles mais grossa e preta; foco com contorno grosso e bem visível.
- Links sempre sublinhados; nada de informação só por cor (o app já segue isso).
- Sem sombras, degradês ou tons intermediários; barras de progresso e interruptores em preto e branco.
- Texto um pouco maior por padrão, combinando com a ideia I-04 (tamanho da letra).

### Aproveitar o padrão da plataforma (não reinventar)

O navegador e o sistema já têm o conceito: a media query CSS **`prefers-contrast: more`** indica que a pessoa pediu mais
contraste, e **`forced-colors`** cobre o modo de cores forçadas. A ideia é: em "Seguir o sistema", se o aparelho pedir
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
  `@media (prefers-contrast: more)` para "Seguir o sistema".
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

---

## I-07 — Sons de instrumentos mais realistas

> **Origem:** pergunta do responsável ("tem como colocar sons mais realistas para os instrumentos?").

### Situação atual
O som é **síntese aditiva**: cada instrumento é uma `PeriodicWave` (uma receita de harmônicos) com envelope e
vibrato, gerada no próprio app. Não há gravações nem banco de sons: por isso o app é pequeno e funciona sem rede, mas
o timbre é aproximado ("tipo um órgão eletrônico"), principalmente em sopros e cordas.

### O que se deseja
Timbres que lembrem mais o instrumento de verdade (flauta, clarinete, violino, órgão, sax...).

### Caminho mais provável (a pesquisar antes de decidir)
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

## I-08 — Mostrar a partitura no hino

> **Origem:** sugestão do responsável: "como temos letras, mostrarmos a partitura também". Não estava no escopo
> inicial. O formato já tem o campo opcional `partitura` (caminho de arquivo), mas nunca foi usado.

### O que se deseja
Uma aba **Partitura** no hino (ao lado de Ouvir e Letra) para o músico ler a música enquanto ouve.

### Caminho recomendado (a confirmar com um teste pequeno)
1. **Gerar imagens fora do app**, na conversão: uma ferramenta de linha de comando transforma cada `.mscx` em **SVG**
   (um por página), por exemplo o MuseScore (`mscore -o hino.svg`). A partitura sai idêntica à do arquivo.
2. **Empacotar** as imagens junto do `hinario.json`, usando o campo `partitura`.
3. **Aba "Partitura"** com zoom e rolagem. SVG fica nítido em qualquer tamanho, o que ajuda quem tem baixa visão.
4. **Extra, depois:** acompanhar a música tocando (cursor ou compasso destacado). É viável, porque o conversor já
   sabe o instante de cada compasso.

**Por que não desenhar a partitura a partir do JSON:** o JSON guarda só altura e duração. Faltam armadura, fórmula
de compasso, acidentes, ligaduras, cifras e casas de volta. Reconstruir isso seria reinventar a roda.

### Pontos de atenção
- **Direitos:** as partituras vêm das mesmas transcrições do autor das transcrições, então a resposta dele vale aqui também. As
  imagens ficam **fora do Git**, como as letras.
- **Importação:** hoje o app importa um só JSON (limite de 20 MB). Com imagens, é preciso um **pacote de vários
  arquivos** (um `.zip`). É a parte de maior trabalho.
- **Tamanho:** 480 hinos em SVG podem somar dezenas de MB; avaliar compressão.
- **Ferramenta:** o MuseScore **não está instalado** no computador de desenvolvimento. Alternativa sem instalar:
  renderizar no próprio app com uma biblioteca como o OpenSheetMusicDisplay, mas exige converter antes para
  MusicXML e é mais frágil. Pesquisar as duas opções antes de escolher (ver também I-01, "Alternativas
  consideradas", onde o MuseScore em linha de comando já foi avaliado para outro fim).

### Perguntas em aberto
1. Instalar o MuseScore para o primeiro teste, ou avaliar a alternativa sem instalar?
2. A aba Partitura deve aparecer só quando o hino tem partitura, ou sempre, com aviso?
3. Vale já planejar o cursor acompanhando a música, ou fica para depois?

### Critérios de aceitação (propostos)
- A partitura de um hino de amostra aparece nítida na aba, com zoom e rolagem, no emulador e no desktop.
- O pacote importa sem passar de um tamanho combinado e sem ir para o Git.
- Com a fonte do sistema no máximo e nos temas claro, escuro e baixa visão, a aba continua utilizável.

---

## Modelo para novas ideias

```markdown
## I-NN — Título curto

- **Status:** anotada
- **Origem:** quem pediu e quando
- **Prioridade:** a definir

### O problema
### O que se deseja
### Perguntas em aberto
### Impacto técnico (hipóteses)
### Critérios de aceitação (propostos)
```
