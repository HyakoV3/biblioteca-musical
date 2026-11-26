import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hino } from "../src/lib/biblioteca.svelte";
import { escada } from "./amostras";

// O sintetizador de verdade usa o Web Audio, que não existe no Node. Este falso guarda cada chamada e deixa o teste decidir QUANDO o `tocar` termina
// (promessa controlada), para exercitar os `await` intercalados do store: parar, pausar e buscar no meio do carregamento do som.
const falso = vi.hoisted(() => {
  const estado = {
    chamadas: [] as string[],
    tocar: [] as { opcoes: unknown; partida: unknown; resolver: (d: number) => void; rejeitar: (e: unknown) => void }[],
    relogio: 0,
    automatico: true,
    volumes: [] as string[],
    /** Quando preenchida, `pausar` só termina quando o teste chamar isto. */
    pausa: null as null | (() => void),
    segurarPausa: false,
  };
  return estado;
});

vi.mock("../src/lib/sintetizador", () => ({
  Sintetizador: class {
    tocar(_vozes: unknown, opcoes: unknown, partida: unknown = {}) {
      falso.chamadas.push("tocar");
      return new Promise<number>((resolver, rejeitar) => {
        falso.tocar.push({ opcoes, partida, resolver, rejeitar });
        if (falso.automatico) resolver(10);
      });
    }
    async pausar() {
      falso.chamadas.push("pausar");
      if (falso.segurarPausa) await new Promise<void>((ok) => (falso.pausa = ok));
    }
    async continuar() {
      falso.chamadas.push("continuar");
    }
    parar() {
      falso.chamadas.push("parar");
    }
    volume(voz: number, valor: number) {
      falso.chamadas.push("volume");
      falso.volumes.push(`${voz}:${valor}`);
    }
    decorrido() {
      return falso.relogio;
    }
    audivel() {
      return falso.relogio;
    }
  },
}));

const { reproducao } = await import("../src/lib/reproducao.svelte");

// Dados FICTÍCIOS: um hino de duas vozes, 3 estrofes, sem final nem introdução.
const hino: Hino = {
  numero: 1,
  titulo: "Hino de teste",
  letra: ["1. primeira", "2. segunda", "3. terceira"],
  andamento: 60,
  vozes: [escada("Soprano", 8, 2), escada("Baixo", 8, 2, 48)],
};

const contar = (nome: string) => falso.chamadas.filter((c) => c === nome).length;
const soltar = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  reproducao.limpar();
  falso.chamadas.length = 0;
  falso.tocar.length = 0;
  falso.relogio = 0;
  falso.automatico = true;
  falso.volumes.length = 0;
  falso.pausa = null;
  falso.segurarPausa = false;
});

