# Ideia: tocar uma nota e o app dizer qual é (rascunho, I-35)

**Status:** rascunho **revisado** (2026-11-24): pesquisado, revisado por um subagente Opus 5 e conferido de novo contra o código e as contas. Nada disto está implementado. Esta ideia **cresce a partir da I-32** (afinador que ouve e mede, `roadmap-ideas.md`; especificação técnica da escuta na seção "I-13, Etapa 2" de [`archive/ideias-implementadas.md`](archive/ideias-implementadas.md)). O que ela acrescenta é a **hierarquia da tela e a transposição já na primeira versão**, para o uso ser: abrir, tocar, ler.

## O pedido (2026-11-24, do responsável)

> "Eu toco a nota no instrumento e ele detecta que nota é aquela e me mostra na tela, [sem] a pessoa ter que escolher o instrumento etc."

## O que a I-13/I-32 já cobria e o que esta ideia muda

A I-13 (etapa 2) **já era** um afinador cromático que descobre a nota: mostra o nome da nota mais próxima, os cents e a palavra ("baixo", "alto", "afinado"), tem faixa, mensagem "toque ou cante uma nota" e leitor de tela com `aria-live`. Então esta ideia **não** é "descobrir a nota" contra "medir a afinação". O que muda de verdade:

| | I-13 / I-32 (já escrita) | Esta ideia |
|---|---|---|
| Centro da tela | O medidor (ponteiro de cents) | **O nome da nota**, grande; o ponteiro vem depois |
| Instrumentos que transpõem | "Mostrar a nota real (que soa); uma opção 'instrumento' **depois**" (pergunta 6) | **Já na primeira versão**, e **sem escolher**: a tela mostra a nota em concerto e, em linha pequena, como ela se escreve em Si♭, Mi♭ e Fá (ver "A tela") |
| Configuração exposta | Tolerância "afinado" **configurável**; referência 440 Hz configurável na etapa 2 | **Nenhuma** na v1: 440 Hz fixo e a tolerância fixa (±5 cents) |
| Estabilidade do nome | Histerese só para a palavra "afinado" | **Histerese também no nome** (senão ele pisca na fronteira entre duas notas) |
| Pauta | Não | Opcional, etapa posterior |

## Como os outros apps fazem (pesquisa de 2026-11-24; textos das lojas, **não testei os apps**; todos os que citei são para iOS)

| App | O que faz sem a pessoa escolher nada | O que oferece escolher |
|---|---|---|
| **Pano Tuner** | Segundo a loja, acompanha a nota assim que ela soa e mostra a nota e a frequência (Hz e cents). | Não achei escolha de instrumento na listagem. |
| **Cleartune** | Seleção **automática** da nota; a loja diz precisão de ±1 cent. | Também seleção **manual** da nota. |
| **APTuner** | A loja diz detectar a nota e os cents "para uma grande variedade de instrumentos". | Não detalhado na listagem. |
| **TonalEnergy** | A loja anuncia faixa de C0 a C8 e transposição **automática ou manual**; um comentário de usuário no AppleVis cita predefinições de trompete, trompa, trombone, bombardino e tuba. | Transposição manual. Não achei fonte que cite si bemol ou mi bemol para este app. |
| **Band Toolbox** | Segundo a loja, **toca-se uma nota e a ferramenta mostra a nota transposta em concerto, Si♭, Mi♭ e Fá**, as quatro de uma vez. | Nada a escolher para ver as quatro. |
| "Tuner - Chromatic Guitar Tuner" | Modo Auto, mas **preso à afinação** (violão e baixo). | A afinação. |

**O que isto ensina**
1. O padrão dos afinadores **cromáticos** é o pedido: **sem escolher instrumento**, mostram a nota mais próxima e o desvio. A escolha de instrumento aparece nos afinadores de **cordas** (cada corda) e como **transposição** nos de sopro.
2. O **Band Toolbox** mostra a nota em **todas** as transposições ao mesmo tempo, o que resolve "sem escolher": quem toca em Si♭ olha a linha dele. É o modelo adotado aqui.
3. Os apps de sopro anunciam faixa funda no grave (C0 a C8); a especificação da I-13 começa em ~65 Hz (ver "Faixa e janela").
4. **Faltou pesquisar:** afinadores **Android** de uso comum (por exemplo gStrings, Soundcorset, DaTuner: só os nomes que conheço, **não verifiquei** os recursos de nenhum), os apps de ensino ou de *ear training* que mostram a nota numa pauta enquanto se toca (o precedente da etapa de pauta) e os afinadores de clipe com transposição. Fazer isto antes de fechar o desenho.

