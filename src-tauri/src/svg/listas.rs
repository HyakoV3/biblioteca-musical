//! As listas de permitidos e de proibidos da limpeza do SVG (ver `svg.rs`): dados, sem lógica.
//! Ficam à parte para o módulo da limpeza só ter o código.

pub(super) const ELEMENTOS: &[&str] = &[
    "svg", "g", "path", "use", "text", "tspan", "rect", "ellipse", "circle", "line", "polyline",
    "polygon", "defs", "desc", "title", "symbol",
];

/// Elementos cujo conteúdo de texto vale. Nos demais, só pode haver espaço entre os filhos.
pub(super) const COM_TEXTO: &[&str] = &["text", "tspan", "desc", "title"];

/// Atributos permitidos (de geometria e de apresentação). `id` e `href` (só `#id`) têm regras próprias em `valor_final`. Sem
/// `style` (nenhum CSS do pacote entra), sem `xmlns` (o app escreve o seu) e sem nada que comece com `on`.
pub(super) const ATRIBUTOS: &[&str] = &[
    "id",
    "class",
    "transform",
    "version",
    "viewBox",
    "preserveAspectRatio",
    "overflow",
    "x",
    "y",
    "dx",
    "dy",
    "width",
    "height",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x1",
    "y1",
    "x2",
    "y2",
    "d",
    "points",
    "href",
    "color",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-opacity",
    "stroke-miterlimit",
    "opacity",
    "visibility",
    "display",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "font-variant",
    "text-anchor",
    "text-decoration",
    "dominant-baseline",
    "letter-spacing",
    "word-spacing",
    "xml:lang",
    "xml:space",
    // I-26: o instante em que a nota (ou pausa) soa dentro do compasso, em batidas. Só números (ver `tempo_valido`).
    "data-t",
    "data-f",
];

/// Pedaços que não podem aparecer em nenhum valor (em minúsculas, já com as entidades XML resolvidas). A barra
/// invertida barra os escapes de CSS (`\75rl(`), que escondem um `url(`.
pub(super) const PROIBIDOS_NO_VALOR: &[&str] = &[
    "url(",
    "javascript:",
    "data:",
    "expression",
    "@import",
    "\\",
    "<",
];
