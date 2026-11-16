// Tipos do manifesto do pacote de partituras (I-08). O manifesto (manifesto.json) é gerado por tools/montar-manifesto-partituras.py e vai
// DENTRO do app: é ele que diz o que o endereço deve entregar, então o app recusa um arquivo que não bata com o tamanho e o SHA-256
// daqui (docs/pacote-de-partituras.md). Enquanto `pacote` é null, não há pacote publicado e o botão Baixar não aparece.

export type PacotePartituras = {
  /** Endereço de download (link público do File Browser). Para uma PASTA compartilhada, o servidor devolve a pasta inteira em zip, com o
   *  zip das partituras dentro; se o link for do próprio arquivo, devolve o zip das partituras direto. O app aceita os dois. */
  url: string;
  /** Nome do zip das partituras (o que `tools/montar-pacote.py` gera), por exemplo "partituras-001.zip". */
  arquivo: string;
  /** Tamanho exato desse zip, em bytes. */
  bytes: number;
  /** SHA-256 desse zip. */
  sha256: string;
};

export type ManifestoPartituras = { versao: number; pacote: PacotePartituras | null };