describe("store de reprodução", () => {
  it("tocar: vai a 'tocando' com a duração e o hino atual", async () => {
    await reproducao.tocar(hino, 1);
    expect(reproducao.estado).toBe("tocando");
    expect(reproducao.duracao).toBe(10);
    expect(reproducao.atual?.numero).toBe(1);
    expect(reproducao.erro).toBe("");
  });

  it("pausar e continuar alternam o estado e chamam o sintetizador", async () => {
    await reproducao.tocar(hino, 1);
    await reproducao.pausar();
    expect(reproducao.estado).toBe("pausado");
    await reproducao.continuar();
    expect(reproducao.estado).toBe("tocando");
    expect(contar("pausar")).toBe(1);
    expect(contar("continuar")).toBe(1);
  });

  it("parar zera tudo e silencia o som", async () => {
    await reproducao.tocar(hino, 1);
    reproducao.parar();
    expect(reproducao.estado).toBe("parado");
    expect(reproducao.atual).toBeNull();
    expect(reproducao.decorrido).toBe(0);
    expect(contar("parar")).toBeGreaterThan(0);
  });

  it("Parar durante o carregamento não deixa o som começar", async () => {
    falso.automatico = false;
    const p = reproducao.tocar(hino, 1);
    await soltar();
    reproducao.parar(); // a pessoa tocou em Parar enquanto o áudio iniciava
    falso.tocar[0].resolver(10);
    await p;
    expect(reproducao.estado).toBe("parado");
    expect(reproducao.atual).toBeNull();
    expect(reproducao.erro).toBe("");
  });

  it("falha ao iniciar o áudio: volta a 'parado' e mostra o erro", async () => {
    falso.automatico = false;
    const p = reproducao.tocar(hino, 1);
    await soltar();
    falso.tocar[0].rejeitar(new Error("bloqueado"));
    await p;
    expect(reproducao.estado).toBe("parado");
    expect(reproducao.erro).toContain("bloqueado");
  });

  it("irPara tocando reagenda dali e continua tocando", async () => {
    await reproducao.tocar(hino, 1);
    await reproducao.irPara(4);
    expect(reproducao.estado).toBe("tocando");
    expect(falso.tocar[1].partida).toEqual({ aPartirDe: 4, pausado: false }); // 4 s a 60 bpm = 4 batidas
  });

  it("irPara pausado reagenda pausado e fica pausado", async () => {
    await reproducao.tocar(hino, 1);
    await reproducao.pausar();
    await reproducao.irPara(2);
    expect(reproducao.estado).toBe("pausado");
    expect(falso.tocar[1].partida).toEqual({ aPartirDe: 2, pausado: true });
  });

  it("irPara durante um reagendamento guarda só a última posição e a aplica ao terminar", async () => {
    await reproducao.tocar(hino, 1);
    falso.automatico = false;
    const a = reproducao.irPara(2);
    await soltar();
    await reproducao.irPara(3); // descartada: há um reagendamento em curso
    await reproducao.irPara(5); // a última vale
    falso.tocar[1].resolver(10);
    await soltar();
    falso.tocar[2].resolver(10);
    await a;
    expect(falso.tocar.map((t) => (t.partida as { aPartirDe?: number }).aPartirDe)).toEqual([undefined, 2, 5]);
  });

  it("irPara sem nada tocando não faz nada", async () => {
    await reproducao.irPara(3);
    expect(falso.tocar).toHaveLength(0);
    expect(reproducao.estado).toBe("parado");
  });

  it("continuar reagenda se o andamento mudou na pausa", async () => {
    await reproducao.tocar(hino, 1);
    await reproducao.pausar();
    reproducao.config(hino).andamento = 90;
    await reproducao.continuar();
    expect(falso.tocar).toHaveLength(2);
    expect(reproducao.estado).toBe("tocando");
  });

  it("REP-001: volume e mudo mexidos durante o carregamento chegam ao som quando ele começa", async () => {
    falso.automatico = false;
    const p = reproducao.tocar(hino, 1);
    await soltar();
    const c = reproducao.config(hino);
    c.mudas[0] = true;
    c.volumes[1] = 0.4;
    falso.tocar[0].resolver(10);
    await p;
    expect(falso.volumes).toEqual(["0:0", "1:0.4"]);
    expect(falso.tocar).toHaveLength(1); // volume não pede reagendamento
  });

  it("REP-001: andamento mudado durante o carregamento reagenda do começo com o valor novo", async () => {
    falso.automatico = false;
    const p = reproducao.tocar(hino, 1);
    await soltar();
    reproducao.config(hino).andamento = 90;
    falso.tocar[0].resolver(10);
    await soltar();
    expect(falso.tocar).toHaveLength(2);
    expect((falso.tocar[1].opcoes as { andamento: number }).andamento).toBe(90);
    expect(falso.tocar[1].partida).toEqual({ aPartirDe: 0, pausado: false });
    falso.tocar[1].resolver(8);
    await p;
    expect(reproducao.estado).toBe("tocando");
    expect(reproducao.duracao).toBe(8);
  });

  it("REP-004: Parar durante o carregamento seguido de falha do áudio não mostra erro", async () => {
    falso.automatico = false;
    const p = reproducao.tocar(hino, 1);
    await soltar();
    reproducao.parar();
    falso.tocar[0].rejeitar(new Error("cancelado"));
    await p;
    expect(reproducao.erro).toBe("");
    expect(reproducao.estado).toBe("parado");
  });

  it("REP-006: Parar durante o pausar não deixa o estado voltar a 'pausado'", async () => {
    await reproducao.tocar(hino, 1);
    falso.segurarPausa = true;
    const p = reproducao.pausar();
    await soltar();
    reproducao.parar();
    falso.pausa?.();
    await p;
    expect(reproducao.estado).toBe("parado");
    expect(reproducao.atual).toBeNull();
  });

  it("REP-005: busca durante o 'continuar' (que reagenda) é aplicada ao terminar, não descartada", async () => {
    await reproducao.tocar(hino, 1);
    await reproducao.pausar();
    reproducao.config(hino).andamento = 90; // continuar vai reagendar
    falso.automatico = false;
    const c = reproducao.continuar();
    await soltar();
    await reproducao.irPara(5); // chega com o reagendamento em curso: fica pendente
    falso.tocar[1].resolver(10); // o reagendamento do continuar termina
    await soltar();
    await soltar();
    falso.tocar[2]?.resolver(10);
    await c;
    expect(falso.tocar).toHaveLength(3);
    expect((falso.tocar[2].partida as { aPartirDe: number }).aPartirDe).toBeCloseTo((5 * 90) / 60);
    expect(reproducao.estado).toBe("tocando");
  });
});
