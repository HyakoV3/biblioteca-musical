// Gera prévias de áudio (MP3) para comparar de ouvido os timbres sintetizados: ANTES (tabela fixa), AGORA (timbre por
// altura, I-15) e GRAVADO (a amostra do FluidR3_GM). Cada arquivo tem os trechos em sequência, separados por silêncio
// (uma escala de duas oitavas e uma nota final longa). Os sete instrumentos com timbre medido têm antes → agora →
// gravado; os demais têm sintetizado → gravado, e os sem gravado no banco só o sintetizado. O nome do arquivo diz a ordem.
//
// Roda o código REAL do app (`agendarNota`, em src/lib/sintetizador.ts) num Chrome headless e MUDO, com um
// OfflineAudioContext: renderiza em memória, sem tocar nada nas caixas.
//
// Uso: node tools/previas-timbres.mjs <pasta-de-saida> [instrumento ...]
// Precisa de: Chrome/Chromium (variável CHROME), ffmpeg e sons-fonte/FluidR3_GM/ (tools/baixar-sons-gm.py), fora do Git.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../", import.meta.url)); // decodifica %20 e acentos; `.pathname` quebraria com espaço no caminho
const PORTA_VITE = 5198;
const PORTA_CHROME = 9341;
// Instrumento da síntese -> [arquivo da amostra gravada (null = o banco não tem), nota inicial da escala, id no catálogo
// de gravados]. A nota inicial fica na região natural do instrumento e a escala sobe duas oitavas, dentro das notas que o
// banco toca (o contrabaixo é mudo acima da nota 57). Os sete primeiros são os que têm timbre medido (I-15).
const INSTRUMENTOS = {
  trompete: ["trumpet", 54, "real_trompete"],
  trombone: ["trombone", 40, "real_trombone"],
  tuba: ["tuba", 28, "real_tuba"],
  fagote: ["bassoon", 36, "real_fagote"],
  oboe: ["oboe", 60, "real_oboe"],
  sax_alto: ["alto_sax", 51, "real_sax_alto"],
  sax_tenor: ["tenor_sax", 46, "real_sax_tenor"],
  flauta_doce: ["recorder", 72, "real_flauta_doce"],
  flauta: ["flute", 60, "real_flauta"],
  violino: ["violin", 55, "real_violino"],
  clarinete: ["clarinet", 52, "real_clarinete"],
  viola: ["viola", 48, "real_viola"],
  violoncelo: ["cello", 36, "real_violoncelo"],
  contrabaixo: ["contrabass", 31, "real_contrabaixo"],
  trompa: ["french_horn", 41, "real_trompa"],
  flugelhorn: [null, 55, null],
  bombardino: [null, 40, null],
  orgao_suave: [null, 48, null],
  orgao_principal: ["drawbar_organ", 48, "real_orgao_tirantes"], // o equivalente gravado é o órgão de tirantes
  orgao_pleno: [null, 48, null],
};
const ESCALA = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24]; // maior, duas oitavas
const NOTAS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const filhos = [];
let perfil = null;

