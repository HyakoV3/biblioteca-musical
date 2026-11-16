# Pacote de partituras

As partituras são **opcionais**, como os sons gravados: o app baixa um pacote do servidor em **Ajustes → Partituras → Baixar** (decisão do
responsável, 2026-11-16: o botão "Importar hinário" vai deixar de existir e as partituras ganham um botão automático, no molde dos sons).
O pacote é um `.zip` só com `partituras/hino-<número>.svg` (formato e verificações em [`FORMATO.md`](FORMATO.md), seção "Importar").

> **Direitos.** As partituras são geradas das transcrições do Enéias (`eneiasramos/ccb-hinario-5-do`, "todos os direitos reservados", sem
> licença); a autorização dele **ainda não veio**. **Publicar o pacote num link público é distribuir esse trabalho**: o mecanismo está pronto,
> mas quem decide quando (e se) publicar é o responsável, depois da resposta dele. Enquanto não houver pacote publicado, o manifesto
> do app fica `"pacote": null` e o botão Baixar **não aparece**.

## Gerar e publicar

```sh
# 1. SVG de cada hino (precisa do MuseScore 4 e do pacote Python verovio; ver tools/gerar-partituras.py)
python3 tools/gerar-partituras.py <pasta dos hino-N.mscx> <pasta dos svg>

# 2. o zip (só partituras/hino-N.svg, reproduzível)
python3 tools/montar-pacote.py <pasta dos svg> partituras-001.zip

# 3. no servidor de arquivos (o mesmo dos sons): uma pasta PRÓPRIA, fora de BibliotecaMusical/, com o zip dentro, e o link público só dela;
#    depois o manifesto do app, com o nome, o tamanho e o SHA-256 do zip
python3 tools/montar-manifesto-partituras.py <link público da pasta> partituras-001.zip
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
