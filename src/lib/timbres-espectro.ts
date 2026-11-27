// A matemática dos espectros de timbres.ts: interpolar âncoras medidas, misturar tabelas, aparar o que não se ouve e medir o volume
// eficaz. Funções puras, sem Web Audio e sem o catálogo de instrumentos.

export type Ancora = { midi: number; h: number[]; ataque: number; fc_inicio: number | null; abertura: number | null };

/** Abaixo da amplitude relativa 0,003 (-50 dB) o harmônico não se ouve: não entra na tabela. */
const PISO = 0.003;

export function mediana(v: number[]): number {
  const o = [...v].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Tira do fim os harmônicos abaixo do piso audível, deixando ao menos o índice 0 e o primeiro harmônico. */
function aparar(h: number[]): number[] {
  while (h.length > 2 && h[h.length - 1] < PISO) h.pop();
  return h;
}

/** A mistura ponderada de tabelas de harmônicos (índice 0 ignorado), já aparada. */
export function misturar(partes: { h: number[]; peso: number }[]): number[] {
  const n = Math.max(...partes.map((p) => p.h.length));
  const h = [0];
  for (let k = 1; k < n; k++) h.push(partes.reduce((s, p) => s + p.peso * (p.h[k] ?? 0), 0));
  return aparar(h);
}

/** As âncoras vizinhas da nota `midi` e o ponto entre elas (0 = a primeira, 1 = a segunda). Fora da faixa vale a âncora da ponta (t = 0). */
function vizinhas(a: Ancora[], midi: number): { lo: number[]; hi: number[]; t: number } {
  const i = a.findIndex((x) => x.midi >= midi);
  if (i < 0) return { lo: a[a.length - 1].h, hi: a[a.length - 1].h, t: 0 };
  if (i === 0) return { lo: a[0].h, hi: a[Math.min(1, a.length - 1)].h, t: 0 };
  const t = (midi - a[i - 1].midi) / (a[i].midi - a[i - 1].midi);
  return { lo: a[i - 1].h, hi: a[i].h, t };
}

/** Tabela de harmônicos (índice 0 ignorado) da nota `midi`, interpolada entre as duas âncoras vizinhas. */
export function interpolar(ancoras: Ancora[], midi: number): number[] {
  const { lo, hi, t } = vizinhas(ancoras, midi);
  const n = Math.max(lo.length, hi.length);
  const h = [0];
  for (let k = 0; k < n; k++) h.push((lo[k] ?? 0) * (1 - t) + (hi[k] ?? 0) * t);
  return aparar(h);
}

/** Quanto da onda (já normalizada para pico 1, como o Web Audio faz) é volume eficaz: serve para igualar o volume entre tabelas. */
export function eficazRelativo(harmonicos: number[]): number {
  const N = 512; // pontos por período: dá para até 255 harmônicos
  let soma = 0;
  let pico = 0;
  for (let n = 0; n < N; n++) {
    let x = 0;
    for (let k = 1; k < harmonicos.length && k < N / 2; k++) x += harmonicos[k] * Math.sin((2 * Math.PI * k * n) / N);
    soma += x * x;
    pico = Math.max(pico, Math.abs(x));
  }
  return pico > 0 ? Math.sqrt(soma / N) / pico : 0;
}
