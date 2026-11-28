// Baixa o zip de um pacote pelo lado nativo do Tauri (plugin HTTP). O navegador interno não serve: o link público do File
// Browser não manda os cabeçalhos CORS. A permissão da rede está restrita, em src-tauri/capabilities/default.json, ao
// endereço do servidor dos sons.
import { fetch as fetchNativo } from "@tauri-apps/plugin-http";
import { juntar } from "../bytes";
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
  const controle = criarControle(semDadosMs);
  try {
    return await baixarComControle(url, estimativa, aoProgredir, controle);
  } finally {
    controle.encerrar();
  }
}

/** Monta o aborto, a corrida contra o tempo estourado e o relógio de "nenhum dado" (já armado, esperando a primeira resposta). */
function criarControle(semDadosMs: number): Controle {
  const aborto = new AbortController();
  let relogio: ReturnType<typeof setTimeout> | undefined;
  let comResposta = false; // a mensagem diz se o servidor nunca respondeu ou se respondeu e parou de mandar dados
  // Rejeita quando o tempo estoura: serve de corrida contra `fetch` e `read`, que podem nunca responder.
  const estouro = new Promise<never>((_, rejeitar) => {
    aborto.signal.addEventListener("abort", () =>
      rejeitar(new ErroPacote("rede", comResposta ? `sem dados por ${semDadosMs / 1000} s` : `sem resposta do servidor em ${semDadosMs / 1000} s`)),
    );
  });
  estouro.catch(() => {}); // sem ninguém esperando, a rejeição não pode virar erro solto
  const armar = () => {
    clearTimeout(relogio);
    relogio = setTimeout(() => aborto.abort(), semDadosMs);
  };
  armar();
  return {
    signal: aborto.signal,
    estouro,
    armar,
    aoResponder: () => {
      comResposta = true;
    },
    encerrar: () => {
      clearTimeout(relogio);
      aborto.abort(); // solta a conexão em qualquer saída (erro de HTTP, tamanho recusado...); depois de um download completo não tem efeito
    },
  };
}

/** O que `baixarZip` entrega ao download: o sinal de aborto, a corrida contra o tempo estourado e os ganchos do relógio. */
interface Controle {
  signal: AbortSignal;
  estouro: Promise<never>;
  armar: () => void;
  aoResponder: () => void;
  encerrar: () => void;
}

async function baixarComControle(url: string, estimativa: number, aoProgredir: ((fracao: number) => void) | undefined, controle: Controle): Promise<Uint8Array> {
  const resposta = await abrirResposta(url, controle);
  controle.aoResponder();
  if (!resposta.ok) throw new ErroPacote("rede", `HTTP ${resposta.status}`);

  const declarado = Number(resposta.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_ZIP) throw new ErroPacote("tamanho", `zip declara ${declarado} bytes`);
  const total = declarado > 0 ? declarado : estimativa;

  const leitor = resposta.body?.getReader();
  if (!leitor) return lerDeUmaVez(resposta, controle, aoProgredir);
  return lerEmPedacos(leitor, controle, (feito) => aoProgredir?.(Math.min(1, feito / Math.max(total, 1))));
}

async function abrirResposta(url: string, { signal, estouro }: Controle): Promise<Response> {
  try {
    return await Promise.race([fetchNativo(url, { method: "GET", signal, connectTimeout: TEMPO_DE_CONEXAO_MS }), estouro]);
  } catch (e) {
    if (e instanceof ErroPacote) throw e;
    throw new ErroPacote("rede", String(e));
  }
}

async function lerDeUmaVez(resposta: Response, { armar, estouro }: Controle, aoProgredir?: (fracao: number) => void): Promise<Uint8Array> {
  armar(); // o relógio das respostas é o de "nenhum dado": recomeça aqui, em vez de contar a conexão junto
  const tudo = new Uint8Array(await Promise.race([resposta.arrayBuffer(), estouro]));
  if (tudo.length > LIMITE_ZIP) throw new ErroPacote("tamanho", `zip passou de ${LIMITE_ZIP} bytes`);
  aoProgredir?.(1);
  return tudo;
}

async function lerEmPedacos(leitor: ReadableStreamDefaultReader<Uint8Array>, controle: Controle, aoAvancar: (feito: number) => void): Promise<Uint8Array> {
  let partes: Uint8Array[];
  try {
    partes = await acumular(leitor, controle, aoAvancar);
  } catch (e) {
    leitor.cancel().catch(() => {}); // solta a conexão (no caso do tempo estourado, ela ainda está aberta)
    if (e instanceof ErroPacote) throw e;
    throw new ErroPacote("rede", String(e));
  }
  return juntar(partes);
}

/** Lê pedaço a pedaço até o fim, devolvendo os pedaços; passa do limite, cancela a leitura e recusa. */
async function acumular(leitor: ReadableStreamDefaultReader<Uint8Array>, controle: Controle, aoAvancar: (feito: number) => void): Promise<Uint8Array[]> {
  const partes: Uint8Array[] = [];
  let feito = 0;
  for (;;) {
    controle.armar(); // o relógio recomeça a cada pedaço: o que conta é ficar parado, não a duração total
    const { done, value } = await Promise.race([leitor.read(), controle.estouro]);
    if (done) return partes;
    partes.push(value);
    feito += value.length;
    if (feito > LIMITE_ZIP) {
      await leitor.cancel();
      throw new ErroPacote("tamanho", `zip passou de ${LIMITE_ZIP} bytes`);
    }
    aoAvancar(feito);
  }
}
