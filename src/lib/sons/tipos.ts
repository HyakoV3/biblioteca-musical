// Tipos do manifesto dos pacotes de sons gravados. O manifesto (manifesto.json) é gerado por
// tools/montar-manifesto-sons.py e vai DENTRO do app: é ele que diz o que cada link deve conter, então o app
// recusa qualquer arquivo que não bata com o tamanho e o SHA-256 daqui (docs/pacote-de-sons.md).

export type ArquivoSom = {
  instrumento: string;
  /** Nome do arquivo (`<instrumento>-mp3.js`), também a chave dele no armazenamento. */
  arquivo: string;
  bytes: number;
  sha256: string;
};

export type PacoteSom = {
  /** "orgao", "madeiras", "metais", "cordas" ou "todos". */
  id: string;
  /** Endereço de download do zip (link público do File Browser). */
  url: string;
  arquivos: ArquivoSom[];
};

export type ManifestoSons = { versao: number; pacotes: PacoteSom[] };

/** Tamanho dos arquivos de um pacote, em bytes (o zip fica um pouco maior). */
export const bytesDoPacote = (p: PacoteSom): number => p.arquivos.reduce((s, a) => s + a.bytes, 0);
