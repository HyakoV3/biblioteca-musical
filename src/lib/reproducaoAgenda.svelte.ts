// Reagendar o som já tocando (arrastar a barra, retomar depois de mexer em tom ou andamento), continuar e ir para um ponto.
// Separado de `reproducao.svelte.ts`.
import { configs, est, iniciarRelogio, motor, parar, pararRelogio, sint } from "./reproducaoEstado.svelte";
import { efetivo, mudou, type Agendado, type Config } from "./reproducaoPlano";

/**
 * Reagenda o hino que está tocando ou pausado a partir de uma posição, com os ajustes de AGORA (instrumento, andamento, tom).
 * A posição vai em batidas da escala em que o hino foi agendado (não em segundos), para valer mesmo que o andamento tenha
 * mudado na pausa. `pausado`: o relógio do áudio está suspenso, então agenda sem retomar. Devolve false se o áudio falhou
 * (nesse caso já parou tudo e `erro` diz por quê).
 */
export async function reagendar(batida: number, pausado: boolean): Promise<boolean> {
  const c = est.atual ? configs.get(est.atual.numero) : undefined;
  if (!est.atual || !c || !motor.agendado) return false;
  motor.trocando = true;
  const g = motor.geracao;
  try {
    return await reagendarSom(c, motor.agendado.vozes, { batida, pausado }, g);
  } catch (e) {
    return falhouAoReagendar(e, g);
  } finally {
    motor.trocando = false;
  }
}

/** O som reagendado de `batida`; se Parar foi tocado no meio, silencia o que acabou de ser agendado e sai sem erro (false). */
async function reagendarSom(c: Config, vozes: Agendado["vozes"], de: { batida: number; pausado: boolean }, g: number): Promise<boolean> {
  est.duracao = await sint.tocar(
    vozes,
    {
      andamento: c.andamento,
      transposicao: c.transposicao,
      instrumentos: [...c.instrumentos],
      volumes: vozes.map((_, i) => efetivo(c, i)),
    },
    { aPartirDe: de.batida, pausado: de.pausado },
  );
  if (g !== motor.geracao || !est.atual || !motor.agendado) {
    // Parar foi tocado enquanto o áudio reagendava: silencia o que acabou de ser agendado e sai sem erro.
    sint.parar();
    return false;
  }
  motor.agendado = { vozes: motor.agendado.vozes, andamento: c.andamento, transposicao: c.transposicao, instrumentos: [...c.instrumentos] };
  est.atual.andamento = c.andamento; // os marcos das partes estão em batidas; o andamento novo os converte
  est.decorrido = sint.decorrido();
  est.revisaoDoPonto++;
  return true;
}

function falhouAoReagendar(e: unknown, g: number): false {
  sint.parar();
  if (g !== motor.geracao) return false;
  parar();
  est.erro = String(e);
  return false;
}

export async function continuar() {
  if (est.estado !== "pausado" || motor.trocando) return;
  const g = motor.geracao;
  const c = est.atual ? configs.get(est.atual.numero) : undefined;
  if (est.atual && c && motor.agendado && mudou(c, motor.agendado)) {
    // Instrumento, andamento ou tom mudaram na pausa: reagenda de onde parou, com os ajustes novos.
    if (!(await reagendar((est.decorrido * motor.agendado.andamento) / 60, true))) return;
  }
  await sint.continuar();
  if (g !== motor.geracao) return;
  est.estado = "tocando";
  iniciarRelogio();
  // Uma busca pedida durante o reagendamento daqui não é descartada: entra pelo mesmo caminho do `irPara`.
  if (motor.buscaPendente !== null) {
    const s = motor.buscaPendente;
    motor.buscaPendente = null;
    await irPara(s);
  }
}

/** O ponto pedido na barra, preso ao hino (de 0 até um instante antes do fim). */
function alvoDaBusca(proximo: number): number {
  return Math.min(Math.max(0, Number.isFinite(proximo) ? proximo : 0), Math.max(0, est.duracao - 0.05));
}

const tocandoOuPausado = () => est.estado === "tocando" || est.estado === "pausado";

/**
 * Vai para um ponto do hino (em segundos da barra de progresso), tocando ou pausado, e continua no mesmo estado: tocando segue
 * tocando dali, pausado fica pausado ali. Fora do hino (de 0 até um instante antes do fim). Sem nada tocando, não faz nada.
 */
export async function irPara(segundos: number) {
  if (!est.atual || !motor.agendado || !tocandoOuPausado()) return;
  if (motor.trocando) {
    // Já há um reagendamento em curso (outra soltura, ou uma seta do teclado repetida): guarda só a última posição pedida e a
    // aplica ao terminar, em vez de descartar e deixar a barra voltar ao ponto antigo.
    motor.buscaPendente = segundos;
    return;
  }
  motor.buscaPendente = null;
  let proximo: number | null = segundos;
  while (proximo !== null && est.atual && motor.agendado && tocandoOuPausado()) {
    const alvo = alvoDaBusca(proximo);
    const tocandoAntes = est.estado === "tocando";
    const batida = (alvo * motor.agendado.andamento) / 60;
    pararRelogio();
    est.decorrido = alvo; // a barra já mostra o ponto escolhido enquanto o som é reagendado
    if (!(await reagendar(batida, !tocandoAntes))) return;
    if (tocandoAntes) iniciarRelogio();
    proximo = motor.buscaPendente;
    motor.buscaPendente = null;
  }
}
