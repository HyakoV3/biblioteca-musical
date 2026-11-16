// Tipos do manifesto do pacote de partituras (I-08). O manifesto (manifesto.json) é gerado por tools/montar-manifesto-partituras.py e vai
// DENTRO do app: é ele que diz o que o endereço deve entregar, então o app recusa um arquivo que não bata com o tamanho e o SHA-256
// daqui (docs/pacote-de-partituras.md). Enquanto `pacote` é null, não há pacote publicado e o botão Baixar não aparece.

export type PacotePartituras = {
  /** Endereço de download do zip (link público do File Browser). */
  url: string;
  /** Tamanho exato do zip, em bytes. */
  bytes: number;
  sha256: string;
};

export type ManifestoPartituras = { versao: number; pacote: PacotePartituras | null };
