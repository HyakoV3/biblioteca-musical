// Teste de ponta a ponta do karaokê, num Chrome de verdade (headless e MUDO). Rodar: npm run test:e2e
//
// Sobe o servidor de desenvolvimento do Vite e um Chrome, entrega ao app um hino FICTÍCIO (por um `invoke` simulado
// do Tauri) e confere, na aba Letra: a sílaba acesa acompanha o tempo da sincronia, a pausa congela o destaque e
// desligar o botão apaga tudo. Depois confere a aba Partitura (I-08): quando aparece, o SVG embutido seguindo o tema, o zoom, a
// fonte Leipzig e o aviso para Ajustes. Precisa de um Chrome ou Chromium instalado (variável CHROME para indicar o caminho).
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
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
      // Karaokê da partitura (I-12, fase B): 3 compassos na vez normal (de 4, 4 e 2 batidas; as batidas são as da vez, de 0 a 10).
      compassos: { normal: [[0, 0], [4, 1], [8, 2]] },
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
const SVG_PARTITURA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" overflow="hidden"><svg class="definition-scale" color="black" viewBox="0 0 400 120"><g id="bmccb-p-folha">${[20, 35, 50, 65, 80].map((y) => `<path d="M10 ${y} L390 ${y}"></path>`).join("")}<ellipse cx="60" cy="50" rx="10" ry="7"></ellipse><rect x="90" y="30" width="6" height="40"></rect><text x="120" y="110" font-family="Leipzig" font-size="30px">&#xE1D5; = 58</text>${[10, 130, 250].map((x, i) => `<g class="measure" id="bmccb-p-m${i}"><path d="M${x} 20 L${x} 80"></path><path d="M${x + 120} 20 L${x + 120} 80"></path></g>`).join("")}</g></svg></svg>`;
// A versão de paisagem é outro desenho (marcado com data-largo, para saber qual foi entregue).
const SVG_PARTITURA_PAISAGEM = SVG_PARTITURA.replace('id="bmccb-p-folha"', 'id="bmccb-p-folha" data-largo="1"');
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
    if (cmd === "remover_partituras") {
      window.__removeu = (window.__removeu ?? 0) + 1;
      sessionStorage.setItem("e2e-sem-partituras", "1"); // depois de remover, o Rust devolve o pacote sem partituras
      return { hinario: ${JSON.stringify(hinario)}, exemplo: false, partituras: [] };
    }
    if (cmd === "ler_partitura") {
      (window.__leituras = window.__leituras ?? []).push(args.paisagem === true); // cada leitura, com a versão pedida
      if (args.numero === 999) {
        // "e2e-falha-partitura": a PRÓXIMA leitura falha (um erro do Rust), e as seguintes dão certo.
        if (sessionStorage.getItem("e2e-falha-partitura") === "1") {
          sessionStorage.removeItem("e2e-falha-partitura");
          throw JSON.stringify(["ler", "falha simulada"]);
        }
        return args.paisagem === true ? ${JSON.stringify(SVG_PARTITURA_PAISAGEM)} : ${JSON.stringify(SVG_PARTITURA)};
      }
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

  // 4. A aba Letra tem de existir e mostrar o botão do karaokê antes de a música começar.
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(300);
  confere(await av("!!document.querySelector('.chave-karaoke')"), "botão Karaokê aparece (hino com sincronia)");
  await av("document.getElementById('aba-ouvir').click(); 1");
  await dormir(300);

  // 5. Amostra o destaque a cada 25 ms ANTES de a música começar, e só então toca e abre a aba Letra, no mesmo instante. Assim a 1ª sílaba ("do",
  // que dura 1 s) é vista por inteiro mesmo num servidor lento: antes, o teste tocava, esperava 0,8 s e só depois começava a amostrar, e com
  // mais de ~0,3 s de atraso (CI carregado) perdia o "do" e falhava a ordem das sílabas, sem nada ter quebrado no app.
  await av(`window.__am = []; window.__t0 = performance.now();
    window.__iv = setInterval(() => {
      const tr = document.querySelector('.trecho');
      const e = document.querySelector('.estrofe.da-vez h2');
      window.__am.push([Math.round(performance.now() - window.__t0), tr ? tr.textContent : null, e ? e.textContent : null]);
    }, 25); 1`);
  const clicou = await av(`(() => {
    const b = [...document.querySelectorAll('#painel-ouvir button')].find(x => /hino todo|whole|todo/i.test(x.textContent));
    if (!b) return false; b.click(); document.getElementById('aba-letra').click(); return true; })()`);
  confere(clicou, 'botão "tocar o hino todo" encontrado e clicado (e a aba Letra aberta no mesmo instante)');
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
  // Sem linha separando o miniplayer do resto do app: a divisa é a trilha do slider, no topo dele (pedido do responsável: mais elegante).
  const semLinha = await av(`(() => {
    const m = document.querySelector('.mini');
    const c = getComputedStyle(m);
    const trilho = m.querySelector('.trilho').getBoundingClientRect();
    return { bordaTopo: c.borderTopWidth, bordas: [c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth], topoDaTrilha: Math.round(((trilho.top - m.getBoundingClientRect().top) / parseFloat(getComputedStyle(document.documentElement).fontSize)) * 100) / 100, // em rem
      larguraDaTrilha: Math.round(trilho.width), larguraDoMini: Math.round(m.getBoundingClientRect().width) };
  })()`);
  confere(semLinha.bordaTopo === "0px" && semLinha.bordas.every((b) => b === "0px"), `o miniplayer não tem borda (sem linha de separação): ${JSON.stringify(semLinha)}`);
  confere(semLinha.larguraDaTrilha === semLinha.larguraDoMini && semLinha.topoDaTrilha <= 0.55, `a trilha do slider faz a divisa: largura toda do miniplayer e logo no topo (${semLinha.topoDaTrilha}rem do topo): ${JSON.stringify(semLinha)}`);
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
  const botoesZoom = await av(`[...document.querySelectorAll('#painel-partitura .controle-tamanho button')].map((b) => b.getAttribute('aria-label'))`);
  confere(botoesZoom.length === 3, `a barra de zoom tem 3 botões: ${JSON.stringify(botoesZoom)}`);
  await av("document.querySelector('#painel-partitura .controle-tamanho [data-acao=mais]').click(); 1");
  await dormir(200);
  const z1 = await av(`(() => {
    const r = document.querySelector('#painel-partitura .rolagem');
    return { rola: r.scrollWidth > r.clientWidth + 1, folha: document.querySelector('#painel-partitura .folha').getBoundingClientRect().width, regiao: r.clientWidth,
      salvo: localStorage.getItem('prefs.partitura'), dica: !!document.querySelector('#painel-partitura .dica'), pagina: document.documentElement.scrollWidth > window.innerWidth };
  })()`);
  confere(z1.rola && Math.abs(z1.folha / z1.regiao - 1.25) < 0.02, `125%: a folha fica ${(z1.folha / z1.regiao).toFixed(2)}x a região e rola de lado`);
  confere(z1.salvo === '{"escala":1.25}' && z1.dica && !z1.pagina, `o zoom fica salvo, aparece a dica de arrastar e só a região rola (a página não): ${JSON.stringify({ salvo: z1.salvo, dica: z1.dica, pagina: z1.pagina })}`);
  await av("document.querySelector('#painel-partitura .controle-tamanho [data-acao=padrao]').click(); 1");
  await dormir(200);
  const z0 = await av(`(() => { const r = document.querySelector('#painel-partitura .rolagem'); return { rola: r.scrollWidth > r.clientWidth + 1, salvo: localStorage.getItem('prefs.partitura') }; })()`);
  confere(!z0.rola && z0.salvo === '{"escala":1}', `restaurar volta a 100% sem rolar de lado: ${JSON.stringify(z0)}`);

  // Diminuir: o padrão (100%) não é o menor tamanho. "−" dá 80%: a folha fica mais estreita que a região, CENTRALIZADA, sem rolar de lado.
  await av("document.querySelector('#painel-partitura .controle-tamanho [data-acao=menos]').click(); 1");
  await dormir(200);
  const zm = await av(`(() => {
    const reg = document.querySelector('#painel-partitura .rolagem');
    const r = reg.getBoundingClientRect();
    const f = document.querySelector('#painel-partitura .folha').getBoundingClientRect();
    return { razao: f.width / r.width, esquerda: f.left - r.left, direita: r.right - f.right, rola: reg.scrollWidth > reg.clientWidth + 1,
      salvo: localStorage.getItem('prefs.partitura'), dica: !!document.querySelector('#painel-partitura .dica') };
  })()`);
  confere(Math.abs(zm.razao - 0.8) < 0.02 && !zm.rola && zm.salvo === '{"escala":0.8}' && !zm.dica, `"−" diminui para 80% (a folha é ${(zm.razao * 100).toFixed(0)}% da região), sem rolar de lado e sem a dica de arrastar: ${JSON.stringify({ salvo: zm.salvo, rola: zm.rola })}`);
  confere(zm.esquerda > 5 && Math.abs(zm.esquerda - zm.direita) < 2, `a partitura menor fica centralizada (sobra ${zm.esquerda.toFixed(0)} px de cada lado)`);
  // chega ao menor (50%) e o "−" desliga; depois volta ao padrão para não afetar o resto
  for (let i = 0; i < 4; i++) await av("document.querySelector('#painel-partitura .controle-tamanho [data-acao=menos]').click(); 1");
  await dormir(200);
  const min = await av(`({ salvo: localStorage.getItem('prefs.partitura'), menosDesligado: document.querySelector('#painel-partitura .controle-tamanho [data-acao=menos]').disabled })`);
  confere(min.salvo === '{"escala":0.5}' && min.menosDesligado, `o menor tamanho é 50% e o "−" desliga: ${JSON.stringify(min)}`);
  await av("document.querySelector('#painel-partitura .controle-tamanho [data-acao=padrao]').click(); 1");
  await dormir(200);

  // Versões: em pé (412 px) é o desenho de retrato; deitado (915 px) o de paisagem, e a coluna deixa de ser limitada a 40rem (640 px).
  const estadoVersao = () => av(`(() => ({
    variante: document.querySelector('#painel-partitura .folha')?.dataset.variante ?? null,
    largo: !!document.querySelector('#painel-partitura .folha svg [data-largo]'),
    leituras: JSON.stringify(window.__leituras ?? []),
    colunaPx: Math.round(document.querySelector('main').getBoundingClientRect().width),
    folhaPx: Math.round(document.querySelector('#painel-partitura .folha').getBoundingClientRect().width),
  }))()`);
  const v0 = await estadoVersao();
  confere(v0.variante === "retrato" && !v0.largo && v0.leituras === "[false]", `em pé: versão de retrato, uma leitura pedindo o retrato: ${JSON.stringify(v0)}`);
  confere(v0.colunaPx <= 412, `em pé a coluna cabe na tela: ${v0.colunaPx} px`);
  await enviar("Emulation.setDeviceMetricsOverride", { width: 915, height: 412, deviceScaleFactor: 1, mobile: true });
  await dormir(900);
  const v1 = await estadoVersao();
  confere(v1.variante === "paisagem" && v1.largo && v1.leituras === "[false,true]", `deitado: a versão de paisagem entra e é lida uma vez: ${JSON.stringify(v1)}`);
  confere(v1.folhaPx > 640, `deitado, a partitura passa dos 40rem de antes (coluna ${v1.colunaPx} px, folha ${v1.folhaPx} px)`);
  // a coluna só é larga na aba Partitura: na Letra o limite de 40rem continua
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(400);
  const colLetra = await av("Math.round(document.querySelector('main').getBoundingClientRect().width)");
  confere(colLetra <= 640, `na aba Letra a coluna continua limitada a 40rem: ${colLetra} px`);
  await av("document.getElementById('aba-partitura').click(); 1");
  await dormir(400);
  await enviar("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 1, mobile: true });
  await dormir(900);
  const v2 = await estadoVersao();
  confere(v2.variante === "retrato" && !v2.largo && v2.leituras === "[false,true]", `de volta em pé: o retrato volta SEM ler de novo: ${JSON.stringify(v2)}`);

  // Karaokê da partitura (I-12, fase B): o compasso que toca fica destacado (um retângulo atrás dele). O hino 999 tem 3 compassos na vez (de 0 a 10
  // batidas: 0-4, 4-8, 8-10), a 120 bpm (2 batidas por segundo), e a vez 2 começa na batida 14 (7 s). Pausado, o slider leva a música a um ponto conhecido.
  const destaque = () => av(`(() => {
    const medidas = [...document.querySelectorAll('#painel-partitura g.measure')];
    const caixa = document.querySelector('#painel-partitura rect.destaque-compasso');
    const m = medidas.find((g) => g.querySelector('rect.destaque-compasso'));
    const rc = caixa?.getBoundingClientRect(), mc = m?.getBoundingClientRect();
    return { indice: medidas.findIndex((g) => g.querySelector('rect.destaque-compasso')), retangulos: document.querySelectorAll('rect.destaque-compasso').length, medidas: medidas.length,
      cobre: !!rc && !!mc && rc.left <= mc.left + 0.5 && rc.right >= mc.right - 0.5 && rc.top <= mc.top + 0.5 && rc.bottom >= mc.bottom - 0.5,
      atras: !!caixa && caixa === m?.firstElementChild };
  })()`);
  // Passos anteriores pararam a música (e um deles desligou o karaokê): começa de novo, como a pessoa faria, e vai para a aba Partitura.
  await av("document.getElementById('aba-ouvir').click(); 1");
  await dormir(300);
  confere(await av(`(() => { const b = [...document.querySelectorAll('#painel-ouvir button')].find((x) => /hino todo|whole|todo/i.test(x.textContent)); if (!b) return false; b.click(); return true; })()`), 'botão "tocar o hino todo" clicado, para o karaokê da partitura');
  await dormir(700);
  await av("document.getElementById('aba-partitura').click(); 1");
  await dormir(600);
  const antesDoBotao = await av(`document.querySelector('.chave-karaoke')?.getAttribute('aria-pressed') ?? null`);
  if (antesDoBotao === "false") {
    await av("document.querySelector('.chave-karaoke').click(); 1"); // o passo da letra deixou o karaokê desligado: liga
    await dormir(300);
  }
  if ((await lido()).tocando) {
    await av("document.querySelector('.mini .acao').click(); 1"); // pausa pelo miniplayer
    await dormir(500);
  }
  const kd = await av(`(() => { const b = document.querySelector('.chave-karaoke'); return { achou: !!b, ligado: b?.getAttribute('aria-pressed') ?? null }; })()`);
  confere(kd.achou && kd.ligado === "true", `o botão do karaokê aparece na aba Partitura (hino com compassos) e está ligado: ${JSON.stringify(kd)}`);
  const ponto = [[1, 0, "vez 1, batida 2"], [2.5, 1, "vez 1, batida 5"], [4.6, 2, "vez 1, batida 9,2"], [6, 2, "na pausa entre as partes o último continua aceso"], [8, 0, "vez 2, batida local 2: volta ao 1º compasso"], [9.5, 1, "vez 2, batida local 5"], [11, 2, "vez 2, batida local 8"]];
  for (const [s, esperado, quando] of ponto) {
    await buscar(".mini .busca-entrada", s);
    await dormir(500);
    const d = await destaque();
    confere(d.indice === esperado && d.retangulos === 1 && d.medidas === 3, `aos ${s} s (${quando}) o compasso ${esperado + 1} está destacado: ${JSON.stringify(d)}`);
  }
  const d1 = await destaque();
  confere(d1.cobre && d1.atras, `o destaque cobre o compasso inteiro e fica ATRÁS das notas (primeiro filho do compasso): ${JSON.stringify(d1)}`);
  // pausado, o destaque não anda
  await buscar(".mini .busca-entrada", 2.5);
  await dormir(500);
  const antes = (await destaque()).indice;
  await dormir(1500);
  confere((await destaque()).indice === antes && antes === 1, `na pausa o destaque congela (compasso ${antes + 1})`);
  // tocando, o destaque anda sozinho: de 1 s (compasso 1) até passar de 4 s (compasso 2) em ~3,3 s
  await buscar(".mini .busca-entrada", 1);
  await dormir(400);
  await av("document.querySelector('.mini .acao').click(); 1"); // continua
  const vistos = [];
  for (let i = 0; i < 9; i++) {
    await dormir(400);
    vistos.push((await destaque()).indice);
  }
  await av("document.querySelector('.mini .acao').click(); 1"); // pausa de novo
  await dormir(400);
  const sobe = vistos.every((v, k) => k === 0 || v >= vistos[k - 1]);
  confere(sobe && vistos.includes(0) && vistos.includes(1) && vistos[vistos.length - 1] >= 1, `tocando, o destaque avança sozinho e só para a frente: ${JSON.stringify(vistos)}`);
  // o liga/desliga é o do karaokê: desligado, o destaque some; ligado, volta
  await av("document.querySelector('.chave-karaoke').click(); 1");
  await dormir(300);
  const off = await av(`({ ligado: document.querySelector('.chave-karaoke').getAttribute('aria-pressed'), retangulos: document.querySelectorAll('rect.destaque-compasso').length })`);
  confere(off.ligado === "false" && off.retangulos === 0, `com o karaokê desligado não há destaque: ${JSON.stringify(off)}`);
  await av("document.querySelector('.chave-karaoke').click(); 1");
  await dormir(300);
  const on = await destaque();
  confere(on.retangulos === 1 && on.indice >= 0, `ligando de novo o destaque volta: ${JSON.stringify(on)}`);
  // fora da aba Partitura não gasta nada e não deixa destaque
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(300);
  confere((await av("document.querySelectorAll('rect.destaque-compasso').length")) === 0, "fora da aba Partitura o destaque some");
  await av("document.getElementById('aba-partitura').click(); 1");
  await dormir(400);
  confere((await destaque()).retangulos === 1, "voltando à aba Partitura o destaque volta");

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
      svg: !!document.querySelector('#painel-partitura .folha svg'), visivel: !document.getElementById('painel-partitura').hidden };
  })()`);
  confere(aviso.aba && aviso.href === "/ajustes?abrir=partituras" && aviso.botao && !aviso.svg && aviso.visivel, `sem pacote com partituras: a aba aparece com o aviso e o botão para Ajustes: ${JSON.stringify(aviso)}`);
  await av("sessionStorage.removeItem('e2e-sem-partituras'); sessionStorage.setItem('e2e-falha-partitura', '1'); 1");

  // Falha na leitura da partitura: o aviso de erro traz "Tentar de novo", e ele lê outra vez (não fica preso para sempre).
  confere(await abrirHino(999), "hino 999 carregado para o teste de falha da partitura");
  await av("document.getElementById('aba-partitura')?.click(); 1");
  await dormir(600);
  const falhou = await av(`({ alerta: !!document.querySelector('#painel-partitura [role="alert"]'), botao: !!document.querySelector('#painel-partitura .tentar'), svg: !!document.querySelector('#painel-partitura .folha svg') })`);
  confere(falhou.alerta && falhou.botao && !falhou.svg, `leitura que falha: aviso de erro com o botão de tentar de novo: ${JSON.stringify(falhou)}`);
  // trocar de aba e voltar NÃO repete sozinho (o erro continua à vista)
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(200);
  await av("document.getElementById('aba-partitura').click(); 1");
  await dormir(400);
  confere(await av(`!!document.querySelector('#painel-partitura [role="alert"]') && !document.querySelector('#painel-partitura .folha svg')`), "trocar de aba e voltar não esconde o erro nem repete sozinho");
  await av("document.querySelector('#painel-partitura .tentar')?.click(); 1");
  await dormir(700);
  const refeito = await av(`({ alerta: !!document.querySelector('#painel-partitura [role="alert"]'), svg: !!document.querySelector('#painel-partitura .folha svg'), botao: !!document.querySelector('#painel-partitura .tentar') })`);
  confere(!refeito.alerta && refeito.svg && !refeito.botao, `"Tentar de novo" lê a partitura outra vez e ela aparece: ${JSON.stringify(refeito)}`);

  // Tela inicial: a logo do app tem o tamanho do botão de Ajustes (o hambúrguer/engrenagem), e a barra não cresce por causa dela.
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.querySelector('.barra .logo') && !!document.querySelector('.barra .acao a')`)); ) await dormir(250);
  const marca = await av(`(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.width * 100) / 100, a: Math.round(b.height * 100) / 100 }; };
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { logo: r(document.querySelector('.barra .logo')), botao: r(document.querySelector('.barra .acao a')), barraRem: Math.round((document.querySelector('.barra').getBoundingClientRect().height / rem) * 100) / 100,
      carregou: document.querySelector('.barra .logo').naturalWidth > 0 };
  })()`);
  confere(marca.logo.l === marca.botao.l && marca.logo.a === marca.botao.a, `a logo tem o tamanho do botão de Ajustes: ${JSON.stringify(marca)}`);
  confere(marca.carregou && marca.barraRem <= 3.6, `a imagem da logo carrega e a barra continua com ~3,5rem (${marca.barraRem}rem)`);

  // Ajustes: "Importar hinário" aceita SÓ .json (o hinário vai deixar de ser importado; as partituras têm o card próprio).
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/ajustes` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.querySelector('input[type="file"]')`)); ) await dormir(250);
  // Os blocos de Ajustes são cartões fechados de saída, com o estado na linha de cima (I-24): o Conteúdo mostra o hinário, as partituras e os sons.
  const resumoFechado = await av(`(() => { const d = document.getElementById('conteudo'); return { aberto: d.open, resumo: d.querySelector('summary').innerText.replace(/\\s+/g, ' ') }; })()`);
  confere(!resumoFechado.aberto && /\d+\s+(scores?|partituras?)/i.test(resumoFechado.resumo), `Ajustes: o cartão Conteúdo começa fechado e mostra o estado na linha de cima: ${JSON.stringify(resumoFechado)}`);
  // O texto de um cartão fechado não é renderizado: abre o Conteúdo antes de ler o que há dentro (hinário, partituras, sons).
  await av("document.getElementById('conteudo').open = true; 1");
  await dormir(400);
  const aceita = await av(`document.querySelector('input[type="file"]').getAttribute('accept')`);
  confere(/json/.test(aceita) && !/zip/i.test(aceita), `Importar hinário aceita só .json: accept="${aceita}"`);

  // Arquivo acima de 20 MB: recusado pelo tamanho, sem ser lido. O arquivo é ESPARSO (só o tamanho conta, não ocupa disco).
  const raiz = (await enviar("DOM.getDocument", {})).result.root.nodeId;
  const entrada = (await enviar("DOM.querySelector", { nodeId: raiz, selector: 'input[type="file"]' })).result.nodeId;
  confere(entrada > 0, "o seletor de arquivo de Ajustes foi encontrado");
  const caminhoGrande = join(perfil, "hinario-enorme.json");
  writeFileSync(caminhoGrande, "{");
  truncateSync(caminhoGrande, 21 * 1024 * 1024);
  await av("window.__leu = false; for (const m of ['text', 'arrayBuffer']) { const o = Blob.prototype[m]; Blob.prototype[m] = function () { window.__leu = true; return o.call(this); }; } 1");
  await enviar("DOM.setFileInputFiles", { nodeId: entrada, files: [caminhoGrande] });
  await dormir(1500);
  const grande = await av(`({ leu: window.__leu, texto: document.body.innerText })`);
  confere(!grande.leu && /20 MB/.test(grande.texto), `hinário de 21 MiB: recusado pelo tamanho, sem ser lido: ${JSON.stringify({ leu: grande.leu, tem20MB: /20 MB/.test(grande.texto) })}`);

  // O card Partituras (no molde dos sons gravados): com partituras instaladas mostra "Instaladas" e Remover; remover chama só o comando
  // de remover partituras; depois, sem pacote publicado (manifesto vazio), não há botão Baixar nem importação manual.
  const card1 = await av(`(() => { const c = document.querySelector('#partituras'); return { achou: !!c, texto: c?.innerText ?? '', botoes: [...(c?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) }; })()`);
  confere(card1.achou && /installed|instaladas|instaladas/i.test(card1.texto) && card1.botoes.length === 1, `card Partituras com partituras instaladas: estado e um só botão (Remover): ${JSON.stringify({ botoes: card1.botoes })}`);
  await av(`document.querySelector('#partituras button').click(); 1`);
  await dormir(600);
  const card2 = await av(`(() => { const c = document.querySelector('#partituras'); return { removeu: window.__removeu ?? 0, texto: c.innerText, botoes: c.querySelectorAll('button').length, entradaArquivo: c.querySelectorAll('input[type="file"]').length }; })()`);
  confere(card2.removeu === 1, `Remover chama o comando que apaga só as partituras (1 vez): ${card2.removeu}`);
  // O que o card mostra depois de remover depende de haver pacote publicado no manifesto do app (src/lib/partituras/manifesto.json):
  //  - sem pacote (`null`): "ainda não disponíveis" e nenhum botão; com pacote: "Não instaladas" e o botão Baixar. Em nenhum dos dois há importação de arquivo.
  const publicado = JSON.parse(readFileSync(join(RAIZ, "src/lib/partituras/manifesto.json"), "utf-8")).pacote !== null;
  const esperado = publicado
    ? /not installed|não instaladas|no instaladas/i.test(card2.texto) && card2.botoes === 1
    : /not yet available|ainda não|aún no/i.test(card2.texto) && card2.botoes === 0;
  confere(esperado && card2.entradaArquivo === 0, `sem partituras (${publicado ? "com pacote publicado: Não instaladas e o botão Baixar" : "sem pacote publicado: ainda não disponíveis e nenhum botão"}), sem importar arquivo: ${JSON.stringify({ botoes: card2.botoes, arquivo: card2.entradaArquivo, texto: card2.texto.slice(-60) })}`);

  // ---- Tela inicial com abas (I-28) e o afinador (I-13, etapa 1: dar o tom) ----
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('aba-afinador')`)); ) await dormir(250);
  await dormir(500);
  const abasInicio = await av(`({ abas: [...document.querySelectorAll('[role="tab"]')].map((a) => a.id), hinos: !document.getElementById('painel-hinos').hidden, afinador: !document.getElementById('painel-afinador').hidden })`);
  confere(abasInicio.abas.join() === "aba-hinos,aba-afinador" && abasInicio.hinos && !abasInicio.afinador, `a tela inicial tem as abas Hinos e Afinador e abre em Hinos: ${JSON.stringify(abasInicio)}`);

  // A busca da lista sobrevive à troca de aba (os painéis ficam montados).
  await av(`(() => { const i = document.querySelector('#painel-hinos input[type="search"]'); i.value = '998'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await dormir(200);
  await av(`document.getElementById('aba-afinador').click(); 1`);
  await dormir(500);
  const noAfinador = await av(`({ hinos: document.getElementById('painel-hinos').hidden, afinador: !document.getElementById('painel-afinador').hidden, selecionada: document.getElementById('aba-afinador').getAttribute('aria-selected') })`);
  confere(noAfinador.hinos && noAfinador.afinador && noAfinador.selecionada === "true", `trocar para o Afinador mostra o painel dele e esconde a lista: ${JSON.stringify(noAfinador)}`);

  // Mede o SOM que o app gera, com o analisador que o app expõe só no servidor de desenvolvimento: autocorrelação com interpolação parabólica.
  const hzDoTom = `(() => {
    const t = window.__bmccbTom;
    if (!t) return { erro: 'sem sonda' };
    const an = t.analisador, buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    const sr = an.context.sampleRate, n = buf.length, lagMax = Math.floor(sr / 60), lagMin = Math.floor(sr / 1500);
    let energia = 0; for (let i = 0; i < n; i++) energia += buf[i] * buf[i];
    if (energia / n < 1e-6) return { erro: 'silêncio', rms: Math.sqrt(energia / n) };
    const r = new Float64Array(lagMax + 2);
    for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) { let a = 0; for (let i = 0; i + lag < n; i++) a += buf[i] * buf[i + lag]; r[lag] = a; }
    let max = 0; for (let lag = lagMin; lag <= lagMax; lag++) if (r[lag] > max) max = r[lag];
    let melhor = -1;
    for (let lag = lagMin; lag <= lagMax; lag++) if (r[lag] > 0.97 * max && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) { melhor = lag; break; }
    if (melhor < 0) return { erro: 'sem pico' };
    const a = r[melhor - 1], b = r[melhor], c = r[melhor + 1], d = a - 2 * b + c;
    const lagFino = d === 0 ? melhor : melhor + (a - c) / (2 * d);
    return { hz: sr / lagFino, tocando: t.tocando, pedida: t.frequencia, rms: Math.sqrt(energia / n) };
  })()`;
  const clicarGrande = (indice) => av(`document.querySelectorAll('#painel-afinador .grande')[${indice}].click(); 1`);

  // "Outra nota" é um cartão FECHADO de saída (com a nota e a frequência na linha de cima) e o volume não está na tela (é o do celular).
  const fechado = await av(`(() => { const d = document.querySelector('#painel-afinador details'); return { aberto: d.open, resumo: d.querySelector('summary').textContent.replace(/\\s+/g, ' ').trim(), controleDeVolume: document.querySelectorAll('#painel-afinador input[type="range"]').length }; })()`);
  confere(fechado.aberto === false && /C4.*262|Dó4.*262|Do4.*262/.test(fechado.resumo) && fechado.controleDeVolume === 0, `Afinador: "Outra nota" começa fechado, mostra a nota e a frequência, e não há controle de volume na tela: ${JSON.stringify(fechado)}`);
  await clicarGrande(0); // Lá 440 Hz
  await dormir(900);
  const la = await av(hzDoTom);
  confere(la.hz && Math.abs(la.hz - 440) <= 1 && la.tocando, `o Lá toca a 440 Hz (medido no som gerado, com folga de 1 Hz): ${JSON.stringify(la)}`);
  const pressionado = await av(`document.querySelectorAll('#painel-afinador .grande')[0].getAttribute('aria-pressed')`);
  confere(pressionado === "true", `o botão do Lá fica pressionado enquanto toca: aria-pressed=${pressionado}`);

  // Outra nota: Mi♭4 (311,13 Hz). Ligar a outra nota com o Lá soando TROCA de nota; mudar a oitava com ela soando a afina na hora (Mi♭5, 622,25 Hz).
  await av(`document.querySelector('#painel-afinador details summary').click(); 1`); // abre o cartão, como a pessoa faria
  await dormir(300);
  await av(`document.querySelector('#painel-afinador input[type="radio"][value="3"]').click(); 1`);
  await clicarGrande(1);
  await dormir(900);
  const mib4 = await av(hzDoTom);
  confere(mib4.hz && Math.abs(mib4.hz - 311.127) <= 1, `o Mi♭4 toca a 311,13 Hz, trocando o Lá: ${JSON.stringify(mib4)}`);
  await av(`[...document.querySelectorAll('#painel-afinador .botao-barra')].find((b) => /up|acima|arriba/i.test(b.getAttribute('aria-label'))).click(); 1`);
  await dormir(900);
  const mib5 = await av(hzDoTom);
  confere(mib5.hz && Math.abs(mib5.hz - 622.254) <= 2, `subir a oitava com a nota soando a afina na hora (Mi♭5, 622,25 Hz): ${JSON.stringify(mib5)}`);
  const lista = await av(`document.querySelector('#painel-afinador .freq').textContent.replace(/\\s+/g, ' ').trim()`);
  confere(/E♭5/.test(lista) && /622/.test(lista), `a tela mostra o nome e a frequência da nota: ${lista}`);

  // Fechar o cartão "Outra nota" com a nota soando a para (o botão de parar fica dentro dele).
  await av(`document.querySelector('#painel-afinador details summary').click(); 1`);
  await dormir(900);
  const aposFechar = await av(`({ tocando: window.__bmccbTom.tocando, aberto: document.querySelector('#painel-afinador details').open })`);
  confere(aposFechar.tocando === false && aposFechar.aberto === false, `fechar o cartão "Outra nota" com a nota soando para o som: ${JSON.stringify(aposFechar)}`);
  await av(`document.querySelector('#painel-afinador details summary').click(); 1`); // reabre para o resto do teste
  await dormir(300);
  await clicarGrande(1);
  await dormir(900);

  // Sair da aba para o som (e o áudio é devolvido).
  await av(`document.getElementById('aba-hinos').click(); 1`);
  await dormir(900); // a soltura da nota (0,1 s) e o fechamento do contexto
  const aposSair = await av(`({ tocando: window.__bmccbTom.tocando, pressionado: document.querySelectorAll('#painel-afinador .grande')[1].getAttribute('aria-pressed'), contexto: window.__bmccbTom.analisador.context.state })`);
  confere(aposSair.tocando === false && aposSair.pressionado === "false" && aposSair.contexto === "closed", `sair da aba Afinador para o som e devolve o áudio (contexto fechado): ${JSON.stringify(aposSair)}`);
  const buscaFicou = await av(`document.querySelector('#painel-hinos input[type="search"]').value`);
  confere(buscaFicou === "998", `a busca da lista sobrevive à troca de aba: "${buscaFicou}"`);

  // Um som de cada vez: dar o tom PARA o hino que estava tocando. Abre o hino, toca, volta à lista (client-side) e liga o Lá.
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.querySelector('a[href="/hino/999"]')`)); ) await dormir(250);
  await av(`document.querySelector('a[href="/hino/999"]').click(); 1`);
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.querySelector('#painel-ouvir button')`)); ) await dormir(250);
  await dormir(500);
  await av(`[...document.querySelectorAll('#painel-ouvir button')].find((x) => /hino todo|whole|todo/i.test(x.textContent)).click(); 1`);
  await dormir(700);
  await av(`document.querySelector('button.voltar').click(); 1`);
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('aba-afinador')`)); ) await dormir(250);
  const miniAntes = await av(`!!document.querySelector('.mini')`);
  await av(`document.getElementById('aba-afinador').click(); 1`);
  await dormir(500);
  await clicarGrande(0);
  await dormir(900);
  const depoisDoTom = await av(`({ mini: !!document.querySelector('.mini'), tom: window.__bmccbTom?.tocando })`);
  confere(miniAntes === true && depoisDoTom.mini === false && depoisDoTom.tom === true, `dar o tom para o hino que tocava (o miniplayer some e o tom soa): antes=${miniAntes}, depois=${JSON.stringify(depoisDoTom)}`);
  await clicarGrande(0); // desliga o tom

  // Falha do áudio (Web Audio bloqueado ou indisponível): o aviso aparece, o botão volta ao normal, nada fica "tocando" e nenhuma promessa
  // rejeitada fica solta. Vale para ligar uma nota e também para a TROCA de nota/oitava com uma nota soando (a antiga tem de parar).
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('aba-afinador')`)); ) await dormir(250);
  await dormir(500);
  await av(`window.__rejeicoes = []; addEventListener('unhandledrejection', (e) => window.__rejeicoes.push(String(e.reason))); 1`);
  await av(`document.getElementById('aba-afinador').click(); 1`);
  await dormir(400);
  await av(`window.__ACOriginal = window.AudioContext; window.AudioContext = class { constructor() { throw new Error('sem áudio'); } }; 1`);
  await clicarGrande(0);
  await dormir(600);
  const audioFalhou = await av(`({ aviso: !!document.querySelector('#painel-afinador .aviso.erro'), pressionado: document.querySelectorAll('#painel-afinador .grande')[0].getAttribute('aria-pressed'), rejeicoes: window.__rejeicoes.length })`);
  confere(audioFalhou.aviso && audioFalhou.pressionado === "false" && audioFalhou.rejeicoes === 0, `áudio indisponível: aviso na tela, botão normal e nenhuma promessa rejeitada solta: ${JSON.stringify(audioFalhou)}`);
  await av(`window.AudioContext = window.__ACOriginal; 1`);
  await clicarGrande(0);
  await dormir(900);
  const recuperou = await av(`({ aviso: !!document.querySelector('#painel-afinador .aviso.erro'), tocando: window.__bmccbTom?.tocando })`);
  confere(!recuperou.aviso && recuperou.tocando === true, `tentar de novo funciona e o aviso some: ${JSON.stringify(recuperou)}`);
  await clicarGrande(0); // desliga o Lá
  await av(`document.querySelector('#painel-afinador details summary').click(); 1`); // abre o cartão (a tela foi recarregada: volta fechado)
  await dormir(300);
  await clicarGrande(1); // liga a nota escolhida
  await dormir(900);
  await av(`window.__resumeOriginal = AudioContext.prototype.resume; AudioContext.prototype.resume = () => Promise.reject(new Error('resume falhou')); 1`);
  await av(`[...document.querySelectorAll('#painel-afinador .botao-barra')].find((b) => /up|acima|arriba/i.test(b.getAttribute('aria-label'))).click(); 1`);
  await dormir(700);
  const trocaFalhou = await av(`({ aviso: !!document.querySelector('#painel-afinador .aviso.erro'), pressionado: document.querySelectorAll('#painel-afinador .grande')[1].getAttribute('aria-pressed'), soando: window.__bmccbTom.tocando, rejeicoes: window.__rejeicoes.length })`);
  confere(trocaFalhou.aviso && trocaFalhou.pressionado === "false" && trocaFalhou.soando === false && trocaFalhou.rejeicoes === 0, `a troca de nota que falha para a nota antiga, avisa e não deixa rejeição solta: ${JSON.stringify(trocaFalhou)}`);
  await av(`AudioContext.prototype.resume = window.__resumeOriginal; 1`);

  // ---- Temporizador do afinador (I-13): o padrão é "até parar" (como sempre); com 10 s o tom para sozinho; trocar de nota recomeça a contagem ----
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('aba-afinador')`)); ) await dormir(250);
  await dormir(500);
  await av(`document.getElementById('aba-afinador').click(); 1`);
  await dormir(600);
  const estadoTemporizador = () => av(`(() => { const d = document.getElementById('cartao-temporizador'); return { aberto: d.open, resumo: d.querySelector('summary').textContent.replace(/\\s+/g, ' ').trim() }; })()`);
  const faltam = () => av(`(() => { const s = document.querySelector('#painel-afinador .grande[aria-pressed="true"] span[aria-hidden="true"]'); const m = s?.textContent.match(/\\d+/); return m ? Number(m[0]) : null; })()`);
  const soando = () => av(`window.__bmccbTom?.tocando === true`);
  const tmp0 = await estadoTemporizador();
  confere(tmp0.aberto === false && /Until stopped|Até parar|Hasta parar/.test(tmp0.resumo), `Temporizador: o cartão começa fechado e em "até parar": ${JSON.stringify(tmp0)}`);

  // Padrão ("até parar"): o tom NÃO para sozinho, nem depois de mais que o maior tempo oferecido.
  await clicarGrande(0);
  await dormir(11500);
  const semLimite = { soando: await soando(), faltam: await faltam() };
  confere(semLimite.soando === true && semLimite.faltam === null, `Temporizador em "até parar": depois de 11 s o tom segue soando e não há contagem: ${JSON.stringify(semLimite)}`);
  await clicarGrande(0); // para
  await dormir(300);

  // 10 s: o botão mostra o que falta e o tom para sozinho.
  await av(`document.querySelector('#cartao-temporizador summary').click(); 1`);
  await dormir(300);
  await av(`document.querySelector('#painel-afinador input[name="limite"][value="10"]').click(); 1`);
  await dormir(300);
  const tmp1 = await estadoTemporizador();
  confere(tmp1.aberto === true && /10 s/.test(tmp1.resumo), `Temporizador: escolher 10 s aparece no resumo do cartão: ${JSON.stringify(tmp1)}`);
  await clicarGrande(0);
  await dormir(1500);
  const f1 = await faltam();
  confere(f1 !== null && f1 >= 8 && f1 <= 10 && (await soando()), `Temporizador de 10 s: o botão mostra o que falta (8 a 10 s após 1,5 s) e o tom soa: faltam ${f1}`);
  const rotuloAcessivel = await av(`document.querySelector('#painel-afinador .grande[aria-pressed="true"]').textContent.replace(/\\s+/g, ' ').trim()`);
  confere(/^(Stop|Parar|Detener) · (\d+ s left|faltam \d+ s|faltan \d+ s)$/.test(rotuloAcessivel), `Temporizador: o botão segue sendo o de parar, com a contagem junto e o separador com espaços: "${rotuloAcessivel}"`);

  // Trocar de nota recomeça a contagem: aos ~7 s faltam ~3; ao tocar a outra nota, voltam a faltar ~10.
  await dormir(5500);
  const f2 = await faltam();
  confere(f2 !== null && f2 >= 2 && f2 <= 4, `Temporizador de 10 s: aos ~7 s faltam ~3: faltam ${f2}`);
  await av(`document.querySelector('#painel-afinador details summary').click(); 1`); // abre "Outra nota"
  await dormir(300);
  await clicarGrande(1);
  await dormir(1300);
  const f3 = await faltam();
  confere(f3 !== null && f3 >= 8 && (await soando()), `Temporizador: tocar outra nota recomeça a contagem (faltam ${f3}, e sem recomeçar seriam ~1)`);

  // Passados os 10 s, o tom para sozinho: o botão volta a "tocar" e o leitor de tela é avisado.
  await dormir(10500);
  const fim10 = await av(`({ soando: window.__bmccbTom.tocando, pressionados: document.querySelectorAll('#painel-afinador .grande[aria-pressed="true"]').length, aviso: document.querySelector('#painel-afinador [role="status"]').textContent.trim() })`);
  confere(fim10.soando === false && fim10.pressionados === 0 && /timer|temporizador/i.test(fim10.aviso), `Temporizador: passado o tempo o tom para sozinho, os botões voltam a "tocar" e o leitor de tela é avisado: ${JSON.stringify(fim10)}`);

  // Mudar o tempo com o tom soando vale a partir de agora: 30 s recomeça a contagem de 30; "até parar" cancela a contagem.
  await clicarGrande(0);
  await dormir(1200);
  await av(`document.querySelector('#painel-afinador input[name="limite"][value="30"]').click(); 1`);
  await dormir(1200);
  const f4 = await faltam();
  confere(f4 !== null && f4 >= 27 && f4 <= 30, `Temporizador: mudar para 30 s com o tom soando recomeça a contagem (faltam ${f4})`);
  await av(`document.querySelector('#painel-afinador input[name="limite"][value="0"]').click(); 1`);
  await dormir(700);
  const f5 = { faltam: await faltam(), soando: await soando() };
  confere(f5.faltam === null && f5.soando === true, `Temporizador: voltar a "até parar" com o tom soando cancela a contagem e o tom segue: ${JSON.stringify(f5)}`);
  await clicarGrande(0); // para
  await dormir(300);

  // ---- Ajustes: o que ficou aberto é lembrado, o valor ruim volta ao padrão e o link da aba Partitura abre o Conteúdo sem gravar (I-24, fatias 3 e 4) ----
  const AJ = `http://127.0.0.1:${PORTA_VITE}/ajustes`;
  const irParaAjustes = async (url) => {
    await enviar("Page.navigate", { url });
    for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('cartao-aparencia')`)); ) await dormir(250);
    await dormir(500);
  };
  const estadoCartoes = () => av(`(() => { const a = (id) => document.getElementById(id)?.open; return { aparencia: a('cartao-aparencia'), idioma: a('cartao-idioma'), conteudo: a('conteudo'), salvo: localStorage.getItem('prefs.ajustes') }; })()`);
  await irParaAjustes(AJ);
  await av(`localStorage.removeItem('prefs.ajustes'); 1`);
  await irParaAjustes(AJ);
  const aj0 = await estadoCartoes();
  confere(aj0.aparencia === false && aj0.idioma === false && aj0.conteudo === false && aj0.salvo === null, `Ajustes: sem nada salvo, todos os cartões começam fechados: ${JSON.stringify(aj0)}`);
  await av(`document.querySelector('#cartao-aparencia summary').click(); 1`); // a pessoa abre a Aparência
  await dormir(300);
  await irParaAjustes(AJ); // fecha e abre a tela
  const aj1 = await estadoCartoes();
  confere(aj1.aparencia === true && aj1.idioma === false && aj1.conteudo === false && aj1.salvo === '{"aparencia":true,"idioma":false,"conteudo":false}', `Ajustes: o cartão que a pessoa abriu continua aberto ao voltar: ${JSON.stringify(aj1)}`);
  await av(`document.querySelector('#cartao-aparencia summary').click(); 1`); // fecha de novo
  await dormir(300);
  await irParaAjustes(AJ);
  const aj2 = await estadoCartoes();
  confere(aj2.aparencia === false && aj2.salvo === '{"aparencia":false,"idioma":false,"conteudo":false}', `Ajustes: fechar também é lembrado: ${JSON.stringify(aj2)}`);
  await av(`localStorage.setItem('prefs.ajustes', '{"aparencia":"sim","idioma":7,"conteudo":null}'); 1`);
  await irParaAjustes(AJ);
  const aj3 = await estadoCartoes();
  confere(aj3.aparencia === false && aj3.idioma === false && aj3.conteudo === false, `Ajustes: valor ruim guardado volta ao padrão (tudo fechado): ${JSON.stringify(aj3)}`);

  // O link da aba Partitura: abre o Conteúdo, rola até as partituras e NÃO grava essa abertura.
  await av(`localStorage.removeItem('prefs.ajustes'); 1`);
  await irParaAjustes(`${AJ}?abrir=partituras`);
  const viaLink = await av(`(() => { const c = document.getElementById('partituras'); const r = c.getBoundingClientRect(); return { conteudo: document.getElementById('conteudo').open, visivel: r.top >= 0 && r.top < window.innerHeight && r.height > 0, salvo: localStorage.getItem('prefs.ajustes') }; })()`);
  confere(viaLink.conteudo === true && viaLink.visivel === true && viaLink.salvo === null, `Ajustes pelo link da aba Partitura: o Conteúdo abre, as partituras ficam à vista e nada é gravado: ${JSON.stringify(viaLink)}`);
  await irParaAjustes(AJ);
  const semLink = await estadoCartoes();
  confere(semLink.conteudo === false, `Ajustes sem o parâmetro: o Conteúdo volta a abrir fechado (a abertura pelo link não ficou): ${JSON.stringify(semLink)}`);
  // Se a pessoa fecha o Conteúdo depois de chegar pelo link, aí sim é uma escolha dela e é lembrada.
  await irParaAjustes(`${AJ}?abrir=partituras`);
  await av(`document.querySelector('#conteudo summary').click(); 1`);
  await dormir(300);
  const fechouDepois = await estadoCartoes();
  confere(fechouDepois.conteudo === false && fechouDepois.salvo === '{"aparencia":false,"idioma":false,"conteudo":false}', `Ajustes: fechar o Conteúdo depois de chegar pelo link é lembrado: ${JSON.stringify(fechouDepois)}`);
  await av(`localStorage.removeItem('prefs.ajustes'); 1`);
  // ---- Acessibilidade: o título de cada cartão é um título (heading) na ÁRVORE DE ACESSIBILIDADE, e o summary segue sendo o botão que abre e fecha ----
  const titulosNaArvore = async () => {
    await enviar("Accessibility.enable");
    const r = await enviar("Accessibility.getFullAXTree");
    const nos = r.result.nodes.filter((x) => !x.ignored);
    return {
      titulos: nos.filter((x) => x.role?.value === "heading").map((x) => `${x.name?.value}:${x.properties?.find((p) => p.name === "level")?.value?.value}`),
      botoes: nos.filter((x) => x.role?.value === "DisclosureTriangle").map((x) => x.name?.value),
    };
  };
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('aba-afinador')`)); ) await dormir(250);
  await av(`document.getElementById('aba-afinador').click(); 1`);
  await dormir(600);
  const axAfinador = await titulosNaArvore();
  confere(axAfinador.titulos.some((t) => /^(Another note|Outra nota|Otra nota):2$/.test(t)) && axAfinador.botoes.some((b) => /Another note|Outra nota|Otra nota/.test(b)), `Afinador: "Outra nota" é um título de nível 2 e também o botão que abre o cartão (árvore de acessibilidade): ${JSON.stringify(axAfinador)}`);
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/ajustes` });
  for (let fim = Date.now() + 20000; Date.now() < fim && !(await av(`!!document.getElementById('conteudo')`)); ) await dormir(250);
  await dormir(500);
  const axAjustes = await titulosNaArvore();
  const titulosCartoes = axAjustes.titulos.filter((t) => /:2$/.test(t));
  confere(titulosCartoes.length >= 5 && axAjustes.botoes.length >= 5, `Ajustes: os 5 cartões (Aparência, Idioma, Conteúdo, Sobre e Créditos) são títulos de nível 2 e botões na árvore: ${JSON.stringify(axAjustes)}`);
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
  // O instante da 1ª sílaba inclui o atraso para a música começar a soar (não é o início exato dela), então a referência dos
  // intervalos continua sendo a 2ª troca. O que importa da 1ª é que seja VISTA: a amostragem já estava rodando quando a música começou.
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
