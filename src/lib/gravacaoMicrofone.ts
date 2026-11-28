// O começo da gravação: pedir o microfone ao gravador e ligar os ouvintes (notificação, serviço, página escondida). Separado de `gravacaoEmCurso.svelte.ts`.
import type { FiltroDeRuido } from "./filtroDeRuido";
import { motivoDoErro, type Gravador } from "./gravador";
import type { Dependencias, ResultadoDeIniciar } from "./gravacaoEmCursoDeps";

/** Ouvintes que a gravação liga ao começar (botão da notificação, falha do serviço, página escondida); a classe só fornece o que eles consultam. */
export type DonoDosOuvintes = {
  gravando: boolean;
  protegida: boolean;
  parar: () => Promise<void>;
};

/** Liga os ouvintes da gravação em curso e devolve o que os desfaz, na mesma ordem de antes. */
export function ligarOuvintes(d: Dependencias, dono: DonoDosOuvintes): (() => void)[] {
  return [
    // O botão "Parar" da notificação do Android.
    d.servico.aoParar(() => {
      if (dono.gravando) void dono.parar();
    }),
    // O serviço do Android não subiu (a ponte avisa depois de já ter dito que sim): sem ele a gravação não está protegida. Com a página escondida o microfone já se foi, então para e guarda o que houver.
    d.servico.aoFalhar(() => {
      dono.protegida = false;
      if (dono.gravando && d.pagina.escondida()) void dono.parar();
    }),
    // App em segundo plano: para uma gravação EM CURSO e devolve o microfone, a menos que o Android a tenha assumido com o serviço (`protegida`).
    d.pagina.aoMudar(() => {
      if (d.pagina.escondida() && dono.gravando && !dono.protegida) void dono.parar();
    }),
  ];
}

/** Pede o microfone ao gravador. Devolve o filtro que falhou (se falhou) ou, se o pedido deu erro, o resultado de `iniciar` pronto. `aindaVale` diz se a pessoa não mandou parar nem saiu no meio. */
export async function pedirMicrofone(gravador: Gravador, filtro: FiltroDeRuido, aindaVale: () => boolean): Promise<{ filtroFalhou: FiltroDeRuido | null } | { erro: ResultadoDeIniciar }> {
  try {
    const aplicado = await gravador.iniciar({ filtro }); // `filtro` já é o valor fixado no toque: a pessoa pode mexer na escolha enquanto o microfone e o filtro carregam
    return { filtroFalhou: aplicado !== filtro && aindaVale() ? filtro : null }; // o filtro neural não carregou: a gravação segue sem filtro
  } catch (e) {
    console.warn("gravador: não foi possível gravar", e);
    return {
      erro: {
        cancelada: !aindaVale(),
        erro: aindaVale() ? motivoDoErro(e) : null,
        filtroFalhou: null,
      },
    };
  }
}
