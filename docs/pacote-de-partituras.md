# Pacote de partituras

As partituras são **opcionais**, como os sons gravados: o app baixa um pacote do servidor em **Ajustes → Partituras → Baixar** (decisão do
responsável, 2026-11-16: o botão "Importar hinário" vai deixar de existir e as partituras ganham um botão automático, no molde dos sons).
O pacote é um `.zip` só com `partituras/hino-<número>.svg` (formato e verificações em [`FORMATO.md`](FORMATO.md), seção "Importar").

> **Direitos.** As partituras são geradas das transcrições do Enéias (`eneiasramos/ccb-hinario-5-do`, "todos os direitos reservados", sem
> licença); a autorização dele **ainda não veio**. **Publicar o pacote num link público é distribuir esse trabalho**: o mecanismo está pronto,
> mas quem decide quando (e se) publicar é o responsável, depois da resposta dele. Enquanto não houver pacote publicado, o manifesto
> do app fica `"pacote": null` e o botão Baixar **não aparece**.

## Estado publicado (2026-11-16)

- **Pasta no servidor:** `/mnt/downloads/BibliotecaMusicalPartituras/`, **fora** da dos sons (`BibliotecaMusicalSons/`, renomeada pelo responsável depois do
  upgrade do File Browser para a 2.0.2; o link dos sons continuou valendo e conferido). Compartilhamento próprio (a pedido do responsável, que criou a pasta
  e o link). Tem **dois** zips:
  - `partituras-001.zip` (155.108 bytes, SHA-256 `35acf55f…f0ac`): a primeira versão, com a letra e largura 700. **Fica** porque os APKs 020 e 021
    procuram por ele.
  - `partituras-002.zip` (125.130 bytes, SHA-256 `253500de…bd0f`): **sem letra, largura 500** (notas 1,4x maiores no celular em pé), o do APK 022.

  O link da pasta baixa os dois juntos (280 KB), e o app acha o seu pelo nome. Quando nenhum APK em uso precisar do 001, apagar.
- **Link do app:** `https://fb.hm.hv2.xyz/public/api/resources/download?hash=<hash do compartilhamento>`, no manifesto do app. Conferido contra os bytes
  reais do servidor: o zip da pasta traz `BibliotecaMusicalPartituras/partituras-001.zip` idêntico ao local (tamanho e SHA-256).
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
# 1. SVG de cada hino, SEM a letra e na largura 500 (precisa do MuseScore 4 e do pacote Python verovio; ver tools/gerar-partituras.py)
python3 tools/gerar-partituras.py <pasta dos hino-N.mscx> <pasta dos svg>

# 2. o zip (só partituras/hino-N.svg, reproduzível)
python3 tools/montar-pacote.py <pasta dos svg> partituras-NNN.zip

# 3. no servidor de arquivos (o mesmo dos sons): uma pasta PRÓPRIA, fora de BibliotecaMusical/, com o zip dentro, e o link público só dela;
#    depois o manifesto do app, com o nome, o tamanho e o SHA-256 do zip
python3 tools/montar-manifesto-partituras.py <link público da pasta> partituras-NNN.zip
```

**Pasta própria, fora de `BibliotecaMusical/`:** o link público do File Browser baixa a **pasta inteira em zip** (não há download de arquivo
avulso por esse tipo de link). Se o zip das partituras ficasse dentro de `BibliotecaMusical/` (a pasta dos sons), o download dos sons o traria
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
