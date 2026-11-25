import { describe, expect, it } from "vitest";
import { contextoValido, limparParaMarkdown, linhasDoContexto, marcarMudanca, montarContexto, resumoDoContexto, textoDoContexto, type Entrada } from "../src/lib/contexto";
import { pt } from "../src/lib/i18n/pt";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";

const tr = (d: Record<string, string>) => (c: string, p: Record<string, string | number> = {}) =>
  (d[c] ?? `?${c}`).replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? `{${k}}`));

const base: Entrada = { fone: true, metronomo: { ligado: false, bpm: 60, compasso: 4 }, hino: null };
const hino = (o: Partial<NonNullable<Entrada["hino"]>> = {}): Entrada["hino"] => ({
  tocando: true,
  numero: 10,
  titulo: "Hino fictício",
  tonalidade: "Si♭ maior",
  transposicao: 0,
  andamento: 69,
  andamentoOriginal: 69,
  parte: "tudo",
  vozes: [
    { nome: "Soprano", muda: false },
    { nome: "Contralto", muda: false },
    { nome: "Tenor", muda: false },
    { nome: "Baixo", muda: false },
  ],
  ...o,
});

describe("montarContexto", () => {
  it("sem fone ou sem nada tocando não há contexto", () => {
    expect(montarContexto({ ...base, fone: false, metronomo: { ligado: true, bpm: 65, compasso: 4 } })).toBeNull();
    expect(montarContexto(base)).toBeNull();
  });
  it("metrônomo simples e composto", () => {
    expect(montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 } })?.metronomo).toEqual({ bpm: 65, cliques: 4, familia: "simples", tempos: 4 });
    expect(montarContexto({ ...base, metronomo: { ligado: true, bpm: 120, compasso: 6 } })?.metronomo).toEqual({ bpm: 120, cliques: 6, familia: "composto", tempos: 2 });
    expect(montarContexto({ ...base, metronomo: { ligado: true, bpm: 90, compasso: 12 } })?.metronomo?.tempos).toBe(4);
  });
  it("hino: guarda só o andamento original quando difere; vozes mudas viram tocando=false", () => {
    const c = montarContexto({ ...base, hino: hino({ andamento: 60, vozes: [{ nome: "Soprano", muda: false }, { nome: "Contralto", muda: true }] }) })!;
    expect(c.origem).toBe("hino");
    expect(c.hino?.andamentoOriginal).toBe(69);
    expect(c.hino?.vozes).toEqual([{ nome: "Soprano", tocando: true }, { nome: "Contralto", tocando: false }]);
    expect(montarContexto({ ...base, hino: hino() })?.hino).not.toHaveProperty("andamentoOriginal");
  });
  it("o hino tem prioridade sobre o metrônomo", () => {
    expect(montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 }, hino: hino() })?.origem).toBe("hino");
  });
});

describe("marcarMudanca", () => {
  const a = montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 } });
  it("igual no fim: sem marca; diferente ou parou: com marca", () => {
    expect(marcarMudanca(a, a)?.mudouDurante).toBeUndefined();
    expect(marcarMudanca(a, montarContexto({ ...base, metronomo: { ligado: true, bpm: 70, compasso: 4 } }))?.mudouDurante).toBe(true);
    expect(marcarMudanca(a, null)?.mudouDurante).toBe(true);
    expect(marcarMudanca(null, a)).toBeNull();
  });
});

describe("contextoValido", () => {
  it("aceita o que o app grava; recusa lixo e versão futura", () => {
    const c = montarContexto({ ...base, hino: hino() });
    expect(contextoValido(c)).toEqual(c);
    expect(contextoValido(null)).toBeNull();
    expect(contextoValido({ v: 99, origem: "hino" })).toBeNull();
    expect(contextoValido({ v: 1, origem: "hino", hino: { numero: "x", vozes: [] } })).toBeNull();
  });
  it("recusa registro malformado, que quebraria o texto (sem título, voz sem nome, tempos fora de 2 a 4)", () => {
    const ok = montarContexto({ ...base, hino: hino() })!;
    expect(contextoValido({ ...ok, hino: { ...ok.hino!, titulo: undefined } })).toBeNull();
    expect(contextoValido({ ...ok, hino: { ...ok.hino!, vozes: [{ tocando: true }] } })).toBeNull();
    expect(contextoValido({ ...ok, hino: { ...ok.hino!, parte: "x" } })).toBeNull();
    const m = montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 } })!;
    expect(contextoValido({ ...m, metronomo: { ...m.metronomo!, tempos: 5 } })).toBeNull();
    expect(contextoValido({ ...m, metronomo: { ...m.metronomo!, familia: "x" } })).toBeNull();
  });
});

