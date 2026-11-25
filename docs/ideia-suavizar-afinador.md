# Ideia: suavizar o movimento do "Qual nota é essa?" (rascunho revisado, I-41)

**Status:** rascunho **revisado** (2026-11-25): revisado por um subagente Opus 5 e conferido de novo contra o código. Nada foi implementado. Separo o que foi **conferido no código** e **lido na pesquisa** do que é **proposta minha**. **Não medi nada no aparelho**: os números abaixo são pontos de partida, e só o seu celular com o seu trompete diz o certo.

## O pedido (2026-11-25, do responsável)

No "Qual nota é essa?" a bola e os números se movem **rápido demais**, o mesmo problema que a barra do gravador teve. Sugerir como suavizar, sem saber se a solução da barra serve ou se tem de ser outra.

**Dívida do I-35:** o rascunho do I-35 já prometia "o número de cents é **suavizado**" (`ideia-detectar-nota-tocada.md`), e isso **não foi feito** na primeira versão. O I-41 paga essa dívida.

## Como é hoje (conferido no código)

Do microfone à tela, em ordem:

| Etapa | Onde | Valor |
|---|---|---|
| Janela de áudio | `detector.ts` (`JANELA`) | 4096 amostras (~85 ms a 48 kHz) |
| Leitura | `escuta.ts` (`PASSO_MS`) | uma a cada **50 ms** (20 por segundo) |
| Corte | `detector.ts` | clareza ≥ 0,9; volume ≥ 0,01; 30 a 2100 Hz |
| **Mediana** | `Estabilizador` (`JANELA_MEDIANA_MS`) | **200 ms**: a poda é `agora − t ≤ 200` e a leitura nova entra depois, então a janela guarda **4 a 5 leituras** |
| Regra de oitava | `Estabilizador` (`CONFIRMAR_SALTO`) | salto de ~1000 cents só vale depois de **5 leituras** seguidas (conta leituras, e não tempo) |
| Histerese do nome | `leituraComHisterese` (`HISTERESE_CENTS`) | o nome só muda a 60 cents da nota atual |
| Congelar | `Estabilizador` (`CONGELAR_MS`) | a última nota fica esmaecida por 1 s; **devolve a mesma `leitura`** de antes |
| **Tela** | `QualNota.svelte` | a bola (`left`), o número, o `aria-valuenow`/`aria-valuetext` e a palavra vêm **direto** de `leitura.cents`; `estado` é um objeto novo a **cada ~50 ms** (até em silêncio); **sem suavização e sem transição** |

Tudo antes da tela já estabiliza **qual nota** é; **nada** estabiliza **onde a bola fica** nem **o número**. O vibrato, o ruído do microfone e a oscilação normal de uma nota de metal chegam ao olho como tremor.

## A solução da barra do gravador tem duas metades

1. **O filtro no código:** `suavizarBarra` (`gravador.ts`) sobe 60% do caminho e cai 12% por passo. É **assimétrica**: boa para um **nível de volume** (nunca negativo; o ataque precisa aparecer na hora). Os **cents têm sinal e são simétricos**: a bola deve reagir igual dos dois lados. Também calcula **por passo**, sem olhar o tempo. **Esta metade não serve ao afinador.**
2. **A transição de CSS:** `.nivel { transition: width var(--duracao) linear }` (`movimento.css`), com uma leitura a cada 80 ms; a barra de progresso faz o mesmo (`.preenchido`, 220 ms). **Esta metade serve**: é ela que faz o movimento parecer **fluido** entre uma leitura e outra. Uma média exponencial **só no código** moveria a bola em **degraus** a ~20 por segundo (até ~28% do salto por passo com `τ` = 150 ms): treme menos, mas não fica fluida.

## Pesquisa (2026-11-25, só web; não testei os apps)

