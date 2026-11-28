// Parte pura do gravador: escolha do formato e os textos de tempo, tamanho e erro. Testada no Vitest (via `gravador.ts`, que reexporta).

/** Formatos que se tenta, do preferido ao último recurso: Opus é compacto e o que o responsável pediu; MP4 e WebM são o que o navegador sabe gravar. */
export const FORMATOS_PREFERIDOS = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/mp4", "audio/webm"] as const;

/** O primeiro formato preferido que o navegador grava; nulo se nenhum (o `MediaRecorder` então escolhe o seu). `aceita` é o `MediaRecorder.isTypeSupported`. */
export function escolherFormato(aceita: (tipo: string) => boolean): string | null {
  for (const tipo of FORMATOS_PREFERIDOS) if (aceita(tipo)) return tipo;
  return null;
}

/** 0:07, 1:05, 12:30 (minutos sem zero à esquerda, segundos com dois dígitos). Valor inválido ou negativo vale 0:00. */
export function formatarTempo(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "340 B", "12,3 KB", "1,8 MB" (separador decimal do idioma). */
export function formatarTamanho(bytes: number, idioma: string): string {
  const n = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const num = (v: number) => new Intl.NumberFormat(idioma, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(v);
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1023.95) return `${num(n / 1024)} KB`; // abaixo disso arredondaria para "1.024,0 KB"
  return `${num(n / (1024 * 1024))} MB`;
}

/** Nome curto do tipo gravado, sem os parâmetros: "audio/webm;codecs=opus" vira "webm (opus)". */
export function nomeDoFormato(tipo: string): string {
  const [base, ...params] = tipo.split(";").map((p) => p.trim());
  const container = base.replace(/^audio\//, "") || "?";
  const codec = params.find((p) => p.startsWith("codecs="))?.slice(7).replace(/"/g, "");
  return codec ? `${container} (${codec})` : container;
}

/** Por que a gravação não começou: a pessoa negou a permissão, não há microfone, ou o aparelho/navegador não grava. */
export type MotivoDoErro = "negada" | "sem_microfone" | "indisponivel" | "falhou";

/** Traduz o erro do navegador no motivo que a tela explica. */
export function motivoDoErro(e: unknown): MotivoDoErro {
  const nome = e instanceof Error || (typeof e === "object" && e !== null && "name" in e) ? String((e as { name: unknown }).name) : "";
  if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") return "negada";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "sem_microfone";
  if (nome === "NotSupportedError" || nome === "TypeError") return "indisponivel";
  return "falhou";
}
