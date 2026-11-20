# Pacote de partituras

As partituras são **opcionais**, como os sons gravados: o app baixa um pacote do servidor em **Ajustes → Partituras → Baixar** (decisão do
responsável, 2026-11-16: o botão "Importar hinário" vai deixar de existir e as partituras ganham um botão automático, no molde dos sons).
O pacote é um `.zip` só com `partituras/hino-<número>.svg` e, opcional, `partituras/hino-<número>-paisagem.svg` (formato e verificações em [`FORMATO.md`](FORMATO.md), seção "Importar").

> **Direitos.** As partituras são geradas das transcrições do Enéias (`eneiasramos/ccb-hinario-5-do`, "todos os direitos reservados", sem
> licença); a autorização dele **ainda não veio**. **Publicar o pacote num link público é distribuir esse trabalho**: o mecanismo está pronto,
> mas quem decide quando (e se) publicar é o responsável, depois da resposta dele. Enquanto não houver pacote publicado, o manifesto
> do app fica `"pacote": null` e o botão Baixar **não aparece**.

## Estado publicado (2026-11-16)

- **Pasta no servidor:** `/mnt/downloads/BibliotecaMusicalPartituras/`, **fora** da dos sons (`BibliotecaMusicalSons/`, renomeada pelo responsável depois do
  upgrade do File Browser para a 2.0.2; o link dos sons continuou valendo e conferido). Compartilhamento próprio (a pedido do responsável, que criou a pasta
  e o link). Tem **só um** zip:
  - `partituras-003.zip` (228.343 bytes, SHA-256 `f39cbe13…9087`): **sem letra, com duas versões de cada hino**: retrato (largura 700, ~1,6 compasso
    por linha) e paisagem (1200, ~3 compassos por linha), o do APK 023 em diante. É o que o manifesto do app aponta.

  Os anteriores foram **apagados em 2026-11-16, a pedido do responsável**, então os **APKs 020 a 022 não conseguem mais baixar partituras** (o
  link não traz mais o zip que eles procuram). O 001 tinha letra e largura 700; o 002, sem letra e largura 500, que deu 1 compasso por linha
  ("cortando", no relato do responsável), motivo do 003. Eram zips reproduzíveis: dá para regerar de `content/amostras` com `tools/gerar-partituras.py`
  (as larguras estão no cabeçalho dele) e `tools/montar-pacote.py`.
- **Link do app:** `https://fb.hm.hv2.xyz/public/api/resources/download?hash=<hash do compartilhamento>`, no manifesto do app. Conferido contra os bytes
  reais do servidor: o zip da pasta traz o `BibliotecaMusicalPartituras/partituras-003.zip`, e o app extrai esse zip e confere o tamanho e o SHA-256 do manifesto (verificado de novo depois de apagar o 001 e o 002).
- **O link está no manifesto, que está no repositório público:** quem lê o código pode baixar as 5 partituras de teste. É o mesmo que já acontece com
  o link dos sons, mas com um agravante: as partituras são das transcrições do Enéias, cuja autorização ainda não veio (ver "Direitos" acima). Antes
  de publicar o conjunto completo, esperar a resposta dele.

## Configuração do compartilhamento (File Browser)

O link precisa ser **anônimo, sem senha e sem validade** (o app não sabe pedir senha, e um link que expira quebraria o download) e **só de baixar**.
Restringir o resto, na tela do File Browser (editar o compartilhamento): desligar upload/criar, editar, apagar e substituir; desligar miniaturas,
visualização e o visualizador de arquivos; esconder a barra lateral, o cartão de compartilhamento e a opção de login. Conferido pela API pública
(2026-11-16): ambos os links já têm a barra lateral e o cartão de compartilhamento escondidos; faltava, nas partituras, esconder a opção de login e,
nos sons, desligar o visualizador. O `config.yaml` do contêiner já dá aos usuários novos **só** a permissão de baixar e não permite cadastro.

## Gerar e publicar

```sh
# 1. SVG de cada hino, SEM a letra, em DUAS versões: retrato (largura 700) e paisagem (1200), cada uma com o seu timemap
#    (precisa do MuseScore 4 e do pacote Python verovio; ver tools/gerar-partituras.py; --so-retrato pula a paisagem)
python3 tools/gerar-partituras.py <pasta dos hino-N.mscx> <pasta dos svg>

# 2. o zip (só partituras/hino-N.svg e hino-N-paisagem.svg, reproduzível; os timemap não entram)
python3 tools/montar-pacote.py <pasta dos svg> partituras-NNN.zip

# 3. no servidor de arquivos (o mesmo dos sons): uma pasta PRÓPRIA, fora de BibliotecaMusicalSons/, com o zip dentro, e o link público só dela;
#    depois o manifesto do app, com o nome, o tamanho e o SHA-256 do zip
python3 tools/montar-manifesto-partituras.py <link público da pasta> partituras-NNN.zip
```

**Conferir um pacote real antes de publicar (sem celular):** o teste `conteudo_real` do `src-tauri/src/pacote.rs` passa o hinário e o zip **reais** pelo mesmo leitor e pela mesma limpeza de SVG do app, e falha se alguma partitura for recusada ou não puder ser lida de volta (retrato e paisagem):

```sh
BMCCB_HINARIO=/caminho/hinario.json BMCCB_ZIP=/caminho/partituras-NNN.zip \
  cargo test --manifest-path src-tauri/Cargo.toml --lib conteudo_real -- --ignored --nocapture
```

**Pasta própria, fora de `BibliotecaMusicalSons/`:** o link público do File Browser baixa a **pasta inteira em zip** (não há download de arquivo
avulso por esse tipo de link). Se o zip das partituras ficasse dentro de `BibliotecaMusicalSons/` (a pasta dos sons), o download dos sons o traria
junto e o das partituras traria os 38 MB de sons. Numa pasta só dele, o servidor entrega uma pasta em zip com o `partituras-001.zip` dentro; o app
a abre, acha o zip **pelo nome**, e confere o **tamanho e o SHA-256 do zip de dentro** (o de fora não é reproduzível). Se o link for do próprio
arquivo, o app também aceita (usa o que veio, se bater).

O passo 3 escreve `src/lib/partituras/manifesto.json`; **o app só instala um arquivo com exatamente aquele tamanho e SHA-256**. Mudou o zip no
servidor, refaça o manifesto e gere um APK novo (a atualização automática, sem APK novo, é a ideia I-25 em
[`roadmap-ideas.md`](roadmap-ideas.md)). O endereço precisa estar no servidor que o app pode acessar: `src-tauri/capabilities/default.json`
(hoje só `https://fb.hm.hv2.xyz/*`).

## Como o app instala

1. Baixa o zip pelo lado nativo (plugin HTTP do Tauri), com progresso.
2. Confere o **tamanho** e o **SHA-256** contra o manifesto; se não bater, descarta (`erro de arquivo`) e nada vai ao Rust.
3. Entrega ao Rust como **base64** (no Android não há corpo binário), que confere nomes, limites e **cada SVG** (lista de permitidos), grava
   numa pasta de preparo e troca a pasta `partituras/` de uma vez; o hinário não é tocado.
4. As partituras recusadas na verificação do SVG aparecem no card (hinos e o primeiro motivo); o resto entra.

**Pré-requisito:** o hinário já instalado. Sem ele a instalação é recusada ("Importe o hinário antes de instalar as partituras"), porque os
números de hino aceitos vêm dele.

## Remover

**Ajustes → Partituras → Remover** apaga só as partituras; o hinário fica.