## A tela

O medidor é um **pêndulo de vizinhas** (pedido do responsável, 2026-11-24): uma trilha com a bola, como o pêndulo do Metrônomo, com **três pontos**: **à esquerda a nota logo abaixo** (um semitom), **no centro a nota que está soando** e **à direita a nota logo acima**. A bola mostra a **afinação em cents**: no centro, afinada; para a esquerda, baixa (indo em direção à de baixo); para a direita, alta.

```
┌──────────────────────────────────────────────┐
│ Afinador            [ Dar o tom | Ouvir ]    │
├──────────────────────────────────────────────┤
│                  Lá♭ 4                       │   ← nome da nota (grande), em concerto
│                  (Sol♯)                      │   ← o outro nome, pequeno
│                                              │
│   Sol                                  Lá    │   ← as vizinhas: a de baixo e a de cima
│   ┣━━━━━━━━━●━━━━━━━━━┃━━━━━━━━━━━━━━━━━━┫   │   ← trilha: ● = os cents; ┃ = faixa "afinado"
│                                              │
│          −14 cents · baixo · 412 Hz          │   ← cents, a palavra e a frequência medida
│   Si♭: Si♭    Mi♭: Fá    Fá: Mi♭             │   ← como se ESCREVE em cada instrumento
│                                              │
│   Toque ou cante uma nota.                   │   ← quando não há som
│   ▸ Fixar o meu instrumento      Concerto    │   ← cartão FECHADO (opcional)
└──────────────────────────────────────────────┘
```

(Os números do esboço são coerentes: Lá♭4 a 440 Hz é 415,3 Hz; 412 Hz medidos dão cerca de −14 cents, e a linha das transposições é a de uma nota que soa Lá♭: Si♭ lê Si♭, Mi♭ lê Fá, Fá lê Mi♭.)

### O pêndulo de vizinhas: o que decidir

1. **Escala da trilha.** Duas escolhas: as pontas valem **±50 cents** (onde a vizinha passa a ser a nota mais próxima) ou **±100** (a vizinha de verdade, a um semitom). **Recomendo ±50**: com ±100 a bola quase nunca passa do meio da trilha, porque o nome do centro troca aos ±50. Com ±50 a bola usa a trilha toda e a ponta diz **qual nota vem em seguida**.
2. **Troca do centro.** Quando a leitura passa de ~60 cents da nota do centro (a histerese do nome, ver "Comportamento"), a vizinha **vira o centro** e a trilha se **recentra**: a bola pula para perto do centro, do outro lado. É o mesmo gesto da bola do Metrônomo, que vai de ponta a ponta; o nome só muda pela regra da histerese, e a bola não deve "voltar" sozinha.
3. **Faixa "afinado" (±5 cents).** Uma **faixa mais grossa no centro da trilha** (a forma diz "aqui", e não só a cor) mais a palavra "afinado". Fora dela, a palavra é "baixo" ou "alto".
4. **Movimento.** Reaproveitar o desenho do pêndulo do Metrônomo (`.pendulo`, `.trilha`, `.bola` em `src/lib/Metronomo.svelte`), **sem transição de CSS** e, com "reduzir movimento", **sem deslizar** (a bola pula, como já faz no metrônomo). O número de cents é **suavizado**. Se os dois ficarem iguais, vale extrair um componente comum (`Trilha.svelte`) em vez de copiar o CSS.
5. **Acessibilidade.** O pêndulo do Metrônomo é **`aria-hidden`** (decorativo, o aviso de status basta). O do afinador **não pode ser**: usar `role="meter"` (mínimo −50, máximo 50, `aria-valuenow` em cents e `aria-valuetext`, por exemplo "14 cents abaixo de Lá bemol"), com o anúncio **limitado a uma vez por segundo** e só quando muda a nota ou a palavra (a regra da I-13).
6. **Sem som.** A bola **some** e as vizinhas ficam esmaecidas, com o texto "Toque ou cante uma nota" (não inventa leitura).
7. **Pontas da faixa.** Na nota mais grave ou mais aguda que o detector aceita, a ponta sem vizinha fica **sem nome**.
8. **Instrumento fixado.** Se a pessoa fixou o seu instrumento (por exemplo Si♭), o **nome grande e os das pontas** devem estar na **nota que ela lê** (a escrita), e o nome em concerto vai para a linha pequena. Sem instrumento fixado, tudo em concerto. **Pergunta ao responsável** (a 8, abaixo).

