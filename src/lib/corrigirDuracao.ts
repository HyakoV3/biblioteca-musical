// Correção da duração do áudio gravado ao vivo (reexportada por `gravador.ts`).

/** Pula o player para um ponto absurdo e o devolve ao começo no primeiro `timeupdate`. */
function voltarAoComeco(audio: HTMLAudioElement): void {
  const volta = () => {
    audio.removeEventListener("timeupdate", volta);
    audio.currentTime = 0;
  };
  audio.addEventListener("timeupdate", volta);
  audio.currentTime = 1e101;
}

/**
 * O WebM gravado ao vivo não traz a duração: o player acha que é infinita e a barra de progresso fica errada. O remédio conhecido do Chromium é
 * pular para um ponto absurdo, o que o obriga a ler o arquivo e descobrir o fim, e voltar ao começo. Devolve a função que desfaz o ouvinte.
 */
export function corrigirDuracao(audio: HTMLAudioElement): () => void {
  const aoCarregar = () => {
    if (audio.duration === Infinity) voltarAoComeco(audio);
  };
  audio.addEventListener("loadedmetadata", aoCarregar);
  return () => audio.removeEventListener("loadedmetadata", aoCarregar);
}