const encerrar = (p, sinal) => {
  try {
    process.kill(-p.pid, sinal);
  } catch {
    /* já saiu */
  }
};
async function limpar() {
  for (const p of filhos) encerrar(p, "SIGTERM");
  await dormir(1500);
  for (const p of filhos) encerrar(p, "SIGKILL");
  await dormir(500);
  if (perfil) rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
for (const [sinal, codigo] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(sinal, async () => {
    await limpar();
    process.exit(codigo);
  });
}

function acharChrome() {
  for (const c of [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].filter(Boolean)) {
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error("Chrome ou Chromium não encontrado (defina CHROME)");
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

const midiDaNota = (nome) => {
  const m = /^([A-G])([b#]?)(\d)$/.exec(nome);
  return 12 * (Number(m[3]) + 1) + NOTAS[m[1]] + ({ "": 0, b: -1, "#": 1 })[m[2]];
};

/** As amostras do instrumento que a escala usa: { midi: base64 do MP3 }. */
function amostrasDaEscala(arquivo, base) {
  const texto = readFileSync(join(RAIZ, "sons-fonte", "FluidR3_GM", `${arquivo}-mp3.js`), "utf8");
  const todas = new Map();
  for (const m of texto.matchAll(/"([A-G][b#]?\d)":\s*"data:audio\/mp3;base64,([^"]+)"/g)) todas.set(midiDaNota(m[1]), m[2]);
  const saida = {};
  for (const grau of ESCALA) {
    const midi = base + grau;
    if (!todas.has(midi)) throw new Error(`${arquivo}: sem a amostra da nota ${midi}`);
    saida[midi] = todas.get(midi);
  }
  return saida;
}

function wav16(pcm, sr) {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  return b;
}

// Roda dentro da página (a Vite serve os módulos do app). Devolve o PCM de 16 bits (em base64) dos três trechos.
const NA_PAGINA = `async (dados) => {
  const { agendarNota } = await import("/src/lib/sintetizador.ts");
  const { INSTRUMENTOS } = await import("/src/lib/instrumentos.ts");
  const { REALISTAS } = await import("/src/lib/realista.ts");
  const { temTimbre: medido_ } = await import("/src/lib/timbres.ts");
  const SR = 44100, PASSO = 0.5, FINAL = 1.6, SILENCIO = 0.8;
  const notas = dados.escala.map((m, i) => [i * PASSO, PASSO * 0.95, m]);
  notas.push([notas.length * PASSO, FINAL, dados.escala[dados.escala.length - 1] - 12]);
  const duracao = notas.length * PASSO + FINAL + 0.3;
  const frequencia = (m) => 440 * 2 ** ((m - 69) / 12);

  // Como a nota era feita antes da I-15: uma tabela de harmônicos por instrumento, igual em todas as alturas.
  const ondasAntigas = new Map();
  function notaAntiga(ctx, destino, id, midi, ini, dur) {
    const perfil = INSTRUMENTOS[id];
    let onda = ondasAntigas.get(ctx);
    if (!onda) { onda = ctx.createPeriodicWave(new Float32Array(perfil.harmonicos.length), Float32Array.from(perfil.harmonicos)); ondasAntigas.set(ctx, onda); }
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.setPeriodicWave(onda); osc.frequency.value = frequencia(midi);
    const fim = ini + Math.max(dur, 0.05), ataque = Math.min(perfil.ataque, (fim - ini) / 2);
    env.gain.setValueAtTime(0, ini); env.gain.linearRampToValueAtTime(perfil.nivel, ini + ataque);
    env.gain.setValueAtTime(perfil.nivel, Math.max(ini + ataque, fim - perfil.solta)); env.gain.linearRampToValueAtTime(0, fim);
    osc.connect(env).connect(destino);
    if (perfil.vibrato) {
      const lfo = ctx.createOscillator(), prof = ctx.createGain();
      lfo.frequency.value = perfil.vibrato.hz;
      prof.gain.setValueAtTime(0, ini); prof.gain.setValueAtTime(0, ini + perfil.vibrato.atraso);
      prof.gain.linearRampToValueAtTime(perfil.vibrato.cents, ini + perfil.vibrato.atraso + 0.25);
      lfo.connect(prof).connect(osc.detune); lfo.start(ini); lfo.stop(fim + 0.02);
    }
    osc.start(ini); osc.stop(fim + 0.02);
  }

  async function renderizar(montar) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * duracao), SR);
    const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination); // a mesma cadeia do app
    const mestre = ctx.createGain(); mestre.gain.value = 0.9; mestre.connect(comp);
    await montar(ctx, mestre);
    return (await ctx.startRendering()).getChannelData(0);
  }
  // Só os instrumentos com timbre por altura (I-15: medido ou derivado de medidas) mudaram: nos outros o "antes" é idêntico ao "agora" e não se repete.
  const medido = medido_(dados.id);
  const antes = medido ? await renderizar((ctx, d) => { for (const [t, dur, m] of notas) notaAntiga(ctx, d, dados.id, m, 0.05 + t, dur); }) : null;
  const agora = await renderizar((ctx, d) => { const ondas = new Map(); for (const [t, dur, m] of notas) agendarNota(ctx, ondas, d, dados.id, m, 0.05 + t, dur); });
  const gravado = !dados.real ? null : await renderizar(async (ctx, d) => {
    const saida = ctx.createGain(); saida.gain.value = REALISTAS[dados.real].ganho; saida.connect(d);
    const buffers = {};
    for (const m of new Set(notas.map((n) => n[2]))) {
      const bin = atob(dados.amostras[m]); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      buffers[m] = await ctx.decodeAudioData(u.buffer);
    }
    for (const [t, dur, m] of notas) {
      const fonte = ctx.createBufferSource(), env = ctx.createGain(), ini = 0.05 + t, fim = ini + Math.max(dur, 0.05);
      fonte.buffer = buffers[m];
      env.gain.setValueAtTime(1, ini); env.gain.setValueAtTime(1, Math.max(ini, fim - 0.08)); env.gain.linearRampToValueAtTime(0, fim);
      fonte.connect(env).connect(saida); fonte.start(ini); fonte.stop(fim + 0.02);
    }
  });
  const rms = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  const nivel = { antes: antes && rms(antes), agora: rms(agora), gravado: gravado && rms(gravado) };
  // O gravado é igualado ao AGORA em volume eficaz: a comparação é de TIMBRE, não de quem está mais alto.
  const fatorGravado = gravado ? nivel.agora / nivel.gravado : 1;
  const partes = medido ? ["antes", "agora"] : ["sintetizado"];
  const todos = medido ? [antes, agora] : [agora];
  if (gravado) { partes.push("gravado"); todos.push(gravado.map((x) => x * fatorGravado)); }
  const lacuna = new Float32Array(Math.ceil(SR * SILENCIO));
  const juntos = [];
  todos.forEach((v, i) => { juntos.push(...(i ? [lacuna] : []), v); });
  const total = juntos.reduce((s, v) => s + v.length, 0);
  const saida = new Int16Array(total); let pico = 0, p = 0;
  for (const v of juntos) for (let i = 0; i < v.length; i++) pico = Math.max(pico, Math.abs(v[i]));
  const k = pico > 0.98 ? 0.98 / pico : 1;
  for (const v of juntos) for (let i = 0; i < v.length; i++) saida[p++] = Math.round(Math.max(-1, Math.min(1, v[i] * k)) * 32767);
  let b64 = ""; const bytes = new Uint8Array(saida.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { pcm: btoa(b64), niveis: nivel, partes, fatorGravado, duracao, silencio: SILENCIO, pico };
}`;

async function principal() {
  const saida = process.argv[2];
  if (!saida) {
    console.error("uso: node tools/previas-timbres.mjs <pasta-de-saida> [instrumento ...]");
    process.exit(2);
  }
  mkdirSync(saida, { recursive: true });
  const nomes = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(INSTRUMENTOS);
  for (const n of nomes) if (!INSTRUMENTOS[n]) throw new Error(`instrumento desconhecido: ${n}`);

  const vite = spawn(process.execPath, [join(RAIZ, "node_modules/vite/bin/vite.js"), "dev", "--port", String(PORTA_VITE), "--strictPort", "--host", "127.0.0.1"], {
    cwd: RAIZ, stdio: "ignore", detached: true,
  });
  filhos.push(vite);
  await esperarUrl(`http://127.0.0.1:${PORTA_VITE}/`, 60000);

  perfil = mkdtempSync(join(tmpdir(), "bm-previas-"));
  const chrome = spawn(
    acharChrome(),
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--mute-audio", `--user-data-dir=${perfil}`, `--remote-debugging-port=${PORTA_CHROME}`, "about:blank"],
    { stdio: "ignore", detached: true },
  );
  filhos.push(chrome);
  await esperarUrl(`http://127.0.0.1:${PORTA_CHROME}/json/version`, 30000);

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
  await enviar("Page.enable");
  await enviar("Runtime.enable");
  // O app procura o Tauri ao carregar: um stub mínimo evita erros que não interessam aqui.
  await enviar("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__TAURI_INTERNALS__ = { invoke: async () => null, transformCallback: () => 0, metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } } };`,
  });
  await enviar("Page.navigate", { url: `http://127.0.0.1:${PORTA_VITE}/` });
  await dormir(6000); // primeira compilação pelo Vite

  console.log(`${"instrumento".padEnd(16)} partes (volume eficaz em dB; o gravado vai igualado ao último sintetizado na prévia)`);
  let ordem = 0;
  for (const id of nomes) {
    const [arquivo, base, real] = INSTRUMENTOS[id];
    const dados = { id, real, escala: ESCALA.map((g) => base + g), amostras: arquivo ? amostrasDaEscala(arquivo, base) : {} };
    const r = await enviar("Runtime.evaluate", { expression: `(${NA_PAGINA})(${JSON.stringify(dados)})`, returnByValue: true, awaitPromise: true });
    if (r.error) throw new Error(`${id}: CDP ${r.error.message}`); // erro do protocolo vem sem `result`
    if (r.result?.exceptionDetails) throw new Error(`${id}: ${JSON.stringify(r.result.exceptionDetails).slice(0, 400)}`);
    const v = r.result.result.value;
    const pcm = new Int16Array(Buffer.from(v.pcm, "base64").buffer.slice(0));
    const wav = join(perfil, `${id}.wav`);
    writeFileSync(wav, wav16(pcm, 44100));
    // Numerado para a lista seguir a ordem do catálogo; o nome diz a ordem dos trechos dentro do arquivo.
    const mp3 = join(saida, `${String(++ordem).padStart(2, "0")}-${id}-${v.partes.join("-")}.mp3`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-q:a", "2", mp3]);
    const f = (x) => (20 * Math.log10(x)).toFixed(1);
    const niveis = v.partes.map((p) => `${p} ${f(v.niveis[p === "sintetizado" ? "agora" : p])}`).join(" | ");
    console.log(`${id.padEnd(16)} ${niveis}  -> ${mp3}`);
  }
}

principal()
  .then(() => limpar())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await limpar();
    process.exit(1);
  });
