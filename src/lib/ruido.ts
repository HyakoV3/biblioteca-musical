// Os filtros de ruído por rede neural do Gravador (I-29): RNNoise e GTCRN, em WebAssembly, rodando num AudioWorklet entre o microfone e o gravador. TUDO LOCAL: o `.wasm` e o worklet saem
// do próprio app (nada é baixado de um servidor), e nenhum áudio sai do aparelho. Este módulo só é carregado (`import()`) quando a pessoa escolhe um desses filtros, para não pesar na abertura.
// Os dois pedem um contexto de áudio de 48 kHz (`TAXA_NEURAL`).
import { GtcrnWorkletNode, RnnoiseWorkletNode, loadGtcrn, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import gtcrnWorkletUrl from "@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?url";
import gtcrnWasmUrl from "@sapphi-red/web-noise-suppressor/gtcrn.wasm?url";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

export type NoDeFiltro = AudioWorkletNode & { destroy(): void };

/** O `.wasm` já lido, por filtro: ler de novo a cada gravação seria à toa (e o arquivo é local, mas ainda assim são ~150 a ~200 KB). */
const binarios = new Map<string, Promise<ArrayBuffer>>();
const modulosCarregados = new WeakMap<BaseAudioContext, Set<string>>();

/** Liga o filtro neural em `ctx` (que deve estar a 48 kHz) e devolve o nó: a fonte entra nele e a saída vai ao gravador. Rejeita se o AudioWorklet ou o WebAssembly não estão disponíveis. */
export async function criarFiltro(ctx: AudioContext, qual: "rnnoise" | "gtcrn"): Promise<NoDeFiltro> {
  if (!ctx.audioWorklet) throw new Error("este aparelho não tem AudioWorklet");
  const jaTem = modulosCarregados.get(ctx) ?? new Set<string>();
  if (!jaTem.has(qual)) {
    await ctx.audioWorklet.addModule(qual === "rnnoise" ? rnnoiseWorkletUrl : gtcrnWorkletUrl);
    jaTem.add(qual);
    modulosCarregados.set(ctx, jaTem);
  }
  let binario = binarios.get(qual);
  if (!binario) {
    binario = qual === "rnnoise" ? loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }) : loadGtcrn({ url: gtcrnWasmUrl });
    binarios.set(qual, binario);
    binario.catch(() => binarios.delete(qual)); // uma falha não fica guardada: a próxima gravação tenta de novo
  }
  const wasmBinary = await binario;
  return qual === "rnnoise" ? new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary }) : new GtcrnWorkletNode(ctx, { maxChannels: 1, wasmBinary });
}
