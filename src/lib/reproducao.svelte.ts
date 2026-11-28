// Reprodução global: um único sintetizador para o app inteiro. Assim a música continua ao trocar de
// aba, voltar à lista ou abrir Ajustes, e o miniplayer sempre mostra o estado real.
import type { Hino } from "./biblioteca.svelte";
import { i18n } from "./i18n/index.svelte";
import { continuar, irPara, reagendar } from "./reproducaoAgenda.svelte";
import { config, configs, est, iniciarRelogio, motor, parar, pararRelogio, sint } from "./reproducaoEstado.svelte";
import { descreverTocando, efetivo, mudou, parteTocandoDe, planejar, pontoDoHino, type Config, type Parte, type Ponto } from "./reproducaoPlano";

// A API pública continua aqui: os componentes e os testes importam tudo de `reproducao.svelte`.
export { ANDAMENTO_MAX, ANDAMENTO_MIN, TRANSPOSICAO_MAX, vezesDoHino, type Config, type Estado, type Parte, type Ponto } from "./reproducaoPlano";

async function tocar(hino: Hino, parte: Parte = "tudo") {
  if (motor.trocando) return;
  motor.trocando = true;
  est.erro = "";
  const g = motor.geracao;
  try {
    await iniciarSom(hino, parte, g);
  } catch (e) {
    falhouAoTocar(e, g);
  } finally {
    motor.trocando = false;
  }
}

/** O som do hino: agenda, e só então (se Parar não foi tocado no meio) passa a "tocando". */
async function iniciarSom(hino: Hino, parte: Parte, g: number) {
  const c = config(hino);
  const plano = planejar(hino, parte, c.andamento);
  pararRelogio();
  // Os ajustes de quando o som foi agendado, em cópia: a configuração é viva e a pessoa pode mexer nela enquanto o áudio carrega.
  const copia = { andamento: c.andamento, transposicao: c.transposicao, instrumentos: [...c.instrumentos] };
  est.duracao = await sint.tocar(plano.vozes, {
    ...copia,
    instrumentos: [...copia.instrumentos],
    volumes: hino.vozes.map((_, i) => efetivo(c, i)),
  });
  if (g !== motor.geracao) {
    sint.parar(); // Parar foi tocado enquanto o áudio iniciava: não deixa o som começar
    return;
  }
  est.atual = descreverTocando({ hino, parte, c, plano }, i18n.idioma);
  motor.agendado = { vozes: plano.vozes, ...copia };
  est.decorrido = 0;
  est.estado = "tocando";
  iniciarRelogio();
  // Reconcilia com o que a pessoa mexeu durante o carregamento: volume e mudo valem já (o `volumeAoVivo` ignorava a voz enquanto `atual` era nulo)
  // e, se andamento, tom ou instrumento mudaram, reagenda do começo com os ajustes de agora.
  hino.vozes.forEach((_, i) => sint.volume(i, efetivo(c, i)));
  if (mudou(c, motor.agendado)) await reagendar(0, false);
}

function falhouAoTocar(e: unknown, g: number) {
  sint.parar();
  // Parar foi tocado enquanto o áudio iniciava: o erro (se houve) é consequência disso, não um problema a mostrar.
  if (g !== motor.geracao) return;
  // O áudio não iniciou (ex.: o sistema bloqueou): volta ao estado parado e mostra o aviso.
  est.estado = "parado";
  est.atual = null;
  est.erro = String(e);
}

async function pausar() {
  if (est.estado !== "tocando" || motor.trocando) return;
  const g = motor.geracao;
  await sint.pausar();
  if (g !== motor.geracao) return; // Parar foi tocado enquanto o áudio suspendia: não ressuscita o estado
  pararRelogio();
  est.decorrido = sint.audivel();
  est.estado = "pausado";
}

/**
 * Botão de uma parte do hino (o hino todo ou uma vez): se é a que está tocando, pausa ou continua;
 * se é outra, passa a tocar essa, direto.
 */
async function alternar(hino: Hino, parte: Parte = "tudo") {
  if (est.atual?.numero !== hino.numero || est.atual.parte !== parte) return tocar(hino, parte);
  if (est.estado === "tocando") return pausar();
  if (est.estado === "pausado") return continuar();
  return tocar(hino, parte);
}

/** Botão do miniplayer: pausar ou continuar o hino que está tocando. */
async function alternarAtual() {
  if (est.estado === "tocando") return pausar();
  if (est.estado === "pausado") return continuar();
}

/** Volume e silenciar valem na hora, mesmo com o hino tocando. */
function volumeAoVivo(numero: number, voz: number) {
  const c = configs.get(numero);
  if (c && est.atual?.numero === numero) sint.volume(voz, efetivo(c, voz));
}

/** Para tudo e esquece os ajustes dos hinos (usar quando o conteúdo importado muda). */
function limpar() {
  parar();
  configs.clear();
}

/**
 * Lê a posição NESTE instante, direto do relógio do áudio (o `decorrido` do store só anda a cada 200 ms, o que
 * faria o karaokê chegar atrasado). Usa o tempo que se ouve, descontando o atraso da saída de áudio. Nulo se o
 * hino `numero` não é o que está tocando ou pausado. Não é reativo: quem chama lê a cada quadro.
 */
function ponto(numero: number): Ponto | null {
  return pontoDoHino(est.atual, est.estado, numero, () => sint.audivel());
}

export const reproducao = {
  ponto,
  get atual() {
    return est.atual;
  },
  get estado() {
    return est.estado;
  },
  get decorrido() {
    return est.decorrido;
  },
  get revisaoDoPonto() {
    return est.revisaoDoPonto;
  },
  /**
   * Qual parte está tocando agora ("intro" ou o número da vez). Em "tudo" acompanha a música; na pausa entre duas
   * partes vale a que acabou de terminar. Nulo se não há nada tocando ou pausado.
   */
  get parteTocando(): "intro" | number | null {
    return parteTocandoDe(est.atual, est.estado, est.decorrido);
  },
  get duracao() {
    return est.duracao;
  },
  get erro() {
    return est.erro;
  },
  get painelNumero() {
    return est.painelNumero;
  },
  set painelNumero(v: number | null) {
    est.painelNumero = v;
  },
  config,
  tocar,
  pausar,
  continuar,
  irPara,
  parar,
  alternar,
  alternarAtual,
  volumeAoVivo,
  limpar,
};
