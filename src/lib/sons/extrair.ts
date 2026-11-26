// Abre o zip baixado e confere cada arquivo contra o manifesto. Só entra no app o que bate com o tamanho e o SHA-256 do
// manifesto; um zip adulterado, incompleto ou grande demais é recusado inteiro.
import { unzip, unzipSync, type Unzipped, type UnzipFileFilter } from "fflate";
import type { PacoteSom } from "./tipos";

/** Teto do que pode ser descompactado de um pacote (contra zip malicioso): o conjunto todo tem ~30 MB. */
export const LIMITE_EXTRAIDO = 100 * 1024 * 1024;
/** Teto do zip baixado. */
export const LIMITE_ZIP = 100 * 1024 * 1024;

export type CodigoErro = "rede" | "zip" | "tamanho" | "faltando" | "integridade" | "armazenamento";

export class ErroPacote extends Error {
  constructor(
    public readonly codigo: CodigoErro,
    detalhe: string,
  ) {
    super(`${codigo}: ${detalhe}`);
    this.name = "ErroPacote";
  }
}

export async function sha256Hex(dados: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", dados as BufferSource);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const nomeBase = (caminho: string): string => caminho.split("/").pop() ?? "";

/**
 * Descompacta só os arquivos que o pacote espera (pelo nome, ignorando as pastas do zip: o File Browser põe o prefixo
 * `BibliotecaMusical/<grupo>/`) e confere o tamanho e o SHA-256 de cada um. Devolve nome do arquivo -> bytes.
 */
export async function extrairEConferir(zip: Uint8Array, pacote: PacoteSom): Promise<Map<string, Uint8Array>> {
  const esperados = new Set(pacote.arquivos.map((a) => a.arquivo));
  let extraidos: Unzipped;
  try {
    extraidos = await descompactar(zip, esperados);
  } catch (e) {
    if (e instanceof ErroPacote) throw e;
    throw new ErroPacote("zip", String(e));
  }

  const porNome = new Map<string, Uint8Array>();
  for (const [caminho, dados] of Object.entries(extraidos)) porNome.set(nomeBase(caminho), dados);
  return conferir(porNome, pacote);
}

/**
 * Descompacta num Web Worker (`unzip` assíncrono do fflate), para os ~30 MB não travarem a tela. Se o ambiente não deixa criar o worker,
 * cai na versão síncrona: um erro do zip em si (ErroPacote do filtro, zip corrompido) NÃO cai, porque a versão síncrona falharia igual.
 */
async function descompactar(zip: Uint8Array, esperados: Set<string>): Promise<Unzipped> {
  const opcoes = () => ({ filter: filtroDoPacote(esperados) });
  try {
    return await new Promise<Unzipped>((resolve, rejeitar) => {
      try {
        unzip(zip, opcoes(), (erro, dados) => (erro ? rejeitar(erro) : resolve(dados)));
      } catch (e) {
        rejeitar(e); // o filtro roda aqui, na chamada
      }
    });
  } catch (e) {
    if (e instanceof ErroPacote || !semWorker(e)) throw e;
    return unzipSync(zip, opcoes());
  }
}

/** O erro de quem não conseguiu criar o worker (ambiente sem Worker ou com a CSP recusando o blob), e não de um zip ruim. */
function semWorker(e: unknown): boolean {
  const msg = String(e instanceof Error ? e.message : e);
  return /worker|blob|securityerror|csp|content security/i.test(msg);
}

function filtroDoPacote(esperados: Set<string>): UnzipFileFilter {
  let total = 0;
  const vistos = new Set<string>();
  return (f) => {
    // O filtro roda ANTES de descompactar: o que não é esperado nem chega a ser aberto, e o tamanho declarado é
    // somado para recusar um zip que "explode" na memória. Soma o MAIOR entre o tamanho declarado e o guardado: numa
    // entrada sem compressão o declarado pode mentir para menos. Um nome esperado que aparece duas vezes é recusado
    // (o segundo apagaria o primeiro depois de conferido por nome, e a soma passaria despercebida).
    const nome = nomeBase(f.name);
    if (!esperados.has(nome)) return false;
    if (vistos.has(nome)) throw new ErroPacote("zip", `arquivo repetido: ${nome}`);
    vistos.add(nome);
    total += Math.max(f.size, f.originalSize);
    if (total > LIMITE_EXTRAIDO) throw new ErroPacote("tamanho", `mais de ${LIMITE_EXTRAIDO} bytes descompactados`);
    return true;
  };
}

async function conferir(porNome: Map<string, Uint8Array>, pacote: PacoteSom): Promise<Map<string, Uint8Array>> {
  const saida = new Map<string, Uint8Array>();
  for (const a of pacote.arquivos) {
    const dados = porNome.get(a.arquivo);
    if (!dados) throw new ErroPacote("faltando", a.arquivo);
    if (dados.length !== a.bytes || (await sha256Hex(dados)) !== a.sha256) throw new ErroPacote("integridade", a.arquivo);
    saida.set(a.arquivo, dados);
  }
  return saida;
}
