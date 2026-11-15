// Teste de ponta a ponta do karaokê, num Chrome de verdade (headless e MUDO). Rodar: npm run test:e2e
//
// Sobe o servidor de desenvolvimento do Vite e um Chrome, entrega ao app um hino FICTÍCIO (por um `invoke` simulado
// do Tauri) e confere, na aba Letra: a sílaba acesa acompanha o tempo da sincronia, a pausa congela o destaque e
// desligar o botão apaga tudo. Precisa de um Chrome ou Chromium instalado (variável CHROME para indicar o caminho).
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
  ],
};
// Sílabas esperadas na 1ª vez (estrofe 1) e na 2ª (estrofe 2), com o início de cada uma em batidas.
const ESPERADO_VEZ1 = [["do", 0], ["re", 2], ["mi", 4], ["fa", 6], ["sol", 8]];
const ESPERADO_VEZ2 = [["la", 0], ["si", 2], ["do", 4], ["re", 6], ["mi", 8]];
const BPM = 120;
const MS_POR_BATIDA = 60000 / BPM;

const STUB = `window.__TAURI_INTERNALS__ = {
  invoke: async (cmd) => (cmd === "carregar_hinario" ? { hinario: ${JSON.stringify(hinario)}, exemplo: false } : null),
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

async function limpar() {
  for (const p of filhos) encerrar(p, "SIGTERM");
  // O Chrome ainda escreve na pasta do perfil ao sair: espera ele terminar (e, se demorar, força) antes de apagá-la.
  await Promise.all(
    filhos.map((p) =>
      p.exitCode !== null
        ? null
        : new Promise((r) => {
            p.once("exit", r);
            setTimeout(() => {
              encerrar(p, "SIGKILL");
              r();
            }, 4000);
          }),
    ),
  );
  await dormir(500);
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
  await dormir(15000); // 1ª vez (10 s) + pausa de 2 s + 2ª vez começando
  const msPausa = await av("Math.round(performance.now() - window.__t0)");
  await av("document.querySelector('.mini .acao')?.click(); 1"); // pausa pelo miniplayer
  await dormir(1500);
  const distintos = await av("new Set(window.__am.slice(-40).map((x) => x[1] + '|' + x[2])).size");
  confere(distintos === 1, `a pausa congela o destaque (estados distintos no último 1 s: ${distintos})`);
  await av("document.querySelector('.chave-karaoke')?.click(); 1"); // desliga
  await dormir(400);
  confere((await av("document.querySelectorAll('.trecho').length")) === 0, "com o botão desligado nada fica aceso");
  await av("clearInterval(window.__iv); 1");
  const am = await av("window.__am");
  ws.close();

  // 6. análise: trocas de sílaba antes da pausa
  const trocas = [];
  let ant = null;
  for (const [ms, tr, est] of am) {
    if (ms >= msPausa - 50) break;
    if (tr !== null && tr !== ant) trocas.push({ ms, tr, est });
    ant = tr ?? ant;
  }
  // a 2ª vez começa depois da 1ª (10 batidas) mais a pausa de 2 s (4 batidas a 120 bpm)
  const inicioVez2 = 10 + (2 * BPM) / 60;
  const alvo = [...ESPERADO_VEZ1.map(([tr, b]) => ({ tr, b, est: "1" })), ...ESPERADO_VEZ2.map(([tr, b]) => ({ tr, b: inicioVez2 + b, est: "2" }))];
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
