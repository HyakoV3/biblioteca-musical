// Estado do pacote de partituras: o andamento do download e o que foi recusado na instalação. O que está INSTALADO vem do Rust
// (`biblioteca.pacote.partituras`). Usado pela tela Ajustes (Baixar e Remover), no mesmo molde dos sons gravados.
import { biblioteca, type Recusada } from "../biblioteca.svelte";
import { criarImportacao } from "../importacao.svelte";
import { instalando } from "../instalando.svelte";
import { MANIFESTO } from "./manifesto";

const importacao = criarImportacao(MANIFESTO.pacote);
/** As partituras que o Rust recusou na última instalação (não passaram na verificação do SVG), para a tela avisar. */
let recusadas = $state<Recusada[]>([]);

async function baixar() {
  const pacote = MANIFESTO.pacote;
  if (!pacote || !pacote.url) return;
  const { fase } = importacao.andamento;
  if (fase === "baixando" || fase === "conferindo" || fase === "instalando") return;
  // As partituras só entram em um hinário JÁ instalado (o Rust recusa com `partituras_sem_hinario`): com só o pacote de exemplo, o botão fica desabilitado e esta chamada não faz nada.
  if (!biblioteca.pacote || biblioteca.pacote.exemplo) return;
  if (instalando.ocupado) return; // o hinário está sendo baixado: as partituras seriam instaladas contra o pacote de exemplo
  const r = await importacao.baixar(
    pacote,
    (zip, aoProgredir) => biblioteca.importarPartituras(zip, aoProgredir),
    () => (recusadas = []),
  );
  if (r) recusadas = r.recusadas;
}

async function remover() {
  recusadas = [];
  await importacao.remover(() => biblioteca.removerPartituras());
}

export const partituras = importacao.publico({
  get recusadas() {
    return recusadas;
  },
  baixar,
  remover,
});
