// Reprodução global: um único sintetizador para o app inteiro. Assim a música continua ao trocar de
// aba, voltar à lista ou abrir Ajustes, e o miniplayer sempre mostra o estado real.
import type { Hino } from "./biblioteca.svelte";
import type { InstrumentoId } from "./instrumentos";
import { estrofes } from "./letra";
import {
  PAUSA_ENTRE_PARTES_S,
  ehFinal,
  montarTudo,
  parteNaBatida,
  partesDoTudo,
  temFinal,
  temIntroducao,
  totalDeVezes,
  vozesDaIntroducao,
  vozesDaVez,
  type ParteDoTudo,
} from "./vezes";
import { lerVoz } from "./preferencias";
import { Sintetizador, type Voz } from "./sintetizador";

export type Estado = "parado" | "tocando" | "pausado";

/** Ajustes de um hino. Instrumento, volume e silenciar de cada voz vêm das preferências salvas. */
export type Config = {
  andamento: number;
  transposicao: number;
  instrumentos: InstrumentoId[];
  volumes: number[];
  mudas: boolean[];
};

/** O que tocar: o hino todo (introdução, 1ª vez, 2ª, ... final, com pausas), só a introdução, ou uma vez (1 = primeira). */
export type Parte = "tudo" | "intro" | number;

/** Quantas vezes o hino tem (1 se não tem final; senão uma por estrofe, a última é o final). */
export function vezesDoHino(hino: Hino): number {
  return totalDeVezes(hino, estrofes(hino.letra).length);
}

export const ANDAMENTO_MIN = 40;
export const ANDAMENTO_MAX = 160;
export const TRANSPOSICAO_MAX = 6;

const sint = new Sintetizador();
const configs = new Map<number, Config>();

/**
 * O que está tocando. `parte` é o que foi pedido; em "tudo", `marcos` diz onde cada parte começa e termina (em
 * batidas, com as pausas) e `andamento` converte o tempo decorrido em batidas. `comFinal` diz se a última vez
 * é o final; `final` diz se a parte tocada sozinha é o final.
 */
type Tocando = {
  numero: number;
  titulo: string;
  parte: Parte;
  total: number;
  comFinal: boolean;
  final: boolean;
  andamento: number;
  marcos: Pick<ParteDoTudo, "parte" | "inicio" | "fim">[];
};
let atual = $state<Tocando | null>(null);
let estado = $state<Estado>("parado");
let decorrido = $state(0);
let duracao = $state(0);
/** Texto do último erro ao iniciar o áudio (vazio se não houve). */
let erro = $state("");
/** Hino cujo painel Ouvir está aberto na tela (o miniplayer some para não duplicar controles). */
let painelNumero = $state<number | null>(null);

/**
 * O que o som que está agendado usa: as vozes montadas (em batidas) e os ajustes do momento em que ele foi agendado.
 * Com a música pausada, se os ajustes mudarem, "continuar" reagenda a partir da posição atual (ver `continuar`).
 */
type Agendado = { vozes: Voz[]; andamento: number; transposicao: number; instrumentos: string[] };
let agendado: Agendado | null = null;

const mudou = (c: Config, a: Agendado) =>
  c.andamento !== a.andamento ||
  c.transposicao !== a.transposicao ||
  c.instrumentos.length !== a.instrumentos.length ||
  c.instrumentos.some((id, i) => id !== a.instrumentos[i]);

let relogio: ReturnType<typeof setInterval> | null = null;
let trocando = false;

const efetivo = (c: Config, i: number) => (c.mudas[i] ? 0 : c.volumes[i]);

function pararRelogio() {
  if (relogio) clearInterval(relogio);
  relogio = null;
}

function iniciarRelogio() {
  pararRelogio();
  relogio = setInterval(() => {
    decorrido = sint.decorrido();
    if (decorrido >= duracao + 0.15) parar(); // terminou sozinho
  }, 200);
}

/** Ajustes do hino; criados na primeira vez a partir das preferências salvas de cada voz. */
function config(hino: Hino): Config {
  const existente = configs.get(hino.numero);
  if (existente) return existente;
  const salvas = hino.vozes.map((v) => lerVoz(v.nome));
  const nova = $state<Config>({
    andamento: hino.andamento ?? 90,
    transposicao: 0,
    instrumentos: salvas.map((p) => p.instrumento),
    volumes: salvas.map((p) => p.volume),
    mudas: salvas.map((p) => p.muda),
  });
  configs.set(hino.numero, nova);
  return nova;
}

async function tocar(hino: Hino, parte: Parte = "tudo") {
  if (trocando) return;
  trocando = true;
  erro = "";
  try {
    const c = config(hino);
    const total = vezesDoHino(hino);
    // "tudo" = o hino como é cantado, com uma pausa entre as partes (em segundos, então vale em batidas conforme o
    // andamento escolhido); "intro" = só a introdução; um número = só aquela vez, direto.
    const pausa = (PAUSA_ENTRE_PARTES_S * c.andamento) / 60;
    const partes = partesDoTudo(hino, total, pausa);
    const vozes =
      parte === "tudo"
        ? montarTudo(hino, total, pausa)
        : parte === "intro" && temIntroducao(hino)
          ? vozesDaIntroducao(hino)
          : vozesDaVez(hino, typeof parte === "number" ? parte : 1, total);
    pararRelogio();
    duracao = await sint.tocar(vozes, {
      andamento: c.andamento,
      transposicao: c.transposicao,
      instrumentos: [...c.instrumentos],
      volumes: hino.vozes.map((_, i) => efetivo(c, i)),
    });
    atual = {
      numero: hino.numero,
      titulo: hino.titulo,
      parte,
      total,
      comFinal: temFinal(hino),
      final: typeof parte === "number" && ehFinal(hino, parte, total),
      andamento: c.andamento,
      marcos: partes.map(({ parte: p, inicio, fim }) => ({ parte: p, inicio, fim })),
    };
    agendado = {
      vozes,
      andamento: c.andamento,
      transposicao: c.transposicao,
      instrumentos: [...c.instrumentos],
    };
    decorrido = 0;
    estado = "tocando";
    iniciarRelogio();
  } catch (e) {
    // O áudio não iniciou (ex.: o sistema bloqueou): volta ao estado parado e mostra o aviso.
    sint.parar();
    estado = "parado";
    atual = null;
    erro = String(e);
  } finally {
    trocando = false;
  }
}

