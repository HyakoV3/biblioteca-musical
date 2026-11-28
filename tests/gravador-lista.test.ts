import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaGravacao } from "../src/lib/gravacoes";

// A lista da aba Gravador (estado, ações e a ordem do foco) com o banco e o DOM trocados por falsos.
const banco = vi.hoisted(() => ({
  listarTodas: vi.fn(),
  atualizar: vi.fn(),
  apagar: vi.fn(),
  apagarTodas: vi.fn(),
}));
const foco = vi.hoisted(() => ({ recuperarFoco: vi.fn(async () => {}), focarVizinhoOuTitulo: vi.fn(), itemTemOFoco: vi.fn(() => true) }));
const copias = vi.hoisted(() => ({ apagarCopiasEnviadas: vi.fn(() => true) }));

vi.mock("../src/lib/gravacoes", async (original) => ({ ...(await original<typeof import("../src/lib/gravacoes")>()), gravacoes: banco }));
vi.mock("../src/lib/compartilhar", () => copias);
vi.mock("../src/lib/gravadorFoco", async (original) => ({ ...(await original<typeof import("../src/lib/gravadorFoco")>()), ...foco }));

import { ListaDeGravacoes } from "../src/lib/gravadorLista.svelte";
import { PAGINA } from "../src/lib/organizar";

const meta = (id: string, criadaEm = 1): MetaGravacao => ({ id, criadaEm, segundos: 2, tipo: "audio/webm", bytes: 3 });
const ids = (l: ListaDeGravacoes) => l.todas.map((m) => m.id);

describe("ListaDeGravacoes", () => {
  let ordem: string[];
  let lista: ListaDeGravacoes;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    ordem = ["a", "b", "c"];
    lista = new ListaDeGravacoes(() => ordem);
  });

  it("lê tudo, mescla com o que foi salvo e apagado durante a leitura e marca a lista como pronta", async () => {
    let entregar!: (v: MetaGravacao[]) => void;
    banco.listarTodas.mockReturnValue(new Promise((r) => (entregar = r)));
    const lendo = lista.carregarTudo();
    lista.inserir(meta("nova", 9));
    entregar([meta("a", 5), meta("velha", 1)]);
    await lendo;
    expect(ids(lista)).toEqual(["nova", "a", "velha"]);
    expect(lista.listaPronta).toBe(true);
    expect(lista.erroCarga).toBe(false);
    expect(lista.novaId).toBe("nova");
  });

  it("uma leitura que falha mostra o erro e ainda assim libera a lista", async () => {
    banco.listarTodas.mockRejectedValue(new Error("x"));
    await lista.carregarTudo();
    expect(lista.erroCarga).toBe(true);
    expect(lista.listaPronta).toBe(true);
  });

  it("descarta uma leitura que chega depois de uma mais nova ou da tela desmontada", async () => {
    let primeira!: (v: MetaGravacao[]) => void;
    banco.listarTodas.mockReturnValueOnce(new Promise((r) => (primeira = r))).mockResolvedValueOnce([meta("b")]);
    const velha = lista.carregarTudo();
    await lista.carregarTudo();
    primeira([meta("a")]);
    await velha;
    expect(ids(lista)).toEqual(["b"]);
    banco.listarTodas.mockResolvedValue([meta("z")]);
    lista.destruir();
    await lista.carregarTudo();
    expect(ids(lista)).toEqual(["b"]);
  });

  it("apagar uma tira da lista, do que toca e do 'novo', e manda o foco para o vizinho", async () => {
    lista.inserir(meta("b"));
    lista.inserir(meta("a", 2));
    lista.tocandoId = "b";
    banco.apagar.mockResolvedValue(undefined);
    await lista.apagarUma("b");
    expect(ids(lista)).toEqual(["a"]);
    expect(lista.tocandoId).toBeNull();
    expect(lista.novaId).toBe("a");
    expect(foco.focarVizinhoOuTitulo).toHaveBeenCalledWith("c");
    expect(lista.erroAcao).toBe(false);
  });

  it("apagar que falha mantém a lista e mostra o erro", async () => {
    lista.inserir(meta("a"));
    banco.apagar.mockRejectedValue(new Error("x"));
    await lista.apagarUma("a");
    expect(ids(lista)).toEqual(["a"]);
    expect(lista.erroAcao).toBe(true);
  });

  it("atualizar troca o registro; se a gravação sumiu, ela sai da lista; se falha, devolve false", async () => {
    lista.inserir(meta("a"));
    banco.atualizar.mockResolvedValueOnce({ ...meta("a"), titulo: "Novo" });
    expect(await lista.atualizarUma("a", { titulo: "Novo" })).toBe(true);
    expect(lista.todas[0].titulo).toBe("Novo");
    expect(foco.recuperarFoco).toHaveBeenCalledWith("a", "b", true);
    lista.tocandoId = "a";
    banco.atualizar.mockResolvedValueOnce(null);
    expect(await lista.atualizarUma("a", { favorita: true })).toBe(true);
    expect(ids(lista)).toEqual([]);
    expect(lista.tocandoId).toBeNull();
    banco.atualizar.mockRejectedValueOnce(new Error("x"));
    expect(await lista.atualizarUma("a", { favorita: true })).toBe(false);
  });

  it("'Apagar todas' pede confirmação, que expira, e só então apaga e zera tudo", async () => {
    vi.useFakeTimers();
    lista.inserir(meta("a"));
    lista.mostrando = PAGINA * 3;
    await lista.apagarTodas();
    expect(lista.confirmacao.pedida).toBe(true);
    expect(banco.apagarTodas).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4000);
    expect(lista.confirmacao.pedida).toBe(false);
    await lista.apagarTodas();
    banco.apagarTodas.mockResolvedValue(undefined);
    await lista.apagarTodas();
    expect(banco.apagarTodas).toHaveBeenCalledTimes(1);
    expect(copias.apagarCopiasEnviadas).toHaveBeenCalled();
    expect(lista.todas).toEqual([]);
    expect(lista.novaId).toBeNull();
    expect(lista.mostrando).toBe(PAGINA);
    expect(lista.listaPronta).toBe(true);
    vi.useRealTimers();
  });

  it("'Apagar todas' que falha deixa a lista e mostra o erro", async () => {
    lista.inserir(meta("a"));
    lista.confirmacao.pedida = true;
    banco.apagarTodas.mockRejectedValue(new Error("x"));
    await lista.apagarTodas();
    expect(ids(lista)).toEqual(["a"]);
    expect(lista.erroAcao).toBe(true);
  });
});
