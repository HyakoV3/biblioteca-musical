// O que a gravação em curso precisa do resto do app (dependências reais, contexto do fone, prazo para guardar) e os tipos que ela troca com as telas. Separado de `gravacaoEmCurso.svelte.ts`.
import { biblioteca } from "./biblioteca.svelte";
import { montarContexto, type ContextoGravacao, type Entrada } from "./contexto";
import type { FiltroDeRuido } from "./filtroDeRuido";
import { Gravador, motivoDoErro, type Gravacao, type MotivoDoErro } from "./gravador";
import { LIMITE_PARA_GUARDAR_MS, LimiteEstourado, comLimite, gravacoes, type MetaGravacao } from "./gravacoes";
import { metronomo } from "./metronomo.svelte";
import { reproducao } from "./reproducao.svelte";
import { aoFalharServicoDeGravacao, aoPararGravacaoPelaNotificacao, desligarServicoDeGravacao, foneConectado, ligarServicoDeGravacao } from "./servico";

const MOTIVO_DEMORA = "o armazenamento demorou demais para guardar a gravação";

/** O que `guardarComPrazo` conta: guardada dentro do prazo, ou não (por erro, ou porque demorou; nesse caso `depois` diz, mais tarde, se a escrita terminou). */
export type ResultadoDoGuardar = { guardada: true; meta: MetaGravacao } | { guardada: false; demorou: boolean; depois: Promise<MetaGravacao> };

/**
 * O ÚNICO lugar que guarda uma gravação com prazo: espera `salvando` até `ms`. O estouro do prazo é o erro próprio `LimiteEstourado` (nada de comparar o texto da mensagem), e a escrita que
 * continua depois do prazo segue em `depois`, para quem precisar saber que a gravação, afinal, foi guardada.
 */
export async function guardarComPrazo(salvando: Promise<MetaGravacao>, ms = LIMITE_PARA_GUARDAR_MS): Promise<ResultadoDoGuardar> {
  salvando.catch(() => {}); // quem olha o resultado tardio é `depois`; sem isto, uma escrita que falha depois do prazo seria uma rejeição sem dono
  try {
    return {
      guardada: true,
      meta: await comLimite(salvando, ms, MOTIVO_DEMORA),
    };
  } catch (e) {
    return {
      guardada: false,
      demorou: e instanceof LimiteEstourado,
      depois: salvando,
    };
  }
}

/** Como terminou uma gravação, para quem mostra a lista (`aoTerminar`). */
export type Resultado =
  | { tipo: "guardada"; meta: MetaGravacao }
  /** Nada chegou do microfone: não há o que guardar. */
  | { tipo: "vazia" }
  /** Não deu para guardar dentro do prazo (cota cheia, armazenamento mudo): a gravação fica à mão para ouvir e enviar. `depois` diz se a escrita ainda terminou. */
  | {
      tipo: "nao-guardada";
      gravacao: Gravacao;
      demorou: boolean;
      depois: Promise<MetaGravacao>;
      sessao: Promise<string | null> | null;
    };

export type ResultadoDeIniciar = {
  cancelada: boolean;
  erro: MotivoDoErro | null;
  filtroFalhou: FiltroDeRuido | null;
};

/** O que a gravação precisa do resto do app; os testes trocam por falsos. */
export type Dependencias = {
  criarGravador: () => Gravador;
  armazenamento: Pick<typeof gravacoes, "salvar" | "abrirSessao" | "guardarPedaco" | "descartarSessao" | "recuperarSessoes">;
  lerContexto: () => ContextoGravacao | null;
  foneConectado: () => boolean;
  /** Sem fone, um som de cada vez: o hino e o metrônomo calam antes de gravar (o alto-falante entraria no microfone). */
  calarSons: () => void;
  servico: {
    ligar: () => boolean;
    desligar: () => void;
    aoParar: (quando: () => void) => () => void;
    aoFalhar: (quando: () => void) => () => void;
  };
  agora: () => number;
  pagina: {
    escondida: () => boolean;
    aoMudar: (quando: () => void) => () => void;
  };
};

/** O hino que toca agora (com a configuração dele), para o contexto da gravação. Nulo se nada toca. */
function hinoTocandoParaContexto(): Entrada["hino"] {
  const atual = reproducao.atual;
  if (!atual || reproducao.estado !== "tocando") return null;
  const hino = biblioteca.pacote?.hinario.hinos.find((h) => h.numero === atual.numero);
  const c = hino ? reproducao.config(hino) : null;
  if (!hino || !c) return null;
  return {
    tocando: true,
    numero: atual.numero,
    titulo: atual.titulo,
    tonalidade: hino.tonalidade,
    transposicao: c.transposicao,
    andamento: c.andamento,
    andamentoOriginal: hino.andamento,
    parte: atual.parte,
    vozes: hino.vozes.map((v, i) => ({
      nome: v.nome,
      muda: c.mudas[i] ?? false,
    })),
  };
}

/** O que a pessoa ouve no fone agora (metrônomo ou hino), para guardar com a gravação (I-38). Nulo sem fone ou sem nada tocando. */
export function lerContextoReal(): ContextoGravacao | null {
  return montarContexto({
    fone: foneConectado(),
    metronomo: {
      ligado: metronomo.ligado,
      bpm: metronomo.bpm,
      compasso: metronomo.compasso,
    },
    hino: hinoTocandoParaContexto(),
  });
}

const paginaEscondida = () => typeof document !== "undefined" && document.hidden;

function aoMudarAPagina(quando: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", quando);
  return () => document.removeEventListener("visibilitychange", quando);
}

export const dependenciasReais = (): Dependencias => ({
  criarGravador: () => new Gravador(),
  armazenamento: gravacoes,
  lerContexto: lerContextoReal,
  foneConectado,
  calarSons: () => {
    reproducao.parar();
    metronomo.parar(); // o clique do alto-falante entraria na gravação
  },
  servico: {
    ligar: ligarServicoDeGravacao,
    desligar: desligarServicoDeGravacao,
    aoParar: aoPararGravacaoPelaNotificacao,
    aoFalhar: aoFalharServicoDeGravacao,
  },
  agora: () => performance.now(),
  pagina: { escondida: paginaEscondida, aoMudar: aoMudarAPagina },
});

/** Quem recebe o resultado de uma gravação: a tela do Gravador (`aoTerminar`) ou, sem ela, o aviso `perdida`. */
export type DestinoDoResultado = {
  aoTerminar: ((resultado: Resultado) => void) | null;
  perdida: "falhou" | "incerta" | null;
};

/** Entrega o resultado à tela do Gravador. Sem ela (a pessoa está em outra tela), o que não foi guardado vira o aviso `perdida`, que a tela inicial mostra. */
export function entregarResultado(destino: DestinoDoResultado, resultado: Resultado): void {
  if (destino.aoTerminar) {
    destino.aoTerminar(resultado);
    return;
  }
  if (resultado.tipo !== "nao-guardada") return;
  URL.revokeObjectURL(resultado.gravacao.url); // ninguém vai ouvir esta gravação na tela
  destino.perdida = resultado.demorou ? "incerta" : "falhou";
  resultado.depois.then(
    () => {
      if (destino.perdida === "incerta") destino.perdida = null; // a escrita terminou bem
    },
    () => {
      destino.perdida = "falhou";
    },
  );
}
