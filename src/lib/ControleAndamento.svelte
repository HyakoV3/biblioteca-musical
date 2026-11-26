<script lang="ts">
  import Passo from "./Passo.svelte";
  import { i18n } from "#lib/i18n/index.svelte";
  import { ANDAMENTO_MAX, ANDAMENTO_MIN } from "./reproducao.svelte";

  // O controle do andamento (−5 −1 [valor] +1 +5), o mesmo na aba Ouvir e no botão do topo das abas Letra e Partitura. Mexe direto nos ajustes do hino
  // (`cfg`, que vivem no módulo de reprodução), então os dois lugares mostram sempre o mesmo valor.
  let { cfg, editavel, min = ANDAMENTO_MIN, max = ANDAMENTO_MAX, padrao }: { cfg: { andamento: number }; editavel: boolean; min?: number; max?: number; padrao?: number } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Andamento em dois passos: 1 bpm (ajuste fino) e 5 bpm (ajuste grosso).
  const PASSO_FINO = 1;
  const PASSO_GROSSO = 5;
  const mudar = (bpm: number) => (cfg.andamento = Math.min(max, Math.max(min, cfg.andamento + bpm)));
  // Dois cliques no valor voltam ao andamento normal do hino (só onde quem usa informa `padrao`; o metrônomo não tem um "normal").
  const restaurar = () => {
    if (editavel && padrao !== undefined) cfg.andamento = Math.min(max, Math.max(min, padrao));
  };
  const item = $derived(t("player.andamento_rotulo").toLowerCase());
</script>

<Passo
  rotulo={t("player.andamento_rotulo")}
  esquerda={[
    { texto: `−${PASSO_GROSSO}`, aria: t("player.diminuir_n", { item, n: PASSO_GROSSO }), desabilitado: !editavel || cfg.andamento <= min, aoClicar: () => mudar(-PASSO_GROSSO) },
    { icone: "menos", aria: t("player.diminuir_n", { item, n: PASSO_FINO }), desabilitado: !editavel || cfg.andamento <= min, aoClicar: () => mudar(-PASSO_FINO) },
  ]}
  direita={[
    { icone: "mais", aria: t("player.aumentar_n", { item, n: PASSO_FINO }), desabilitado: !editavel || cfg.andamento >= max, aoClicar: () => mudar(PASSO_FINO) },
    { texto: `+${PASSO_GROSSO}`, aria: t("player.aumentar_n", { item, n: PASSO_GROSSO }), desabilitado: !editavel || cfg.andamento >= max, aoClicar: () => mudar(PASSO_GROSSO) },
  ]}
  valor={t("player.bpm", { n: cfg.andamento })}
  dica={t("player.duplo_clique_restaurar")}
  aoRestaurar={editavel && padrao !== undefined ? restaurar : undefined}
/>
