import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Global = { BmccbServico?: { iniciar: (t: string) => void; parar: () => void; iniciarGravacao?: () => void; pararGravacao?: () => void; iniciarMetronomo?: () => void; pararMetronomo?: () => void }; __bmccbParadoPelaNotificacao?: () => void; __bmccbGravacaoParadaPelaNotificacao?: () => void };
const g = globalThis as Global;

// O módulo guarda se o serviço está ligado: cada teste começa com um módulo novo.
async function carregar() {
  vi.resetModules();
  return import("../src/lib/servico");
}

describe("serviço de reprodução (I-22)", () => {
  let chamadas: string[];
  beforeEach(() => {
    chamadas = [];
    g.BmccbServico = { iniciar: (t) => chamadas.push(`iniciar:${t}`), parar: () => chamadas.push("parar") };
  });
  afterEach(() => {
    delete g.BmccbServico;
    delete g.__bmccbParadoPelaNotificacao;
    vi.restoreAllMocks();
  });

  it("liga ao começar a tocar e desliga ao parar", async () => {
    const { sincronizarServico } = await carregar();
    sincronizarServico(false, ""); // parado desde o começo: nada a desligar
    sincronizarServico(true, "Cristo, meu Mestre");
    sincronizarServico(false, "");
    expect(chamadas).toEqual(["iniciar:Cristo, meu Mestre", "parar"]);
  });

  it("repetir o mesmo estado não chama a ponte de novo", async () => {
    const { sincronizarServico } = await carregar();
    sincronizarServico(true, "A");
    sincronizarServico(true, "A");
    sincronizarServico(false, "");
    sincronizarServico(false, "");
    expect(chamadas).toEqual(["iniciar:A", "parar"]);
  });

  it("trocar de hino com o serviço ligado atualiza o título", async () => {
    const { sincronizarServico } = await carregar();
    sincronizarServico(true, "A");
    sincronizarServico(true, "B");
    expect(chamadas).toEqual(["iniciar:A", "iniciar:B"]);
  });

  it("sem a ponte (navegador, computador) não faz nada nem falha", async () => {
    delete g.BmccbServico;
    const { sincronizarServico } = await carregar();
    expect(() => {
      sincronizarServico(true, "A");
      sincronizarServico(false, "");
    }).not.toThrow();
  });

  it("uma falha da ponte vai para o console e não derruba o som", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    g.BmccbServico = { iniciar: () => { throw new Error("recusou"); }, parar: () => {} };
    const { sincronizarServico } = await carregar();
    expect(() => sincronizarServico(true, "A")).not.toThrow();
    expect(aviso).toHaveBeenCalled();
  });

  it("o botão Parar da notificação chama o que o app registrou", async () => {
    const { aoPararPelaNotificacao } = await carregar();
    const parou = vi.fn();
    aoPararPelaNotificacao(parou);
    g.__bmccbParadoPelaNotificacao?.();
    expect(parou).toHaveBeenCalledTimes(1);
  });
});

describe("serviço de gravação (Gravador em segundo plano)", () => {
  afterEach(() => {
    delete g.BmccbServico;
    delete g.__bmccbGravacaoParadaPelaNotificacao;
    vi.restoreAllMocks();
  });

  it("liga e desliga pela ponte e avisa que o Android assumiu a gravação", async () => {
    const chamadas: string[] = [];
    g.BmccbServico = { iniciar: () => {}, parar: () => {}, iniciarGravacao: () => chamadas.push("ligar"), pararGravacao: () => chamadas.push("desligar") };
    const { ligarServicoDeGravacao, desligarServicoDeGravacao } = await carregar();
    expect(ligarServicoDeGravacao()).toBe(true);
    desligarServicoDeGravacao();
    expect(chamadas).toEqual(["ligar", "desligar"]);
  });

  it("sem a ponte (navegador) ou com uma ponte antiga, devolve falso e não falha", async () => {
    const { ligarServicoDeGravacao, desligarServicoDeGravacao } = await carregar();
    expect(ligarServicoDeGravacao()).toBe(false);
    g.BmccbServico = { iniciar: () => {}, parar: () => {} };
    expect(ligarServicoDeGravacao()).toBe(false);
    expect(() => desligarServicoDeGravacao()).not.toThrow();
  });

  it("uma falha da ponte vira falso, com aviso no console", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    g.BmccbServico = { iniciar: () => {}, parar: () => {}, iniciarGravacao: () => { throw new Error("recusou"); } };
    const { ligarServicoDeGravacao } = await carregar();
    expect(ligarServicoDeGravacao()).toBe(false);
    expect(aviso).toHaveBeenCalled();
  });

  it("o botão Parar da notificação chama o que o Gravador registrou, e soltar remove", async () => {
    const { aoPararGravacaoPelaNotificacao } = await carregar();
    const parou = vi.fn();
    const soltar = aoPararGravacaoPelaNotificacao(parou);
    g.__bmccbGravacaoParadaPelaNotificacao?.();
    expect(parou).toHaveBeenCalledTimes(1);
    soltar();
    expect(g.__bmccbGravacaoParadaPelaNotificacao).toBeUndefined();
  });
});

