// Estado dos pacotes de sons gravados: o que está instalado no aparelho e o andamento de cada download.
// Usado pela tela Ajustes (baixar e remover) e pelo player (quais instrumentos gravados aparecem).
import { IDS_REALISTAS, arquivoDoRealista, type RealistaId } from "../realista";
import * as armazenamento from "./armazenamento";
import { baixarZip } from "./baixar";
import { ErroPacote, extrairEConferir, type CodigoErro } from "./extrair";
import { MANIFESTO } from "./manifesto";
import { bytesDoPacote, type PacoteSom } from "./tipos";

export type Andamento = {
  fase: "ocioso" | "baixando" | "conferindo" | "erro";
  /** 0 a 1, só durante o download. */
  progresso: number;
  /** Código do erro (para a tela traduzir), quando `fase` é "erro". */
  erro: CodigoErro | "outro" | "";
};

const OCIOSO: Andamento = { fase: "ocioso", progresso: 0, erro: "" };

let instalados = $state<Set<string>>(new Set());
/** Falso até a primeira leitura do armazenamento terminar (antes disso não dá para dizer o que está instalado). */
let carregado = $state(false);
let andamentos = $state<Record<string, Andamento>>({});

async function atualizar() {
  try {
    instalados = new Set(await armazenamento.listar());
  } catch {
    instalados = new Set();
  }
  carregado = true;
}

const achar = (id: string): PacoteSom => {
  const p = MANIFESTO.pacotes.find((x) => x.id === id);
  if (!p) throw new Error(`pacote desconhecido: ${id}`);
  return p;
};

async function baixar(id: string) {
  const pacote = achar(id);
  if (andamentos[id]?.fase === "baixando" || andamentos[id]?.fase === "conferindo") return;
  andamentos[id] = { fase: "baixando", progresso: 0, erro: "" };
  const gravados: string[] = [];
  try {
    if (!armazenamento.disponivel()) throw new ErroPacote("armazenamento", "o aparelho não oferece o Cache API");
    await armazenamento.pedirPersistencia();
    const zip = await baixarZip(pacote.url, bytesDoPacote(pacote), (f) => (andamentos[id] = { fase: "baixando", progresso: f, erro: "" }));
    andamentos[id] = { fase: "conferindo", progresso: 1, erro: "" };
    const arquivos = await extrairEConferir(zip, pacote);
    try {
      for (const [nome, dados] of arquivos) {
        await armazenamento.guardar(nome, dados);
        gravados.push(nome);
      }
    } catch (e) {
      await armazenamento.apagar(gravados).catch(() => {}); // não deixa um pacote pela metade
      throw new ErroPacote("armazenamento", String(e));
    }
    await atualizar();
    andamentos[id] = OCIOSO;
  } catch (e) {
    andamentos[id] = { fase: "erro", progresso: 0, erro: e instanceof ErroPacote ? e.codigo : "outro" };
  }
}

async function remover(id: string) {
  const pacote = achar(id);
  await armazenamento.apagar(pacote.arquivos.map((a) => a.arquivo));
  await atualizar();
  andamentos[id] = OCIOSO;
}

export const sons = {
  pacotes: MANIFESTO.pacotes,
  get carregado() {
    return carregado;
  },
  /** O pacote inteiro está instalado? */
  pacoteInstalado: (p: PacoteSom) => p.arquivos.every((a) => instalados.has(a.arquivo)),
  andamento: (id: string): Andamento => andamentos[id] ?? OCIOSO,
  /** Os instrumentos gravados que podem ser escolhidos agora (arquivo instalado). */
  get instrumentos(): RealistaId[] {
    return IDS_REALISTAS.filter((id) => instalados.has(arquivoDoRealista(id)));
  },
  /** Este instrumento gravado está instalado? */
  instalado: (id: RealistaId) => instalados.has(arquivoDoRealista(id)),
  atualizar,
  baixar,
  remover,
};
