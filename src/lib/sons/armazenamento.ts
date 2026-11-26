// Guarda os sons baixados no Cache do navegador interno do app (funciona offline depois de baixado) e entrega os arquivos
// ao smplr. Chaves virtuais `/sons/<arquivo>`: nunca são buscadas na rede.
import type { Storage as ArmazenamentoSmplr } from "smplr";

import { sha256Hex } from "./extrair";

const NOME = "sons-gravados-v1";
const CABECALHO_SHA = "x-sha256";
const chave = (arquivo: string) => `/sons/${arquivo}`;
const arquivoDaChave = (url: string) => decodeURIComponent(new URL(url, "http://x").pathname.replace(/^\/sons\//, ""));

/** O aparelho oferece o Cache API? */
export const disponivel = (): boolean => typeof caches !== "undefined";

/** Pede ao sistema para não apagar os sons quando faltar espaço (o navegador interno pode negar; não é obrigatório). */
export async function pedirPersistencia(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* sem persistência garantida: o pacote pode ser baixado de novo */
  }
}

/** Guarda o arquivo junto do SHA-256 dele (cabeçalho `x-sha256`), para depois conferir o que está guardado com o manifesto. */
export async function guardar(arquivo: string, dados: Uint8Array, sha256: string): Promise<void> {
  const cache = await caches.open(NOME);
  await cache.put(chave(arquivo), new Response(new Blob([dados as BlobPart]), { headers: { "content-type": "text/javascript", [CABECALHO_SHA]: sha256 } }));
}

/** Um arquivo guardado e o SHA-256 dele ("" se não deu para ler). */
export type Guardado = { arquivo: string; sha256: string };

/**
 * Os arquivos guardados e o SHA-256 de cada um. Um guardado por versão antiga do app (sem o cabeçalho) tem o SHA calculado do
 * conteúdo UMA vez e regravado com o cabeçalho, uma entrada por vez (para não segurar tudo na memória). Uma entrada que não
 * dá para ler fica com SHA vazio (não conta como instalada) sem derrubar a leitura das outras.
 */
export async function listar(): Promise<Guardado[]> {
  if (!disponivel()) return [];
  const cache = await caches.open(NOME);
  const saida: Guardado[] = [];
  for (const r of await cache.keys()) {
    const arquivo = arquivoDaChave(r.url);
    try {
      const resposta = await cache.match(r);
      let sha256 = resposta?.headers.get(CABECALHO_SHA) ?? "";
      if (resposta && !sha256) {
        const dados = new Uint8Array(await resposta.arrayBuffer());
        sha256 = await sha256Hex(dados);
        await guardar(arquivo, dados, sha256); // da próxima vez o cabeçalho já está lá
      }
      saida.push({ arquivo, sha256 });
    } catch {
      saida.push({ arquivo, sha256: "" });
    }
  }
  return saida;
}

export async function apagar(arquivos: string[]): Promise<void> {
  const cache = await caches.open(NOME);
  for (const a of arquivos) await cache.delete(chave(a));
}

/** Armazenamento que o smplr usa para ler o arquivo de um instrumento: só do Cache, sem rede. */
export const armazenamentoDoSmplr: ArmazenamentoSmplr = {
  async fetch(url: string) {
    const cache = await caches.open(NOME);
    const resposta = await cache.match(url);
    if (!resposta) throw new Error(`som não instalado: ${url}`);
    return resposta;
  },
};