- **Zero configuração para começar:** abre, pede o microfone **no toque** de "Ouvir" e só então, e já mostra. O Hz exibido é o **medido** (como nos afinadores), e não o nominal da nota.
- **Uma grafia só no nome grande**, a **mesma do "dar o tom" e dos hinos** (`src/lib/notacao.ts`: Dó♯, Mi♭, Fá♯, Lá♭, Si♭), nos três idiomas e nas notações Dó Ré Mi ou C D E que o app já tem, com a **oitava**. O enarmônico (Sol♯ no lugar de Lá♭) vai **pequeno** ao lado, sem dobrar o peso visual. Para o leitor de tela, o nome por extenso que o app já tem (`nomeDaNotaPorExtenso`), **só do nome grande**.
- **A linha de transposições:** o nome da nota **como se escreve** em Si♭, Mi♭ e Fá (a nota que o músico lê na partitura dele). **Fixar o meu instrumento** (cartão fechado, lembrado) destaca a linha dele e a põe em cima.
- **Sem som ou som fraco:** "Toque ou cante uma nota", a bola some e as vizinhas esmaecem; não inventa nota.

### Transposição: o que está certo e o que o rótulo precisa dizer

Para uma nota que **soa** Dó:

| Instrumento | Nota escrita | Observação |
|---|---|---|
| Si♭ (trompete, clarinete, sax soprano) | Ré | um **tom** acima do que soa |
| Si♭ uma oitava abaixo (sax tenor, clarone, bombardino ou barítono em **clave de sol**) | Ré, **uma oitava + um tom** acima | a **oitava** muda |
| Mi♭ (sax alto, genis) | Lá | uma **sexta maior** acima |
| Mi♭ uma oitava abaixo (sax barítono) | Lá, uma oitava **mais** acima | uma oitava e uma sexta maior acima do que soa |
| Fá (trompa) | Sol | uma **quinta justa** acima |
| **Concerto** (trombone e bombardino em **clave de fá**, tuba, órgão, voz, cordas) | Dó | **não** transpõem, apesar de o bombardino e o trombone serem "em Si♭" quando lidos em clave de sol |

O rótulo da opção **não pode ser só "Si♭"**: a pessoa que toca trombone e escolhe Si♭ vai ler errado. Rotular **por instrumento**, como na tabela. Como a tela mostra a oitava (Lá4), a oitava escrita precisa acompanhar a transposição (ou ser omitida quando houver transposição).

## Faixa e janela (correções à I-13)

- A I-13 diz que 2048 amostras "cobrem dois períodos até ~65 Hz". **A conta está errada para baixo:** a 48 kHz, 2048 amostras são 42,7 ms, e **dois períodos cabem até ~47 Hz** (~43 Hz a 44,1 kHz). O limite de 65 Hz da faixa é uma **escolha**, e não uma limitação da janela. Uma janela de **4096** (o dobro do atraso) cobre dois períodos até ~23 Hz.
- **O pedal do trombone** (Si♭1 = 58,3 Hz) cabe na janela de 2048. **A tuba** desce a ~44 Hz (Fá1) na tessitura normal e a ~30 Hz nos pedais: a faixa de 65 Hz **a deixa de fora**, e pior, o microfone do celular costuma ter filtro passa-alta por volta de 80 a 100 Hz, então o fundamental chega fraco (o detector ainda acha o período pelos harmônicos, mas o **erro de oitava para cima** fica mais provável).
- **Proposta:** janela de 2048 como padrão; descer a faixa para ~40 Hz com janela de 4096 **só quando** a leitura estiver no grave; ou declarar a **tuba fora da v1**. Decidir depois de testar com o instrumento real.
- O teto de ~2100 Hz (Dó7) basta para metais e voz; flautim e flauta aguda passam dele.

## Comportamento (o que um app cujo centro é o nome da nota precisa definir)

