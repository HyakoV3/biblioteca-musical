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
  /** Tamanho do zip a baixar, em bytes (gerado por tools/montar-manifesto-sons.py quando recebe o zip). Sem ele, vale a soma dos arquivos. */
  bytesZip?: number;
  arquivos: ArquivoSom[];
};

export type ManifestoSons = { versao: number; pacotes: PacoteSom[] };

/** Quanto se baixa de um pacote: o tamanho do zip, ou (se o manifesto não o traz) a soma dos arquivos, que é só uma estimativa. */
export const bytesParaBaixar = (p: PacoteSom): number => p.bytesZip && p.bytesZip > 0 ? p.bytesZip : bytesDoPacote(p);
/** Tamanho dos arquivos de um pacote DESCOMPACTADOS, em bytes (o que ocupam no aparelho). */
export const bytesDoPacote = (p: PacoteSom): number => p.arquivos.reduce((s, a) => s + a.bytes, 0);
