// As sessões de recuperação (AND-002) da gravação em curso e o guardar com prazo: os pedaços vão sendo guardados numa sessão, e uma queda do app deixa o que já foi gravado.
// Separado de `gravacaoEmCurso.svelte.ts`.
import type { ContextoGravacao } from "./contexto";
import type { Dependencias, Resultado } from "./gravacaoEmCursoDeps";
import { guardarComPrazo } from "./gravacaoEmCursoDeps";
import { rastro, type Gravacao, type Gravador } from "./gravador";

type Sessao = Promise<string | null> | null;

export class SessoesDeRecuperacao {
  /** A sessão de recuperação da gravação que está em curso: os pedaços vão sendo guardados nela. Nula se o armazenamento não abriu. */
  private atual: Sessao = null;
  /** Sessões de gravações que já pararam mas ainda não foram resolvidas (guardando, ou não guardadas e à mão na tela): `recuperar` não as trata como sobra (viraria uma segunda cópia). */
  private readonly fechando = new Set<Promise<string | null>>();

  constructor(private readonly armazenamento: () => Dependencias["armazenamento"]) {}

  /** Abre a sessão de recuperação e liga o gravador a ela: cada pedaço que chega (um por segundo) é guardado na hora. Falhar aqui não atrapalha a gravação. */
  abrir(gravador: Gravador, contexto: ContextoGravacao | null): void {
    const armazenamento = this.armazenamento();
    const aberta = armazenamento.abrirSessao(gravador.tipo || "audio/webm", contexto).then(
      (id): string | null => id,
      (e) => {
        console.warn("gravador: não foi possível abrir a sessão de recuperação", e);
        return null;
      },
    );
    this.atual = aberta;
    gravador.aoPedaco = (indice, pedaco) => {
      void aberta.then((id) => (id ? armazenamento.guardarPedaco(id, indice, pedaco) : undefined)).catch((e) => console.warn("gravador: não foi possível guardar um pedaço", e));
    };
  }

  /** A gravação parou: a sessão dela sai de "atual" e passa a "fechando". Devolve a sessão. */
  fechar(): Sessao {
    const sessao = this.atual;
    this.atual = null;
    if (sessao) this.fechando.add(sessao);
    return sessao;
  }

  /** A sessão já foi resolvida (a gravação foi guardada): `recuperar` pode ignorá-la. */
  resolvida(sessao: Sessao): void {
    if (sessao) this.fechando.delete(sessao);
  }

  /** Apaga a sessão de recuperação (e os pedaços dela). */
  esquecer(sessao: Sessao): void {
    if (!sessao) return;
    void sessao
      .then((id) => (id ? this.armazenamento().descartarSessao(id) : undefined))
      .catch((e) => console.warn("gravador: não foi possível apagar a sessão de recuperação", e))
      .finally(() => this.fechando.delete(sessao));
  }

  /** Os ids das sessões que NÃO são sobras: a que está gravando agora e as que já pararam mas ainda estão sendo guardadas (ou esperam na tela). */
  async emUso(): Promise<string[]> {
    return (await Promise.all([this.atual, ...this.fechando])).filter((id): id is string => id !== null);
  }
}

/** O que `guardarGravacao` recebe de uma gravação que acabou de parar. */
export type Parada = {
  nova: Gravacao;
  contexto: ContextoGravacao | null;
  sessao: Sessao;
};

/** Guarda a gravação (com prazo). Se não der, ela fica à mão (na tela do Gravador, se há uma) e a sessão de recuperação NÃO é apagada: a próxima abertura do app ainda a recupera. */
export async function guardarGravacao(d: Dependencias, sessoes: SessoesDeRecuperacao, parada: Parada): Promise<Resultado> {
  const { nova, contexto, sessao } = parada;
  rastro(`guardando ${nova.bytes} bytes`);
  const comeco = d.agora();
  // A sessão sai na MESMA transação que guarda a gravação (se o app cair no meio, nada fica duplicado na próxima abertura).
  const idDaSessao = sessao ? await sessao : null;
  const r = await guardarComPrazo(d.armazenamento.salvar(nova.blob, nova.tipo, nova.segundos, contexto, idDaSessao));
  if (r.guardada) {
    rastro(`guardada em ${Math.round(d.agora() - comeco)} ms`);
    URL.revokeObjectURL(nova.url); // o arquivo já está no armazenamento; a lista o lê de lá quando a pessoa tocar em Ouvir
    sessoes.resolvida(sessao);
    return { tipo: "guardada", meta: r.meta };
  }
  console.warn("gravador: não foi possível guardar a gravação", r.demorou ? "(demorou demais)" : "");
  void r.depois.then(
    () => sessoes.resolvida(sessao), // a escrita terminou depois do prazo: guardada, e a sessão já saiu na mesma transação
    () => {},
  );
  return {
    tipo: "nao-guardada",
    gravacao: nova,
    demorou: r.demorou,
    depois: r.depois,
    sessao,
  };
}
