// Teste de ponta a ponta do karaokê, num Chrome de verdade (headless e MUDO). Rodar: npm run test:e2e
//
// Sobe o servidor de desenvolvimento do Vite e um Chrome, entrega ao app um hino FICTÍCIO (por um `invoke` simulado
// do Tauri) e confere, na aba Letra: a sílaba acesa acompanha o tempo da sincronia, a pausa congela o destaque e
// desligar o botão apaga tudo. Depois confere a aba Partitura (I-08): quando aparece, o SVG embutido seguindo o tema, o zoom, a
// fonte Leipzig e o aviso para Ajustes. Precisa de um Chrome ou Chromium instalado (variável CHROME para indicar o caminho).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const PORTA_VITE = 5199;
const PORTA_CHROME = 9340;
const RAIZ = new URL("../../", import.meta.url).pathname;

// Hino fictício: 2 estrofes, 5 sílabas por estrofe, cada uma em 2 batidas, a 120 bpm (1 s por sílaba).
const SILABAS = [0, 2, 4, 6, 8];
const nota = (t, midi) => [t, 2, midi];
const hinario = {
  versao: 1,
  hinario: { id: "e2e", nome: "Teste e2e", idioma: "pt-BR" },
  hinos: [
    {
      numero: 999,
      titulo: "Hino fictício",
      andamento: 120,
      letra: ["1. do re mi", "fa sol", "", "2. la si do", "re mi"],
      vozes: ["Soprano", "Contralto", "Tenor", "Baixo"].map((nome, i) => ({
        nome,
        notas: SILABAS.map((t, k) => nota(t, 72 - i * 5 + (k % 2) * 2)),
      })),
      sincronia: {
        normal: [
          { estrofe: 1, linhas: [[[0, 0, 2], [2, 3, 5], [4, 6, 8]], [[6, 0, 2], [8, 3, 6]]] },
          { estrofe: 2, linhas: [[[0, 0, 2], [2, 3, 5], [4, 6, 8]], [[6, 0, 2], [8, 3, 5]]] },
        ],
      },
    },
    // Só letra e sem partitura: serve para conferir que a aba Partitura não aparece num hino sem ela.
    { numero: 998, titulo: "Hino só com letra", letra: ["1. la la", "la la"], vozes: [] }, // o Rust sempre envia `vozes` (lista vazia por padrão)
  ],
};
// Partitura FICTÍCIA (nada de hino real): cinco linhas de pauta, uma "nota" (elipse) e um texto na fonte Leipzig, com um id para
// conferir o prefixo e o <svg> aninhado com color="black" como o do Verovio. No app de verdade, quem entrega o SVG
// é o Rust, já limpo; aqui o `invoke` simulado devolve o que o Rust devolveria.
const SVG_PARTITURA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" overflow="hidden"><svg class="definition-scale" color="black" viewBox="0 0 400 120"><g id="bmccb-p-folha">${[20, 35, 50, 65, 80].map((y) => `<path d="M10 ${y} L390 ${y}"></path>`).join("")}<ellipse cx="60" cy="50" rx="10" ry="7"></ellipse><rect x="90" y="30" width="6" height="40"></rect><text x="120" y="110" font-family="Leipzig" font-size="30px">&#xE1D5; = 58</text></g></svg></svg>`;
// Sílabas esperadas na 1ª vez (estrofe 1) e na 2ª (estrofe 2), com o início de cada uma em batidas.
const ESPERADO_VEZ1 = [["do", 0], ["re", 2], ["mi", 4], ["fa", 6], ["sol", 8]];
const ESPERADO_VEZ2 = [["la", 0], ["si", 2], ["do", 4], ["re", 6], ["mi", 8]];
const BPM = 120;
const MS_POR_BATIDA = 60000 / BPM;
// A 2ª vez começa depois da 1ª (10 batidas) mais a pausa de 2 s (4 batidas a 120 bpm). Definido uma vez e usado por tudo.
const BATIDAS_ESTROFE = 10;
const PAUSA_BATIDAS = (2 * BPM) / 60;
const INICIO_VEZ2 = BATIDAS_ESTROFE + PAUSA_BATIDAS;

// `sessionStorage["e2e-sem-partituras"]` faz o app começar como se nenhum pacote com partituras tivesse sido importado.
const STUB = `window.__TAURI_INTERNALS__ = {
  invoke: async (cmd, args) => {
    if (cmd === "carregar_hinario") {
      const sem = sessionStorage.getItem("e2e-sem-partituras") === "1";
      return { hinario: ${JSON.stringify(hinario)}, exemplo: false, partituras: sem ? [] : [999] };
    }
    if (cmd === "ler_partitura") {
      if (args.numero === 999) return ${JSON.stringify(SVG_PARTITURA)};
      throw JSON.stringify(["sem_partitura", String(args.numero)]);
    }
    return null;
  },
  transformCallback: () => 0,
  metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
};`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const filhos = [];
let perfil = null;

