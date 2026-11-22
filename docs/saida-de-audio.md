# Saída de áudio

Em **Ajustes → Saída de áudio** a pessoa escolhe o modo do `AudioContext` para a saída em uso. Existe porque o som sintetizado (calculado na hora) pode **estalar**, e quanto
estala depende de **por onde o som sai**.

## Por que por rota

Todo celular tem um conversor de áudio. Sem a entrada de fone de 3,5 mm (a maioria hoje), o som sai **digital pela USB-C** e o conversor fica **no cabo ou adaptador**.
Cada rota tem o seu buffer: alto-falante, fone com fio, USB-C e Bluetooth. Um buffer maior **piorou** os estalos no fone USB-C do autor (APK 068), então não existe uma regra
segura para todos: a escolha é da pessoa e é **guardada por rota** (`prefs.saida-audio`, por exemplo `{"usb":"estavel"}`; só o que sai do padrão é guardado).

## Modos

| Modo | `AudioContext` | Para quê |
|---|---|---|
| Automático (padrão) | sem opções | o que o app sempre fez |
| Mais estável | `latencyHint: "playback"` | buffer maior: menos chance de estalar, um pouco mais de atraso |
| Menor atraso | `latencyHint: "interactive"` | buffer menor: responde mais rápido, mais chance de estalar |

O navegador pode tratar o `latencyHint` como um simples pedido (no Chrome do Android a latência base já ficou parada em cerca de 87 ms qualquer que fosse a dica).
Por isso o cartão mostra o que **valeu**: taxa de amostragem, `baseLatency` e `outputLatency` (alguns aparelhos não informam o segundo: aparece "não informado") do
**último contexto criado**, que o hino, o metrônomo e o afinador criam pelo mesmo ponto (`criarContexto()` em `src/lib/saidaAudio.ts`).

## Como funciona

- **Android (`PonteServico.rotaDeSaida()`):** olha as saídas ligadas (`AudioManager.getDevices`) e devolve `usb` (fone ou dispositivo USB), `fio` (3,5 mm), `bluetooth`
  (A2DP, SCO ou BLE) ou `alto-falante`. Com várias ligadas, vale essa ordem. Fora do Android, ou num APK sem a função, o app trata como alto-falante.
- **`src/lib/saidaAudio.ts`:** rota, modos, preferências validadas ao ler, `criarContexto()` (cai no contexto padrão se o navegador recusar a opção: o som nunca deixa de
  tocar por causa disto) e a chave `rota:modo`.
- **Sintetizador:** guarda a chave com que o contexto nasceu; ao trocar de saída ou de modo, **fecha o contexto velho** (as ondas e os instrumentos gravados nasceram nele) e
  cria outro antes do próximo hino. O metrônomo e o afinador criam o contexto a cada uso e já nascem com a escolha.
- A mudança vale no **próximo som** que tocar (não troca o contexto no meio de um hino).

## Verificar no aparelho

1. Ligue o fone, abra Ajustes → Saída de áudio e confira a rota (USB-C, fio, Bluetooth, alto-falante).
2. Toque um hino sintetizado e volte ao cartão: aparecem a taxa e os atrasos medidos.
3. Troque o modo, toque de novo e compare o estalo e os números. Cada rota guarda o seu modo.

Ideia ainda não feita: fixar a taxa em 48 kHz (a do mixer do Android), caso a conversão de taxa seja a causa; só vale se os modos não resolverem.
