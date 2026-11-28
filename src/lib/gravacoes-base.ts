// A base da classe `Gravacoes`: a conexão preguiçosa com o IndexedDB e o registro das sessões já encerradas. As consultas, as sessões de recuperação e a escrita
// ficam em `gravacoes-consultas.ts`, `gravacoes-sessoes.ts` e `gravacoes.ts`, uma camada sobre a outra (a API pública é a mesma de sempre).

import { abrirComTentativas } from "./gravacoes-banco";

export class BaseDasGravacoes {
  private abrindo: Promise<IDBDatabase> | null = null;
  /** Sessões já fechadas ou descartadas: um pedaço que chega atrasado para elas não é escrito (ficaria órfão e viraria uma gravação falsa na recuperação). */
  protected readonly encerradas = new Set<string>();

  /** `fabrica` devolve o IndexedDB (um falso nos testes). */
  constructor(private readonly fabrica: () => IDBFactory | undefined = () => (typeof indexedDB === "undefined" ? undefined : indexedDB)) {}

  protected banco(): Promise<IDBDatabase> {
    if (this.abrindo) return this.abrindo;
    const idb = this.fabrica();
    if (!idb) return Promise.reject(new Error("armazenamento indisponível"));
    // Uma falha ao abrir não fica guardada: a próxima chamada tenta de novo.
    this.abrindo = abrirComTentativas(idb, () => {
      this.abrindo = null;
    }).catch((e) => {
      this.abrindo = null;
      throw e;
    });
    return this.abrindo;
  }

  /** Fecha a conexão (nos testes, para recomeçar do zero). */
  async fechar(): Promise<void> {
    const b = await this.abrindo?.catch(() => null);
    b?.close();
    this.abrindo = null;
  }
}