// Encerra o processo e os filhos dele (o Chrome abre vários): sinal para o grupo de processos inteiro.
function encerrar(p, sinal) {
  try {
    if (process.platform === "win32") p.kill(sinal);
    else process.kill(-p.pid, sinal);
  } catch {
    /* já saiu */
  }
}

// O grupo de processos ainda tem alguém vivo? `kill(-pid, 0)` não envia nada: só falha com ESRCH quando o grupo
// esvaziou. O líder (o processo que o Node criou) pode sair antes dos filhos, então olhar só o `exit` dele não basta.
function grupoVivo(p) {
  if (process.platform === "win32") return p.exitCode === null;
  try {
    process.kill(-p.pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function aguardarGrupo(p, ms) {
  const fim = Date.now() + ms;
  while (grupoVivo(p) && Date.now() < fim) await dormir(100);
}

let limpando = null;
function limpar() {
  limpando ??= (async () => {
    for (const p of filhos) encerrar(p, "SIGTERM");
    // O Chrome ainda escreve na pasta do perfil ao sair: espera o grupo inteiro sumir (e, se demorar, força).
    await Promise.all(filhos.map((p) => aguardarGrupo(p, 4000)));
    for (const p of filhos) if (grupoVivo(p)) encerrar(p, "SIGKILL");
    await Promise.all(filhos.map((p) => aguardarGrupo(p, 2000)));
    apagarPerfil();
  })();
  return limpando;
}

// Com `detached: true` o Ctrl-C do terminal não chega mais aos filhos: sem isto, interromper o teste (ou cancelar o job)
// deixaria o Chrome e o Vite órfãos, e o Vite seguiria na porta 5199 e quebraria a próxima execução.
for (const [sinal, codigo] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(sinal, async () => {
    await limpar();
    process.exit(codigo);
  });
}

function apagarPerfil() {
  if (perfil) {
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (e) {
      // É só uma pasta temporária: não pode mudar o resultado do teste.
      console.warn(`aviso: não deu para apagar ${perfil}: ${e.code ?? e.message}`);
    }
  }
}

function acharChrome() {
  const candidatos = [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean);
  for (const c of candidatos) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error("Chrome ou Chromium não encontrado (defina CHROME com o caminho do executável)");
}

async function esperarUrl(url, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* ainda não subiu */
    }
    await dormir(300);
  }
  throw new Error(`não respondeu a tempo: ${url}`);
}

async function principal() {
  // 1. servidor de desenvolvimento
  // Chama o Vite direto pelo Node (com `npx` ele viraria processo neto e sobraria rodando ao fim do teste).
  const vite = spawn(
    process.execPath,
    [join(RAIZ, "node_modules/vite/bin/vite.js"), "dev", "--port", String(PORTA_VITE), "--strictPort", "--host", "127.0.0.1"],
    { cwd: RAIZ, stdio: "ignore", detached: true },
  );
  filhos.push(vite);
  await esperarUrl(`http://127.0.0.1:${PORTA_VITE}/`, 60000);

  // 2. Chrome mudo
  perfil = mkdtempSync(join(tmpdir(), "bmccb-e2e-"));
  const chrome = spawn(
    acharChrome(),
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required",
      "--window-size=412,915", `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORTA_CHROME}`, "about:blank"],
    { stdio: "ignore", detached: true },
  );
  filhos.push(chrome);
  await esperarUrl(`http://127.0.0.1:${PORTA_CHROME}/json/version`, 30000);

  // 3. protocolo de depuração do Chrome
  const alvos = await (await fetch(`http://127.0.0.1:${PORTA_CHROME}/json`)).json();
  const ws = new WebSocket(alvos.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let n = 0;
  const espera = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && espera.has(m.id)) espera.get(m.id)(m);
  };
  const enviar = (method, params = {}) =>
    new Promise((r) => {
      const id = ++n;
      espera.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const av = async (expressao) => {
    const r = await enviar("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };

  await enviar("Page.enable");
  await enviar("Runtime.enable");
  await enviar("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await enviar("Page.addScriptToEvaluateOnNewDocument", { source: STUB });
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/hino/999` });
  await esperarUrl(`http://127.0.0.1:${PORTA_VITE}/hino/999`, 30000);
  await dormir(7000); // primeira compilação das telas pelo Vite

  const falhas = [];
  const confere = (ok, msg) => {
    if (!ok) falhas.push(msg);
    console.log(`${ok ? "ok    " : "FALHOU"} ${msg}`);
  };

  // 4. toca o hino todo (aba Ouvir) e vai para a aba Letra
  const clicou = await av(`(() => {
    const b = [...document.querySelectorAll('#painel-ouvir button')].find(x => /hino todo|whole|todo/i.test(x.textContent));
    if (!b) return false; b.click(); return true; })()`);
  confere(clicou, 'botão "tocar o hino todo" encontrado e clicado');
  await dormir(500);
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(300);
  confere(await av("!!document.querySelector('.chave-karaoke')"), "botão Karaokê aparece (hino com sincronia)");

  // 5. amostra o destaque a cada 25 ms
  await av(`window.__am = []; window.__t0 = performance.now();
    window.__iv = setInterval(() => {
      const tr = document.querySelector('.trecho');
      const e = document.querySelector('.estrofe.da-vez h2');
      window.__am.push([Math.round(performance.now() - window.__t0), tr ? tr.textContent : null, e ? e.textContent : null]);
    }, 25); 1`);
  // A pausa é ancorada no que o teste OBSERVA, e não num tempo fixo (que dependeria de atrasos de início que ninguém mede):
  // espera a sílaba "re" da 2ª estrofe aparecer na amostragem e pede a pausa meia batida depois, no meio dela. Essa sílaba dura
  // 2 batidas (1 s); a "mi" só acende 1 s depois do início da "re". (Antes esperava 15 s, depois do fim da música, que dura 12 s:
  // a pausa nem era testada, pois já não havia nada aceso.)
  const estado = (x) => `${x[1]}|${x[2]}`;
  const eRe2 = (x) => x && x[1] === "re" && (x[2] ?? "").includes("2");
  let achouRe2 = false;
  for (let fim = Date.now() + 25000; Date.now() < fim && !achouRe2; ) {
    achouRe2 = eRe2(await av("window.__am.at(-1)"));
    if (!achouRe2) await dormir(25);
  }
  confere(achouRe2, 'a sílaba "re" da 2ª estrofe acendeu (a pausa é pedida no meio da música)');
  await dormir(MS_POR_BATIDA / 2);
  // Lê o instante, o último estado amostrado e clica na MESMA expressão: é o estado exato do momento da pausa.
  const pausa = await av(`(() => {
    const b = document.querySelector('.mini .acao');
    const antes = window.__am.at(-1);
    const ms = Math.round(performance.now() - window.__t0);
    if (b) b.click();
    return { botao: !!b, ms, antes };
  })()`); // pausa pelo miniplayer
  confere(pausa.botao, "botão de pausa do miniplayer encontrado e clicado");
  const msPausa = pausa.ms;
  confere(eRe2(pausa.antes), `o destaque no instante da pausa era a "re" da 2ª estrofe: ${JSON.stringify(pausa.antes?.slice(1))}`);
  await dormir(1500); // a "mi" acenderia 0,5 s depois do clique, se a pausa não congelasse
  const todas = await av("window.__am");
  // Tudo o que foi amostrado depois do clique (com 150 ms de acomodação) tem de ser exatamente o estado do instante da pausa.
  const depois = todas.filter((x) => x[0] >= msPausa + 150);
  const estados = [...new Set(depois.map(estado))];
  confere(depois.length >= 40, `amostras depois da pausa: ${depois.length} (esperado pelo menos 40, ~1 s)`);
  confere(
    estados.length === 1 && estados[0] === estado(pausa.antes),
    `a pausa congela o destaque no estado em que foi pedida (depois dela: ${JSON.stringify(estados)}; antes: ${JSON.stringify(estado(pausa.antes))})`,
  );
  // 5b. Slider de busca (avançar e retroceder). Usa o <input type="range"> como a pessoa usaria: muda o valor e solta (input + change).
  // Cada sílaba dura 1 s (2 batidas a 120 bpm), então o segundo inteiro escolhido cai no começo de uma sílaba, e o teste confere a
  // sílaba e a estrofe 0,7 s depois de continuar, no meio dela.
  const buscar = (seletor, s) =>
    av(`(() => {
      const i = document.querySelector(${JSON.stringify(seletor)});
      if (!i || i.disabled) return false;
      i.value = ${s};
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
  const lido = () =>
    av(`({
      tr: document.querySelector('.trecho')?.textContent ?? null,
      est: document.querySelector('.estrofe.da-vez h2')?.textContent ?? null,
      tocando: /pause|pausar/i.test(document.querySelector('.mini .acao')?.getAttribute('aria-label') ?? ''),
      valor: document.querySelector('.mini .busca-entrada')?.getAttribute('aria-valuetext') ?? null,
    })`);
  // A área de toque do slider do miniplayer tem de ficar DENTRO do miniplayer e livre dos outros controles: se invadisse a linha
  // dos botões e do link do hino ou a barra de abas, roubaria toques deles. Ele fica EM CIMA da linha dos botões (I-21): embaixo, o
  // dourado dele ficava a ~0,5rem do traço dourado da aba ativa e se confundia com a barra de abas. Com abas embaixo, ele tem de
  // ficar bem longe delas (pelo menos 2,5rem; no teste são ~3,5rem).
  const geo = await av(`(() => {
    const m = document.querySelector('.mini').getBoundingClientRect();
    const i = document.querySelector('.mini .busca-entrada').getBoundingClientRect();
    const cruza = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const outros = [...document.querySelectorAll('.mini .acao, .mini .info, [role="tablist"] [role="tab"]')].map((e) => e.getBoundingClientRect());
    const linha = document.querySelector('.mini .linha').getBoundingClientRect();
    const abas = document.querySelector('[role="tablist"]')?.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize); // as medidas do app são em rem; o navegador devolve px
    return {
      dentro: i.top >= m.top - 0.5 && i.bottom <= m.bottom + 0.5,
      livre: outros.every((r) => !cruza(i, r)),
      altura: Math.round(i.height),
      emCima: i.bottom <= linha.top + 0.5,
      distanciaDasAbas: abas && abas.top >= i.bottom ? Math.round(((abas.top - i.bottom) / rem) * 100) / 100 : null, // em rem; null: sem abas embaixo (barra lateral)
    };
  })()`);
  confere(geo.dentro && geo.livre && geo.altura >= 20, `a área de toque do slider do miniplayer fica dentro dele e não cobre outros controles: ${JSON.stringify(geo)}`);
  confere(geo.emCima, `o slider do miniplayer fica EM CIMA da linha dos botões: ${JSON.stringify(geo)}`);
  confere(geo.distanciaDasAbas === null || geo.distanciaDasAbas >= 2.5, `o slider fica longe da barra de abas (>= 2,5rem) para não se confundir com ela: ${geo.distanciaDasAbas}rem`);
  // Voltar com a música PAUSADA (estava na 2ª estrofe): vai para 0:03 e continua pausada.
  confere(await buscar(".mini .busca-entrada", 3), "slider do miniplayer encontrado e usado (voltar para 0:03 com a música pausada)");
  await dormir(600);
  let e = await lido();
  confere(!e.tocando, "voltar pelo slider com a música pausada mantém a pausa");
  confere((e.valor ?? "").startsWith("0:03"), `o slider mostra o ponto escolhido: ${JSON.stringify(e.valor)} (esperado 0:03 ...)`);
  await av("document.querySelector('.mini .acao')?.click(); 1"); // continua
  await dormir(700);
  e = await lido();
  confere(e.tocando, "continuar depois de voltar toca de novo");
  confere(e.tr === "fa" && (e.est ?? "").includes("1"), `a letra acompanha o ponto escolhido: ${e.tr} / ${e.est} (esperado fa / estrofe 1)`);
  // Avançar com a música TOCANDO: vai para 0:08 (a "si" da 2ª estrofe) e segue tocando.
  confere(await buscar(".mini .busca-entrada", 8), "slider do miniplayer: avançar para 0:08 com a música tocando");
  await dormir(700);
  e = await lido();
  confere(e.tocando, "avançar pelo slider com a música tocando segue tocando");
  confere(e.tr === "si" && (e.est ?? "").includes("2"), `a letra acompanha o ponto escolhido: ${e.tr} / ${e.est} (esperado si / estrofe 2)`);
  // O slider da aba Ouvir (o miniplayer some lá, porque os controles completos já estão visíveis).
  await av("document.getElementById('aba-ouvir').click(); 1");
  await dormir(400);
  confere(await buscar("#painel-ouvir .busca-entrada", 2), "slider da aba Ouvir encontrado e usado (voltar para 0:02)");
  await dormir(600);
  const tempoOuvir = await av("document.querySelector('#painel-ouvir .tempos span')?.textContent ?? null");
  confere(tempoOuvir === "0:02", `o tempo da aba Ouvir acompanha o slider: ${JSON.stringify(tempoOuvir)} (esperado "0:02")`);
  // O polegar NATIVO (transparente) tem de ter o mesmo tamanho do ponto desenhado: o toque e o arraste são mapeados por ele, e se
  // fosse menor o valor escolhido e o ponto divergiriam alguns pixels nas pontas. (O Chrome não informa o tamanho de um polegar
  // nativo pelo estilo, então a medida é de COMPORTAMENTO: com o passo livre, um toque exatamente no ponto que o desenho indicaria
  // para 10% da barra tem de escolher 10% do tempo.)
  const caixa = await av(`(() => {
    const e = document.querySelector('#painel-ouvir .busca-entrada');
    e.step = 'any';
    const r = e.getBoundingClientRect();
    const ponto = parseFloat(getComputedStyle(document.querySelector('#painel-ouvir .busca .ponto')).width);
    return { x: r.left + ponto / 2 + (r.width - ponto) * 0.1, y: r.top + r.height / 2, max: Number(e.max) };
  })()`);
  await enviar("Input.dispatchMouseEvent", { type: "mousePressed", x: caixa.x, y: caixa.y, button: "left", clickCount: 1 });
  const escolhido = Number(await av("document.querySelector('#painel-ouvir .busca-entrada').value"));
  await av("document.querySelector('#painel-ouvir .busca-entrada').step = '1'; 1");
  await enviar("Input.dispatchMouseEvent", { type: "mouseReleased", x: caixa.x, y: caixa.y, button: "left", clickCount: 1 });
  const fracaoEscolhida = escolhido / caixa.max;
  confere(Math.abs(fracaoEscolhida - 0.1) < 0.003, `o toque escolhe o ponto que o desenho indica (esperado 10%, escolheu ${(fracaoEscolhida * 100).toFixed(2)}%)`);
  // A barra tem de usar as cores do TEMA (`--ouro-linha` no preenchimento e no ponto, `--borda` na trilha), e não o azul do controle
  // nativo do sistema: as cores mudam em cada tema, então a conferência é contra as variáveis, não contra um valor fixo.
  const cores = await av(`(() => {
    const cor = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const fundo = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
    return { ouro: cor('var(--ouro-linha)'), borda: cor('var(--borda)'), preenchimento: fundo('#painel-ouvir .busca .preenchido'),
             ponto: fundo('#painel-ouvir .busca .ponto'), trilha: fundo('#painel-ouvir .busca .trilho') };
  })()`);
  confere(
    cores.preenchimento === cores.ouro && cores.ponto === cores.ouro && cores.trilha === cores.borda,
    `a barra de progresso usa as cores do tema (preenchimento e ponto = ouro-linha, trilha = borda): ${JSON.stringify(cores)}`,
  );
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(400);
  confere(
    (await av(`(() => { const e = document.querySelector('.mini .busca .preenchido'); return e ? getComputedStyle(e).backgroundColor : null; })()`)) === cores.ouro,
    "o fio do miniplayer usa o ouro-linha do tema",
  );
  await av("document.querySelector('.chave-karaoke')?.click(); 1"); // desliga
  await dormir(400);
  confere((await av("document.querySelectorAll('.trecho').length")) === 0, "com o botão desligado nada fica aceso");
  // Duas soltas seguidas (é o que a seta do teclado segurada faz): vale a ÚLTIMA. A segunda chega com o reagendamento da primeira
  // ainda em curso e não pode ser descartada em silêncio (a barra voltaria ao ponto antigo e a pessoa acharia que não funcionou).
  await av(`(() => {
    const i = document.querySelector('.mini .busca-entrada');
    for (const v of [2, 6]) {
      i.value = v;
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }
  })()`);
  await dormir(900);
  const aposDuas = await av("document.querySelector('.mini .busca-entrada')?.getAttribute('aria-valuetext') ?? null");
  confere((aposDuas ?? "").startsWith("0:06"), `duas soltas seguidas: vale a última (0:06): ${JSON.stringify(aposDuas)}`);
  // Corrida: soltar o slider e tocar em Parar logo em seguida, com o áudio ainda reagendando, tem de parar tudo e SEM aviso de
  // erro falso (antes, o reagendamento lia o hino que o Parar já tinha esquecido e mostrava uma falha de áudio que não existiu).
  const corrida = await av(`(() => {
    const i = document.querySelector('.mini .busca-entrada');
    const parar = [...document.querySelectorAll('.mini .acao')].at(-1);
    if (!i || !parar) return false;
    i.value = 5;
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.dispatchEvent(new Event("change", { bubbles: true }));
    parar.click();
    return true;
  })()`);
  confere(corrida, "slider solto e Parar tocado logo em seguida");
  await dormir(1200);
  confere(!(await av("!!document.querySelector('.mini')")), "Parar logo depois de soltar o slider para tudo (o miniplayer some)");
  confere(!(await av("!!document.querySelector('.aviso.erro')")), "Parar durante o reagendamento não mostra erro falso");
  // Aparência da letra (I-04): aumentar o tamanho e justificar mudam a letra na hora e ficam salvos no aparelho.
  const fonteAntes = await av("parseFloat(getComputedStyle(document.querySelector('.estrofe p')).fontSize)");
  const clicouAparencia = await av(`(() => {
    const botoes = [...document.querySelectorAll('#painel-letra .barra-letra button')];
    const por = (re) => botoes.find((b) => re.test(b.getAttribute('aria-label') ?? ''));
    const mais = por(/increase/i), justificar = por(/justify/i);
    if (!mais || !justificar) return false;
    mais.click();
    justificar.click();
    return true;
  })()`);
  confere(clicouAparencia, "controles de tamanho e alinhamento da letra encontrados e usados");
  await dormir(200);
  const aparencia = await av(`({
    fonte: parseFloat(getComputedStyle(document.querySelector('.estrofe p')).fontSize),
    alinha: getComputedStyle(document.querySelector('.letra')).textAlign,
    salvo: localStorage.getItem('prefs.letra'),
  })`);
  confere(aparencia.fonte > fonteAntes, `aumentar o tamanho cresce a letra: ${fonteAntes} → ${aparencia.fonte} px`);
  confere(aparencia.alinha === "justify", `justificar muda o alinhamento da letra: ${aparencia.alinha}`);
  confere(aparencia.salvo === '{"passo":2,"alinhamento":"justificado"}', `a escolha fica salva no aparelho: ${aparencia.salvo}`);
  // Alto contraste (I-06) com o aparelho no ESCURO: o escuro "do sistema" de cada estilo tem seletor mais específico (0,3,0) que o bloco
  // do modo (0,2,0) e o venceria se o :not(...) não o excluísse. Só um navegador de verdade confere isso (a cascata não é texto).
  await enviar("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
  const cascata = await av(`(() => {
    const r = document.documentElement;
    const v = (nome) => getComputedStyle(r).getPropertyValue(nome).trim();
    const saida = {};
    delete r.dataset.tema; delete r.dataset.estilo;
    saida.controleEscuro = v('--fundo'); // sem o modo, o aparelho no escuro tem de dar o escuro (prova que a emulação vale)
    for (const estilo of ['normal', 'pergaminho', 'marinho']) {
      if (estilo === 'normal') delete r.dataset.estilo; else r.dataset.estilo = estilo;
      r.dataset.tema = 'alto-contraste';
      saida[estilo] = [v('--fundo'), v('--texto'), v('--ouro')].join(' ');
    }
    delete r.dataset.tema; delete r.dataset.estilo;
    return saida;
  })()`);
  await enviar("Emulation.setEmulatedMedia", { features: [] });
  confere(cascata.controleEscuro === "#10151d", `controle: com o aparelho no escuro e sem o modo, vale o escuro normal: ${cascata.controleEscuro}`);
  for (const estilo of ["normal", "pergaminho", "marinho"]) {
    confere(cascata[estilo] === "#000000 #ffff00 #ffff00", `alto contraste vence o escuro do sistema no estilo ${estilo}: ${cascata[estilo]}`);
  }
  await av("clearInterval(window.__iv); 1");
  const am = await av("window.__am");

  // 5c. Aba Partitura (I-08), no hino 999 (que tem áudio e partitura): as abas são Ouvir, Letra e Partitura.
  const abas = await av("[...document.querySelectorAll('[role=\"tab\"]')].map((t) => t.id)");
  confere(JSON.stringify(abas) === '["aba-ouvir","aba-letra","aba-partitura"]', `hino com áudio e partitura: abas ${JSON.stringify(abas)}`);
  await av("document.getElementById('aba-partitura').click(); 1");
  await dormir(800);
  const p1 = await av(`(() => {
    const svg = document.querySelector('#painel-partitura .folha svg');
    const cor = (e, p) => getComputedStyle(e)[p];
    return {
      painelVisivel: !document.getElementById('painel-partitura').hidden,
      svg: !!svg,
      overflow: svg?.getAttribute('overflow') ?? null,
      id: svg?.querySelector('g')?.id ?? null,
      regiao: document.querySelector('#painel-partitura .rolagem')?.getAttribute('role') ?? null,
      foco: document.querySelector('#painel-partitura .rolagem')?.tabIndex ?? null,
      rotulo: document.querySelector('#painel-partitura .folha')?.getAttribute('aria-label') ?? null,
      larguraDaFolha: Math.round(document.querySelector('#painel-partitura .folha').getBoundingClientRect().width),
      larguraDaRegiao: Math.round(document.querySelector('#painel-partitura .rolagem').getBoundingClientRect().width),
      paginaLargaDemais: document.documentElement.scrollWidth > window.innerWidth,
      zoomSalvo: localStorage.getItem('prefs.partitura'),
    };
  })()`);
  confere(p1.painelVisivel && p1.svg, `a partitura aparece no painel da aba: ${JSON.stringify({ painelVisivel: p1.painelVisivel, svg: p1.svg })}`);
  confere(p1.overflow === "hidden" && (p1.id ?? "").startsWith("bmccb-p-"), `o SVG entregue tem overflow hidden e id com o prefixo do app: ${p1.overflow} / ${p1.id}`);
  confere(p1.regiao === "region" && p1.foco === 0 && (p1.rotulo ?? "").includes("999"), `a região que rola é focável pelo teclado e tem nome: ${p1.regiao} / tabIndex ${p1.foco} / ${p1.rotulo}`);
  confere(p1.larguraDaFolha <= p1.larguraDaRegiao + 1 && !p1.paginaLargaDemais, `a 100% a partitura cabe na tela, sem rolar de lado (folha ${p1.larguraDaFolha}, região ${p1.larguraDaRegiao})`);
  // A fonte Leipzig (embarcada no app) é carregada quando o SVG pede o texto nela.
  const fonte = await av(`(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.family.includes('Leipzig')).map((f) => f.status); })()`);
  confere(fonte.length === 1 && fonte[0] === "loaded", `a fonte Leipzig do app foi carregada: ${JSON.stringify(fonte)}`);

  // Cor pelo tema: cada tema dá a cor do texto aos traços e ao preenchimento (o SVG vem com color="black" no arquivo).
  const corDoTema = (tema, estilo = "normal") => av(`(() => {
    const r = document.documentElement;
    ${tema === null ? "delete r.dataset.tema;" : `r.dataset.tema = '${tema}';`}
    ${estilo === "normal" ? "delete r.dataset.estilo;" : `r.dataset.estilo = '${estilo}';`}
    const svg = document.querySelector('#painel-partitura .folha svg');
    const alvo = getComputedStyle(document.querySelector('#painel-partitura .folha')).color; // = var(--texto) do tema
    const traco = getComputedStyle(svg.querySelector('path')).stroke;
    const preench = getComputedStyle(svg.querySelector('rect')).fill;
    const texto = getComputedStyle(svg.querySelector('text')).fill;
    const fundo = getComputedStyle(document.querySelector('#painel-partitura .rolagem')).backgroundColor;
    delete r.dataset.tema; delete r.dataset.estilo;
    return { alvo, traco, preench, texto, fundo };
  })()`);
  for (const [tema, esperado] of [["claro", null], ["escuro", null], ["alto-contraste", "rgb(255, 255, 0)"]]) {
    const c = await corDoTema(tema);
    confere(
      c.traco === c.alvo && c.preench === c.alvo && c.texto === c.alvo && (esperado === null || c.alvo === esperado) && c.alvo !== c.fundo,
      `tema ${tema}: traço, preenchimento e texto da partitura têm a cor do texto do tema (${JSON.stringify(c)})`,
    );
  }
  const claro = await corDoTema("claro");
  const escuro = await corDoTema("escuro");
  confere(claro.alvo !== escuro.alvo && claro.fundo !== escuro.fundo, `claro e escuro dão cores diferentes à partitura: ${claro.alvo} no ${claro.fundo} / ${escuro.alvo} no ${escuro.fundo}`);

  // Zoom: 125% passa da largura da tela e rola de lado; o passo fica salvo; "restaurar" volta a 100%.
  const botoesZoom = await av(`[...document.querySelectorAll('#painel-partitura .barra-zoom button')].map((b) => b.getAttribute('aria-label'))`);
  confere(botoesZoom.length === 3, `a barra de zoom tem 3 botões: ${JSON.stringify(botoesZoom)}`);
  await av("document.querySelectorAll('#painel-partitura .barra-zoom button')[2].click(); 1");
  await dormir(200);
  const z1 = await av(`(() => {
    const r = document.querySelector('#painel-partitura .rolagem');
    return { rola: r.scrollWidth > r.clientWidth + 1, folha: document.querySelector('#painel-partitura .folha').getBoundingClientRect().width, regiao: r.clientWidth,
      salvo: localStorage.getItem('prefs.partitura'), dica: !!document.querySelector('#painel-partitura .dica'), pagina: document.documentElement.scrollWidth > window.innerWidth };
  })()`);
  confere(z1.rola && Math.abs(z1.folha / z1.regiao - 1.25) < 0.02, `125%: a folha fica ${(z1.folha / z1.regiao).toFixed(2)}x a região e rola de lado`);
  confere(z1.salvo === '{"zoom":1}' && z1.dica && !z1.pagina, `o zoom fica salvo, aparece a dica de arrastar e só a região rola (a página não): ${JSON.stringify({ salvo: z1.salvo, dica: z1.dica, pagina: z1.pagina })}`);
  await av("document.querySelectorAll('#painel-partitura .barra-zoom button')[1].click(); 1");
  await dormir(200);
  const z0 = await av(`(() => { const r = document.querySelector('#painel-partitura .rolagem'); return { rola: r.scrollWidth > r.clientWidth + 1, salvo: localStorage.getItem('prefs.partitura') }; })()`);
  confere(!z0.rola && z0.salvo === '{"zoom":0}', `restaurar volta a 100% sem rolar de lado: ${JSON.stringify(z0)}`);

  const abrirHino = async (numero) => {
    await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/hino/${numero}` });
    for (let fim = Date.now() + 20000; Date.now() < fim; ) {
      await dormir(250);
      if (await av(`!!document.querySelector('#painel-letra .estrofe p')`)) return true;
    }
    return false;
  };

  // Hino sem partitura num pacote que tem partituras: não há aba Partitura (e, sem áudio, nenhuma barra de abas).
  confere(await abrirHino(998), "hino 998 carregado (a letra apareceu)");
  const h998 = await av(`({ abas: [...document.querySelectorAll('[role="tab"]')].map((t) => t.id), painel: !!document.getElementById('painel-partitura'), barra: !!document.querySelector('[role="tablist"]') })`);
  confere(!h998.painel && h998.abas.length === 0 && !h998.barra, `hino sem partitura, num pacote com partituras: sem aba Partitura: ${JSON.stringify(h998)}`);

  // Nenhum pacote com partituras importado (partituras = []): a aba aparece com o aviso e o botão para Ajustes.
  await av("sessionStorage.setItem('e2e-sem-partituras', '1'); 1");
  confere(await abrirHino(998), "hino 998 carregado de novo, sem partituras importadas");
  await av("document.getElementById('aba-partitura')?.click(); 1");
  await dormir(400); // o Svelte atualiza o DOM depois do clique
  const aviso = await av(`(() => {
    const aba = document.getElementById('aba-partitura');
    if (!aba) return { aba: false };
    const a = document.querySelector('#painel-partitura .sem-pacote a');
    return { aba: true, abas: [...document.querySelectorAll('[role="tab"]')].map((t) => t.id), href: a?.getAttribute('href') ?? null, botao: a?.classList.contains('botao') ?? false,
      svg: !!document.querySelector('#painel-partitura svg'), visivel: !document.getElementById('painel-partitura').hidden };
  })()`);
  confere(aviso.aba && aviso.href === "/ajustes" && aviso.botao && !aviso.svg && aviso.visivel, `sem pacote com partituras: a aba aparece com o aviso e o botão para Ajustes: ${JSON.stringify(aviso)}`);
  await av("sessionStorage.removeItem('e2e-sem-partituras'); 1");
  ws.close();

  // 6. análise: trocas de sílaba antes da pausa
  const trocas = [];
  let ant = null;
  for (const [ms, tr, est] of am) {
    if (ms >= msPausa - 50) break;
    if (tr !== null && tr !== ant) trocas.push({ ms, tr, est });
    ant = tr ?? ant;
  }
  const alvo = [...ESPERADO_VEZ1.map(([tr, b]) => ({ tr, b, est: "1" })), ...ESPERADO_VEZ2.map(([tr, b]) => ({ tr, b: INICIO_VEZ2 + b, est: "2" }))];
  const obs = trocas.slice(0, alvo.length);
  console.log("trocas (ms desde o início da amostragem):", obs.map((o) => `${o.ms} ${o.tr}`).join(" | "));
  console.log("esperado (batidas):", alvo.map((a) => `${a.b} ${a.tr}`).join(" | "));
  confere(obs.length >= 8, `trocas de sílaba observadas até a pausa: ${obs.length} (esperado pelo menos 8)`);
  confere(obs.every((o, i) => o.tr === alvo[i].tr), `sílabas na ordem certa: ${obs.map((o) => o.tr).join(" ")}`);
  confere(obs.every((o, i) => (o.est ?? "").includes(alvo[i].est)), "a estrofe acesa é a 1 na 1ª vez e a 2 na 2ª");
  // A 1ª sílaba já estava acesa quando a amostragem começou (o tempo dela está cortado), então a referência dos
  // intervalos é a 2ª troca.
  let maior = 0;
  for (let i = 2; i < obs.length; i++) maior = Math.max(maior, Math.abs(obs[i].ms - obs[i - 1].ms - (alvo[i].b - alvo[i - 1].b) * MS_POR_BATIDA));
  confere(maior <= 120, `maior desvio entre trocas: ${Math.round(maior)} ms (limite 120 ms)`);
  const k = obs.length - 1;
  const deriva = obs[k].ms - obs[1].ms - (alvo[k].b - alvo[1].b) * MS_POR_BATIDA;
  confere(Math.abs(deriva) <= 200, `deriva acumulada em ${k - 1} trocas: ${Math.round(deriva)} ms (limite 200 ms)`);

  console.log(falhas.length === 0 ? "\nE2E do karaokê: OK" : `\nE2E do karaokê: ${falhas.length} falha(s)`);
  return falhas.length === 0 ? 0 : 1;
}

let codigo = 1;
try {
  codigo = await principal();
} catch (e) {
  console.error("erro no teste:", e.message ?? e);
} finally {
  await limpar();
}
process.exit(codigo);
