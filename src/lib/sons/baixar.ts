// Baixa o zip de um pacote pelo lado nativo do Tauri (plugin HTTP). O navegador interno não serve: o link público do File
// Browser não manda os cabeçalhos CORS. A permissão da rede está restrita, em src-tauri/capabilities/default.json, ao
// endereço do servidor dos sons.
import { fetch as fetchNativo } from "@tauri-apps/plugin-http";
import { ErroPacote, LIMITE_ZIP } from "./extrair";

/** Baixa o zip inteiro para a memória, avisando o progresso. `estimativa` (bytes) vale quando o servidor não diz o tamanho. */
export async function baixarZip(
  url: string,
  estimativa: number,
  aoProgredir?: (fracao: number) => void,
): Promise<Uint8Array> {
  let resposta: Response;
  try {
    resposta = await fetchNativo(url, { method: "GET" });
  } catch (e) {
    throw new ErroPacote("rede", String(e));
  }
  if (!resposta.ok) throw new ErroPacote("rede", `HTTP ${resposta.status}`);

  const declarado = Number(resposta.headers.get("content-length") ?? 0);
  if (declarado > LIMITE_ZIP) throw new ErroPacote("tamanho", `zip declara ${declarado} bytes`);
  const total = declarado > 0 ? declarado : estimativa;

  const leitor = resposta.body?.getReader();
  if (!leitor) {
    const tudo = new Uint8Array(await resposta.arrayBuffer());
    aoProgredir?.(1);
    return tudo;
  }
  const partes: Uint8Array[] = [];
  let feito = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
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
