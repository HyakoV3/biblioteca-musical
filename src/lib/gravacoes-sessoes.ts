// As sessões de gravação (AND-002): o registro que abre, os pedaços que chegam e a recuperação do que ficou aberto se o app caiu.

import type { ContextoGravacao } from "./contexto";
import { pedido, transacao } from "./gravacoes-banco";
import { ConsultasDasGravacoes } from "./gravacoes-consultas";
import { faixaDaSessao, guardarArquivo, metaRecuperada, novoId, removerSessao } from "./gravacoes-registros";
import type { MetaGravacao, SessaoAberta } from "./gravacoes-registros";

export class SessoesDasGravacoes extends ConsultasDasGravacoes {
  /** Abre uma sessão de gravação (AND-002): daqui em diante os pedaços entram por `guardarPedaco`. Devolve o id da sessão. */
  async abrirSessao(tipo: string, contexto?: ContextoGravacao | null): Promise<string> {
    const banco = await this.banco();
    const sessao: SessaoAberta = { id: novoId(), criadaEm: Date.now(), tipo, ...(contexto ? { contexto } : {}) };
    await transacao(banco, ["sessoes"], "readwrite", (t) => {
      t.objectStore("sessoes").put(sessao);
    });
    return sessao.id;
  }

  /** Guarda o pedaço `indice` de uma sessão aberta (como bytes, pelo mesmo motivo de `salvar`). Pedaço para uma sessão já encerrada é ignorado. */
  async guardarPedaco(sessao: string, indice: number, pedaco: Blob): Promise<void> {
    const dados = await pedaco.arrayBuffer();
    if (this.encerradas.has(sessao)) return;
    const banco = await this.banco();
    if (this.encerradas.has(sessao)) return; // conferido de novo: a espera pelo banco pode ter passado do fechamento
    await transacao(banco, ["pedacos"], "readwrite", (t) => {
      t.objectStore("pedacos").put({ dados }, [sessao, indice]);
    });
  }

  /** Encerra uma sessão sem fazer dela uma gravação (a gravação inteira já foi guardada pelo caminho normal): apaga os pedaços e o registro. */
  async descartarSessao(sessao: string): Promise<void> {
    this.encerradas.add(sessao);
    const banco = await this.banco();
    await transacao(banco, ["sessoes", "pedacos"], "readwrite", (t) => removerSessao(t, sessao));
  }

  /**
   * Na abertura do app: toda sessão que ficou aberta (o app caiu no meio da gravação) vira uma gravação guardada, montada com os pedaços que chegaram, na ordem. `excluir` é o que está
   * gravando agora (não é uma sobra). A duração é estimada (um pedaço por segundo). Sessão sem nenhum pedaço é só apagada. Devolve as gravações recuperadas.
   */
  async recuperarSessoes(excluir: readonly string[] = []): Promise<MetaGravacao[]> {
    const banco = await this.banco();
    const sessoes = (await transacao(banco, ["sessoes"], "readonly", (t) => pedido(t.objectStore("sessoes").getAll()))) as SessaoAberta[];
    const recuperadas: MetaGravacao[] = [];
    for (const s of sessoes) {
      if (excluir.includes(s.id) || this.encerradas.has(s.id)) continue;
      const meta = await this.tentarRecuperar(banco, s);
      if (meta) recuperadas.push(meta);
    }
    return recuperadas;
  }

  /** Uma sessão que não dá para recuperar (pouco espaço: a cópia inteira precisa de mais lugar que os pedaços) NÃO impede as outras: fica como está e a próxima abertura tenta de novo. */
  private async tentarRecuperar(banco: IDBDatabase, s: SessaoAberta): Promise<MetaGravacao | null> {
    try {
      return await this.recuperarUma(banco, s);
    } catch (e) {
      console.warn(`gravador: não foi possível recuperar a gravação ${s.id}`, e);
      return null;
    }
  }

  private async recuperarUma(banco: IDBDatabase, s: SessaoAberta): Promise<MetaGravacao | null> {
    const faixa = faixaDaSessao(s.id);
    const pedacos = (await transacao(banco, ["pedacos"], "readonly", (t) => pedido(t.objectStore("pedacos").getAll(faixa)))) as { dados: ArrayBuffer }[];
    const blob = new Blob(
      pedacos.map((p) => p.dados),
      { type: s.tipo },
    );
    const meta = blob.size > 0 ? metaRecuperada(s, pedacos.length, blob.size) : null;
    const dados = meta ? await blob.arrayBuffer() : null;
    // Numa transação só: a gravação entra e a sessão sai (ou nada muda, e a próxima abertura tenta de novo).
    await transacao(banco, ["meta", "blobs", "sessoes", "pedacos"], "readwrite", (t) => {
      if (meta && dados) guardarArquivo(t, meta, dados);
      removerSessao(t, s.id);
    });
    this.encerradas.add(s.id);
    return meta;
  }
}
