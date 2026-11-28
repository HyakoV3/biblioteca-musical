// As consultas às gravações guardadas (só leitura): a página da lista, a lista inteira, o arquivo de áudio e o resumo de espaço.

import { pedido, transacao } from "./gravacoes-banco";
import { BaseDasGravacoes } from "./gravacoes-base";
import { varrer } from "./gravacoes-registros";
import type { MetaGravacao, Pagina, Posicao, Resumo } from "./gravacoes-registros";
import { normalizarMeta } from "./metaGravacao";

/** Quantas gravações a lista carrega por vez. */
export const TAMANHO_DA_PAGINA = 10;

export class ConsultasDasGravacoes extends BaseDasGravacoes {
  /** Uma página da lista, da mais nova para a mais antiga, começando depois de `antes` (ou do começo). `temMais` diz se há outra página. */
  async listar(limite: number = TAMANHO_DA_PAGINA, antes?: Posicao): Promise<Pagina> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", (t) => {
      const faixa = antes ? globalThis.IDBKeyRange.upperBound([antes.criadaEm, antes.id], true) : undefined;
      const coletadas: MetaGravacao[] = [];
      const cursor = t.objectStore("meta").index("porData").openCursor(faixa, "prev");
      // Lê uma a mais que o limite: é assim que se sabe se há outra página.
      const passo = (valor: unknown): boolean => {
        if (coletadas.length > limite) return false;
        coletadas.push(valor as MetaGravacao);
        return true;
      };
      return varrer(cursor, passo, () => ({ itens: coletadas.slice(0, limite), temMais: coletadas.length > limite }));
    });
  }

  /** Todos os metadados, da mais nova para a mais antiga (o áudio fica de fora: `meta` é leve). Uma leitura só, pelo índice `porData`, no lugar de um cursor por página. */
  async listarTodas(): Promise<MetaGravacao[]> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", async (t) => {
      const lidas = (await pedido(t.objectStore("meta").index("porData").getAll())) as MetaGravacao[];
      return lidas.reverse().map(normalizarMeta); // o índice vai da mais antiga para a mais nova; nome e estrela lidos do banco são validados
    });
  }

  /** O arquivo de áudio de uma gravação, ou nulo se não existe mais. */
  async blob(id: string): Promise<Blob | null> {
    const banco = await this.banco();
    return transacao(banco, ["blobs"], "readonly", async (t) => {
      const v = (await pedido(t.objectStore("blobs").get(id))) as Blob | { dados: ArrayBuffer; tipo: string } | undefined;
      if (!v) return null;
      return v instanceof Blob ? v : new Blob([v.dados], { type: v.tipo }); // o formato antigo era o Blob inteiro
    });
  }

  /** Quantas gravações há e quanto espaço ocupam (soma dos tamanhos dos arquivos). */
  async resumo(): Promise<Resumo> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", (t) => {
      let quantidade = 0;
      let bytes = 0;
      const passo = (valor: unknown): boolean => {
        quantidade++;
        bytes += (valor as MetaGravacao).bytes;
        return true;
      };
      return varrer(t.objectStore("meta").openCursor(), passo, () => ({ quantidade, bytes }));
    });
  }
}