- **Afinadores comuns** (Wikipedia, lojas e fabricantes): fora os de estroboscópio, os afinadores eletrônicos **calculam a média do tom sobre vários ciclos** para alimentar o visor; o ponteiro ainda **oscila**, e a menor divisão costuma ser 1 cent.
- **Atualizar mais vezes ajuda** (um comentário no código de um afinador de pedal aberto, o GuitarPedal; **não é um estudo**): analisar com mais frequência em janelas deslizantes dá uma **suavização natural**, sem reduzir a latência total.
- **Mediana sobre o vibrato** (uma ferramenta de transcrição vocal): uma janela de mediana de **meio ciclo** de vibrato (4 a 8 Hz) é uma escolha comum **ali**. É um projeto de pitch de **voz**, e não uma especificação de afinador; e uma mediana de meio ciclo **atrasa e achata o pico**, mas **não** remove o vibrato.
- **Média exponencial (EMA) independente do tempo:** `alfa = 1 − exp(−dt/τ)` é o peso do valor novo e não depende da taxa de quadros. Há duas convenções, uma o complemento da outra (`exp(−dt/τ)` é o quanto se **mantém** do antigo); `expm1` dá mais precisão quando `dt ≪ τ`.
- **Não achei** fonte que dê a **constante de tempo, a taxa de atualização ou o amortecimento** certos para um afinador. **Esses números são palpite meu.**

## Proposta

O detector e a escolha da nota **não mudam**. Muda só o que é mostrado.

### 1. Um suavizador puro com estado (`SuavizadorDeCents`)

Uma classe pura, com o relógio injetado, chamada logo depois de `estabilizador.entrar(agora, …)` **com o mesmo `agora`** (ou dentro do próprio `Estabilizador`, que já conhece troca de nota, silêncio e congelamento: decidir na implementação; as duas são testáveis). Regras:

- **EMA simétrica com o tempo real:** `alfa = 1 − exp(−ms/τ)`, `novo = anterior + alfa × (atual − anterior)`; `ms` vem do relógio, e não de "1 passo".
- **Primeiro valor:** o valor cru.
- **Zerar (saltar) quando o `midi` que soa muda** e quando o som volta depois do silêncio. Tem de ser o `midi` **que soa** (`leitura.midi`), e **não** a nota escrita: trocar de instrumento muda a nota escrita sem mexer nos cents.
- **Segurar (não andar) no estado "congelada"** e no quadro suspeito de **erro de oitava**: nesses dois casos o `Estabilizador` devolve **a mesma `leitura`** de antes, e uma EMA alimentada com ela **deslizaria** a bola, esmaecida, até o valor bruto antigo por até 1 s. O `Estabilizador` passa a marcar o `Estado` como **repetido** (um campo), e o suavizador segura.
- **A zona entre 50 e 60 cents:** o nome ainda não trocou (a histerese é 60), os cents vão a ±60 e a bola fica **presa na ponta** da trilha; a EMA converge para +55 com a bola parada: sem problema. Passando de 60 a leitura vira ~−40 e o `midi` muda: zera.
- **`ms` inválido** (≤ 0, NaN): `alfa = 0` (segura o valor). **`ms` enorme:** `alfa → 1` sozinho.

A constante **`TAU_MS`** fica num lugar só. Tempo para a bola chegar a 90% de um salto (`≈ 2,3 × τ`), e a latência **total** (a mediana atrasa uns **100 ms** e a EMA soma `τ`):

| τ | 90% só da EMA | **Total** (≈ 100 ms + 2,3 τ) | Sensação esperada (**suposição**) |
|---|---|---|---|
| 100 ms | ~230 ms | ~330 ms | ainda nervosa, só tira o tremor fino |
| 150 ms | ~345 ms | ~445 ms | **ponto de partida que eu escolheria** |
| 250 ms | ~575 ms | ~675 ms | calma, com atraso perceptível |
| 400 ms | ~920 ms | ~1020 ms | "pesada": parece travada ao afinar |

Mais suave também é mais **atrasado**: quem afina precisa ver o sentido da correção a tempo.

**O vibrato:** um filtro de 1ª ordem com `τ` = 150 ms deixa passar só ~17% de um vibrato de 6 Hz (`1/√(1+(2π·6·0,15)²)`) e **centra na média dos cents**, que é o que importa para afinar. (A faixa de 4 a 8 Hz é de **voz**; o vibrato do trompete não foi medido.)

