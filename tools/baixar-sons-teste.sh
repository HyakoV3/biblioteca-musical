#!/bin/sh
# Baixa as amostras do protótipo de "sons gravados" (I-07) para sons-fonte/FluidR3_GM/ (fora do Git).
# Origem: repositório midi-js-soundfonts, de Benjamin Gleitzman (banco FluidR3_GM, licença MIT).
# Tamanho: cerca de 14 MB no total (três órgãos, flauta e clarinete, ~3 MB cada).
# Uso: sh tools/baixar-sons-teste.sh   (a partir da raiz do projeto)
set -eu
DESTINO="sons-fonte/FluidR3_GM"
BASE="https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM"
mkdir -p "$DESTINO"
for instrumento in church_organ reed_organ drawbar_organ flute clarinet; do
  echo "baixando $instrumento..."
  curl -fsSL --max-time 180 -o "$DESTINO/$instrumento-mp3.js" "$BASE/$instrumento-mp3.js"
done
ls -l "$DESTINO"
