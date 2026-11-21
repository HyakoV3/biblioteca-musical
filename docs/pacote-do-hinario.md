# Pacote do hinário (baixável)

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
# 1. o hinario.json pronto (fora do Git), com um NÚMERO NOVO no nome:
cp hinario.json ~/Development/auxiliar/pacotes/hinario-002.json
# 2. subir para a pasta PRÓPRIA do hinário no servidor:  /mnt/downloads/BibliotecaMusicalHinario/hinario-002.json
# 3. refazer o manifesto (o link público da pasta do hinário) e gerar um APK novo:
python3 tools/montar-manifesto-hinario.py "<link público>" ~/Development/auxiliar/pacotes/hinario-002.json
```

Regras: **não troque o conteúdo de um arquivo que já está publicado** (o manifesto dos APKs antigos recusaria o arquivo novo); suba com número novo e refaça o manifesto.

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

- `hinario-002.json` (o do manifesto): os 480 hinos (Dó), 4.119.977 bytes, SHA-256 `a68de375…`. Muda só o hino 76 (estrofe 3: "podebalar" → "pode abalar", com as marcas do karaokê ajustadas). Está em `/mnt/downloads/BibliotecaMusicalHinario/`.
- `hinario-001.json`: o anterior (4.119.975 bytes, SHA-256 `ee9b8cfb…`), que continua no servidor para os APKs até o 063, cujos manifestos apontam para ele. **Não apague.**
- **Para pegar um hinário novo no aparelho:** Ajustes → Conteúdo → Hinário completo → Remover e Baixar. O Remover do hinário **apaga também as partituras** (as gravações ficam): baixe as partituras de novo depois. O app não compara versões sozinho.
- Se o manifesto aponta para um arquivo ainda **não publicado** (pasta sem ele), o download falha com "arquivo incompleto ou diferente".
