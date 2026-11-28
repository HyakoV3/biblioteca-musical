// O estado da reprodução global (o que a tela vê e o que só o motor sabe), o relógio, os ajustes de cada hino e o `parar`.
// Separado de `reproducao.svelte.ts` para que o tocar/pausar e o reagendar/irPara dividam o mesmo estado sem se importarem em círculo.
import type { Hino } from "./biblioteca.svelte";
import { lerVoz } from "./preferencias";
import { Sintetizador } from "./sintetizador";
import { configInicial, type Agendado, type Config, type Estado, type Tocando } from "./reproducaoPlano";

export const sint = new Sintetizador();
export const configs = new Map<number, Config>();

/** O que a tela lê (reativo). */
export const est = $state<{
  atual: Tocando | null;
  estado: Estado;
  decorrido: number;
  /**
   * Sobe a cada vez que o som termina de ser reagendado (arrastar a barra, retomar depois de mexer em tom ou andamento). O `decorrido` muda ANTES
   * (a barra já mostra o ponto escolhido) e depois volta ao mesmo valor, então quem lê a posição estando pausado (o destaque da partitura, I-12) não
   * ficaria sabendo que o som já está no ponto novo; este contador avisa.
   */
  revisaoDoPonto: number;
  duracao: number;
  /** Texto do último erro ao iniciar o áudio (vazio se não houve). */
  erro: string;
  /** Hino cujo painel Ouvir está aberto na tela (o miniplayer some para não duplicar controles). */
  painelNumero: number | null;
}>({ atual: null, estado: "parado", decorrido: 0, revisaoDoPonto: 0, duracao: 0, erro: "", painelNumero: null });

/** O que só o motor usa (não reativo). */
export const motor: {
  agendado: Agendado | null;
  relogio: ReturnType<typeof setInterval> | null;
  trocando: boolean;
  // Muda a cada `parar()`. Quem está esperando o áudio (tocar, reagendar) guarda o número de quando começou: se mudou ao voltar,
  // a pessoa tocou em Parar nesse meio tempo, então o som que acabou de ser agendado é silenciado em vez de começar a tocar.
  geracao: number;
  // A última posição pedida no slider enquanto um reagendamento estava em curso (aplicada ao terminar, em vez de descartada).
  buscaPendente: number | null;
} = { agendado: null, relogio: null, trocando: false, geracao: 0, buscaPendente: null };

export function pararRelogio() {
  if (motor.relogio) clearInterval(motor.relogio);
  motor.relogio = null;
}

export function iniciarRelogio() {
  pararRelogio();
  motor.relogio = setInterval(() => {
    est.decorrido = sint.audivel(); // o que se OUVE: a mesma régua do karaokê (REP-007)
    if (est.decorrido >= est.duracao + 0.15) parar(); // terminou sozinho
  }, 200);
}

/** Ajustes do hino; criados na primeira vez a partir das preferências salvas de cada voz. */
export function config(hino: Hino): Config {
  const existente = configs.get(hino.numero);
  if (existente) return existente;
  const nova = $state<Config>(
    configInicial(
      hino,
      hino.vozes.map((v) => lerVoz(v.nome)),
    ),
  );
  configs.set(hino.numero, nova);
  return nova;
}

export function parar() {
  motor.geracao++;
  motor.buscaPendente = null;
  pararRelogio();
  sint.parar();
  est.estado = "parado";
  est.decorrido = 0;
  est.duracao = 0;
  est.atual = null;
  motor.agendado = null;
}
