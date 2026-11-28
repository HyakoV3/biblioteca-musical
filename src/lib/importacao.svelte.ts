// Miolo comum dos estados de "baixar pacote" (hinário e partituras): o andamento (fase, progresso, erro) e o ciclo de instalar/remover.
// Cada loja cria o seu com `criarImportacao()` e mantém só o que é dela (manifesto, o que fazer ao instalar, as recusadas...).
import { instalando } from "./instalando.svelte";
import { baixarEInstalar, erroDoPacote, extrairDaPastaReal, type Andamento, type Dependencias } from "./partituras/baixar";
import type { PacotePartituras } from "./partituras/tipos";
import { baixarZip } from "./sons/baixar";
import { sha256Hex } from "./sons/extrair";

const OCIOSO: Andamento = { fase: "ocioso", progresso: 0, erro: null };

type Definir = (novo: Andamento) => void;

/** Baixa e instala com a trava `instalando`, relatando cada fase por `definir`. Devolve o que `instalar` devolveu, ou `undefined` se falhou. */
async function executar<T>(definir: Definir, pacote: PacotePartituras, instalar: Dependencias<T>["instalar"]): Promise<T | undefined> {
  const dep = { baixar: baixarZip, sha256: sha256Hex, extrairDaPasta: extrairDaPastaReal, instalar };
  try {
    const r = await baixarEInstalar(pacote, dep, (fase, progresso) => definir({ fase, progresso, erro: null }));
    definir(OCIOSO);
    return r;
  } catch (e) {
    definir({ fase: "erro", progresso: 0, erro: erroDoPacote(e) });
    return undefined;
  }
}

/** Roda a remoção: fica ocioso se der certo; se falhar, guarda o texto bruto do erro. */
async function remover(definir: Definir, remocao: () => Promise<unknown>) {
  try {
    await remocao();
    definir(OCIOSO);
  } catch (e) {
    definir({ fase: "erro", progresso: 0, erro: { bruto: String(e) } });
  }
}

/** Baixa e instala com a trava `instalando`; `aoComecar` roda logo após a trava, antes da primeira fase. */
async function baixar<T>(definir: Definir, pacote: PacotePartituras, instalar: Dependencias<T>["instalar"], aoComecar?: () => void) {
  instalando.ocupar();
  try {
    aoComecar?.();
    definir({ fase: "baixando", progresso: 0, erro: null });
    return await executar(definir, pacote, instalar);
  } finally {
    instalando.liberar();
  }
}

type Pacote = PacotePartituras | null;

function publico<E extends object>(pacote: Pacote, ler: () => Andamento, extra: E) {
  const base = {
    /** Há um pacote publicado (manifesto com endereço)? Sem ele, o botão Baixar não aparece. */
    disponivel: pacote !== null && pacote.url !== "",
    /** Tamanho do arquivo, em bytes (0 sem pacote). */
    bytes: pacote?.bytes ?? 0,
    get andamento() {
      return ler();
    },
  };
  return Object.defineProperties(base, Object.getOwnPropertyDescriptors(extra)) as typeof base & E;
}

export function criarImportacao(pacote: Pacote) {
  let andamento = $state<Andamento>(OCIOSO);
  const definir: Definir = (novo) => (andamento = novo);

  return {
    get andamento() {
      return andamento;
    },
    /** Baixa e instala o pacote (só `instalar` é de quem chama). Devolve o que `instalar` devolveu, ou `undefined` se falhou (o erro fica no andamento). */
    baixar: <T>(p: PacotePartituras, instalar: Dependencias<T>["instalar"], aoComecar?: () => void) => baixar(definir, p, instalar, aoComecar),
    remover: (remocao: () => Promise<unknown>) => remover(definir, remocao),
    /** O objeto público da loja: o que é igual nas duas (há pacote publicado? tamanho, andamento) mais o que é dela (`extra`, getters preservados). */
    publico: <E extends object>(extra: E) => publico(pacote, () => andamento, extra),
  };
}
