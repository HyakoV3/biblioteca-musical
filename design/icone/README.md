# Ícone do app

Livro aberto com uma nota musical sobre o teclado de um piano, em azul-marinho (`#012250`) e dourado.

## Arquivos

- `icone.svg`: a **fonte** (viewBox 1254 × 1254, versão plana, "fase 2", com cantos transparentes), em vetor. Todos os ícones
  do app saem dela. É a arte do responsável, vetorizada: o arquivo começa com um grupo de traços finos (`stroke`, resto da
  vetorização automática) que o gerador **descarta**; o desenho são os caminhos preenchidos. A primeira moldura dourada e a placa
  azul vêm primeiro; o resto é o símbolo.

A fonte anterior (um PNG de 1254 × 1254, `icone-origem.png`) e o script que tirava o fundo dele por "cor para alfa"
(`tools/ajustar-icones.py`) foram **substituídos** em 2026-11-16 e ficam só no histórico do git.

A versão com relevo e degradê (fase 3) **não** foi usada: em tamanho de lançador (48 a 192 px) o relevo embaça o teclado, e a
versão plana combina com a interface plana do app. Ela serve bem como imagem grande, para a loja ou divulgação.

## Como regenerar

```bash
python3 tools/gerar-icone-do-app.py      # requer o Inkscape, o Pillow e o `tauri` do projeto (npm ci)
```

Um comando só: ele desenha as camadas do SVG, monta um manifesto e chama o `npx tauri icon`. **Não rode o `tauri icon` à mão
depois**, porque ele sobrescreveria o que o script acerta. O que sai (tudo versionado, em `src-tauri/icons/`, no
`src-tauri/gen/android/.../res/` e em `static/favicon.png`):

1. **Padrão** (desktop, iOS, tiles do Windows, loja): o ícone completo, com a moldura dourada, recortado rente a ela.
2. **Android 8+ (adaptativo):** o lançador recorta o ícone com uma máscara (círculo, quadrado arredondado...) e cortaria a moldura.
   Por isso o **fundo** é o azul-marinho liso (`mipmap-*/ic_launcher_background.png`) e o **primeiro plano** é só o símbolo
   (`ic_launcher_foreground.png`), reduzido para caber no **círculo seguro de 66 dp** de uma tela de 108 dp, com folga.
3. **Android 13+ (ícone temático):** a silhueta do símbolo (`ic_launcher_monochrome.png`): só o alfa importa, e a nota e os vãos do
   teclado viram recortes.
4. **iOS:** os PNGs saem do `tauri icon` em RGBA e são regravados em **RGB**, sem canal alfa, que a App Store exige.
5. **Favicon** de 256 px, que também é a logo da barra da tela inicial.

O gerador **recusa** um SVG com script, imagem, `<use>`, `<style>`, link (`href`, inclusive `xlink:href`), entidade externa ou
`url()` externo. Os testes (`python3 tools/test_gerar_icone_do_app.py`) rodam no CI e não precisam do Inkscape.

## Limites conhecidos

- O `icon.icns` muda de bytes a cada geração, mesmo com o desenho igual: se nada mudou no desenho, volte esse arquivo
  (`git checkout -- src-tauri/icons/icon.icns`) antes de commitar.
- O Android 7 ou anterior (`minSdk` 24) e o ícone redondo usam `ic_launcher.png` e `ic_launcher_round.png`, que o próprio `tauri icon`
  monta a partir da frente e do fundo; no redondo, o símbolo fica apertado.
- Os arquivos `drawable/ic_launcher_background.xml` e `drawable-v24/ic_launcher_foreground.xml` (e a cor em
  `values/ic_launcher_background.xml`) são do modelo do Android e **não são usados**: o ícone adaptativo aponta para os `mipmap`.
- Não há build de iOS neste ambiente (exige um Mac), então os ícones do iOS foram só verificados em arquivo.
- O ícone velho no lançador some ao **desinstalar** o app antes de instalar de novo (o lançador guarda o ícone em cache).