### 2. Uma transição curta e linear só na bola, no `movimento.css`

~50 a 60 ms (o passo da leitura), `linear`, só na bola do afinador (uma classe própria, **sem afetar o Metrônomo**, cuja bola é desenhada a cada quadro), **dentro de `@media (prefers-reduced-motion: no-preference)`** e com `var(--duracao)`, como o `.nivel`. O verificador do CI (`tools/verificar-movimento.py`) **exige** isso: transição só em `movimento.css`. Efeito: **"reduzir movimento" fica resolvido de graça**: quem pediu menos movimento vê a bola em degraus, sem `matchMedia` e sem um segundo caminho no código. E a EMA **reduz** movimento: desligá-la para essa pessoa seria o contrário do que ela quer.

### 3. O número calmo, sem segundo relógio

- **Zona morta:** o número mostrado só troca se `|suave − mostrado| ≥ 1,5 cent`. Mantém a resolução de 1 cent, **não precisa de relógio** e cai sozinha a cada leitura. (A versão anterior do rascunho propunha "arredondar de 2 em 2 e atualizar 4 vezes por segundo"; a revisão mostrou que isso esconde o "+3" e exige um segundo relógio.)
- **O leitor de tela recebe o mesmo valor mostrado:** `aria-valuenow` e `aria-valuetext` vêm do **valor calmo**, e não do cru (hoje o texto visível e o do leitor são iguais, e continuam iguais). Hoje o `aria-valuenow` muda a cada cent, quase 20 vezes por segundo com ruído.

### 4. A palavra "afinado" / "baixo" / "alto"

Calculada a partir dos **cents calmos**, com o **limite único de ±5** de hoje: boa parte do pisca-pisca some sem estado novo. **Não** entra a histerese "entra a ±5, sai a ±8" na primeira versão: a **faixa desenhada na trilha** tem ±5 fixos (`.faixa { left: 45%; width: 10% }`), e com histerese a bola poderia estar a +7, **fora** da faixa, com a palavra dizendo "afinado". Se ainda piscar, uma histerese estreita (5 e 6) **ou** alargar a faixa junto. O `$effect` do anúncio dispara quando a palavra muda, então uma palavra que pisca faz o leitor de tela alternar "afinado" e "alto": calmar os cents já ajuda aí.

### O que fica **fora** da primeira versão

- **A mediana de 300 ms.** O custo certo é **~50 ms a mais só numa troca de nota sem pausa** (a janela passa de 4 a 5 leituras para 6 a 7: a mediana troca com 4 novas em vez de 3), e **não** "100 ms na primeira nota" (como dizia a versão anterior: depois do silêncio a janela está vazia e a primeira nota **não paga nada**). E ela é **desnecessária**: a EMA já centra o vibrato, e a janela do `pitchy` (85 ms) já faz a média de meio ciclo. Entra **só se o teste no aparelho pedir**. **Atenção:** o `CONFIRMAR_SALTO` conta **leituras** e não tempo; se o passo da leitura mudar (25 ms), a regra de oitava passa de 250 para 125 ms sem ninguém notar: converter para ms se isso mudar.
- **Ler com passo de 25 ms** (janela deslizante): não é necessário; a transição de CSS dá o mesmo efeito visual sem dobrar a CPU do `pitchy`.
- **Mudar o detector** (janela, clareza): não é isso que incomoda.

## Testes (propostos)

Funções puras, no Vitest, com o relógio injetado:
- **Convergência:** um degrau de 0 a 40 cents chega a ~63% em `τ` e a ~90% em `2,3 τ`; **sem passar do valor** e **simétrico** (o degrau para −40 é o espelho).
- **Independência da taxa:** passos de 50 e de 25 ms dão o mesmo resultado no mesmo instante **para uma entrada constante** (um degrau); com a entrada variando, não é igual (dizer isso no teste).
- **`ms` inválido** (0, negativo, NaN): segura; **enorme:** salta para o valor novo.
- **Zerar** na troca do `midi` que soa e na volta do silêncio; **não** zerar ao trocar de instrumento (a nota escrita muda, o `midi` não).
- **Segurar** em "congelada" e no quadro suspeito de oitava (a bola não anda, esmaecida).
- **Zona morta do número:** oscilando em volta de um valor, o número não pisca.
- **A palavra** a partir dos cents calmos: oscilando em volta de ±5 pisca **menos** do que a crua (comparar os dois).
- **Regressão do detector:** o campo "repetido" no `Estado` não muda o que os testes atuais esperam.

