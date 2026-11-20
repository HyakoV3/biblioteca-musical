// Créditos e licenças de terceiros mostrados em Ajustes ("Créditos e licenças"). A fonte de cada dado está em
// docs/licencas-de-terceiros.md. Nomes, autoria e textos de licença ficam no original; só a descrição do uso é traduzida
// (chave `licencas.uso.<id>`).
import { TEXTO_APACHE_2, TEXTO_GENERALUSER, TEXTO_MIT, TEXTO_OFL } from "./licencas-textos";

export type TipoTexto = "mit" | "apache2" | "generaluser" | "ofl" | "reservado";

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
    // As transcrições do Enéias, de onde saem as notas, as letras e as partituras dos hinos. O repositório não traz licença: o crédito reconhece a autoria e não diz que há autorização.
    id: "eneias",
    nome: "Hinário 5: transcrições em MuseScore",
    autoria: "Enéias Ramos",
    licenca: "Todos os direitos reservados",
    url: "https://github.com/eneiasramos",
    textos: [
      {
        tipo: "reservado",
        direitos: "Transcrições dos hinos do Hinário 5 em MuseScore, de Enéias Ramos, em github.com/eneiasramos (um repositório por tonalidade).\nTodos os direitos reservados ao autor; os repositórios não trazem licença.",
      },
    ],
  },
  {
    id: "generaluser",
    nome: "GeneralUser GS",
    autoria: "S. Christian Collins",
    licenca: "GeneralUser GS License v2.0",
    url: "https://github.com/mrbumpy409/GeneralUser-GS",
    textos: [{ tipo: "generaluser" }],
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
    nome: "Google Material Icons e Material Symbols",
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
    id: "leipzig",
    nome: "Leipzig",
    autoria: "Etienne Darbellay, Jean-François Marti, Laurent Pugin",
    licenca: "SIL Open Font License 1.1",
    url: "https://github.com/rism-digital/leipzig",
    textos: [
      {
        tipo: "ofl",
        direitos: "Copyright (c) 2014, Etienne Darbellay, Jean-Francois Marti and Laurent Pugin (info@rism.digital),\nwith Reserved Font Name \"Leipzig\".",
      },
    ],
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

/** O crédito não tem licença (só "direitos reservados")? Aí o rótulo e o botão não podem prometer um texto de licença: a tela usa `creditos.reservado` e `creditos.ver_direitos`. */
export function semLicenca(c: Credito): boolean {
  return c.textos.length > 0 && c.textos.every((x) => x.tipo === "reservado");
}

/** O texto de uma licença para um crédito (com a linha de direitos autorais, quando há). */
export function textoDaLicenca(t: Credito["textos"][number]): string {
  switch (t.tipo) {
    case "mit":
      return `MIT License\n\n${t.direitos ?? ""}\n\n${TEXTO_MIT}`;
    case "apache2":
      return TEXTO_APACHE_2;
    case "generaluser":
      return TEXTO_GENERALUSER;
    case "ofl":
      return `${t.direitos ?? ""}\n\n${TEXTO_OFL}`;
    case "reservado":
      return t.direitos ?? "";
  }
}
