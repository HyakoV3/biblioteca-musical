# Segurança

## Como relatar uma vulnerabilidade

Não abra uma *issue* pública com detalhes de uma falha de segurança. Use **Security, Report a vulnerability** neste
repositório (relato privado do GitHub). Se essa opção não aparecer, abra uma *issue* só pedindo um contato privado,
sem descrever a falha.

## O que o app faz com a rede e com os dados

- Não tem conta nem login, e não envia dados de uso.
- Pela rede, o app só acessa **um endereço**, de pacotes opcionais: o repositório público de pacotes no GitHub (**hinário, partituras e sons gravados**). O servidor do responsável (File Browser) deixou de ser usado pelo app em 2026-11-24 e só serve APKs antigos. Essa
  permissão é restrita, em `src-tauri/capabilities/default.json`, a um caminho do GitHub (`.../biblioteca-musical-pacotes/releases/download/*`). O GitHub redireciona o download para o seu armazenamento de assets, e o plugin não restringe esse destino (só a URL inicial); o conteúdo continua protegido pelo SHA-256 de cada arquivo, conferido contra o manifesto embutido no app.
- Cada pacote baixado é conferido por **tamanho e SHA-256** contra o manifesto que vai dentro do app
  (`src/lib/hinario/manifesto.json`, `src/lib/partituras/manifesto.json` e `src/lib/sons/manifesto.json`) antes de ser guardado. Pacote
  adulterado, incompleto ou com tamanho absurdo (zip "bomba": o download tem teto de 100 MiB) é recusado inteiro; no Rust, cada partitura
  ainda passa por uma limpeza do SVG (lista de elementos permitidos). Detalhes em [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md),
  [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) e [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- **Microfone:** só o Gravador e o "Qual nota é essa?" do Afinador o usam, com a permissão pedida só ao gravar ou ao tocar em Ouvir (o Afinador não grava nada: lê o som e o descarta); a gravação fica no aparelho e só sai
  quando a pessoa toca em **Enviar** (folha de compartilhamento do sistema). O `FileProvider` que entrega a gravação ao outro app expõe só a
  pasta de cache e a pasta de arquivos externos do próprio app (`getExternalFilesDir`), e não o armazenamento todo.
- O conteúdo de hinários (letras e partituras) **não fica neste repositório**: só código e dados de teste fictícios.

## Versões

O projeto está em desenvolvimento (0.x) e não há versão publicada em loja. Correções de segurança entram na `main`.