1. **O nome não pode piscar na fronteira entre duas notas.** Uma nota a +50 cents pisca entre duas. Regra: o nome **só muda** depois de a leitura passar de ~60 cents da nota atual **ou** depois de N quadros seguidos na nota nova (a calibrar). A palavra "afinado" tem a sua histerese à parte.
2. **Ataque e fim da nota.** Metais têm transiente de ataque e a voz tem portamento. Meta: mostrar a primeira nota em **menos de ~200 ms** depois de estável. Quando o som **acaba**, **congelar a última nota por ~1 s, esmaecida**, em vez de voltar na hora para "toque uma nota": quem toca quase nunca olha a tela durante o som.
3. **Taxa de atualização.** Ler a cada quadro (~16 ms), mas suavizar o número de cents e só trocar o nome pela regra acima; o ponteiro respeita "reduzir movimento".
4. **Clareza baixa.** Definir os casos e o texto de cada um: "sem nota" (silêncio), "som com ruído" (volume alto e clareza baixa) e "várias notas" ("toque uma nota de cada vez"; acorde e vários instrumentos dão leitura instável).
5. **Ruído de fundo (igreja, sala de ensaio, outros músicos afinando).** Decidir se o corte de volume é fixo ou **relativo ao ruído medido** nos primeiros instantes, e se a tela sugere aproximar o celular do instrumento.
6. **Órgão.** Um registro único de 8' é monofônico e funciona; os de 16' e 32' e as misturas enganam a oitava. Dizer isso na tela de ajuda.
7. **Convenção de oitava.** O app usa a científica (Dó4 = Dó central, MIDI 60). Há métodos e professores que chamam o Dó central de Dó3. "Lá4" pode confundir: **perguntar ao responsável** qual convenção os métodos usam.
8. **Acessibilidade.** `aria-live` com taxa limitada (uma vez por segundo, já na I-13); o nome anunciado por extenso ("Lá bemol"); nome em letra ampliada; contraste no Alto contraste; talvez uma vibração em "afinado".
9. **Bateria e ciclo de vida.** Soltar o microfone ao sair da aba e em `visibilitychange` (I-13); desligar sozinho depois de ~2 min sem som; mostrar na tela, de forma clara, que o **microfone está ligado**.
10. **Privacidade.** Dizer na tela de permissão que **nada é gravado nem sai do aparelho** e que o microfone só abre no toque em "Ouvir".
11. **Convivência com o hino e com o Gravador.** Ao ouvir, **pausar o hino** (I-13). Se o **Gravador** estiver gravando (inclusive em segundo plano), dois `getUserMedia` ao mesmo tempo esbarram no problema do wry (#1917, na I-13): na v1, **não ouvir enquanto grava** e avisar.

## Como detectar (resumo; o detalhe está na I-13)

- **Biblioteca:** `pitchy` (MPM, de McLeod), MIT/0BSD, com `clareza` de 0 a 1 e volume mínimo; recebe amostras e a taxa, sem depender do Web Audio. Faixa de clareza recomendada pelo pacote: 0,8 a 1; um afinador de código aberto que o usa corta em 0,9 (a calibrar).
- **Filtros por cima:** corte por clareza e por volume, **mediana de ~200 ms** (vibrato da voz) e **regra de oitava** (ignorar saltos de ~1200 cents até persistirem). Mais a **histerese do nome** (acima).
- **Captura:** o Gravador já pede `echoCancellation`, `noiseSuppression` e `autoGainControl` como `false` (booleano simples, o que vale como `ideal`; `src/lib/gravador.ts:179`) e tem um `AnalyserNode` de `fftSize` 1024 (`gravador.ts:247`); o afinador precisaria de 2048 ou mais. **O app ainda não chama `track.getSettings()`**, então **não se sabe** se os filtros saem mesmo desligados no aparelho do responsável. Há relato de que `exact: false` funcionou no Chrome 124 do Android 14 e deu `OverconstrainedError` no Chrome 126 (por isso, `ideal`), e de que o navegador ainda filtra o sinal mesmo com tudo desligado (WebKit). **Nenhuma fonte trata do WebView do Android com afinador.**
- **O que já existe do microfone:** permissão e manifesto (`RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`), `getUserMedia` testado no aparelho, segundo plano (`FOREGROUND_SERVICE_MICROPHONE`) e a ponte `temFone` (`servico.ts`), feita para o Gravador.

## Decisões da I-13 que esta ideia herda, e as que muda

- **Herda (decididas pelo responsável):** as duas etapas (dar o tom e ouvir e medir); a aba **Afinador** na tela inicial.
- **Herda como proposta, ainda sem resposta do responsável:** a escuta e o "dar o tom" **exclusivos** na v1 (pergunta 1 da I-13, marcada lá como "proposta minha"). **O contexto mudou:** o argumento da I-13 era evitar um plugin Kotlin para detectar fone; hoje a ponte `temFone` **já existe** (feita para o Gravador). Vale reabrir a pergunta: ouvir e tocar a nota **ao mesmo tempo, com fone**, já é tecnicamente possível.
- **Muda:** a referência de **440 Hz** fica **fixa** na v1 (a I-13 recomendava torná-la configurável na etapa 2); a **tolerância** do "afinado" fica **fixa** (±5 cents). Isto cumpre o "zero configuração"; confirmar com o responsável.

## Etapas sugeridas (reordenadas depois da revisão)

O "spike do microfone" da I-13 **já está feito, na prática**, pelo Gravador (permissão, `getUserMedia`, medidor, segundo plano e fone, tudo testado no aparelho do responsável). O que continua sem teste: os valores de `getSettings()`, o AGC em nota longa, a precisão do `pitchy` com instrumento real e o Bluetooth. Por isso, **em vez de um APK descartável**:

1. **Funções puras e testes** (`afinador.ts` já tem `centsEntre` e `notaMaisProxima`): nome da nota, oitava, cents, **histerese do nome**, transposição com a oitava, casos de borda (fronteira entre notas, enarmônicos).
2. **Calibração com gravações reais:** o responsável grava no próprio Gravador trompete, trombone (com o pedal), tuba, voz e órgão; os arquivos viram **fixtures** e um teste no Vitest roda o `pitchy` com os filtros sobre eles (calibração e regressão). Acrescentar ao Gravador (ou a uma tela de depuração escondida) a exibição de `track.getSettings()`. O Opus a 64 kbps preserva a altura, mas conferir se o AGC ou o codec alteram o ataque.
3. **A tela "Qual nota é essa?"** na aba Afinador (nome grande, linha de transposições, frequência, ponteiro, cartão "Fixar o meu instrumento") e o `aria-live`.
4. **Opcionais:** pauta com a nota; e, mais adiante, **comparar o que se toca com a nota que a partitura pede naquele ponto** (ideia maior, a numerar quando virar ideia: seria a I-36).

## Critérios de aceitação (propostos; herdam os da I-13, etapa 2)

- O nome certo para tons puros de 58, 110, 440 e 1000 Hz, e para as gravações reais de cada instrumento.
- A nota **escrita** certa para cada transposição, com a oitava.
- O nome **não pisca** com uma nota a ±50 cents.
- Com silêncio, a tela descansa e diz "toque ou cante uma nota"; depois do fim da nota, a última fica esmaecida por ~1 s.
- O microfone só abre no toque em "Ouvir", fecha ao sair da aba, e a tela mostra que está ligado.
- Funciona com letra ampliada e no Alto contraste; o leitor de tela anuncia o nome por extenso.

## O que falta para fechar a I-35 (revisão de 2026-11-24)

**Decisões do responsável** (as sete perguntas abaixo, mais as três do pêndulo): a escala da trilha (±50 ou ±100 cents), o instrumento fixado mudar os nomes do centro e das pontas, e a bola sumir sem som.

**Pesquisa que falta**
- Afinadores de **Android** de uso comum e apps com um medidor de "vizinhas" (a nota de baixo, a atual e a de cima): só conheço os nomes, não verifiquei recursos.
- Apps de ensino que mostram a nota numa pauta enquanto se toca (para a etapa da pauta).

**Código, na ordem**
1. **Funções puras e testes** (`src/lib/afinador.ts`): nome da nota, oitava, vizinhas (abaixo e acima), cents com sinal, **histerese do nome**, transposição com oitava.
2. **Dependência `pitchy`:** ainda **não está no `package.json`**. Conferir de novo a licença no npm (MIT; o repositório diz 0BSD) e o tamanho (~2,8 KB) antes de adicionar.
3. **Calibração:** gravar no Gravador trompete, trombone (com o pedal), tuba, voz e órgão; os arquivos viram fixtures de um teste do detector (clareza, volume, mediana de ~200 ms, regra de oitava).
4. **O componente da trilha**, compartilhado com o Metrônomo se o desenho ficar igual, e a tela na aba Afinador, com o `role="meter"` e o `aria-live` limitado.
5. **Textos nos três idiomas** (nome da nota, vizinhas, "baixo", "alto", "afinado", "toque ou cante uma nota", o aviso de privacidade, o cartão "Fixar o meu instrumento" e os rótulos por instrumento).
6. **Teste de ponta a ponta com um tom conhecido:** o Chrome do e2e já roda com `--use-fake-device-for-media-stream`; a opção `--use-file-for-fake-audio-capture=tom.wav` do Chrome alimenta o microfone falso com um arquivo, o que permitiria conferir **o nome, os cents e a bola** com uma onda de 440 Hz (e a de 415,3 Hz). **A confirmar** que a opção funciona no Chrome do CI.
7. **Documentação:** `README.md` (recursos), `docs/teste-de-uso.md` (tarefas novas), `SECURITY.md` (o Afinador passa a usar o microfone) e mover a I-32 e a I-35 para as implementadas quando entregues.

**Teste no aparelho do responsável (não substituível)**
- Os valores de `track.getSettings()` (os filtros saem mesmo desligados?), o AGC em nota longa, a precisão do `pitchy` com os instrumentos reais, a tuba, o Bluetooth e a leitura com a igreja ou sala de ensaio ao fundo.

**Não será feito na v1 (decidido por enquanto):** pauta, reconhecimento de várias notas (acorde), afinação de referência diferente de 440 Hz e comparação com a nota da partitura (a futura I-36).

## Perguntas ao responsável

1. O **Dó central** é Dó3 ou Dó4 para vocês (convenção da oitava)?
2. **Quais instrumentos que transpõem** a orquestra usa de fato (para rotular as opções)?
3. O nome grande deve **congelar** (esmaecido) quando o som para?
4. A **pauta** vale a pena na primeira versão?
5. A escuta e o "dar o tom" podem ser **ao mesmo tempo com fone**, agora que a ponte `temFone` existe?
6. A **tuba** entra na v1 (janela de 4096 no grave) ou fica para depois?
7. A escuta é uma **terceira área** na aba Afinador ou **substitui** a escolha de nota?
8. **Instrumento fixado:** o nome grande e as pontas do pêndulo passam para a **nota que a pessoa lê** (a escrita)? Recomendo sim; o concerto vai para a linha pequena.
9. **Escala do pêndulo:** pontas em **±50 cents** (recomendado) ou **±100**?
10. **Sem som:** a bola **some** (recomendado) ou fica parada no centro esmaecida?

## Fontes (pesquisa de 2026-11-24)

- Lojas: [Pano Tuner](https://apps.apple.com/us/app/id348094874), [Cleartune](https://apps.apple.com/gb/app/id286799607), [APTuner](https://apps.apple.com/bb/app/aptuner/id6449228938), [Tuner - Chromatic Guitar Tuner](https://apps.apple.com/us/app/-/id1518293355), [TonalEnergy](https://apps.apple.com/us/app/tonalenergy-tuner-metronome/id497716362) (e o [guia do usuário](https://www.tonalenergy.com/tet-user-guide-ios) e a [avaliação no AppleVis](https://applevis.com/comment/121972)) e [Band Toolbox](https://apps.apple.com/us/app/band-toolbox/id1415584000?l=en): descrições das lojas, não testadas.
- [pitchy (GitHub)](https://github.com/ianprime0509/pitchy) e [no npm](https://www.npmjs.com/package/pitchy) (MPM, clareza de 0,8 a 1); [chordbook/tuner (GitHub)](https://github.com/chordbook/tuner), que usa o pacote com corte de 0,9.
- [Pitch detection algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Pitch_detection_algorithm): erros de oitava em métodos de autocorrelação.
- Microfone: [Disabling hardware noise suppression (Chrome)](https://developer.chrome.com/blog/disabling-hardware-noise-suppression/) (só macOS, não vale para o Android), [WebKit Bugzilla](https://bugs.webkit.org/show_bug.cgi?id=192932) e a discussão [discuss-webrtc](https://groups.google.com/g/discuss-webrtc/c/PDZYMzAI-_Y) (o `exact: false` no Chrome do Android).
- **Não verificado nesta rodada:** as listagens de Pano Tuner, Cleartune, APTuner e do afinador de violão; se o TonalEnergy existe para Android; os relatos do Chrome 124 e 126; o corte de 0,9 do chordbook/tuner; e a convenção de oitava usada nos métodos.
