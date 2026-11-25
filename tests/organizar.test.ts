import { describe, expect, it } from "vitest";
import { PAGINA, SEM_FILTRO, agrupar, chaveDeBusca, diaCivil, filtrar, grupoDe, janela, maisNovaPrimeiro, mesclar, resumir } from "../src/lib/organizar";
import type { MetaGravacao } from "../src/lib/gravacoes";
import type { ContextoGravacao } from "../src/lib/contexto";

const HINO = (numero: number, titulo: string): ContextoGravacao => ({
  v: 1,
  fone: true,
  origem: "hino",
  hino: { numero, titulo, transposicao: 0, andamento: 60, parte: "tudo", vozes: [{ nome: "Soprano", tocando: true }] },
});
const METRO: ContextoGravacao = { v: 1, fone: true, origem: "metronomo", metronomo: { bpm: 65, cliques: 4, familia: "simples", tempos: 4 } };
const meta = (id: string, criadaEm: number, contexto?: ContextoGravacao, bytes = 1000): MetaGravacao => ({ id, criadaEm, segundos: 5, tipo: "audio/webm", bytes, ...(contexto ? { contexto } : {}) });
const nomeDe = (m: MetaGravacao) => `Gravação ${new Date(m.criadaEm).getDate()}/${new Date(m.criadaEm).getMonth() + 1}`;
const dataDe = (m: MetaGravacao) => `${new Date(m.criadaEm).getDate()}/${new Date(m.criadaEm).getMonth() + 1}`;
const chave = (m: MetaGravacao) => chaveDeBusca(m, nomeDe, dataDe);
const ids = (l: MetaGravacao[]) => l.map((m) => m.id);
const DIA = 86_400_000;

describe("mesclar (leitura completa x mudanças durante ela)", () => {
  const a = meta("a", 3000), b = meta("b", 2000), c = meta("c", 1000);
  it("ordena da mais nova para a mais antiga", () => {
    expect(ids(mesclar([c, a, b], [], new Set()))).toEqual(["a", "b", "c"]);
    expect(ids([meta("x", 5), meta("y", 5)].sort(maisNovaPrimeiro))).toEqual(["y", "x"]); // empata pelo id, como o índice
  });
  it("a gravação salva durante a leitura não some", () => {
    const nova = meta("n", 4000);
    expect(ids(mesclar([a, b, c], [nova], new Set()))).toEqual(["n", "a", "b", "c"]);
  });
  it("a salva que a leitura também trouxe entra uma vez só", () => {
    expect(ids(mesclar([a, b], [a], new Set()))).toEqual(["a", "b"]);
  });
  it("a apagada durante a leitura não volta, venha de onde vier", () => {
    expect(ids(mesclar([a, b, c], [], new Set(["b"])))).toEqual(["a", "c"]);
    expect(ids(mesclar([a], [meta("n", 4000)], new Set(["n"])))).toEqual(["a"]);
  });
});

describe("resumir", () => {
  it("soma quantidade e bytes, ignorando valores inválidos", () => {
    expect(resumir([meta("a", 1, undefined, 100), meta("b", 2, undefined, 250)])).toEqual({ quantidade: 2, bytes: 350 });
    expect(resumir([{ ...meta("a", 1), bytes: NaN }])).toEqual({ quantidade: 1, bytes: 0 });
    expect(resumir([])).toEqual({ quantidade: 0, bytes: 0 });
  });
});

describe("filtrar", () => {
  const lista = [
    meta("h10", Date.UTC(2026, 10, 10, 15), HINO(10, "Prossegui vitoriosos")),
    meta("h100", Date.UTC(2026, 10, 11, 15), HINO(100, "Ó Santo Deus")),
    meta("m", Date.UTC(2026, 9, 5, 15), METRO),
    meta("s", Date.UTC(2026, 9, 6, 15)),
  ];
  const f = (filtro: "todas" | "hino" | "metronomo", busca = "") => ids(filtrar(lista, { filtro, busca }, chave));
  it("sem busca nem filtro devolve tudo", () => expect(filtrar(lista, SEM_FILTRO, chave)).toHaveLength(4));
  it("filtra pela origem", () => {
    expect(f("hino")).toEqual(["h10", "h100"]);
    expect(f("metronomo")).toEqual(["m"]);
  });
  it("busca só de número vale como número de hino (exato) e não casa com a data", () => {
    expect(f("todas", "10")).toEqual(["h10"]);
    expect(f("todas", "hino 100")).toEqual(["h100"]);
    expect(f("todas", "11")).toEqual([]); // há uma gravação do dia 11, mas não há hino 11
  });
  it("busca por palavras (sem acento) acha o título, o metrônomo e a data", () => {
    expect(f("todas", "santo deus")).toEqual(["h100"]);
    expect(f("todas", "O SANTO")).toEqual(["h100"]);
    expect(f("todas", "metronomo")).toEqual(["m"]);
    expect(f("todas", "gravacao")).toHaveLength(4);
  });
  it("a palavra da origem vale nas três línguas (pt, en e es)", () => {
    expect(f("todas", "metronome")).toEqual(["m"]);
    expect(f("todas", "hymn vitoriosos")).toEqual(["h10"]);
    expect(f("todas", "himno santo")).toEqual(["h100"]);
    expect(f("todas", "hino 100")).toEqual(["h100"]); // "hino N" sozinho segue valendo como número
  });
  it("filtro e busca se combinam; contexto malformado não quebra nem entra no filtro", () => {
    expect(f("hino", "vitoriosos")).toEqual(["h10"]);
    expect(f("metronomo", "vitoriosos")).toEqual([]);
    const ruim = meta("r", 1, { v: 1, fone: true, origem: "hino" } as ContextoGravacao);
    expect(ids(filtrar([ruim], { filtro: "hino", busca: "" }, chave))).toEqual([]);
    expect(ids(filtrar([ruim], SEM_FILTRO, chave))).toEqual(["r"]);
  });
});

