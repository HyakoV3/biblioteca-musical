# Pacote do hinário (baixável)

> **Hospedagem (2026-11-24):** o hinário (e as partituras) passaram para o repositório público **separado** `HyakoV3/biblioteca-musical-pacotes` (Release `hinario-<sha8>`, arquivo `.json` direto), para que uma eventual reclamação sobre o conteúdo não alcance o repositório do app. O manifesto do app aponta para esse asset; o link do servidor, abaixo, vale só para APKs antigos (o app novo **não aceita mais** o endereço do servidor: `capabilities/default.json` só permite o GitHub). Para trocar: gerar o `hinario-<sha8>.json`, criar o Release no repositório de pacotes e refazer o manifesto com `python3 tools/montar-manifesto-hinario.py <url do asset> <arquivo>`.

> **Autorização:** o Enéias Ramos autorizou a distribuição (registrada em 2026-11-26 em [`licencas-de-terceiros.md`](licencas-de-terceiros.md), a única fonte). Os direitos das letras e músicas seguem sem registro.

O **texto e a música dos hinos não vão dentro do app nem do Git**: são conteúdo de terceiros (ver `docs/licencas-de-terceiros.md`). O app baixa o hinário **uma vez**, pelo
mesmo caminho conferido das partituras, e o guarda no aparelho. Sem ele, o app mostra só o pacote de exemplo fictício e, no primeiro acesso, um aviso oferece o download
(o botão segue em **Ajustes → Conteúdo → Hinário completo**, com Baixar e Remover, no desenho dos outros pacotes).

## Como funciona

1. `src/lib/hinario/manifesto.json` (dentro do app) diz **o que o endereço deve entregar**: nome do arquivo, tamanho e SHA-256.
2. O botão Baixar pede o arquivo pelo lado nativo (plugin HTTP, só o endereço permitido em `src-tauri/capabilities/default.json`). O link pode ser o **do arquivo** ou o **da pasta**
   compartilhada (o File Browser entrega a pasta em zip; o app acha o arquivo pelo nome).
3. O app só segue se o arquivo tiver **exatamente** o tamanho e o SHA-256 do manifesto (`ErroPacote("integridade")` senão) e for UTF-8 válido. Só então entrega o texto ao Rust
   (`importar_hinario`), que valida o `hinario.json` (`docs/FORMATO.md`) e o instala. As partituras já instaladas só ficam se forem do mesmo hinário (`id`).
4. Sem manifesto (`"pacote": null`), o botão Baixar e o aviso do primeiro acesso não aparecem.

## Publicar um hinário novo

```sh
# 1. o hinario.json pronto (fora do Git); o NOME leva os 8 primeiros caracteres do SHA-256 do conteúdo (hinario-<sha8>.json):
N=hinario-$(sha256sum hinario.json | cut -c1-8).json
cp hinario.json ~/Development/auxiliar/pacotes/$N
# 2. subir para a pasta PRÓPRIA do hinário no servidor:  /mnt/downloads/BibliotecaMusicalHinario/$N
# 3. refazer o manifesto (o link público da pasta do hinário) e gerar um APK novo:
python3 tools/montar-manifesto-hinario.py "<link público>" ~/Development/auxiliar/pacotes/$N
```

Regras: **não troque o conteúdo de um arquivo que já está publicado** (o manifesto dos APKs antigos recusaria o arquivo novo); suba com nome novo (o SHA-256 no nome já garante que muda com o conteúdo) e refaça o manifesto.

**Nome do pacote = SHA-256 do conteúdo (a partir de 2026-11-22).** Antes era um número em sequência (`hinario-001.json` a `-003.json`); agora o nome leva os 8 primeiros caracteres do SHA-256 do arquivo, que identificam o conteúdo sem depender de contador e batem com o `sha256` do manifesto. Os numerados continuam no servidor para os APKs antigos.

## O que isto NÃO é

Separar o hinário do app o tira do APK e do Git, mas **não é controle de acesso**: o endereço está no manifesto, dentro do repositório público. Quem lê o código acha o link. Quem controla
a distribuição é quem administra o servidor (apagar o arquivo ou trocar o link faz o download parar). Para restringir quem recebe, o desenho alternativo é a pessoa informar um código de
acesso no primeiro uso, em vez de o endereço ir no manifesto (não implementado).

## Onde fica no servidor

Uma pasta **só do hinário**, com link público próprio (File Browser: pasta `BibliotecaMusicalHinario`, link público sem senha e sem prazo, como o das partituras):

| | |
|---|---|
| Pasta no servidor | `/mnt/downloads/BibliotecaMusicalHinario/` |
| Link do manifesto | `https://fb.hm.hv2.xyz/public/api/resources/download?hash=EMnR--vnLpImy8tW7COc2A` (a página de compartilhamento é `/public/share/EMnR--vnLpImy8tW7COc2A`) |

Por que **não** na pasta das partituras: o link de uma pasta entrega a pasta inteira em zip, e o app tiraria o arquivo pelo nome; com as partituras na mesma pasta o download do hinário (4 MB) puxaria uns
60 MB. E um link separado permite **desligar só o hinário** (apagar o arquivo ou o compartilhamento) sem derrubar as partituras.

## Estado

- `hinario-eca41c3f.json` (o do manifesto; é a cópia do antigo `hinario-003.json`, mesmos bytes): os 480 hinos (Dó), 4.119.994 bytes, SHA-256 `eca41c3f…`. É o lote 2 do português: 34 palavras que a partitura escrevia picadas ou coladas ("Con solador" → "Consolador", "osfiéis" → "os fiéis"), 17 letras faltando ou trocadas ("desos" → "dos", "Brevemenem" → "Brevemente em") e 14 trechos sem sentido que o responsável leu no hinário de papel ("sananção" → "santa unção", "Quanê e-levaó" → "Quanto é elevado, ó"). Nos hinos 148 e 372 duas linhas quebradas no meio da palavra viraram uma só. As marcas do karaokê seguem as sílabas (os tempos não mudam). Está em `/mnt/downloads/BibliotecaMusicalHinario/`.
- `hinario-002.json`: o anterior (4.119.977 bytes, SHA-256 `a68de375…`; só o hino 76 "pode abalar"), que **saiu da pasta compartilhada** em 2026-11-22 e está em `/mnt/downloads/BibliotecaMusicalHinario-archive/` (os APKs 064 a 075 não baixam mais o hinário). **Não apague.**
- `hinario-001.json`: o anterior (4.119.975 bytes, SHA-256 `ee9b8cfb…`), que também está em `BibliotecaMusicalHinario-archive/` (os APKs até o 063 não baixam mais). **Não apague.**
- **Para pegar um hinário novo no aparelho:** Ajustes → Conteúdo → Hinário completo → Remover e Baixar. O Remover do hinário **apaga também as partituras** (as gravações ficam): baixe as partituras de novo depois. O app não compara versões sozinho.
- Se o manifesto aponta para um arquivo ainda **não publicado** (pasta sem ele), o download falha com "arquivo incompleto ou diferente".
