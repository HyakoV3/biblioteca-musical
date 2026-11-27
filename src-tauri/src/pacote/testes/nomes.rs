//! Testes do pacote: os nomes aceitos num pacote.

use crate::pacote::entradas::classificar;
use crate::pacote::tipos::*;

// ---- nomes ----

#[test]
fn classifica_so_os_nomes_exatos() {
    // a versão de paisagem (opcional), do mesmo jeito: número canônico
    assert_eq!(
        classificar("partituras/hino-1-paisagem.svg"),
        Some(Entrada::Svg(1, Variante::Paisagem))
    );
    assert_eq!(
        classificar("partituras/hino-283-paisagem.svg"),
        Some(Entrada::Svg(283, Variante::Paisagem))
    );
    for ruim in [
        "partituras/hino-0-paisagem.svg",
        "partituras/hino-01-paisagem.svg",
        "partituras/hino--paisagem.svg",
        "partituras/hino-1-Paisagem.svg",
        "partituras/hino-1-paisagem.SVG",
        "partituras/hino-1-paisagem.svg.bak",
        "partituras/hino-1-retrato.svg",
        "partituras/hino-1-paisagem-paisagem.svg",
        "partituras/hino-1paisagem.svg",
        "partituras/hino-1_paisagem.svg",
        "partituras/hino-1-paisagem",
        "partituras/sub/hino-1-paisagem.svg",
        "partituras/hino-1000000000-paisagem.svg",
    ] {
        assert_eq!(classificar(ruim), None, "{ruim:?}");
    }
    // o zip é só de partituras: o hinario.json NÃO é um nome aceito
    assert_eq!(classificar("hinario.json"), None);
    assert_eq!(classificar("partituras/"), Some(Entrada::Pasta));
    assert_eq!(
        classificar("partituras/hino-1.svg"),
        Some(Entrada::Svg(1, Variante::Retrato))
    );
    assert_eq!(
        classificar("partituras/hino-283.svg"),
        Some(Entrada::Svg(283, Variante::Retrato))
    );
    assert_eq!(
        classificar("partituras/hino-999999999.svg"),
        Some(Entrada::Svg(999_999_999, Variante::Retrato))
    );
    for ruim in [
        "",
        "/",
        "hinario.json/",
        "Hinario.json",
        "hinario.json.bak",
        "./hinario.json",
        "/hinario.json",
        "../hinario.json",
        "x/hinario.json",
        "partituras",
        "partituras//",
        "partituras/hino-0.svg",
        "partituras/hino-01.svg",
        "partituras/hino-1.SVG",
        "partituras/hino-1.svg ",
        "partituras/hino-.svg",
        "partituras/hino--1.svg",
        "partituras/hino-+1.svg",
        "partituras/hino-1e3.svg",
        "partituras/hino-1000000000.svg",
        "partituras/hino-١.svg",
        "partituras/../hino-1.svg",
        "partituras/x/hino-1.svg",
        "partituras/hino-1.svg/",
        "partituras\\hino-1.svg",
        "partituras/hino-1.svg\0",
        "partituras/hino-1.timemap.json",
        "partituras/.hinario",
        "partituras/Leipzig.woff2",
    ] {
        assert_eq!(classificar(ruim), None, "{ruim:?}");
    }
}
