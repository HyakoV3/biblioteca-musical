#!/usr/bin/env bash
# A catraca do Tezcat no perfil strict: falha só em violação NOVA ou PIORADA em relação a tezcat-baseline.json (a dívida conhecida, congelada).
# Roda no computador do responsável, onde o `tzt` está instalado (pipx install git+https://github.com/HyakoV3/tezcat.git); o repositório do Tezcat é
# privado, então isto não roda no CI.
#   tools/tezcat.sh                 confere: sai com erro se algo piorou
#   tools/tezcat.sh --tudo          mostra também a dívida conhecida (ignora o baseline)
#   tools/tezcat.sh --baseline      regrava o baseline, DEPOIS de pagar dívida: o arquivo só pode encolher (revise o diff)
set -euo pipefail
cd "$(dirname "$0")/.."
command -v tzt >/dev/null || { echo "tzt não encontrado: pipx install git+https://github.com/HyakoV3/tezcat.git" >&2; exit 2; }
case "${1:-}" in
  --tudo) exec tzt . --profile strict --no-baseline --summary ;;
  --baseline) exec tzt . --profile strict --baseline-write ;;
  "") exec tzt . --profile strict --fail-on fail --summary ;;
  *) echo "uso: tools/tezcat.sh [--tudo | --baseline]" >&2; exit 2 ;;
esac
