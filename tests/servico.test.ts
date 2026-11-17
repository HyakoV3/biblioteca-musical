import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Global = { BmccbServico?: { iniciar: (t: string) => void; parar: () => void }; __bmccbParadoPelaNotificacao?: () => void };
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
