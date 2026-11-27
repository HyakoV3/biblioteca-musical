import { describe, expect, it } from "vitest";
import hinarioJson from "../src-tauri/exemplo/hinario.json";
import { sincroniaCombina, type Sincronia } from "../src/lib/karaoke";
import { tituloDoHino } from "../src/lib/titulo";
import { duracaoEmBatidas } from "../src/lib/vezes";
import retrato1 from "../src-tauri/exemplo/partituras/hino-1.svg?raw";
import retrato2 from "../src-tauri/exemplo/partituras/hino-2.svg?raw";
import retrato3 from "../src-tauri/exemplo/partituras/hino-3.svg?raw";
import retrato4 from "../src-tauri/exemplo/partituras/hino-4.svg?raw";
import retrato5 from "../src-tauri/exemplo/partituras/hino-5.svg?raw";
import paisagem1 from "../src-tauri/exemplo/partituras/hino-1-paisagem.svg?raw";
import paisagem2 from "../src-tauri/exemplo/partituras/hino-2-paisagem.svg?raw";
import paisagem3 from "../src-tauri/exemplo/partituras/hino-3-paisagem.svg?raw";
import paisagem4 from "../src-tauri/exemplo/partituras/hino-4-paisagem.svg?raw";
import paisagem5 from "../src-tauri/exemplo/partituras/hino-5-paisagem.svg?raw";

// O pacote de exemplo embutido no app (src-tauri/exemplo/hinario.json): 5 hinos reais de domínio público (procedência em docs/licencas-de-terceiros.md).
type Nota = [number, number, number];
type Hino = { titulos?: { pt?: string; en?: string; es?: string }; compassos?: { normal: [number, number][] }; numero: number; titulo: string; autoria?: string; letra: string[]; andamento: number; vozes: { nome: string; notas: Nota[] }[]; sincronia?: Sincronia };
const pacote = hinarioJson as unknown as { hinario: { id: string }; hinos: Hino[] };

describe("pacote de exemplo embutido", () => {
  it("traz os cinco hinos, na ordem, com autoria e as quatro vozes", () => {
    expect(pacote.hinario.id).toBe("exemplo");
    expect(pacote.hinos.map((h) => h.numero)).toEqual([1, 2, 3, 4, 5]);
    for (const h of pacote.hinos) {
      expect(h.titulo.length).toBeGreaterThan(5);
      expect(h.autoria).toBeTruthy();
      expect(h.vozes.map((v) => v.nome)).toEqual(["Soprano", "Contralto", "Tenor", "Baixo"]);
      expect(h.andamento).toBeGreaterThanOrEqual(20);
      expect(h.andamento).toBeLessThanOrEqual(300);
    }
  });

  it("todas as vozes de um hino terminam juntas e as notas são válidas", () => {
    for (const h of pacote.hinos) {
      const fins = h.vozes.map((v) => Math.max(...v.notas.map(([i, d]) => i + d)));
      expect(new Set(fins.map((f) => f.toFixed(3))).size, `hino ${h.numero}`).toBe(1);
      for (const v of h.vozes) for (const [i, d, m] of v.notas) expect(i >= 0 && d > 0 && m >= 0 && m <= 127).toBe(true);
      expect(duracaoEmBatidas(h.vozes)).toBeGreaterThan(20);
    }
  });

  it("a sincronia do karaokê combina com a letra de cada hino", () => {
    for (const h of pacote.hinos) expect(sincroniaCombina(h.letra, h.sincronia), `hino ${h.numero}`).toBe(true);
  });

  it("a letra tem estrofes numeradas e os versos esperados (o hino 1 tem 4 estrofes de 9 versos)", () => {
    const estrofes = (h: Hino) => h.letra.join("\n").split("\n\n");
    expect(estrofes(pacote.hinos[0]!)).toHaveLength(4);
    for (const e of estrofes(pacote.hinos[0]!)) expect(e.split("\n")).toHaveLength(9);
    for (const h of pacote.hinos) estrofes(h).forEach((e, i) => expect(e.startsWith(`${i + 1}. `)).toBe(true));
  });

  it("cada hino tem a partitura embutida (retrato e paisagem) com um g.measure por compasso e o tempo (data-t e data-f) em cada nota", () => {
    const retratos = [retrato1, retrato2, retrato3, retrato4, retrato5];
    const paisagens = [paisagem1, paisagem2, paisagem3, paisagem4, paisagem5];
    const conta = (svg: string, re: RegExp) => svg.match(re)?.length ?? 0;
    pacote.hinos.forEach((h, i) => {
      for (const svg of [retratos[i]!, paisagens[i]!]) {
        // a ordem dos compassos do SVG é a ordem dos índices em `compassos` (o maior índice + 1 é quantos compassos escritos há)
        const escritos = Math.max(...h.compassos!.normal.map(([, c]) => c)) + 1;
        expect(conta(svg, /class="measure"/g), `hino ${h.numero}`).toBe(escritos);
        const notas = conta(svg, /class="note"/g);
        expect(notas).toBeGreaterThan(50);
        expect(conta(svg, /class="note" data-t="[\d.]+" data-f="[\d.]+"/g), `hino ${h.numero}`).toBe(notas);
        expect(svg).not.toMatch(/xlink:href|url\(|<script|font-face/);
      }
    });
  });

  it("cada hino mostra o nome consagrado no idioma da interface, e o título original na língua original", () => {
    const nome = (n: number, idioma: string) => tituloDoHino(pacote.hinos[n - 1]!, idioma);
    expect(["pt", "en", "es"].map((i) => nome(1, i))).toEqual(["Castelo Forte é Nosso Deus", "A Mighty Fortress Is Our God", "Castillo fuerte es nuestro Dios"]);
    expect(["pt", "en", "es"].map((i) => nome(2, i))).toEqual(["Noite Feliz", "Silent Night", "Noche de paz"]);
    expect(["pt", "en", "es"].map((i) => nome(3, i))).toEqual(["Santo, Santo, Santo", "Holy, Holy, Holy", "Santo, Santo, Santo"]); // inglês: o original
    expect(["pt", "en", "es"].map((i) => nome(4, i))).toEqual(["Maravilhosa Graça", "Amazing Grace", "Sublime gracia"]);
    expect(["pt", "en", "es"].map((i) => nome(5, i))).toEqual(["Ode à Alegria", "Ode to Joy", "Oda a la Alegría"]);
    expect(pacote.hinos.map((h) => h.titulo)).toEqual(["Ein feste Burg ist unser Gott", "Stille Nacht, heilige Nacht", "Holy, Holy, Holy", "Amazing Grace", "An die Freude"]);
  });
});
