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
// A 2ª vez começa depois da 1ª (10 batidas) mais a pausa de 2 s (4 batidas a 120 bpm). Definido uma vez e usado por tudo.
const BATIDAS_ESTROFE = 10;
const PAUSA_BATIDAS = (2 * BPM) / 60;
const INICIO_VEZ2 = BATIDAS_ESTROFE + PAUSA_BATIDAS;

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
  // A área de toque do slider do miniplayer tem de ficar DENTRO do miniplayer e livre dos outros controles: se invadisse a linha de
  // cima (botões e link do hino) ou a barra de abas embaixo, roubaria toques deles.
  const geo = await av(`(() => {
    const m = document.querySelector('.mini').getBoundingClientRect();
    const i = document.querySelector('.mini .busca-entrada').getBoundingClientRect();
    const cruza = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const outros = [...document.querySelectorAll('.mini .acao, .mini .info, [role="tablist"] [role="tab"]')].map((e) => e.getBoundingClientRect());
    return { dentro: i.top >= m.top - 0.5 && i.bottom <= m.bottom + 0.5, livre: outros.every((r) => !cruza(i, r)), altura: Math.round(i.height) };
  })()`);
  confere(geo.dentro && geo.livre && geo.altura >= 20, `a área de toque do slider do miniplayer fica dentro dele e não cobre outros controles: ${JSON.stringify(geo)}`);
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
  await av("document.getElementById('aba-letra').click(); 1");
  await dormir(400);
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
