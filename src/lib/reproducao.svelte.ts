// Reprodução global: um único sintetizador para o app inteiro. Assim a música continua ao trocar de
// aba, voltar à lista ou abrir Ajustes, e o miniplayer sempre mostra o estado real.
import type { Hino } from "./biblioteca.svelte";
import type { InstrumentoId } from "./instrumentos";
import { lerVoz } from "./preferencias";
import { Sintetizador } from "./sintetizador";

export type Estado = "parado" | "tocando" | "pausado";

/** Ajustes de um hino. Instrumento, volume e silenciar de cada voz vêm das preferências salvas. */
export type Config = {
  andamento: number;
  transposicao: number;
  instrumentos: InstrumentoId[];
  volumes: number[];
  mudas: boolean[];
};

export const ANDAMENTO_MIN = 40;
export const ANDAMENTO_MAX = 160;
export const TRANSPOSICAO_MAX = 6;

const sint = new Sintetizador();
const configs = new Map<number, Config>();

let atual = $state<{ numero: number; titulo: string } | null>(null);
let estado = $state<Estado>("parado");
let decorrido = $state(0);
let duracao = $state(0);
/** Texto do último erro ao iniciar o áudio (vazio se não houve). */
let erro = $state("");
/** Hino cujo painel Ouvir está aberto na tela (o miniplayer some para não duplicar controles). */
let painelNumero = $state<number | null>(null);

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

async function tocar(hino: Hino) {
  if (trocando) return;
  trocando = true;
  erro = "";
  try {
    const c = config(hino);
    pararRelogio();
    duracao = await sint.tocar(hino.vozes, {
      andamento: c.andamento,
      transposicao: c.transposicao,
      instrumentos: [...c.instrumentos],
      volumes: hino.vozes.map((_, i) => efetivo(c, i)),
    });
    atual = { numero: hino.numero, titulo: hino.titulo };
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
}

/** Botão principal de um hino: tocar, pausar ou continuar conforme o estado dele. */
async function alternar(hino: Hino) {
  if (atual?.numero !== hino.numero) return tocar(hino);
  if (estado === "tocando") return pausar();
  if (estado === "pausado") return continuar();
  return tocar(hino);
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

export const reproducao = {
  get atual() {
    return atual;
  },
  get estado() {
    return estado;
  },
  get decorrido() {
    return decorrido;
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
