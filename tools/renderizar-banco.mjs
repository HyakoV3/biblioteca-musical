// Renderiza um SoundFont (.sf2) em amostras por nota, no MESMO formato do banco que o app já lê (<instrumento>-mp3.js, um objeto
// com uma nota em base64 de MP3 por chave, como o do midi-js-soundfonts), para o `preparar-sons.py` e o pacote de sons.
//
// Uso:
//   SPESSASYNTH=/caminho/node_modules/spessasynth_core/dist/index.js \
//   node tools/renderizar-banco.mjs <banco.sf2> <pasta-de-saida> [instrumento ...]
//
// O `spessasynth_core` (Apache 2.0) NÃO é dependência do projeto: é só desta ferramenta de manutenção. Instale-o fora do
// repositório (por exemplo `npm install --prefix ~/tmp/render spessasynth_core`) e aponte `SPESSASYNTH` para o index.js dele.
// Precisa também de ffmpeg. As amostras saem SECAS (sem reverb nem coro): o app já aplica o seu próprio compressor, e um
// reverb gravado dentro de cada nota embolaria as notas seguidas de um hino.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SR = 44100;
const FAIXA = [30, 86]; // a mesma de tools/preparar-sons.py
const SEGURA = 2.6; // segundos com a nota ligada
const CAUDA = 0.5; // e o que sobra depois de soltar: cada amostra tem ~3,1 s, como as do banco anterior
const VELOCIDADE = 100;
const KBPS = 80;
const NOMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]; // com bemóis, como no banco original
// Arquivo do pacote -> programa General MIDI (0 a 127).
const PROGRAMAS = {
  drawbar_organ: 16, flute: 73, recorder: 74, clarinet: 71, oboe: 68, alto_sax: 65, tenor_sax: 66, bassoon: 70,
  trumpet: 56, french_horn: 60, trombone: 57, tuba: 58, violin: 40, viola: 41, cello: 42, contrabass: 43,
};

const nomeDaNota = (m) => `${NOMES[m % 12]}${Math.floor(m / 12) - 1}`;

const [bancoSf2, saida, ...pedidos] = process.argv.slice(2);
if (!bancoSf2 || !saida) {
  console.error("uso: SPESSASYNTH=<index.js> node tools/renderizar-banco.mjs <banco.sf2> <pasta-de-saida> [instrumento ...]");
  process.exit(2);
}
const lib = await import(process.env.SPESSASYNTH ? pathToFileURL(process.env.SPESSASYNTH).href : "spessasynth_core");
const { SoundBankLoader, SpessaSynthProcessor } = lib;
const instrumentos = pedidos.length ? pedidos : Object.keys(PROGRAMAS);
for (const i of instrumentos) if (!(i in PROGRAMAS)) throw new Error(`instrumento desconhecido: ${i} (${Object.keys(PROGRAMAS).join(", ")})`);

const sf = fs.readFileSync(bancoSf2);
const banco = SoundBankLoader.fromArrayBuffer(sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.byteLength));
fs.mkdirSync(saida, { recursive: true });

async function renderizarNota(programa, midi) {
  const synth = new SpessaSynthProcessor(SR, { eventsEnabled: false, effectsEnabled: false });
  synth.soundBankManager.addSoundBank(banco, "main");
  await synth.ready;
  synth.programChange(0, programa);
  synth.controllerChange(0, 91, 0); // reverb 0
  synth.controllerChange(0, 93, 0); // coro 0
  const n = Math.ceil(SR * (SEGURA + CAUDA));
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const solta = Math.round(SR * SEGURA);
  let pos = 0;
  synth.noteOn(0, midi, VELOCIDADE);
  while (pos < n) {
    if (pos >= solta && pos - solta < 128) synth.noteOff(0, midi);
    const proximo = pos < solta ? Math.min(solta, n) : n;
    const bloco = Math.max(1, Math.min(128, proximo - pos));
    synth.process(L, R, pos, bloco);
    pos += bloco;
  }
  const mono = new Float32Array(n);
  for (let k = 0; k < n; k++) mono[k] = (L[k] + R[k]) / 2;
  return mono;
}

function emMp3(pcm) {
  const saidaMp3 = execFileSync(
    "ffmpeg",
    ["-v", "error", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", `${KBPS}k`, "-f", "mp3", "pipe:1"],
    { input: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), maxBuffer: 1 << 26 },
  );
  return saidaMp3.toString("base64");
}

for (const arquivo of instrumentos) {
  const linhas = [];
  for (let midi = FAIXA[0]; midi <= FAIXA[1]; midi++) {
    const pcm = await renderizarNota(PROGRAMAS[arquivo], midi);
    // Pequeno fade nos últimos 30 ms: a nota terminada pelo corte não pode estalar.
    const fade = Math.round(SR * 0.03);
    for (let k = 0; k < fade; k++) pcm[pcm.length - 1 - k] *= k / fade;
    linhas.push(`${JSON.stringify(nomeDaNota(midi))}: ${JSON.stringify(`data:audio/mp3;base64,${emMp3(pcm)}`)}`);
  }
  const texto =
    "if (typeof(MIDI) === 'undefined') var MIDI = {};\n" +
    "if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};\n" +
    `MIDI.Soundfont.${arquivo} = {\n${linhas.join(",\n")},\n}\n`;
  const destino = path.join(saida, `${arquivo}-mp3.js`);
  fs.writeFileSync(destino, texto);
  console.log(`${arquivo.padEnd(14)} ${linhas.length} notas, ${(fs.statSync(destino).size / 1e6).toFixed(2)} MB -> ${destino}`);
}
process.exit(0);