Nada disso substitui **olhar e ouvir no aparelho**: o e2e do CI não tem um som real.

## Como escolher os números (o ponto que só o aparelho resolve)

1. A primeira versão sai com **`τ` = 150 ms**, a **zona morta de 1,5 cent** e a **transição de ~60 ms**.
2. Você testa com o trompete (nota sustentada, vibrato, troca de nota sem pausa, silêncio) e diz se a bola ficou **nervosa**, **pesada** ou **boa**.
3. Ajustamos as constantes (são três números, num lugar só) e geramos outro APK. **Um valor fixo por APK basta**: um seletor escondido viraria configuração (o desenho do I-35 era "zero configuração").

## Etapas sugeridas

1. **`SuavizadorDeCents`** (puro, com o relógio injetado) e o campo "repetido" no `Estado`, **com os testes**.
2. **Na tela:** a bola, o número (zona morta), `aria-valuenow`/`aria-valuetext` e a palavra passam a vir **dos cents calmos**; a transição de ~60 ms no `movimento.css` (no bloco `no-preference`).
3. **APK de teste** e a rodada de ajuste dos números com o seu trompete.
4. **Só se o aparelho pedir:** a mediana maior e uma histerese estreita na palavra.

## Perguntas ao responsável

1. **O que mais incomoda:** a bola tremendo para os lados **dentro da mesma nota**, o **número piscando** ou a bola **pulando** na troca de nota? (A EMA com a transição trata os dois primeiros; zerar na troca trata o terceiro.)
2. **O leitor de tela deve receber o valor calmo** (o mesmo da tela)? **Recomendo que sim.**
3. A **primeira nota depois do silêncio** pode aparecer com o valor cru (sem suavizar) e só então acalmar? (Proposta: sim; é o que dá resposta rápida.)
4. A **zona morta de 1,5 cent** no número serve, ou prefere ver o cent exato (mais nervoso)?
5. **Um valor fixo por APK** (e a gente troca) está bem para a rodada de teste?

## Fontes (pesquisa de 2026-11-25)

- Afinadores: [Wikipedia, afinador eletrônico](https://en.wikipedia.org/wiki/Electronic_tuner); [Thomann, tipos de visor](https://www.thomannmusic.com/onlineexpert_page_tuners_display_types.html); o comentário sobre janelas deslizantes está no código do afinador do [GuitarPedal](https://github.com/torvalds/GuitarPedal) (código aberto; **um comentário no código, não um estudo**).
- Média exponencial independente do tempo: [Improved lerp smoothing](https://howlingmoonsoftware.com/improved-lerp-smoothing/); [Dr. Dobb's, discontiguous exponential averaging](https://drdobbs.com/tools/discontiguous-exponential-averaging/184410671?pgno=4); [Variable and fixed interval exponential smoothing (arXiv)](https://arxiv.org/pdf/1502.03465); [Wikipedia, exponential smoothing](https://en.wikipedia.org/wiki/Exponential_smoothing).
- Mediana e vibrato: [UltraSinger, janela da mediana](https://github.com/MrDix/UltraSinger/pull/65) (um projeto de pitch de voz, **fonte fraca**).
- **Não verificado:** as constantes (τ, a zona morta, a duração da transição) **não vêm de nenhuma fonte**; o que é "agradável" num afinador; a faixa do vibrato do trompete; a causa exata do tremor (ruído de medida, embocadura ou vibrato: **não medida**); o custo de CPU de ler a 25 ms; qualquer medida no aparelho do responsável.
