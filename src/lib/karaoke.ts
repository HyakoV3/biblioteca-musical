// Karaokê da letra: qual trecho (sílaba) está sendo cantado agora. Funções puras, sem tela e sem relógio.
//
// O conversor grava, por estrofe e por linha, o início de cada trecho em batidas e a posição dele no texto da linha
// (`[inicio, de, ate]`, em unidades UTF-16, como o JavaScript indexa o texto). Há uma sincronia para a passada normal
// e, nos hinos com final, outra para a passada do final (os tempos já estão na régua das notas daquela passada).
import { estrofes } from "./letra";

/** `[inicio_em_batidas, de, ate]`: o trecho `de..ate` da linha começa a ser cantado em `inicio`. */
export type Trecho = [number, number, number];
export type EstrofeSinc = { estrofe: number; linhas: Trecho[][] };
export type Sincronia = { normal: EstrofeSinc[]; final?: EstrofeSinc[] | null };

/** Um trecho com o lugar dele na letra, pronto para procurar por tempo. */
export type Marca = { t: number; estrofe: number; linha: number; de: number; ate: number };

const EPS = 1e-6;

function confere(letra: ReturnType<typeof estrofes>, lista: EstrofeSinc[]): boolean {
  for (const e of lista) {
    const alvo = letra.find((x) => x.numero === e.estrofe);
    if (!alvo || e.linhas.length > alvo.linhas.length) return false;
    for (let i = 0; i < e.linhas.length; i++) {
      const tamanho = alvo.linhas[i].length;
      for (const [t, de, ate] of e.linhas[i]) {
        if (!Number.isFinite(t) || t < 0 || !Number.isInteger(de) || !Number.isInteger(ate)) return false;
        if (de < 0 || de >= ate || ate > tamanho) return false;
      }
    }
  }
  return true;
}

/**
 * A sincronia combina com a letra do hino? Se a letra foi editada depois da conversão (ou algo não bate), as posições
 * apontariam para o lugar errado: nesse caso o karaokê fica desligado para o hino, e a letra aparece normalmente.
 */
export function sincroniaCombina(letra: string[], s: Sincronia | null | undefined): boolean {
  if (!s || s.normal.length === 0) return false;
  const ests = estrofes(letra);
  return confere(ests, s.normal) && (!s.final || confere(ests, s.final));
}

/**
 * As marcas que valem numa vez: as da estrofe dela e as de outras estrofes só DEPOIS da última da estrofe da vez
 * (o trecho final de um hino com final costuma ter a letra escrita sob uma estrofe só, e ela tem de acender também
 * na vez das outras). No meio da música, outras estrofes não interferem: a estrofe da vez manda. Em ordem de tempo.
 */
export function marcasDaVez(estrofesSinc: EstrofeSinc[], estrofeDaVez: number): Marca[] {
  const todas: Marca[] = [];
  for (const e of estrofesSinc) {
    e.linhas.forEach((linha, i) => {
      for (const [t, de, ate] of linha) todas.push({ t, estrofe: e.estrofe, linha: i, de, ate });
    });
  }
  const ultimaDaVez = Math.max(-Infinity, ...todas.filter((m) => m.estrofe === estrofeDaVez).map((m) => m.t));
  return todas
    .filter((m) => m.estrofe === estrofeDaVez || m.t > ultimaDaVez + EPS)
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.t - b.m.t || a.i - b.i)
    .map(({ m }) => m);
}

/**
 * O trecho que está sendo cantado no instante `batida` (em batidas, contado desde o começo da vez): o último que já
 * começou. Antes do primeiro, ou sem marcas, devolve `null`. Depois do último, o último segue aceso até a vez acabar.
 * `marcas` vem de `marcasDaVez` (em ordem de tempo).
 */
export function marcaEm(marcas: Marca[], batida: number): Marca | null {
  if (!Number.isFinite(batida) || marcas.length === 0 || batida < marcas[0].t - EPS) return null;
  let lo = 0;
  let hi = marcas.length - 1;
  while (lo < hi) {
    const meio = (lo + hi + 1) >> 1;
    if (marcas[meio].t <= batida + EPS) lo = meio;
    else hi = meio - 1;
  }
  // Marcas no mesmo instante (só acontece com estrofes diferentes no trecho final): vale a primeira do empate.
  while (lo > 0 && Math.abs(marcas[lo - 1].t - marcas[lo].t) < EPS) lo--;
  return marcas[lo];
}