describe("textoDoContexto", () => {
  it("metrônomo simples (pt)", () => {
    const c = montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 } })!;
    expect(textoDoContexto(c, tr(pt), "pt")).toBe("*Gravação com contexto*\n- Com: metrônomo, 65 bpm\n- Compasso: quaternário simples (4 tempos)");
  });
  it("metrônomo composto diz o bpm por clique e por tempo", () => {
    const c = montarContexto({ ...base, metronomo: { ligado: true, bpm: 120, compasso: 6 } })!;
    const t = textoDoContexto(c, tr(pt), "pt");
    expect(t).toContain("120 bpm por clique (40 bpm por tempo)");
    expect(t).toContain("binário composto (6 cliques, 2 tempos de 3)");
  });
  it("hino com voz tirada, andamento mudado e transposição (pt)", () => {
    const c = montarContexto({
      ...base,
      hino: hino({ andamento: 60, transposicao: 1, vozes: [{ nome: "Soprano", muda: false }, { nome: "Contralto", muda: true }, { nome: "Tenor", muda: false }, { nome: "Baixo", muda: false }] }),
    })!;
    expect(textoDoContexto(c, tr(pt), "pt")).toBe(
      [
        "*Gravação com contexto*",
        '- Com: hino 10, "Hino fictício"',
        "- Vozes no fone: soprano, tenor e baixo _(sem contralto)_",
        "- Andamento: 60 bpm _(original 69)_",
        "- Tom do hino: Si♭ maior",
        "- Transposição: +1 semitom",
      ].join("\n"),
    );
  });
  it("linhas que não se aplicam somem; parte e mudança aparecem", () => {
    const c = marcarMudanca(montarContexto({ ...base, hino: hino({ tonalidade: null, parte: 2, transposicao: -2 }) }), null)!;
    const t = textoDoContexto(c, tr(pt), "pt");
    expect(t).not.toContain("Tom do hino");
    expect(t).not.toContain("original");
    expect(t).not.toContain("sem ");
    expect(t).toContain("Transposição: −2 semitons");
    expect(t).toContain("Parte: vez 2");
    expect(t).toContain("_Algo mudou durante a gravação");
  });
  it("título sem caracteres de formatação", () => {
    expect(limparParaMarkdown("A *bela* _voz_ ~x~ `y`")).toBe("A bela voz x y");
  });
  it("en e es têm as mesmas chaves que pt (nenhuma sem tradução)", () => {
    const chaves = Object.keys(pt).filter((k) => k.startsWith("ctx.") || k.startsWith("gravador."));
    for (const d of [en, es]) for (const k of chaves) expect(d, k).toHaveProperty([k]);
  });
  it("en: texto do hino", () => {
    const c = montarContexto({ ...base, hino: hino() })!;
    expect(textoDoContexto(c, tr(en), "en")).toContain("Voices in the headphones: soprano, contralto, tenor, and baixo");
  });
});

describe("linhas e resumo do contexto (o card da gravação)", () => {
  const pt_ = tr({ ...pt, "gravador.resumo_hino": "hino {numero}", "gravador.resumo_metronomo": "metrônomo, {bpm} bpm" });
  it("as linhas são as do texto enviado, sem formatação; a nota vai à parte", () => {
    const c = montarContexto({ ...base, hino: hino({ andamento: 60, transposicao: 1, vozes: [{ nome: "Soprano", muda: false }, { nome: "Contralto", muda: true }] }) })!;
    const l = linhasDoContexto(c, pt_, "pt");
    expect(l[0]!.texto).toBe('Com: hino 10, "Hino fictício"');
    expect(l[1]).toEqual({ texto: "Vozes no fone: soprano", nota: "sem contralto" });
    expect(l[2]).toEqual({ texto: "Andamento: 60 bpm", nota: "original 69" });
    expect(l.map((x) => x.texto).join()).not.toMatch(/[*_]/);
    // o Markdown enviado continua igual: as mesmas linhas, com a nota em itálico
    expect(textoDoContexto(c, pt_, "pt")).toContain("- Vozes no fone: soprano _(sem contralto)_");
  });
  it("na tela o título e o tom ficam como são; só o texto enviado tira * _ ~ e crase", () => {
    const c = montarContexto({ ...base, hino: hino({ titulo: "Louvor *ao* Senhor_", tonalidade: "Si♭ ~maior~" }) })!;
    const tela = linhasDoContexto(c, pt_, "pt").map((x) => x.texto).join("\n");
    expect(tela).toContain('Louvor *ao* Senhor_');
    expect(tela).toContain("Si♭ ~maior~");
    const enviado = textoDoContexto(c, pt_, "pt");
    expect(enviado).toContain("Louvor ao Senhor");
    expect(enviado).not.toContain("*ao*");
    expect(enviado).toContain("Si♭ maior");
  });
  it("sem nenhuma voz tocando o texto diz isso", () => {
    const c = montarContexto({ ...base, hino: hino({ vozes: [{ nome: "Soprano", muda: true }, { nome: "Tenor", muda: true }] }) })!;
    expect(linhasDoContexto(c, pt_, "pt").map((x) => x.texto)).toContain("Vozes no fone: nenhuma (todas silenciadas)");
  });
  it("o resumo de uma linha: hino com andamento e transposição, ou metrônomo", () => {
    expect(resumoDoContexto(montarContexto({ ...base, hino: hino({ andamento: 60, transposicao: 1 }) })!, pt_)).toBe("hino 10 · 60 bpm · +1 semitom");
    expect(resumoDoContexto(montarContexto({ ...base, hino: hino({ transposicao: -2 }) })!, pt_)).toBe("hino 10 · 69 bpm · −2 semitons");
    expect(resumoDoContexto(montarContexto({ ...base, metronomo: { ligado: true, bpm: 65, compasso: 4 } })!, pt_)).toBe("metrônomo, 65 bpm");
  });
});
