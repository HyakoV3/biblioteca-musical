#!/usr/bin/env node
// Gera src/lib/icones.json: só os ícones que o app usa, em SVG, do conjunto "ic" (Google Material Icons, contorno,
// licença Apache-2.0), buscados na API pública do Iconify. Inspirado em admin-web/scripts/build-icons-subset.mjs do
// outro projeto do responsável (mesma ideia: buscar uma vez, gravar o JSON no repositório; em uso o app não precisa de rede).
//
// Uso (precisa de rede, só quando a lista abaixo mudar):
//   node tools/gerar-icones.mjs            # mostra o que faria
//   node tools/gerar-icones.mjs --escrever # grava src/lib/icones.json
//
// Para trocar de conjunto (ex.: "material-symbols-light"), mude CONJUNTO e os nomes em NOMES.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CONJUNTO = "ic";
const LICENCA = "Apache-2.0 (Google Material Icons, via Iconify)";
// nome usado no app -> nome do ícone no conjunto
const NOMES = {
  play: "outline-play-arrow",
  pause: "outline-pause",
  stop: "outline-stop",
  musica: "outline-music-note",
  bandeira: "outline-flag",
  som: "outline-volume-up",
  mudo: "outline-volume-off",
  voltar: "outline-arrow-back",
  ok: "outline-check",
  mais: "outline-add",
  menos: "outline-remove",
  abrir: "outline-expand-more",
  fechar: "outline-expand-less",
  menu: "outline-menu", // hambúrguer (três linhas)
  ajustes: "outline-settings", // engrenagem
  karaoke: "outline-mic-off", // microfone riscado: karaokê desligado (o estado não depende só da cor)
  karaoke_ligado: "baseline-mic", // microfone: karaokê ligado
  alinhar_esquerda: "outline-format-align-left",
  alinhar_direita: "outline-format-align-right",
  justificar: "outline-format-align-justify",
};
// Só tags de desenho: o corpo do SVG é inserido na página com {@html}, então nada além disso pode passar.
const TAGS_PERMITIDAS = new Set(["path", "g", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);

const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "icones.json");
const url = `https://api.iconify.design/${CONJUNTO}.json?icons=${Object.values(NOMES).join(",")}`;

const resposta = await fetch(url);
if (!resposta.ok) throw new Error(`Iconify respondeu ${resposta.status}`);
const dados = await resposta.json();
if (dados.not_found?.length) throw new Error(`não encontrados no conjunto: ${dados.not_found.join(", ")}`);
if (dados.aliases && Object.keys(dados.aliases).length) throw new Error("o conjunto devolveu aliases; trate antes de gravar");

const icones = {};
for (const [nome, nomeNoConjunto] of Object.entries(NOMES)) {
  const corpo = dados.icons?.[nomeNoConjunto]?.body;
  if (typeof corpo !== "string") throw new Error(`sem corpo para ${nomeNoConjunto}`);
  const tags = new Set([...corpo.matchAll(/<\s*([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]));
  const fora = [...tags].filter((t) => !TAGS_PERMITIDAS.has(t));
  if (fora.length || /\son\w+\s*=|javascript:/i.test(corpo)) throw new Error(`${nomeNoConjunto}: conteúdo não permitido (${fora.join(", ")})`);
  icones[nome] = corpo;
}

const saida = { conjunto: CONJUNTO, licenca: LICENCA, largura: dados.width ?? 24, altura: dados.height ?? 24, icones };
const texto = JSON.stringify(saida, null, 1) + "\n";
console.log(`${Object.keys(icones).length} ícones, ${texto.length} bytes (${CONJUNTO}, ${LICENCA})`);
if (process.argv.includes("--escrever")) {
  writeFileSync(destino, texto);
  console.log("gravado em", destino);
} else {
  console.log("(simulação: use --escrever para gravar)");
}
