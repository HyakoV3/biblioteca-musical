// O aviso do primeiro acesso: enquanto o app só tem o pacote de EXEMPLO (fictício), oferece baixar o hinário de verdade. A pessoa pode dispensar o aviso (o caminho
// continua em Ajustes → Conteúdo); a escolha é lembrada neste aparelho. Qualquer falha de armazenamento é ignorada (o aviso só volta a aparecer).
export const CHAVE_AVISO_HINARIO = "prefs.hinario_aviso";

export function avisoDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_AVISO_HINARIO) === "dispensado";
  } catch {
    return false;
  }
}

export function dispensarAviso(): void {
  try {
    localStorage.setItem(CHAVE_AVISO_HINARIO, "dispensado");
  } catch {
    /* sem armazenamento: o aviso volta na próxima abertura */
  }
}

/** O aviso aparece só com o conteúdo já carregado e sendo o de exemplo, havendo um hinário publicado para baixar e a pessoa não o tendo dispensado. */
export function deveAvisar(pacote: { exemplo: boolean } | null, disponivel: boolean, dispensado: boolean): boolean {
  return pacote !== null && pacote.exemplo && disponivel && !dispensado;
}
