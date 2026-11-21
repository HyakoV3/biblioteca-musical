// Estado do download do hinário (o texto e a música dos hinos, em um `hinario.json`): o andamento e o erro. O que está INSTALADO vem do Rust
// (`biblioteca.pacote`). Usado pela tela Ajustes (cartão Conteúdo) e pelo aviso do primeiro acesso, no mesmo molde das partituras.
import { biblioteca } from "../biblioteca.svelte";
import { baixarEInstalar, extrairDaPastaReal, type Fase } from "../partituras/baixar";
import { baixarZip } from "../sons/baixar";
import { ErroPacote, sha256Hex, type CodigoErro } from "../sons/extrair";
import { MANIFESTO_HINARIO } from "./manifesto";
import { textoDoHinario } from "./texto";

export type Andamento = {
  fase: "ocioso" | Fase | "erro";
  /** 0 a 1, só durante o download. */
  progresso: number;
  /** Quando `fase` é "erro": o código do erro do pacote (rede, integridade...) ou o texto bruto vindo do Rust (a tela traduz). */
  erro: { codigo: CodigoErro } | { bruto: string } | null;
};

const OCIOSO: Andamento = { fase: "ocioso", progresso: 0, erro: null };
let andamento = $state<Andamento>(OCIOSO);

async function baixar() {
  const pacote = MANIFESTO_HINARIO.pacote;
  if (!pacote || !pacote.url) return;
  if (andamento.fase === "baixando" || andamento.fase === "conferindo" || andamento.fase === "instalando") return;
  andamento = { fase: "baixando", progresso: 0, erro: null };
  try {
    await baixarEInstalar(
      pacote,
      { baixar: baixarZip, sha256: sha256Hex, extrairDaPasta: extrairDaPastaReal, instalar: (bytes) => biblioteca.importar(textoDoHinario(bytes)) },
      (fase, progresso) => (andamento = { fase, progresso, erro: null }),
    );
    andamento = OCIOSO;
  } catch (e) {
    andamento = { fase: "erro", progresso: 0, erro: e instanceof ErroPacote ? { codigo: e.codigo } : { bruto: String(e) } };
  }
}

async function remover() {
  try {
    await biblioteca.remover();
    andamento = OCIOSO;
  } catch (e) {
    andamento = { fase: "erro", progresso: 0, erro: { bruto: String(e) } };
  }
}

export const hinario = {
  /** Há um hinário publicado (manifesto com endereço)? Sem ele, o botão Baixar não aparece. */
  disponivel: MANIFESTO_HINARIO.pacote !== null && MANIFESTO_HINARIO.pacote.url !== "",
  /** Tamanho do arquivo, em bytes (0 sem pacote). */
  bytes: MANIFESTO_HINARIO.pacote?.bytes ?? 0,
  get andamento() {
    return andamento;
  },
  baixar,
  remover,
};
