/** Concatena os blocos de bytes, na ordem. */
export function juntar(blocos: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(blocos.reduce((soma, b) => soma + b.length, 0));
  let pos = 0;
  for (const b of blocos) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}
