// Quem está INSTALANDO conteúdo (hinário baixado, partituras baixadas) neste momento. Os dois escrevem no mesmo conteúdo do Rust: um não pode começar enquanto o outro
// termina (o hinário baixado sobrescreveria uma importação feita no meio, e as partituras instaladas contra o pacote de exemplo seriam recusadas). Ajustes também usa
// isto para desabilitar o "Importar" de arquivo durante o download.
let em_curso = $state(0);

export const instalando = {
  get ocupado() {
    return em_curso > 0;
  },
  ocupar() {
    em_curso += 1;
  },
  liberar() {
    em_curso = Math.max(0, em_curso - 1);
  },
};
