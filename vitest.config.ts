import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

// Testes automatizados da lógica do app (módulos em src/lib, sem tela). Rodar: npm test
// O teste de ponta a ponta do karaokê, que usa um Chrome de verdade, fica à parte: npm run test:e2e
// O plugin do Svelte compila as runes ($state, $derived) dos módulos `.svelte.ts`: sem ele, o store de reprodução não carrega no Vitest.
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
