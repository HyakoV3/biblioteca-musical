// Baixa o zip de um pacote pelo lado nativo do Tauri (plugin HTTP). O navegador interno não serve: o link público do File
// Browser não manda os cabeçalhos CORS. A permissão da rede está restrita, em src-tauri/capabilities/default.json, ao
// endereço do servidor dos sons.
import { fetch as fetchNativo } from "@tauri-apps/plugin-http";
import { ErroPacote, LIMITE_ZIP } from "./extrair";

/** Quanto tempo a conexão pode demorar a abrir, e quanto a rede pode ficar sem entregar nenhum pedaço antes de o download ser abortado. */
export const TEMPO_DE_CONEXAO_MS = 15_000;
export const TEMPO_SEM_DADOS_MS = 30_000;

/**
 * Baixa o zip inteiro para a memória, avisando o progresso. `estimativa` (bytes) vale quando o servidor não diz o tamanho.
 * Se a conexão não abre ou nenhum pedaço chega por `semDadosMs`, aborta e falha com `ErroPacote("rede")` (sem isso, uma rede
 * que trava deixaria a tela em "baixando" para sempre).
 */
export async function baixarZip(
  url: string,
  estimativa: number,
  aoProgredir?: (fracao: number) => void,
  semDadosMs: number = TEMPO_SEM_DADOS_MS,
): Promise<Uint8Array> {
  const controle = new AbortController();
  let relogio: ReturnType<typeof setTimeout> | undefined;
  // Rejeita quando o tempo estoura: serve de corrida contra `fetch` e `read`, que podem nunca responder.
  const estouro = new Promise<never>((_, rejeitar) => {
    controle.signal.addEventListener("abort", () => rejeitar(new ErroPacote("rede", `sem dados por ${semDadosMs / 1000} s`)));
  });
  estouro.catch(() => {}); // sem ninguém esperando, a rejeição não pode virar erro solto
  const armar = () => {
    clearTimeout(relogio);
    relogio = setTimeout(() => controle.abort(), semDadosMs);
  };
  armar();
  try {
    return await baixarComControle(url, estimativa, aoProgredir, controle.signal, estouro, armar);
  } finally {
    clearTimeout(relogio);
  }
}

async function baixarComControle(
  url: string,
  estimativa: number,
  aoProgredir: ((fracao: number) => void) | undefined,
  signal: AbortSignal,
  estouro: Promise<never>,
  armar: () => void,
): Promise<Uint8Array> {
  let resposta: Response;
  try {
    resposta = await Promise.race([fetchNativo(url, { method: "GET", signal, connectTimeout: TEMPO_DE_CONEXAO_MS }), estouro]);
  } catch (e) {
    if (e instanceof ErroPacote) throw e;
    throw new ErroPacote("rede", String(e));
  }
  if (!resposta.ok) throw new ErroPacote("rede", `HTTP ${resposta.status}`);

  const declarado = Number(resposta.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_ZIP) throw new ErroPacote("tamanho", `zip declara ${declarado} bytes`);
  const total = declarado > 0 ? declarado : estimativa;

  const leitor = resposta.body?.getReader();
  if (!leitor) {
    const tudo = new Uint8Array(await Promise.race([resposta.arrayBuffer(), estouro]));
    aoProgredir?.(1);
    return tudo;
  }
  const partes: Uint8Array[] = [];
  let feito = 0;
  try {
    for (;;) {
      armar(); // o relógio recomeça a cada pedaço: o que conta é ficar parado, não a duração total
      const { done, value } = await Promise.race([leitor.read(), estouro]);
      if (done) break;
      partes.push(value);
      feito += value.length;
      if (feito > LIMITE_ZIP) {
        await leitor.cancel();
        throw new ErroPacote("tamanho", `zip passou de ${LIMITE_ZIP} bytes`);
      }
      aoProgredir?.(Math.min(1, feito / Math.max(total, 1)));
    }
  } catch (e) {
    leitor.cancel().catch(() => {}); // solta a conexão (no caso do tempo estourado, ela ainda está aberta)
    if (e instanceof ErroPacote) throw e;
    throw new ErroPacote("rede", String(e));
  }
  const saida = new Uint8Array(feito);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}
