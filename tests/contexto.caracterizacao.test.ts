// Caracterização do contexto: percorre muitas entradas (metrônomo, hino, vozes, transposição, tons, notações, idiomas) e compara com a saída gravada antes do refactor (o hash em tests/fixtures/contexto-caracterizacao.sha256).
// Só se regrava o hash de propósito, quando o texto muda de verdade.
import { describe, expect, it } from "vitest";
import { contextoValido, linhasDoContexto, marcarMudanca, montarContexto, resumoDoContexto, textoDoContexto, type ContextoGravacao, type Entrada } from "../src/lib/contexto";
import esperado from "./fixtures/contexto-caracterizacao.sha256?raw";
import { pt } from "../src/lib/i18n/pt";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";

const tr = (d: Record<string, string>) => (c: string, p: Record<string, string | number> = {}) => (d[c] ?? `?${c}`).replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? `{${k}}`));

const vozesPadrao = [
  { nome: "Soprano", muda: false },
  { nome: "Contralto", muda: true },
  { nome: "Tenor", muda: false },
  { nome: "Parte I", muda: true },
];

function entradas(): Entrada[] {
  const lista: Entrada[] = [{ fone: false, metronomo: { ligado: true, bpm: 60, compasso: 4 }, hino: null }];
  for (const compasso of [2, 3, 4, 6, 9, 12]) lista.push({ fone: true, metronomo: { ligado: true, bpm: 65, compasso }, hino: null });
  lista.push({ fone: true, metronomo: { ligado: false, bpm: 60, compasso: 4 }, hino: null });
  const sem = { ligado: false, bpm: 60, compasso: 4 };
  const andamentos: [number, number | null | undefined][] = [[69, 69], [60, 69], [70, null], [80, undefined]];
  const todasMudas = vozesPadrao.map((v) => ({ ...v, muda: true }));
  const todasTocando = vozesPadrao.map((v) => ({ ...v, muda: false }));
  const combinacoes = [-3, -1, 0, 1, 5].flatMap((transposicao) =>
    (["tudo", "intro", 2] as const).flatMap((parte) =>
      [undefined, null, "Si♭ maior", "Fá# menor *x*"].flatMap((tonalidade) =>
        andamentos.flatMap(([andamento, andamentoOriginal]) =>
          [vozesPadrao, [], todasMudas, todasTocando].map((vozes) => ({ tocando: true, numero: 7, titulo: "Hino _fic_ `tício` ~x~", tonalidade, transposicao, andamento, andamentoOriginal, parte, vozes })),
        ),
      ),
    ),
  );
  for (const hino of combinacoes) lista.push({ fone: true, metronomo: sem, hino });
  return lista;
}

const hinoMin = { numero: 1, titulo: "a", andamento: 2, transposicao: 0 };
const lixo: unknown[] = [
  null, 1, "x", {}, { v: 0 }, { v: 2, origem: "hino" }, { v: 1, origem: "metronomo" }, { v: 1, origem: "outra" },
  { v: 1, origem: "metronomo", metronomo: { bpm: 1, cliques: 2, familia: "simples", tempos: 5 } },
  { v: 1, origem: "metronomo", metronomo: { bpm: 1, cliques: 2, familia: "simples", tempos: 2 } },
  { v: 1, origem: "metronomo", metronomo: { bpm: NaN, cliques: 2, familia: "simples", tempos: 2 } },
  { v: 1, origem: "metronomo", metronomo: { bpm: 1, cliques: 2, familia: "x", tempos: 2 } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "tudo", vozes: [null] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: 3, vozes: [{ nome: "a", tocando: true }] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "x", vozes: [] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, tonalidade: 3, parte: "intro", vozes: [] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, andamentoOriginal: "a", parte: "intro", vozes: [] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "intro", vozes: "a" } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "intro", vozes: [{ nome: 1, tocando: true }] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "intro", vozes: [{ nome: "a", tocando: 1 }] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, titulo: 3, parte: "intro", vozes: [] } },
  { v: 1, origem: "hino", hino: { ...hinoMin, parte: "intro", vozes: [], tonalidade: "Sol", andamentoOriginal: 3 } },
];

const DICIONARIOS: Record<string, Record<string, string>> = { pt, en, es };

/** Tudo o que o texto produz para um contexto num idioma, em cada notação. */
function saidasDoIdioma(c: ContextoGravacao, id: string): Record<string, unknown> {
  const t = tr(DICIONARIOS[id]!);
  const item: Record<string, unknown> = {};
  for (const nota of ["auto", "silabas", "letras"] as const) {
    item[`${id}.${nota}.md`] = textoDoContexto({ ...c, mudouDurante: true }, t, id, nota);
    item[`${id}.${nota}.l`] = linhasDoContexto(c, t, id, { notacao: nota });
  }
  item[`${id}.r`] = resumoDoContexto(c, t);
  return item;
}

const saidasDoTexto = (c: ContextoGravacao): Record<string, unknown> => Object.assign({}, ...Object.keys(DICIONARIOS).map((id) => saidasDoIdioma(c, id)));

async function gerar(): Promise<string> {
  const saida: unknown[] = [];
  const todas = entradas().map((e) => montarContexto(e));
  for (const c of todas) saida.push({ c, valido: contextoValido(c), mudou: marcarMudanca(c, c), mudou2: marcarMudanca(c, todas[1] ?? null), ...(c ? saidasDoTexto(c) : {}) });
  saida.push(lixo.map((x) => contextoValido(x)));
  saida.push([marcarMudanca(null, null), marcarMudanca(todas[1] ?? null, null)]);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(saida)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("contexto: caracterização", () => {
  it("a saída é idêntica à gravada", async () => {
    expect(await gerar()).toBe(esperado.trim());
  });
});
