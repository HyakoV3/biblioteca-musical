import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
// @ts-expect-error type error without @types/node package
import process from "node:process";
// @ts-expect-error type error without @types/node package
import { execSync } from "node:child_process";
// @ts-expect-error type error without @types/node package
import { readFileSync } from "node:fs";
const host = process.env.TAURI_DEV_HOST;

// Versão (de package.json) e commit do build, para a tela Ajustes mostrar qual build está instalado. O "+" no fim do
// commit avisa que havia alterações não commitadas. Fora de um repositório git, o commit vira "sem-git".
const versao = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")).version;
function commit() {
  try {
    const id = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const sujo = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() !== "";
    return id + (sujo ? "+" : "");
  } catch {
    return "sem-git";
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  // A partir do SvelteKit 3 a configuração mora aqui (o svelte.config.js deixou de ser lido)
  plugins: [await sveltekit({ preprocess: vitePreprocess(), adapter: adapter({ fallback: "index.html" }) })],
  define: { __APP_VERSAO__: JSON.stringify(versao), __APP_COMMIT__: JSON.stringify(commit()) },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      // 4. e `.claude/`: os worktrees do Claude Code ficam DENTRO da pasta do projeto, e cada `npm run check`/`build` deles (que mexe em
      //    `.svelte-kit/tsconfig.json` e `build/`) fazia o `tauri dev` da pasta principal recarregar o app ("forcing full-reload").
      ignored: ["**/src-tauri/**", "**/.claude/**"],
    },
  },
}));