describe("janela", () => {
  it("devolve as primeiras n", () => {
    expect(janela([1, 2, 3, 4], 2)).toEqual([1, 2]);
    expect(janela([1, 2], 10)).toEqual([1, 2]);
    expect(janela([1, 2], -1)).toEqual([]);
    expect(PAGINA).toBe(20);
  });
});

describe("agrupar por dia civil local", () => {
  const agora = new Date(2026, 10, 25, 14, 30).getTime();
  it("hoje, ontem, os últimos 7 dias e depois o mês", () => {
    expect(grupoDe(new Date(2026, 10, 25, 0, 1).getTime(), agora).tipo).toBe("hoje");
    expect(grupoDe(new Date(2026, 10, 24, 23, 59).getTime(), agora).tipo).toBe("ontem");
    expect(grupoDe(new Date(2026, 10, 19, 10).getTime(), agora).tipo).toBe("semana"); // 6 dias antes
    expect(grupoDe(new Date(2026, 10, 18, 10).getTime(), agora)).toMatchObject({ tipo: "mes", chave: "2026-11" }); // 7 dias antes
    expect(grupoDe(new Date(2025, 11, 31, 10).getTime(), agora)).toMatchObject({ tipo: "mes", chave: "2025-12", ano: 2025 });
    expect(grupoDe(agora + 5 * DIA, agora).tipo).toBe("hoje"); // relógio adiantado: não vira "amanhã"
  });
  it("a mudança de horário de verão não desloca o dia (dias civis, e não Δms/86400000)", () => {
    // Em muitos fusos o dia tem 23 ou 25 horas na virada; as componentes locais não erram.
    for (const [ano, mes] of [[2026, 2], [2026, 9], [2026, 10]] as const) {
      for (let dia = 1; dia < 28; dia++) {
        const meiaNoite = new Date(ano, mes, dia, 0, 0, 30).getTime();
        const fimDoDia = new Date(ano, mes, dia, 23, 59, 30).getTime();
        expect(diaCivil(fimDoDia) - diaCivil(meiaNoite)).toBe(0);
        expect(diaCivil(new Date(ano, mes, dia + 1, 0, 0, 30).getTime()) - diaCivil(meiaNoite)).toBe(1);
      }
    }
  });
  it("agrupa trechos seguidos e preserva a ordem", () => {
    const lista = [
      meta("a", new Date(2026, 10, 25, 9).getTime()),
      meta("b", new Date(2026, 10, 25, 8).getTime()),
      meta("c", new Date(2026, 10, 24, 20).getTime()),
      meta("d", new Date(2026, 9, 2).getTime()),
    ];
    const g = agrupar(lista, agora);
    expect(g.map((x) => [x.chave, ids(x.itens)])).toEqual([["hoje", ["a", "b"]], ["ontem", ["c"]], ["2026-10", ["d"]]]);
  });
});

describe("escala: milhares de registros", () => {
  const N = 10000;
  const base = new Date(2026, 10, 25).getTime();
  const lista = Array.from({ length: N }, (_, i) => meta(`g${String(i).padStart(5, "0")}`, base - i * 3_600_000, i % 3 === 0 ? HINO(1 + (i % 600), `Hino ${i}`) : i % 3 === 1 ? METRO : undefined));
  it("filtra, busca e agrupa 10000 sem perder nem repetir (a complexidade, e não o tempo)", () => {
    const chaves = new Map(lista.map((m) => [m.id, chave(m)]));
    const hinos = filtrar(lista, { filtro: "hino", busca: "" }, (m) => chaves.get(m.id)!);
    expect(hinos.length).toBe(Math.ceil(N / 3));
    expect(new Set(ids(hinos)).size).toBe(hinos.length);
    const por = filtrar(lista, { filtro: "todas", busca: "7" }, (m) => chaves.get(m.id)!);
    expect(por.every((m) => (m.contexto as { hino?: { numero: number } }).hino?.numero === 7)).toBe(true);
    const grupos = agrupar(lista, base + 12 * 3_600_000);
    expect(grupos.reduce((s, g) => s + g.itens.length, 0)).toBe(N);
    expect(janela(lista, PAGINA)).toHaveLength(PAGINA);
  });
});
