# Segurança

## Como relatar uma vulnerabilidade

Não abra uma *issue* pública com detalhes de uma falha de segurança. Use **Security, Report a vulnerability** neste
repositório (relato privado do GitHub). Se essa opção não aparecer, abra uma *issue* só pedindo um contato privado,
sem descrever a falha.

## O que o app faz com a rede e com os dados

- Não tem conta nem login, e não envia dados de uso.
- Pela rede, o app só acessa o endereço do pacote opcional de **sons gravados**. Essa permissão é restrita a esse
  endereço em `src-tauri/capabilities/default.json`.
- Cada arquivo do pacote baixado é conferido por **tamanho e SHA-256** contra o manifesto que vai dentro do app
  (`src/lib/sons/manifesto.json`) antes de ser guardado. Pacote adulterado, incompleto ou com tamanho absurdo (zip
  "bomba") é recusado inteiro. Detalhes em [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md).
- O conteúdo de hinários (letras e partituras) **não fica neste repositório**: só código e dados de teste fictícios.

## Versões

O projeto está em desenvolvimento (0.x) e não há versão publicada em loja. Correções de segurança entram na `main`.
