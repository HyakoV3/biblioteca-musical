#!/usr/bin/env python3
"""Ajusta os ícones gerados por `npm run tauri icon` para Android e iOS, a partir de design/icone/icone-origem.png.

Faz duas coisas que o comando do Tauri não faz:
  A) Android 8.0+: gera as camadas do ícone adaptativo (fundo + primeiro plano), detalhadas abaixo;
  B) iOS: achata os ícones para RGB, sem canal alfa (a App Store recusa ícone com canal alfa).


Por quê: o Android recorta o ícone com uma máscara (círculo, quadrado arredondado...). Se o primeiro plano
for o desenho inteiro com moldura, a máscara corta a borda e aparecem cantos de outra cor. O correto são
duas camadas: FUNDO (cor sólida) e PRIMEIRO PLANO (só o desenho, dentro da zona segura).

Uso (sempre nesta ordem; o comando do Tauri sobrescreve os arquivos que este script ajusta):
    npm run tauri icon design/icone/icone-origem.png -- --ios-color "#012352"
    python3 tools/ajustar-icones.py

O que faz:
  1. descobre o azul-marinho do fundo do desenho e o grava como cor de fundo do ícone adaptativo;
  2. tira a moldura (anel dourado) e transforma o azul em transparência ("cor para alfa", como no GIMP);
  3. reduz o desenho para ~60% do lado, dentro da zona segura (a máscara mostra ~66% e a parte
     garantida é um círculo de ~61%);
  4. grava ic_launcher_foreground.png em cada densidade e a cor em values/ic_launcher_background.xml.
Requer Pillow e numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "design" / "icone" / "icone-origem.png"
RES = RAIZ / "src-tauri" / "gen" / "android" / "app" / "src" / "main" / "res"
DENSIDADES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}  # 108 dp x densidade
TELA = 1024
FRACAO = 0.56  # lado maior do desenho / lado da tela (zona segura ~61%; deixa folga na máscara redonda)
MOLDURA = 90  # px da origem (1254) ocupados pela borda dourada, a descartar
CANTO = 230  # lado, em px, do quadrado de cada canto a descartar (restos da moldura)
TOLERANCIA = 14  # diferença máxima (0 a 255) ao azul de fundo para ainda contar como fundo
PONTO_FUNDO = (640, 150)  # um ponto do azul de fundo na origem


def main():
    im = Image.open(ORIGEM).convert("RGBA")
    arr = np.asarray(im).astype(np.float64)
    h, w = arr.shape[:2]
    rgb, alfa_orig = arr[..., :3], arr[..., 3] / 255.0

    fundo = tuple(int(v) for v in arr[PONTO_FUNDO[1], PONTO_FUNDO[0], :3])
    ref = np.array(fundo, dtype=np.float64)

    # cor -> alfa (algoritmo do GIMP): quanto mais longe do azul de fundo, mais opaco
    sobe = np.where(rgb > ref, (rgb - ref) / np.maximum(255.0 - ref, 1.0), 0.0)
    desce = np.where(rgb < ref, (ref - rgb) / np.maximum(ref, 1.0), 0.0)
    alfa = np.clip(np.maximum(sobe, desce).max(axis=2), 0.0, 1.0) * alfa_orig
    # O azul da origem tem ruído leve (alguns níveis de variação por canal). Normalizar por canal amplifica esse
    # ruído nos canais escuros (4/35 = 11% de alfa no verde), então o critério é a diferença ABSOLUTA ao azul:
    # até TOLERANCIA níveis em todos os canais é fundo.
    desvio = np.abs(rgb - ref).max(axis=2)
    alfa[desvio <= TOLERANCIA] = 0.0
    alfa[alfa < 0.02] = 0.0

    # descarta a moldura (anel dourado) nas bordas
    alfa[:MOLDURA, :] = 0
    alfa[-MOLDURA:, :] = 0
    alfa[:, :MOLDURA] = 0
    alfa[:, -MOLDURA:] = 0
    # os cantos da moldura curvam para dentro e escapam da faixa acima: o desenho nunca chega aos cantos
    alfa[:CANTO, :CANTO] = 0
    alfa[:CANTO, -CANTO:] = 0
    alfa[-CANTO:, :CANTO] = 0
    alfa[-CANTO:, -CANTO:] = 0

    # recupera a cor "pura" do primeiro plano (desfaz a mistura com o azul)
    seguro = np.where(alfa[..., None] > 0, alfa[..., None], 1.0)
    cor = np.clip(ref + (rgb - ref) / seguro, 0, 255)
    cor = np.where(alfa[..., None] > 0, cor, 0)

    saida = np.dstack([cor, alfa * 255.0]).astype(np.uint8)
    camada = Image.fromarray(saida, "RGBA")
    caixa = camada.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if not caixa:
        raise SystemExit("não sobrou desenho depois de tirar o fundo: confira a origem")
    desenho = camada.crop(caixa)

    escala = (TELA * FRACAO) / max(desenho.size)
    novo = desenho.resize((round(desenho.width * escala), round(desenho.height * escala)), Image.LANCZOS)
    tela = Image.new("RGBA", (TELA, TELA), (0, 0, 0, 0))
    tela.alpha_composite(novo, ((TELA - novo.width) // 2, (TELA - novo.height) // 2))
    (RAIZ / "design" / "icone").mkdir(parents=True, exist_ok=True)
    tela.save(RAIZ / "design" / "icone" / "primeiro-plano-adaptativo.png", optimize=True)

    for dens, lado in DENSIDADES.items():
        pasta = RES / f"mipmap-{dens}"
        pasta.mkdir(parents=True, exist_ok=True)
        tela.resize((lado, lado), Image.LANCZOS).save(pasta / "ic_launcher_foreground.png", optimize=True)

    hexa = "#{:02X}{:02X}{:02X}".format(*fundo)
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'  <color name="ic_launcher_background">{hexa}</color>\n</resources>\n',
        encoding="utf-8",
    )
    print(f"fundo: {hexa} | desenho {desenho.size} -> {novo.size} na tela {TELA} ({novo.width / TELA:.0%} da largura)")
    print("camadas gravadas em", RES)

    # iOS: sem canal alfa. Compõe sobre o azul de fundo e salva em RGB.
    ios = sorted((RAIZ / "src-tauri" / "icons" / "ios").glob("*.png"))
    for caminho in ios:
        base = Image.new("RGBA", Image.open(caminho).size, fundo + (255,))
        base.alpha_composite(Image.open(caminho).convert("RGBA"))
        base.convert("RGB").save(caminho, optimize=True)
    print(f"iOS: {len(ios)} ícones achatados para RGB (sem canal alfa)")


if __name__ == "__main__":
    main()
