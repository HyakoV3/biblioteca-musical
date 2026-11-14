# Ícone do app

Livro aberto com uma nota musical sobre o teclado de um piano, em azul-marinho (`#012352`) e dourado.

## Arquivos

- `icone-origem.png` — a **fonte** (1254 × 1254, versão plana, com cantos transparentes). Todos os ícones do app
  são gerados a partir dela. É a arte original do responsável, recentralizada em 6 px na horizontal e 2 px na vertical
  (as margens eram 24/36 e 28/24 px) para o desenho ficar no centro da tela.
- `primeiro-plano-adaptativo.png` — referência (1024 × 1024) da camada de primeiro plano do ícone adaptativo do
  Android: só o desenho, sem a moldura, com fundo transparente. É gerada por `tools/ajustar-icones.py`.

A versão com relevo e degradê (fase 3) **não** foi usada: em tamanho de lançador (48 a 192 px) o relevo embaça o
teclado, e a versão plana combina com a interface plana do app. Ela serve bem como imagem grande, para a loja ou
divulgação.

## Como regenerar

Sempre nesta ordem, porque o comando do Tauri sobrescreve os arquivos que o script ajusta:

```bash
npm run tauri icon design/icone/icone-origem.png -- --ios-color "#012352"
python3 tools/ajustar-icones.py        # requer Pillow e numpy
```

O primeiro comando é o oficial do Tauri e gera os ícones de desktop, Android e iOS. O segundo faz o que ele não faz:

1. **Android 8+ (ícone adaptativo):** o lançador recorta o ícone com uma máscara (círculo, quadrado arredondado...).
   O Tauri usa o desenho inteiro, com a moldura e os cantos transparentes, sobre fundo branco: apareceriam cantos
   brancos e a borda cortada. O script separa **fundo** (azul-marinho sólido, em `values/ic_launcher_background.xml`)
   e **primeiro plano** (só o desenho, a 56% do lado, dentro da zona segura).
2. **iOS:** converte os ícones para RGB sem canal alfa, que a App Store exige.

O Android 7 ou anterior, e o desktop, usam o ícone com a moldura dourada (`ic_launcher.png` e `icon.png`).

## Limites conhecidos

- O primeiro plano é extraído da imagem por "cor para alfa" (tirando o azul de fundo). A origem tem ruído leve no
  azul, e o script ignora diferenças de até 14 níveis; se a arte mudar, confira a prévia antes de aceitar.
- O ícone **monocromático** do Android 13+ (ícones temáticos) não foi criado: sem ele, o Android usa o ícone normal.
- Não há build de iOS neste ambiente (exige um Mac), então os ícones do iOS foram só verificados em arquivo.