describe("detecção de fone", () => {
  afterEach(() => {
    delete g.BmccbServico;
  });

  it("devolve o que a ponte diz; sem ponte, ponte antiga ou falha, devolve falso", async () => {
    const { foneConectado } = await carregar();
    expect(foneConectado()).toBe(false);
    g.BmccbServico = { iniciar: () => {}, parar: () => {} };
    expect(foneConectado()).toBe(false);
    (g.BmccbServico as { temFone?: () => boolean }).temFone = () => true;
    expect(foneConectado()).toBe(true);
    (g.BmccbServico as { temFone?: () => boolean }).temFone = () => { throw new Error("x"); };
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(foneConectado()).toBe(false);
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});

describe("falha do serviço de gravação", () => {
  afterEach(() => {
    delete (globalThis as { __bmccbServicoDeGravacaoFalhou?: () => void }).__bmccbServicoDeGravacaoFalhou;
  });

  it("o aviso do Android chama o que o Gravador registrou, e soltar remove", async () => {
    const { aoFalharServicoDeGravacao } = await carregar();
    const g2 = globalThis as { __bmccbServicoDeGravacaoFalhou?: () => void };
    const falhou = vi.fn();
    const soltar = aoFalharServicoDeGravacao(falhou);
    g2.__bmccbServicoDeGravacaoFalhou?.();
    expect(falhou).toHaveBeenCalledTimes(1);
    soltar();
    expect(g2.__bmccbServicoDeGravacaoFalhou).toBeUndefined();
  });
});

describe("serviço do metrônomo", () => {
  afterEach(() => {
    delete g.BmccbServico;
    delete (globalThis as { __bmccbMetronomoParadoPelaNotificacao?: () => void }).__bmccbMetronomoParadoPelaNotificacao;
    delete (globalThis as { __bmccbServicoDoMetronomoFalhou?: () => void }).__bmccbServicoDoMetronomoFalhou;
    vi.restoreAllMocks();
  });

  it("liga e desliga pela ponte e diz se o Android assumiu", async () => {
    const chamadas: string[] = [];
    g.BmccbServico = { iniciar: () => {}, parar: () => {}, iniciarMetronomo: () => chamadas.push("ligar"), pararMetronomo: () => chamadas.push("desligar") };
    const { ligarServicoDoMetronomo, desligarServicoDoMetronomo } = await carregar();
    expect(ligarServicoDoMetronomo()).toBe(true);
    desligarServicoDoMetronomo();
    expect(chamadas).toEqual(["ligar", "desligar"]);
  });

  it("sem ponte, com ponte antiga ou com falha, devolve falso e não derruba", async () => {
    const { ligarServicoDoMetronomo, desligarServicoDoMetronomo } = await carregar();
    expect(ligarServicoDoMetronomo()).toBe(false);
    g.BmccbServico = { iniciar: () => {}, parar: () => {} };
    expect(ligarServicoDoMetronomo()).toBe(false);
    expect(() => desligarServicoDoMetronomo()).not.toThrow();
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    g.BmccbServico = { iniciar: () => {}, parar: () => {}, iniciarMetronomo: () => { throw new Error("x"); } };
    expect(ligarServicoDoMetronomo()).toBe(false);
    expect(aviso).toHaveBeenCalled();
  });

  it("os avisos do Android (Parar da notificação e falha do serviço) chamam o que o app registrou, e soltar remove", async () => {
    const { aoPararMetronomoPelaNotificacao, aoFalharServicoDoMetronomo } = await carregar();
    const g2 = globalThis as { __bmccbMetronomoParadoPelaNotificacao?: () => void; __bmccbServicoDoMetronomoFalhou?: () => void };
    const parou = vi.fn();
    const falhou = vi.fn();
    const s1 = aoPararMetronomoPelaNotificacao(parou);
    const s2 = aoFalharServicoDoMetronomo(falhou);
    g2.__bmccbMetronomoParadoPelaNotificacao?.();
    g2.__bmccbServicoDoMetronomoFalhou?.();
    expect(parou).toHaveBeenCalledTimes(1);
    expect(falhou).toHaveBeenCalledTimes(1);
    s1();
    s2();
    expect(g2.__bmccbMetronomoParadoPelaNotificacao).toBeUndefined();
    expect(g2.__bmccbServicoDoMetronomoFalhou).toBeUndefined();
  });
});