async function pausar() {
  if (estado !== "tocando" || trocando) return;
  await sint.pausar();
  pararRelogio();
  decorrido = sint.decorrido();
  estado = "pausado";
}

async function continuar() {
  if (estado !== "pausado" || trocando) return;
  const c = atual ? configs.get(atual.numero) : undefined;
  if (atual && c && agendado && mudou(c, agendado)) {
    // Instrumento, andamento ou tom mudaram na pausa: reagenda de onde parou, com os ajustes novos. A posição vai
    // em batidas (não em segundos), para valer mesmo que o andamento tenha mudado.
    trocando = true;
    try {
      const batida = (decorrido * agendado.andamento) / 60;
      duracao = await sint.tocar(
        agendado.vozes,
        {
          andamento: c.andamento,
          transposicao: c.transposicao,
          instrumentos: [...c.instrumentos],
          volumes: agendado.vozes.map((_, i) => efetivo(c, i)),
        },
        { aPartirDe: batida, pausado: true },
      );
      agendado = {
        vozes: agendado.vozes,
        andamento: c.andamento,
        transposicao: c.transposicao,
        instrumentos: [...c.instrumentos],
      };
      atual.andamento = c.andamento; // os marcos das partes estão em batidas; o andamento novo os converte
      decorrido = sint.decorrido();
    } catch (e) {
      sint.parar();
      parar();
      erro = String(e);
      trocando = false;
      return;
    }
    trocando = false;
  }
  await sint.continuar();
  estado = "tocando";
  iniciarRelogio();
}

function parar() {
  pararRelogio();
  sint.parar();
  estado = "parado";
  decorrido = 0;
  duracao = 0;
  atual = null;
  agendado = null;
}

/**
 * Botão de uma parte do hino (o hino todo ou uma vez): se é a que está tocando, pausa ou continua;
 * se é outra, passa a tocar essa, direto.
 */
async function alternar(hino: Hino, parte: Parte = "tudo") {
  if (atual?.numero !== hino.numero || atual.parte !== parte) return tocar(hino, parte);
  if (estado === "tocando") return pausar();
  if (estado === "pausado") return continuar();
  return tocar(hino, parte);
}

/** Botão do miniplayer: pausar ou continuar o hino que está tocando. */
async function alternarAtual() {
  if (estado === "tocando") return pausar();
  if (estado === "pausado") return continuar();
}

/** Volume e silenciar valem na hora, mesmo com o hino tocando. */
function volumeAoVivo(numero: number, voz: number) {
  const c = configs.get(numero);
  if (c && atual?.numero === numero) sint.volume(voz, efetivo(c, voz));
}

/** Para tudo e esquece os ajustes dos hinos (usar quando o conteúdo importado muda). */
function limpar() {
  parar();
  configs.clear();
}

/** Onde a música está agora: a parte, a batida dentro dela e se essa parte é o final do hino. */
export type Ponto = { parte: "intro" | number; batida: number; final: boolean };

/**
 * Lê a posição NESTE instante, direto do relógio do áudio (o `decorrido` do store só anda a cada 200 ms, o que
 * faria o karaokê chegar atrasado). Usa o tempo que se ouve, descontando o atraso da saída de áudio. Nulo se o
 * hino `numero` não é o que está tocando ou pausado. Não é reativo: quem chama lê a cada quadro.
 */
function ponto(numero: number): Ponto | null {
  if (!atual || atual.numero !== numero || estado === "parado") return null;
  const batida = (sint.audivel() * atual.andamento) / 60;
  const parte = atual.parte === "tudo" ? parteNaBatida(atual.marcos, batida) : atual.parte;
  if (parte === null) return null;
  // Em "tudo" a parte começa onde o marco diz; tocada sozinha, começa em 0.
  const inicio = atual.parte === "tudo" ? (atual.marcos.find((m) => m.parte === parte)?.inicio ?? 0) : 0;
  const final = parte !== "intro" && atual.comFinal && parte === atual.total;
  return { parte, batida: Math.max(0, batida - inicio), final };
}

export const reproducao = {
  ponto,
  get atual() {
    return atual;
  },
  get estado() {
    return estado;
  },
  get decorrido() {
    return decorrido;
  },
  /**
   * Qual parte está tocando agora ("intro" ou o número da vez). Em "tudo" acompanha a música; na pausa entre duas
   * partes vale a que acabou de terminar. Nulo se não há nada tocando ou pausado.
   */
  get parteTocando(): "intro" | number | null {
    if (!atual || estado === "parado") return null;
    if (atual.parte !== "tudo") return atual.parte;
    return parteNaBatida(atual.marcos, (decorrido * atual.andamento) / 60);
  },
  get duracao() {
    return duracao;
  },
  get erro() {
    return erro;
  },
  get painelNumero() {
    return painelNumero;
  },
  set painelNumero(v: number | null) {
    painelNumero = v;
  },
  config,
  tocar,
  pausar,
  continuar,
  parar,
  alternar,
  alternarAtual,
  volumeAoVivo,
  limpar,
};
