// As gravações guardadas do Gravador (I-03): ficam no IndexedDB da própria WebView, só neste aparelho (nada sai dele) e sobrevivem a fechar o app; somem
// quando a pessoa as apaga ou limpa os dados do app. Dois depósitos: `meta` (nome, data, duração, tamanho: leve, é o que a lista lê, página por página)
// e `blobs` (o arquivo de áudio, lido só quando a pessoa toca em "Ouvir"). Sem limite de quantidade: a lista pagina e a tela mostra o espaço usado.
// A conexão, o esquema do banco e a transação ficam em `gravacoes-banco.ts`; os registros e as peças puras, em `gravacoes-registros.ts`; este arquivo reexporta o que é público deles.

import type { ContextoGravacao } from "./contexto";
import { rastro } from "./gravador";
import { pedido, transacao } from "./gravacoes-banco";
import { SessoesDasGravacoes } from "./gravacoes-sessoes";
import { aplicarMudancas, guardarArquivo, novaMeta, removerSessao } from "./gravacoes-registros";
import type { MetaGravacao, Mudancas } from "./gravacoes-registros";

export type { MetaGravacao, Mudancas, Pagina, Posicao, Resumo, SessaoAberta } from "./gravacoes-registros";
export { TAMANHO_DA_PAGINA } from "./gravacoes-consultas";
export { BANCO, ESPERA_AO_ABRIR_MS, LIMITE_PARA_GUARDAR_MS, LimiteEstourado, TENTATIVAS_DE_ABRIR, comLimite } from "./gravacoes-banco";

/** "17/11 10:46" (dia e mês na ordem do idioma, mais hora e minuto); com `comAno`, "17/11/2025 10:46". */
export function formatarData(criadaEm: number, idioma: string, comAno = false): string {
  if (!Number.isFinite(criadaEm)) return "";
  const opcoes: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  if (comAno) opcoes.year = "numeric";
  return new Intl.DateTimeFormat(idioma, opcoes).format(new Date(criadaEm));
}

/** O que `salvar` recebe: o arquivo gravado e de onde ele veio. */
export type EntradaDeGravacao = {
  blob: Blob;
  tipo: string;
  segundos: number;
  contexto?: ContextoGravacao | null;
  /** A sessão de recuperação de onde a gravação veio dos pedaços: sai na mesma transação. */
  sessao?: string | null;
};

export class Gravacoes extends SessoesDasGravacoes {
  /**
   * Guarda uma gravação (metadados e arquivo, numa transação só: ou entram os dois ou nenhum). O arquivo entra como **bytes** (`ArrayBuffer`) e não como `Blob`:
   * no CI, o `put` de um Blob feito pelo MediaRecorder nunca confirmava (o gravador entregava o arquivo e o armazenamento ficava mudo). A leitura entende os
   * dois formatos, então o que já estava guardado como Blob continua tocando.
   */
  async salvar({ blob, tipo, segundos, contexto, sessao }: EntradaDeGravacao): Promise<MetaGravacao> {
    const comeco = performance.now();
    rastro(`lendo os ${blob.size} bytes do arquivo`);
    const dados = await blob.arrayBuffer();
    rastro(`bytes lidos em ${Math.round(performance.now() - comeco)} ms; abrindo o armazenamento`);
    const banco = await this.banco();
    rastro(`armazenamento pronto em ${Math.round(performance.now() - comeco)} ms`);
    const meta = novaMeta(blob, tipo, segundos, contexto);
    // Com `sessao` (a gravação que veio dos pedaços), a sessão sai NA MESMA transação: se o app cair entre uma coisa e outra, a próxima abertura não recupera uma segunda cópia do que já está guardado.
    if (sessao) this.encerradas.add(sessao);
    await transacao(banco, sessao ? ["meta", "blobs", "sessoes", "pedacos"] : ["meta", "blobs"], "readwrite", (t) => {
      guardarArquivo(t, meta, dados);
      if (sessao) removerSessao(t, sessao);
    });
    rastro(`transação confirmada em ${Math.round(performance.now() - comeco)} ms`);
    return meta;
  }

  /**
   * Muda o nome ou a estrela de uma gravação. O `get` e o `put` vão na MESMA transação de `meta`: duas mudanças seguidas (favoritar e renomear) não perdem uma à outra, e uma gravação
   * apagada no meio NÃO é recriada (sem registro, não grava nada e devolve nulo). Os outros campos do registro, conhecidos ou não, ficam como estão; o áudio não é tocado.
   */
  async atualizar(id: string, mudancas: Mudancas): Promise<MetaGravacao | null> {
    const banco = await this.banco();
    // CUIDADO: dentro desta função só se pode esperar pedidos do IndexedDB. Qualquer outro `await` (um `tick`, um `fetch`, um `setTimeout`) deixa a transação terminar sozinha,
    // e o `put` abaixo daria `TransactionInactiveError`.
    return transacao(banco, ["meta"], "readwrite", async (t) => {
      const loja = t.objectStore("meta");
      const atual = (await pedido(loja.get(id))) as MetaGravacao | undefined;
      if (!atual) return null;
      const final = aplicarMudancas(atual, mudancas);
      loja.put(final);
      return final;
    });
  }

  async apagar(id: string): Promise<void> {
    const banco = await this.banco();
    await transacao(banco, ["meta", "blobs"], "readwrite", (t) => {
      t.objectStore("meta").delete(id);
      t.objectStore("blobs").delete(id);
    });
  }

  async apagarTodas(): Promise<void> {
    const banco = await this.banco();
    await transacao(banco, ["meta", "blobs"], "readwrite", (t) => {
      t.objectStore("meta").clear();
      t.objectStore("blobs").clear();
    });
  }
}

export const gravacoes = new Gravacoes();
