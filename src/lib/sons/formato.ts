/** "29,4 MB" (ou "29.4 MB" em inglês), conforme o idioma da interface. */
export function formatarMB(bytes: number, idioma: string): string {
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 }).format(bytes / 1e6)} MB`;
}
