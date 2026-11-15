<script lang="ts">
  import Icone from "$lib/Icone.svelte";
  import type { Chave } from "$lib/i18n/pt";
  import { sons } from "$lib/sons/pacotes.svelte";
  import { formatarMB } from "$lib/sons/formato";
  import { bytesDoPacote } from "$lib/sons/tipos";
  import Aviso from "$lib/Aviso.svelte";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { IDIOMAS, i18n, type Idioma } from "$lib/i18n/index.svelte";
  import { usarVoltar } from "$lib/navegacao";
  import { reproducao } from "$lib/reproducao.svelte";
  import { ESTILOS, TEMAS, estilo, tema } from "$lib/tema.svelte";
  import { CREDITOS, textoDaLicenca } from "$lib/licencas";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  let resultado = $state<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  let confirmando = $state(false);
  // O texto do "Sobre o app" é longo: fica num card fechado, que a pessoa abre se quiser ler.
  let sobreAberto = $state(false);
  // Os créditos também ficam num card fechado: é informação de licença, que quase ninguém precisa ler no dia a dia.
  let creditosAberto = $state(false);

  // Código do erro do download -> texto traduzido.
  const erroDoSom = (codigo: string): Chave =>
    codigo === "rede" ? "sons.erro_rede"
    : codigo === "armazenamento" ? "sons.erro_armazenamento"
    : codigo === "outro" ? "sons.erro_outro"
    : "sons.erro_arquivo";

  async function importar(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    resultado = null;
    try {
      const p = await biblioteca.importar(await arquivo.text());
      reproducao.limpar(); // o conteúdo mudou: para o som e esquece os ajustes dos hinos antigos
      resultado = {
        tipo: "sucesso",
        texto: t("importar.ok", { total: i18n.tn("plural.hinos", p.hinario.hinos.length), nome: p.hinario.hinario.nome }),
      };
    } catch (err) {
      resultado = { tipo: "erro", texto: t("importar.erro", { erro: String(err) }) };
    }
  }

  async function remover() {
    confirmando = false;
    try {
      await biblioteca.remover();
      reproducao.limpar();
      resultado = { tipo: "sucesso", texto: t("remover.ok") };
    } catch (err) {
      resultado = { tipo: "erro", texto: t("remover.erro", { erro: String(err) }) };
    }
  }
</script>

<svelte:head><title>{t("ajustes.titulo")} · Biblioteca Musical CCB</title></svelte:head>

