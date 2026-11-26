#!/usr/bin/env bash
# Confere as permissões de um APK contra a lista permitida. Uso: tools/conferir-permissoes-apk.sh arquivo.apk (precisa do `aapt` no PATH).
# Usado pelo release (release.yml) e pelas PRs que mexem no Android (android-pr.yml): a lista fica num lugar só.
set -euo pipefail
apk="${1:?uso: conferir-permissoes-apk.sh arquivo.apk}"
# Permissões: este app BAIXA os pacotes de conteúdo, então INTERNET é esperada. O que se confere é que não apareceu nenhuma
# permissão fora desta lista (um plugin novo pode trazer uma sem ninguém notar).
# `uses-permission-sdk-23` também conta, e `maxSdkVersion` vem depois do nome (o sed pega só o nome entre aspas)
permissoes=$(aapt dump permissions "$apk" | sed -n "s/^uses-permission[-a-z0-9]*: name='\([^']*\)'.*/\1/p")
[ -n "$permissoes" ] || { echo "::error::não consegui ler as permissões do APK"; exit 1; }
echo "$permissoes"
permitidas='android.permission.INTERNET android.permission.FOREGROUND_SERVICE android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK android.permission.FOREGROUND_SERVICE_MICROPHONE android.permission.POST_NOTIFICATIONS android.permission.WAKE_LOCK android.permission.RECORD_AUDIO android.permission.MODIFY_AUDIO_SETTINGS'
for p in $permissoes; do
  # a permissão própria que o AndroidX acrescenta a todo app (br.pro.bibliotecamusical.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION)
  case "$p" in *.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION) continue ;; esac
  case " $permitidas " in
    *" $p "*) ;;
    *) echo "::error::permissão inesperada no APK: $p"; exit 1 ;;
  esac
done
