// Créditos e licenças de terceiros mostrados em Ajustes ("Créditos e licenças"). A fonte de cada dado está em
// docs/licencas-de-terceiros.md. Nomes, autoria e textos de licença ficam no original; só a descrição do uso é traduzida
// (chave `licencas.uso.<id>`).
import { TEXTO_APACHE_2, TEXTO_GENERALUSER, TEXTO_MIT } from "./licencas-textos";

export type TipoTexto = "mit" | "apache2" | "ccby3" | "generaluser";

export type Credito = {
  id: string;
  nome: string;
  autoria: string;
  /** Rótulo curto da licença, como aparece na lista. */
  licenca: string;
  url?: string;
  /** As licenças que se aplicam, na ordem em que o texto é mostrado. */
  textos: { tipo: TipoTexto; direitos?: string }[];
};

export const CREDITOS: readonly Credito[] = [
  {
    id: "generaluser",
    nome: "GeneralUser GS",
    autoria: "S. Christian Collins",
    licenca: "GeneralUser GS License v2.0",
    url: "https://github.com/mrbumpy409/GeneralUser-GS",
    textos: [{ tipo: "generaluser" }],
  },
  {
    id: "fluidr3",
    nome: "FluidR3_GM",
    autoria: "Frank Wen",
    licenca: "MIT",
    textos: [{ tipo: "mit", direitos: "Copyright © 2000-2002, 2008 Frank Wen" }],
  },
  {
    id: "soundfonts",
    nome: "midi-js-soundfonts",
    autoria: "Benjamin Gleitzman",
    licenca: "MIT · CC BY 3.0",
    url: "https://github.com/gleitz/midi-js-soundfonts",
    textos: [{ tipo: "mit", direitos: "Copyright (C) 2012 Benjamin Gleitzman" }, { tipo: "ccby3" }],
  },
  {
    id: "smplr",
    nome: "smplr",
    autoria: "danigb",
    licenca: "MIT",
    url: "https://github.com/danigb/smplr",
    textos: [{ tipo: "mit", direitos: "Author: danigb (as declared in the npm package, which publishes no copyright line)" }],
  },
  {
    id: "icones",
    nome: "Google Material Icons",
    autoria: "Material Design Authors (Google)",
    licenca: "Apache 2.0",
    url: "https://github.com/google/material-design-icons",
    textos: [{ tipo: "apache2" }],
  },
  {
    id: "fflate",
    nome: "fflate",
    autoria: "Arjun Barrett",
    licenca: "MIT",
    url: "https://github.com/101arrowz/fflate",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2026 Arjun Barrett" }],
  },
  {
    id: "svelte",
    nome: "Svelte e SvelteKit",
    autoria: "Svelte Contributors",
    licenca: "MIT",
    url: "https://github.com/sveltejs/svelte",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2016-2025 Svelte Contributors (Svelte)\nCopyright (c) 2020 SvelteKit contributors (SvelteKit)" }],
  },
  {
    id: "tauri",
    nome: "Tauri",
    autoria: "Tauri Apps Contributors",
    licenca: "MIT ou Apache 2.0",
    url: "https://github.com/tauri-apps/tauri",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2017 - Present Tauri Apps Contributors" }],
  },
] as const;

/**
 * Atribuição da CC BY 3.0 para as amostras do FluidR3 em MP3 (o texto legal fica no link). Hoje elas só servem para MEDIR o
 * timbre dos instrumentos sintetizados (os sons gravados do pacote vêm do GeneralUser GS); a atribuição continua por honestidade.
 */
export const AVISO_CCBY3 =
  "Sound samples generated from FluidR3_GM by Benjamin Gleitzman (midi-js-soundfonts); the repository README labels them " +
  "Creative Commons Attribution 3.0 (https://creativecommons.org/licenses/by/3.0/us/). They are used by this app only to measure " +
  "the timbre of the synthesized instruments (spectrum, attack); no FluidR3 sample is played or distributed by the app.";

/** O texto de uma licença para um crédito (com a linha de direitos autorais, quando há). */
export function textoDaLicenca(t: Credito["textos"][number]): string {
  switch (t.tipo) {
    case "mit":
      return `MIT License\n\n${t.direitos ?? ""}\n\n${TEXTO_MIT}`;
    case "apache2":
      return TEXTO_APACHE_2;
    case "ccby3":
      return AVISO_CCBY3;
    case "generaluser":
      return TEXTO_GENERALUSER;
  }
}