<Barra titulo={t("ajustes.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />

<main class="coluna conteudo">
  <section>
    <h2>{t("ajustes.aparencia")}</h2>
    <!-- Duas escolhas que se combinam: o modo (claro ou escuro) e o estilo de cor. O próprio rótulo visível dá o nome
         ao grupo (aria-labelledby), então texto visível e nome acessível são sempre o mesmo. -->
    <p class="rotulo-grupo" id="rotulo-modo">{t("ajustes.modo")}</p>
    <fieldset class="segmentos" aria-labelledby="rotulo-modo">
      {#each TEMAS as id}
        <label class:ativo={tema.atual === id}>
          <input type="radio" name="tema" value={id} checked={tema.atual === id} onchange={() => (tema.atual = id)} />
          <span class="opcao-tema">{#if tema.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`tema.${id}`)}</span>
        </label>
      {/each}
    </fieldset>
    <p class="rotulo-grupo" id="rotulo-estilo">{t("ajustes.estilo")}</p>
    <fieldset class="segmentos" aria-labelledby="rotulo-estilo">
      {#each ESTILOS as id}
        <label class:ativo={estilo.atual === id}>
          <input type="radio" name="estilo" value={id} checked={estilo.atual === id} onchange={() => (estilo.atual = id)} />
          <span class="opcao-tema">{#if estilo.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`estilo.${id}`)}</span>
        </label>
      {/each}
    </fieldset>
  </section>

  <section>
    <h2>{t("ajustes.idioma")}</h2>
    <select
      aria-label={t("ajustes.idioma")}
      value={i18n.idioma}
      onchange={(e) => (i18n.idioma = e.currentTarget.value as Idioma)}
    >
      <!-- Cada nome está na própria língua: o lang faz o leitor de tela pronunciar certo. -->
      {#each Object.entries(IDIOMAS) as [id, l]}<option value={id} lang={id}>{l.nome}</option>{/each}
    </select>
  </section>

  <section>
    <h2>{t("ajustes.biblioteca")}</h2>
    {#if biblioteca.pacote}
      <p class="meta">
        {#if biblioteca.pacote.exemplo}
          {t("biblioteca.aviso_exemplo")}
        {:else}
          {t("ajustes.fonte_atual", {
            nome: biblioteca.pacote.hinario.hinario.nome,
            total: i18n.tn("plural.hinos", biblioteca.pacote.hinario.hinos.length),
          })}
        {/if}
      </p>
    {/if}

    <div class="acoes">
      <label class="botao primario">
        {t("importar.botao")}
        <input type="file" accept=".json,application/json" onchange={importar} hidden />
      </label>
      {#if biblioteca.pacote && !biblioteca.pacote.exemplo}
        <button class="botao perigo" onclick={() => (confirmando = true)}>{t("importar.remover")}</button>
      {/if}
    </div>

    {#if confirmando}
      <div class="confirma" role="alertdialog" aria-labelledby="confirma-titulo" aria-describedby="confirma-texto">
        <h3 id="confirma-titulo">{t("ajustes.remover_titulo")}</h3>
        <p id="confirma-texto">{t("ajustes.remover_texto")}</p>
        <div class="acoes">
          <button class="botao" onclick={() => (confirmando = false)}>{t("ajustes.cancelar")}</button>
          <button class="botao perigo" onclick={remover}>{t("ajustes.confirmar_remocao")}</button>
        </div>
      </div>
    {/if}

    {#if resultado}<Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>{/if}
  </section>

  <section>
    <h2>{t("sons.titulo")}</h2>
    <p class="meta">{t("sons.explica")}</p>
    {#each sons.pacotes as p (p.id)}
      {@const and = sons.andamento(p.id)}
      {@const instalado = sons.pacoteInstalado(p)}
      {@const tamanho = formatarMB(bytesDoPacote(p), i18n.idioma)}
      <div class="pacote">
        <div class="pacote-info">
          <strong>{t(`sons.pacote_${p.id}` as Chave)}</strong>
          <span class="meta">{tamanho} · {instalado ? t("sons.instalado") : t("sons.nao_instalado")}</span>
        </div>
        {#if and.fase === "baixando"}
          <progress
            value={and.progresso}
            max="1"
            aria-label={t("sons.baixando", { n: Math.round(and.progresso * 100) })}
          ></progress>
          <span class="meta">{t("sons.baixando", { n: Math.round(and.progresso * 100) })}</span>
        {:else if and.fase === "conferindo"}
          <span class="meta" role="status">{t("sons.conferindo")}</span>
        {:else if instalado}
          <button class="botao" onclick={() => sons.remover(p.id)}>{t("sons.remover")}</button>
        {:else}
          <button class="botao primario" onclick={() => sons.baixar(p.id)}>{t("sons.baixar", { tamanho })}</button>
        {/if}
      </div>
      {#if and.fase === "erro"}
        <Aviso tipo="erro">{t(erroDoSom(and.erro))}</Aviso>
      {/if}
    {/each}
  </section>

  <!-- Aviso: o app não tem ligação com a CCB. Vem antes do "Sobre", em destaque. -->
  <section>
    <Aviso tipo="info"><strong>{t("sobre.aviso_titulo")}</strong><br />{t("sobre.aviso")}</Aviso>
  </section>

  <section>
    <details class="cartao" bind:open={sobreAberto}>
      <summary>
        <span>{t("ajustes.sobre")}</span>
        <Icone nome={sobreAberto ? "fechar" : "abrir"} tamanho={24} />
      </summary>
      <div class="corpo sobre">
        <p>{t("sobre.intro")}</p>

        <h3>{t("sobre.fazer_titulo")}</h3>
        <ul>
          <li>{t("sobre.fazer_1")}</li>
          <li>{t("sobre.fazer_2")}</li>
          <li>{t("sobre.fazer_3")}</li>
          <li>{t("sobre.fazer_4")}</li>
        </ul>

        <h3>{t("sobre.como_titulo")}</h3>
        <p>{t("sobre.como")}</p>

        <h3>{t("sobre.privacidade_titulo")}</h3>
        <p>{t("sobre.privacidade")}</p>

        <h3>{t("sobre.codigo_titulo")}</h3>
        <p>{t("sobre.codigo")}</p>
      </div>
    </details>
  </section>

  <section>
    <details class="cartao" bind:open={creditosAberto}>
      <summary>
        <span>{t("ajustes.creditos")}</span>
        <Icone nome={creditosAberto ? "fechar" : "abrir"} tamanho={24} />
      </summary>
      <div class="corpo sobre">
        <p>{t("creditos.intro")}</p>
        <ul class="creditos">
          {#each CREDITOS as c (c.id)}
            <li>
              <strong>{c.nome}</strong>
              <span class="meta">{t("creditos.por", { autor: c.autoria })}</span>
              <span>{t(`creditos.uso.${c.id}` as Chave)}</span>
              <span class="meta">{t("creditos.licenca", { licenca: c.licenca })}</span>
              {#if c.url}<span class="meta url">{c.url}</span>{/if}
              <details class="licenca">
                <summary>{t("creditos.ver")}</summary>
                {#each c.textos as tx}
                  <pre>{textoDaLicenca(tx)}</pre>
                {/each}
              </details>
            </li>
          {/each}
        </ul>
      </div>
    </details>
  </section>

  <!-- A versão fica sozinha no fim, centralizada, fora do card. -->
  <p class="meta versao">{t("ajustes.versao", { v: `${__APP_VERSAO__} (${__APP_COMMIT__})` })}</p>
</main>

<style>
  section { margin-bottom: 1.8rem; }
  .cartao { border: 1px solid var(--borda-controle); border-radius: 12px; background: var(--superficie); }
  summary {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; min-height: 48px;
    padding: 0 0.9rem; font-weight: 600; cursor: pointer; list-style: none;
  }
  summary::-webkit-details-marker { display: none; }
  .corpo { padding: 0.2rem 0.9rem 0.9rem; }
  .versao { margin: 0 0 1.5rem; text-align: center; }
  .pacote { display: grid; gap: 0.5rem; margin: 0.6rem 0; padding: 0.8rem 0.9rem; border: 1px solid var(--borda-controle); border-radius: 12px; background: var(--superficie); }
  .pacote-info { display: grid; gap: 0.15rem; }
  .pacote progress { width: 100%; height: 10px; accent-color: var(--acento); }
  .sobre p, .sobre li { line-height: 1.5; }
  .sobre h3 { margin: 1.1rem 0 0.3rem; font-size: 0.95rem; }
  .sobre ul { margin: 0; padding-left: 1.2rem; }
  .sobre ul.creditos { padding-left: 0; list-style: none; }
  .creditos li { display: grid; gap: 0.15rem; padding: 0.7rem 0; border-top: 1px solid var(--borda-controle); }
  .creditos li:first-child { border-top: 0; }
  .creditos .url { overflow-wrap: anywhere; }
  .licenca summary { min-height: 44px; padding: 0; font-weight: 500; color: var(--acento); }
  .licenca pre { margin: 0.4rem 0 0.8rem; font: 0.78rem/1.45 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  h2 { margin: 0 0 0.6rem; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--suave); }
  select {
    width: 100%; box-sizing: border-box; /* ocupa toda a largura, como as opções de aparência */
    min-height: 48px; font-size: 1rem; padding: 0 0.6rem; border-radius: 12px;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  /* Aparência: três opções lado a lado; a escolhida tem "✓", negrito e borda de acento (não só cor). */
  .rotulo-grupo { margin: 0.9rem 0 0.35rem; font-size: 0.9rem; color: var(--suave); }
  .rotulo-grupo:first-of-type { margin-top: 0.4rem; }
  .segmentos { display: flex; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .segmentos label { position: relative; flex: 1; }
  .segmentos input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .segmentos span {
    display: flex; align-items: center; justify-content: center; min-height: 48px; box-sizing: border-box;
    padding: 0 0.5rem; text-align: center; border-radius: 12px; font-size: 0.95rem;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .opcao-tema { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; }
  .segmentos .ativo span { border: 2px solid var(--acento); font-weight: 700; }
  .segmentos input:focus-visible + span { outline: 3px solid var(--foco); outline-offset: 2px; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.6rem 0; }
  .confirma { margin: 0.8rem 0; padding: 1rem; border: 1px solid var(--perigo); border-radius: 12px; background: var(--superficie); }
  .confirma h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
  .confirma p { margin: 0 0 0.6rem; line-height: 1.5; }
</style>
