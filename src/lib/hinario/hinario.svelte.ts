// Estado do download do hinário (o texto e a música dos hinos, em um `hinario.json`): o andamento e o erro. O que está INSTALADO vem do Rust
// (`biblioteca.pacote`). Usado pela tela Ajustes (cartão Conteúdo) e pelo aviso do primeiro acesso, no mesmo molde das partituras.
import { biblioteca } from "../biblioteca.svelte";
import { criarImportacao } from "../importacao.svelte";
import { instalando } from "../instalando.svelte";
import { reproducao } from "../reproducao.svelte";
import { MANIFESTO_HINARIO } from "./manifesto";
import { textoDoHinario } from "./texto";

const importacao = criarImportacao(MANIFESTO_HINARIO.pacote);

async function baixar() {
  const pacote = MANIFESTO_HINARIO.pacote;
  if (!pacote || !pacote.url) return;
  // Um escritor do conteúdo por vez (outro download, ou o hinário já em curso): ver `instalando.svelte.ts`.
  if (instalando.ocupado) return;
  await importacao.baixar(pacote, async (bytes) => {
    const instalado = await biblioteca.importar(textoDoHinario(bytes));
    reproducao.limpar(); // o conteúdo mudou: para o som e esquece os ajustes dos hinos antigos (como no "Importar" de arquivo)
    return instalado;
  });
}

async function remover() {
  await importacao.remover(async () => {
    await biblioteca.remover();
    reproducao.limpar();
  });
}

export const hinario = importacao.publico({ baixar, remover });
