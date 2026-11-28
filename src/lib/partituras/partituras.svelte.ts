// Estado do pacote de partituras: o andamento do download e o que foi recusado na instalação. O que está INSTALADO vem do Rust
// (`biblioteca.pacote.partituras`). Usado pela tela Ajustes (Baixar e Remover), no mesmo molde dos sons gravados.
import { biblioteca, type Recusada } from "../biblioteca.svelte";
import { instalando } from "../instalando.svelte";
import { baixarZip } from "../sons/baixar";
import { sha256Hex } from "../sons/extrair";
import { baixarEInstalar, erroDoPacote, extrairDaPastaReal, type Andamento } from "./baixar";
import { MANIFESTO } from "./manifesto";

const OCIOSO: Andamento = { fase: "ocioso", progresso: 0, erro: null };

let andamento = $state<Andamento>(OCIOSO);
/** As partituras que o Rust recusou na última instalação (não passaram na verificação do SVG), para a tela avisar. */
let recusadas = $state<Recusada[]>([]);

async function baixar() {
  const pacote = MANIFESTO.pacote;
  if (!pacote || !pacote.url) return;
  if (andamento.fase === "baixando" || andamento.fase === "conferindo" || andamento.fase === "instalando") return;
  // As partituras só entram em um hinário JÁ instalado (o Rust recusa com `partituras_sem_hinario`): com só o pacote de exemplo, o botão fica desabilitado e esta chamada não faz nada.
  if (!biblioteca.pacote || biblioteca.pacote.exemplo) return;
  if (instalando.ocupado) return; // o hinário está sendo baixado: as partituras seriam instaladas contra o pacote de exemplo
  instalando.ocupar();
  recusadas = [];
  andamento = { fase: "baixando", progresso: 0, erro: null };
  try {
    const r = await baixarEInstalar(
      pacote,
      { baixar: baixarZip, sha256: sha256Hex, extrairDaPasta: extrairDaPastaReal, instalar: (zip, aoProgredir) => biblioteca.importarPartituras(zip, aoProgredir) },
      (fase, progresso) => (andamento = { fase, progresso, erro: null }),
    );
    recusadas = r.recusadas;
    andamento = OCIOSO;
  } catch (e) {
    andamento = { fase: "erro", progresso: 0, erro: erroDoPacote(e) };
  } finally {
    instalando.liberar();
  }
}

async function remover() {
  recusadas = [];
  try {
    await biblioteca.removerPartituras();
    andamento = OCIOSO;
  } catch (e) {
    andamento = { fase: "erro", progresso: 0, erro: { bruto: String(e) } };
  }
}

export const partituras = {
  /** Há um pacote publicado (manifesto com endereço)? Sem ele, o botão Baixar não aparece. */
  disponivel: MANIFESTO.pacote !== null && MANIFESTO.pacote.url !== "",
  /** Tamanho do zip, em bytes (0 sem pacote). */
  bytes: MANIFESTO.pacote?.bytes ?? 0,
  get andamento() {
    return andamento;
  },
  get recusadas() {
    return recusadas;
  },
  baixar,
  remover,
};
