// Estado dos pacotes de sons gravados: o que está instalado no aparelho e o andamento de cada download.
// Usado pela tela Ajustes (baixar e remover) e pelo player (quais instrumentos gravados aparecem).
import { IDS_REALISTAS, arquivoDoRealista, type RealistaId } from "../realista";
import * as armazenamento from "./armazenamento";
import { baixarZip } from "./baixar";
import { ErroPacote, extrairEConferir, sha256Hex, type CodigoErro } from "./extrair";
import { MANIFESTO } from "./manifesto";
import { bytesParaBaixar, type PacoteSom } from "./tipos";

export type Andamento = {
  fase: "ocioso" | "baixando" | "conferindo" | "instalando" | "erro";
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

/** Os SHA-256 que o manifesto embutido aceita para cada arquivo de som (em geral um só; se dois pacotes trouxerem o mesmo nome, vale qualquer um dos dois). */
const esperado = new Map<string, Set<string>>();
for (const p of MANIFESTO.pacotes) for (const a of p.arquivos) esperado.set(a.arquivo, (esperado.get(a.arquivo) ?? new Set()).add(a.sha256));

let leitura = 0; // número da leitura mais recente: uma leitura lenta que termina depois de outra não pode desfazer o resultado dela

async function atualizar() {
  const minha = ++leitura;
  let lidos: Set<string>;
  try {
    // Só conta como instalado o arquivo cujo SHA-256 guardado (o dos bytes que foram gravados) bate com o do manifesto: um nome
    // igual com outro conteúdo (resto de uma versão antiga dos sons, ou gravação adulterada) fica como não instalado e pode ser baixado de novo.
    lidos = new Set((await armazenamento.listar()).filter((a) => esperado.get(a.arquivo)?.has(a.sha256)).map((a) => a.arquivo));
  } catch {
    lidos = new Set();
  }
  if (minha !== leitura) return; // chegou outra leitura depois desta: a dela vale
  instalados = lidos;
  carregado = true;
}

const achar = (id: string): PacoteSom => {
  const p = MANIFESTO.pacotes.find((x) => x.id === id);
  if (!p) throw new Error(`pacote desconhecido: ${id}`);
  return p;
};

const ocupado = (id: string) => ["baixando", "conferindo", "instalando"].includes(andamentos[id]?.fase ?? "");

async function baixar(id: string) {
  const pacote = achar(id);
  if (ocupado(id)) return;
  andamentos[id] = { fase: "baixando", progresso: 0, erro: "" };
  const gravados: string[] = [];
  try {
    if (!armazenamento.disponivel()) throw new ErroPacote("armazenamento", "o aparelho não oferece o Cache API");
    await armazenamento.pedirPersistencia();
    const zip = await baixarZip(pacote.url, bytesParaBaixar(pacote), (f) => (andamentos[id] = { fase: "baixando", progresso: f, erro: "" }));
    andamentos[id] = { fase: "conferindo", progresso: 1, erro: "" };
    const arquivos = await extrairEConferir(zip, pacote);
    andamentos[id] = { fase: "instalando", progresso: 0, erro: "" }; // gravar no Cache API pode demorar em pacote grande
    try {
      for (const [nome, dados] of arquivos) {
        await armazenamento.guardar(nome, dados, await sha256Hex(dados));
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
  if (ocupado(id)) return; // um download em curso regravaria o pacote "removido" e esconderia o progresso
  try {
    const pacote = achar(id);
    await armazenamento.apagar(pacote.arquivos.map((a) => a.arquivo));
    andamentos[id] = OCIOSO;
  } catch {
    andamentos[id] = { fase: "erro", progresso: 0, erro: "armazenamento" }; // o Cache pode recusar (disco cheio, cota, perfil bloqueado)
  } finally {
    await atualizar(); // o que realmente ficou no Cache, com erro ou sem
  }
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
