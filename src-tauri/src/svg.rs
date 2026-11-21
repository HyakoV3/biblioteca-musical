//! Limpeza do SVG da partitura (I-08).
//!
//! O SVG vem de um pacote importado e é **embutido na página** (para seguir o tema escuro e o alto contraste), e o app roda
//! com `csp: null`: um SVG malicioso poderia executar script. Por isso o arquivo não é copiado como veio. Ele é lido por um
//! parser XML, conferido contra uma **lista de permitidos** (elementos, atributos e valores) e **reescrito** pelo app, que é
//! quem decide cada byte do que a página vai receber (assim, diferenças entre o parser XML e o do navegador não ajudam quem
//! ataca). O que não está na lista faz o arquivo ser **recusado**, com o motivo, e não "consertado".
//!
//! A lista cobre o que o Verovio gera (ver `tools/gerar-partituras.py`): formas e texto. Fica de fora tudo o que executa ou
//! busca algo: `script`, `foreignObject`, `image`, `a`, animações, `iframe`, `use` com endereço de fora, `url(...)` em
//! qualquer valor, `@import`, atributos `on*`, `xlink:href`, DOCTYPE, comentários e instruções.
//!
//! **CSS.** Um `<style>` dentro de um SVG embutido na página vale para o **documento inteiro**, não só para o SVG: um pacote
//! malicioso poderia esconder ou falsificar botões do app (`.botao{position:fixed;...}`). Por isso nenhum CSS do pacote entra:
//! o `<style>` do Verovio é **descartado** (só tem negrito, itálico e `stroke:currentColor`, que o app traz no seu CSS, escopado
//! à partitura: ver docs/FORMATO.md) e o atributo `style` é recusado.
//!
//! **O que mais um SVG embutido poderia afetar da página**, e como é barrado:
//!  - `id` e `href="#..."` ganham o prefixo `bm-p-` (um `id` igual ao de um elemento do app não o confunde);
//!  - o `<svg>` raiz, que é o que o layout da página enxerga, não pode ter `class` (puxaria uma regra do app, por exemplo
//!    `position:fixed`) nem `transform`, e sai sempre com `overflow="hidden"` (o desenho não passa por cima da interface).

use roxmltree::{Document, Node, NodeType, ParsingOptions};

/// Nós (elementos, textos...) que um SVG pode ter. Um hino grande do Verovio tem cerca de 20 mil.
pub const LIMITE_NOS: u32 = 300_000;
const LIMITE_PROFUNDIDADE: usize = 40;
const NS_SVG: &str = "http://www.w3.org/2000/svg";
const NS_XML: &str = "http://www.w3.org/XML/1998/namespace";

const ELEMENTOS: &[&str] = &[
    "svg", "g", "path", "use", "text", "tspan", "rect", "ellipse", "circle", "line", "polyline",
    "polygon", "defs", "desc", "title", "symbol",
];

/// Elementos cujo conteúdo de texto vale. Nos demais, só pode haver espaço entre os filhos.
const COM_TEXTO: &[&str] = &["text", "tspan", "desc", "title"];

/// Atributos permitidos (de geometria e de apresentação). `id` e `href` (só `#id`) têm regras próprias em `valor_final`. Sem
/// `style` (nenhum CSS do pacote entra), sem `xmlns` (o app escreve o seu) e sem nada que comece com `on`.
const ATRIBUTOS: &[&str] = &[
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
const PROIBIDOS_NO_VALOR: &[&str] = &[
    "url(",
    "javascript:",
    "data:",
    "expression",
    "@import",
    "\\",
    "<",
];

/// Prefixo dos `id` (e dos `href="#..."`) do SVG, para não colidirem com os da página.
const PREFIXO_ID: &str = "bm-p-";

/// Confere o SVG e devolve a versão reescrita, ou o motivo de recusar.
pub fn limpar(texto: &str) -> Result<String, String> {
    limpar_com(texto, LIMITE_NOS)
}

fn limpar_com(texto: &str, limite_nos: u32) -> Result<String, String> {
    let opcoes = ParsingOptions {
        allow_dtd: false,
        nodes_limit: limite_nos,
        ..ParsingOptions::default()
    };
    let doc =
        Document::parse_with_options(texto, opcoes).map_err(|e| format!("XML inválido: {e}"))?;
    for no in doc.root().children() {
        match no.node_type() {
            NodeType::Comment => return Err("tem comentário".into()),
            NodeType::PI => return Err("tem instrução de processamento".into()),
            _ => {}
        }
    }
    let raiz = doc.root_element();
    if raiz.tag_name().name() != "svg" {
        return Err(format!("a raiz é <{}>, não <svg>", raiz.tag_name().name()));
    }
    let mut saida = String::with_capacity(texto.len());
    escrever(raiz, 0, &mut saida)?;
    Ok(saida)
}

fn escrever(no: Node, nivel: usize, saida: &mut String) -> Result<(), String> {
    if nivel > LIMITE_PROFUNDIDADE {
        return Err("elementos aninhados fundo demais".into());
    }
    let nome = no.tag_name().name();
    if no.tag_name().namespace() != Some(NS_SVG) {
        return Err(format!("elemento <{nome}> fora do espaço de nomes do SVG"));
    }
    if !ELEMENTOS.contains(&nome) {
        return Err(format!("elemento não permitido: <{nome}>"));
    }
    saida.push('<');
    saida.push_str(nome);
    if nivel == 0 {
        saida.push_str(&format!(" xmlns=\"{NS_SVG}\""));
    }
    for a in no.attributes() {
        let completo = match a.namespace() {
            None => a.name().to_string(),
            Some(NS_XML) => format!("xml:{}", a.name()),
            Some(_) => {
                return Err(format!(
                    "atributo {} de outro espaço de nomes em <{nome}>",
                    a.name()
                ));
            }
        };
        if !ATRIBUTOS.contains(&completo.as_str()) {
            return Err(format!("atributo não permitido: {completo} em <{nome}>"));
        }
        if nivel == 0 {
            match completo.as_str() {
                // O overflow do raiz é decidido abaixo, e não pelo pacote.
                "overflow" => continue,
                "class" | "transform" => {
                    return Err(format!("{completo} não é permitido no <svg> raiz"));
                }
                _ => {}
            }
        }
        let valor = valor_final(&completo, a.value())
            .map_err(|m| format!("{completo} em <{nome}>: {m}"))?;
        saida.push(' ');
        saida.push_str(&completo);
        saida.push_str("=\"");
        escapar(&valor, true, saida);
        saida.push('"');
    }
    if nivel == 0 {
        saida.push_str(" overflow=\"hidden\"");
    }
    saida.push('>');
    let com_texto = COM_TEXTO.contains(&nome);
    for filho in no.children() {
        match filho.node_type() {
            // O CSS do pacote é descartado (ver o cabeçalho): quem o escreveu não decide nada na página.
            NodeType::Element if is_style(filho) => {}
            NodeType::Element => escrever(filho, nivel + 1, saida)?,
            NodeType::Text => {
                let t = filho.text().unwrap_or("");
                if com_texto {
                    // Em <text> e <tspan> o espaço entre os filhos é mantido: faz parte de como o texto é desenhado.
                    escapar(t, false, saida);
                } else if !t.trim().is_empty() {
                    return Err(format!("texto solto em <{nome}>"));
                }
            }
            NodeType::Comment => return Err("tem comentário".into()),
            NodeType::PI => return Err("tem instrução de processamento".into()),
            NodeType::Root => {}
        }
    }
    saida.push_str("</");
    saida.push_str(nome);
    saida.push('>');
    Ok(())
}

/// `<style>` do espaço de nomes do SVG (um `<style>` de outro espaço de nomes não é descartado: é recusado em `escrever`).
fn is_style(no: Node) -> bool {
    no.tag_name().name() == "style" && no.tag_name().namespace() == Some(NS_SVG)
}

/// Um tempo em batidas como o gerador escreve: dígitos com no máximo um ponto decimal no meio, até 12 caracteres (`0`, `1.5`, `12.3333`).
/// Sem sinal, sem expoente, sem espaço: o app lê o valor com `parseFloat`, e nada mais que número passa.
fn tempo_valido(valor: &str) -> bool {
    let partes: Vec<&str> = valor.split('.').collect();
    valor.len() <= 12
        && partes.len() <= 2
        && partes
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

fn id_simples(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-.:".contains(c))
}

/// O `id` com o prefixo do app. Idempotente: limpar de novo um SVG já limpo não prefixa outra vez.
fn com_prefixo(id: &str) -> String {
    if id.starts_with(PREFIXO_ID) {
        id.to_string()
    } else {
        format!("{PREFIXO_ID}{id}")
    }
}

/// Confere o valor de um atributo e devolve o que vai para a saída (`id` e `href` ganham o prefixo).
fn valor_final(atributo: &str, valor: &str) -> Result<String, String> {
    match atributo {
        "id" if id_simples(valor) => Ok(com_prefixo(valor)),
        "id" => Err("só letras, números e _ - . :".into()),
        "data-t" | "data-f" if tempo_valido(valor) => Ok(valor.to_string()),
        "data-t" | "data-f" => {
            Err("só um número de batidas (como 1.5), de até 12 caracteres".into())
        }
        "href" => {
            let id = valor.strip_prefix('#').unwrap_or("");
            if id_simples(id) {
                Ok(format!("#{}", com_prefixo(id)))
            } else {
                Err("só aponta para dentro (#id)".into())
            }
        }
        _ => {
            let baixo = valor.to_ascii_lowercase();
            match PROIBIDOS_NO_VALOR.iter().find(|p| baixo.contains(**p)) {
                Some(p) => Err(format!("contém \"{p}\"")),
                None => Ok(valor.to_string()),
            }
        }
    }
}

fn escapar(texto: &str, atributo: bool, saida: &mut String) {
    for c in texto.chars() {
        match c {
            '&' => saida.push_str("&amp;"),
            '<' => saida.push_str("&lt;"),
            '>' => saida.push_str("&gt;"),
            '"' if atributo => saida.push_str("&quot;"),
            _ => saida.push(c),
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    /// Um SVG no formato do Verovio (com `svgRemoveXlink`), pequeno.
    const VEROVIO: &str = r##"<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 100 100" overflow="visible" color="black">
  <desc>Engraved by Verovio 6.4.1</desc>
  <defs>
    <path id="E050-1" d="M0 0 L10 10 Z" transform="scale(0.5)"/>
  </defs>
  <style type="text/css">#x g.dir, #x g.dynam {font-style:italic;} #x path {stroke:currentColor}</style>
  <g id="x" class="definition-scale">
    <use href="#E050-1" x="1" y="2" height="720px" width="720px"/>
    <text x="1" y="2" font-size="0px" text-anchor="middle" xml:lang="pt">
      <tspan class="text">
        <tspan font-size="405px">em</tspan>
      </tspan>
    </text>
    <rect x="1" y="2" width="3" height="4"/>
    <ellipse cx="1" cy="2" rx="3" ry="4"/>
  </g>
</svg>"##;

    /// Embrulha um trecho no SVG mínimo, para testar um elemento ou atributo por vez.
    fn svg(miolo: &str) -> String {
        format!(r#"<svg xmlns="http://www.w3.org/2000/svg">{miolo}</svg>"#)
    }

    fn recusa(texto: &str) -> String {
        match limpar(texto) {
            Ok(s) => panic!("devia recusar, mas passou: {s}"),
            Err(e) => e,
        }
    }

    #[test]
    fn aceita_o_formato_do_verovio_e_reescreve() {
        let s = limpar(VEROVIO).unwrap();
        // O raiz perde o overflow do pacote ("visible") e sai com "hidden", sempre por último.
        assert!(
            s.starts_with(
                r#"<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100" color="black" overflow="hidden">"#
            ),
            "{s}"
        );
        assert!(!s.contains("<?xml") && !s.contains("xlink"), "{s}");
        // id e href ganham o prefixo do app
        assert!(
            s.contains(
                r##"<use href="#bm-p-E050-1" x="1" y="2" height="720px" width="720px"></use>"##
            ),
            "{s}"
        );
        assert!(
            s.contains(r#"<path id="bm-p-E050-1""#) && s.contains(r#"<g id="bm-p-x""#),
            "{s}"
        );
        assert!(s.contains(r#"xml:lang="pt""#));
        // o CSS do pacote é descartado
        assert!(
            !s.contains("<style") && !s.contains("font-style:italic"),
            "{s}"
        );
        assert!(
            !s.contains("\n  <g") && !s.contains("\n  <defs"),
            "o espaço entre os elementos soltos some"
        );
    }

    #[test]
    fn reescrever_de_novo_nao_muda_nada() {
        let uma = limpar(VEROVIO).unwrap();
        assert_eq!(limpar(&uma).unwrap(), uma);
    }

    #[test]
    fn texto_e_espaco_dentro_de_text_e_tspan_sao_mantidos() {
        let s = limpar(&svg("<text>a <tspan> b </tspan>\n</text>")).unwrap();
        assert!(s.contains("<text>a <tspan> b </tspan>\n</text>"), "{s}");
    }

    #[test]
    fn texto_que_parece_tag_continua_texto() {
        let s = limpar(&svg(
            "<text>&lt;img src=x onerror=alert(1)&gt; &amp; fim</text>",
        ))
        .unwrap();
        assert!(
            s.contains("&lt;img src=x onerror=alert(1)&gt; &amp; fim"),
            "{s}"
        );
        assert!(!s.contains("<img"), "{s}");
    }

    #[test]
    fn aspas_no_valor_do_atributo_sao_escapadas() {
        let s = limpar(&svg(r#"<g class='a"b&amp;c'/>"#)).unwrap();
        assert!(s.contains(r#"class="a&quot;b&amp;c""#), "{s}");
    }

    #[test]
    fn recusa_elementos_que_executam_ou_buscam_coisas() {
        for el in [
            "<script>alert(1)</script>",
            "<script/>",
            "<foreignObject><div/></foreignObject>",
            "<foreignObject/>", // vazio: o que o barra é o próprio elemento, não o que há dentro
            r#"<image href="x.png"/>"#,
            "<image/>",
            r##"<a href="#x"><g/></a>"##,
            "<a/>",
            r#"<animate attributeName="href" to="javascript:alert(1)"/>"#,
            r#"<set attributeName="href" to="x"/>"#,
            r#"<iframe src="x"/>"#,
            r#"<filter id="f"/>"#,
            r#"<linearGradient id="g"/>"#,
            r#"<mask id="m"/>"#,
        ] {
            let motivo = recusa(&svg(el));
            assert!(
                motivo.contains("não permitido") || motivo.contains("fora do espaço"),
                "{el} -> {motivo}"
            );
        }
    }

    #[test]
    fn recusa_atributos_de_evento_e_desconhecidos() {
        for attr in [
            r#"onload="x()""#,
            r#"onclick="x()""#,
            r#"onerror="x()""#,
            r#"onmouseover="x()""#,
            r#"src="x""#,
            r#"srcset="x""#,
            r#"formaction="x""#,
            r#"filter="x""#,
            r#"clip-path="x""#,
            r#"mask="x""#,
            r#"contenteditable="true""#,
            r#"tabindex="0""#,
        ] {
            let motivo = recusa(&svg(&format!("<g {attr}/>")));
            assert!(
                motivo.contains("atributo não permitido"),
                "{attr} -> {motivo}"
            );
        }
    }

    #[test]
    fn href_so_aponta_para_dentro() {
        assert!(limpar(&svg(r##"<use href="#abc_1.2-x:y"/>"##)).is_ok());
        for href in [
            "",
            "#",
            "x.svg#a",
            "https://evil/x.svg#a",
            "javascript:alert(1)",
            "data:image/svg+xml;base64,AAAA",
            "//evil/x",
            "#a b",
            "#a\"b",
            "#a<b",
            "#a'b",
            "#a)b",
        ] {
            let motivo = recusa(&svg(&format!(
                r#"<use href="{}"/>"#,
                href.replace('"', "&quot;").replace('<', "&lt;")
            )));
            assert!(motivo.contains("href"), "{href} -> {motivo}");
        }
    }

    #[test]
    fn recusa_xlink_href() {
        let motivo = recusa(
            r##"<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>"##,
        );
        assert!(motivo.contains("outro espaço de nomes"), "{motivo}");
    }

    #[test]
    fn recusa_url_e_afins_em_qualquer_valor() {
        for v in [
            "url(#g)",
            "URL(#g)",
            "url(https://evil/x)",
            "javascript:x",
            "JavaScript:x",
            "data:text/html,x",
            "expression(x)",
            "\\75rl(x)",
            "a<b",
            "@import",
        ] {
            let motivo = recusa(&svg(&format!(r#"<g fill="{}"/>"#, v.replace('<', "&lt;"))));
            assert!(motivo.contains("fill"), "{v} -> {motivo}");
        }
        // entidade que vira "url(" depois de lida
        recusa(&svg(r#"<g fill="&#117;rl(#g)"/>"#));
    }

    #[test]
    fn o_style_do_pacote_e_descartado_com_tudo_o_que_ha_dentro() {
        // Um <style> no SVG embutido valeria para a página inteira (".botao{position:fixed}"): nada dele chega à saída, nem o
        // que parece inofensivo, nem o que tem marcação escondida em CDATA.
        for css in [
            "#a g.b {font-weight:bold;} #a rect {stroke:currentColor}",
            "body{display:none}",
            "*{visibility:hidden}",
            ".botao{position:fixed;inset:0;z-index:9}",
            "@import url(https://evil/x.css);",
            "a{background:url(https://evil/x)}",
            "/* c */ a{b:\\75rl(x)}",
            "<![CDATA[</style><img src=x onerror=alert(1)>]]>",
        ] {
            let s = limpar(&svg(&format!(
                r#"<style type="text/css">{css}</style><g/>"#
            )))
            .unwrap();
            assert!(
                !s.contains("style") && !s.contains("CDATA") && !s.contains("onerror"),
                "{css} -> {s}"
            );
            assert!(s.ends_with("<g></g></svg>"), "o resto continua: {s}");
        }
        // com filhos e sem type, e dentro de outro elemento
        let s = limpar(&svg(r#"<g><style><g id="x"/></style></g>"#)).unwrap();
        assert!(s.ends_with("<g></g></svg>"), "{s}");
    }

    #[test]
    fn style_de_outro_espaco_de_nomes_nao_e_descartado_e_sim_recusado() {
        recusa(&svg(
            r#"<style xmlns="http://www.w3.org/1999/xhtml">body{display:none}</style>"#,
        ));
    }

    #[test]
    fn atributo_style_e_type_sao_recusados() {
        for attr in [
            r#"style="fill:red""#,
            r#"style="position:fixed;inset:0""#,
            r#"style="background:url(x)""#,
            r#"style="""#,
            r#"type="text/css""#,
        ] {
            let motivo = recusa(&svg(&format!("<g {attr}/>")));
            assert!(
                motivo.contains("atributo não permitido"),
                "{attr} -> {motivo}"
            );
        }
    }

    #[test]
    fn id_e_href_ganham_o_prefixo_do_app_e_isso_e_idempotente() {
        let uma = limpar(&svg(r##"<defs><path id="app"/></defs><use href="#app"/>"##)).unwrap();
        assert!(uma.contains(r#"<path id="bm-p-app">"#), "{uma}");
        assert!(uma.contains(r##"<use href="#bm-p-app">"##), "{uma}");
        assert_eq!(
            limpar(&uma).unwrap(),
            uma,
            "limpar de novo não prefixa outra vez"
        );
        // quem já escreve com o prefixo continua no espaço do app
        let ja = limpar(&svg(r#"<g id="bm-p-x"/>"#)).unwrap();
        assert!(
            ja.contains(r#"id="bm-p-x""#) && !ja.contains("bm-p-bm-p-"),
            "{ja}"
        );
    }

    #[test]
    fn id_com_caracteres_estranhos_e_recusado() {
        for id in [
            "", "a b", "a\"b", "a<b", "a'b", "a/b", "a#b", "a)b", "é", "a\n",
        ] {
            let motivo = recusa(&svg(&format!(
                r#"<g id="{}"/>"#,
                id.replace('"', "&quot;").replace('<', "&lt;")
            )));
            assert!(motivo.contains("id em <g>"), "{id:?} -> {motivo}");
        }
    }

    #[test]
    fn o_svg_raiz_nao_pode_ter_class_nem_transform_mas_os_de_dentro_podem() {
        for attr in [
            r#"class="miniplayer""#,
            r#"transform="translate(-500 -500)""#,
        ] {
            let motivo = recusa(&format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" {attr}/>"#
            ));
            assert!(
                motivo.contains("não é permitido no <svg> raiz"),
                "{attr} -> {motivo}"
            );
        }
        // o <svg> de dentro (o do Verovio, "definition-scale") e os outros elementos seguem com os dois
        let s = limpar(&svg(r#"<svg class="definition-scale" viewBox="0 0 1 1"><g class="a" transform="scale(2)"/></svg>"#)).unwrap();
        assert!(
            s.contains(r#"<svg class="definition-scale""#)
                && s.contains(r#"<g class="a" transform="scale(2)">"#),
            "{s}"
        );
    }

    #[test]
    fn o_overflow_do_raiz_e_sempre_hidden() {
        for entrada in [
            r#"<svg xmlns="http://www.w3.org/2000/svg" overflow="visible"/>"#,
            r#"<svg xmlns="http://www.w3.org/2000/svg" overflow="hidden"/>"#,
            r#"<svg xmlns="http://www.w3.org/2000/svg" overflow="auto"/>"#,
            r#"<svg xmlns="http://www.w3.org/2000/svg"/>"#,
        ] {
            let s = limpar(entrada).unwrap();
            assert_eq!(
                s, r#"<svg xmlns="http://www.w3.org/2000/svg" overflow="hidden"></svg>"#,
                "{entrada}"
            );
        }
        // um elemento de dentro mantém o que o pacote escreveu (o raiz o recorta)
        let s = limpar(&svg(r#"<svg overflow="visible"/>"#)).unwrap();
        assert!(s.contains(r#"<svg overflow="visible">"#), "{s}");
    }

    #[test]
    fn recusa_doctype_entidades_comentarios_e_instrucoes() {
        recusa(r#"<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>"#);
        recusa(
            r#"<!DOCTYPE svg [<!ENTITY a "x">]><svg xmlns="http://www.w3.org/2000/svg"><text>&a;</text></svg>"#,
        );
        assert!(
            recusa(r#"<!-- x --><svg xmlns="http://www.w3.org/2000/svg"/>"#).contains("comentário")
        );
        assert!(recusa(&svg("<g><!-- x --></g>")).contains("comentário"));
        assert!(
            recusa(r#"<svg xmlns="http://www.w3.org/2000/svg"/><?pi x?>"#).contains("instrução")
        );
        assert!(recusa(&svg("<g><?pi x?></g>")).contains("instrução"));
        // a declaração <?xml ...?> do começo é normal e não conta como instrução
        assert!(
            limpar(r#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>"#).is_ok()
        );
    }

    #[test]
    fn recusa_raiz_e_espaco_de_nomes_errados() {
        assert!(recusa(r#"<html xmlns="http://www.w3.org/1999/xhtml"/>"#).contains("raiz"));
        assert!(recusa("<svg/>").contains("espaço de nomes"));
        assert!(recusa(r#"<svg xmlns="http://evil/ns"/>"#).contains("espaço de nomes"));
        assert!(
            recusa(&svg(r#"<body xmlns="http://www.w3.org/1999/xhtml"/>"#))
                .contains("espaço de nomes")
        );
        assert!(
            recusa(&svg(
                r#"<svg xmlns="http://www.w3.org/2000/svg"><g xmlns="http://evil/ns"/></svg>"#
            ))
            .contains("espaço de nomes")
        );
    }

    #[test]
    fn recusa_texto_solto_fora_de_text() {
        assert!(recusa(&svg("<g>oi</g>")).contains("texto solto"));
        assert!(limpar(&svg("<g>  \n </g>")).is_ok());
    }

    #[test]
    fn recusa_xml_invalido_e_vazio() {
        for t in [
            "",
            "não é xml",
            "<svg xmlns=\"http://www.w3.org/2000/svg\">",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"></g>",
        ] {
            assert!(recusa(t).contains("XML inválido"), "{t}");
        }
    }

    #[test]
    fn limita_a_profundidade() {
        let fundo = |n: usize| svg(&format!("{}{}", "<g>".repeat(n), "</g>".repeat(n)));
        assert!(limpar(&fundo(LIMITE_PROFUNDIDADE)).is_ok());
        assert!(recusa(&fundo(LIMITE_PROFUNDIDADE + 1)).contains("fundo demais"));
    }

    #[test]
    fn limita_a_quantidade_de_nos() {
        let tres = svg("<g/><g/>");
        assert!(limpar_com(&tres, 100).is_ok());
        assert!(recusa_com(&tres, 2).contains("XML inválido"));
    }

    fn recusa_com(texto: &str, limite: u32) -> String {
        limpar_com(texto, limite).expect_err("devia recusar")
    }

    /// Confere os SVG gerados de verdade: `BM_SVGS=pasta cargo test -- --ignored svgs_gerados`. Não roda no CI (as partituras
    /// ficam fora do Git); serve para ver se um lote novo passa na limpeza antes de empacotar.
    #[test]
    #[ignore = "precisa de BM_SVGS=pasta com hino-N.svg"]
    fn svgs_gerados_passam_na_limpeza() {
        let pasta = std::env::var("BM_SVGS").expect("defina BM_SVGS");
        let mut total = 0;
        let mut recusados = Vec::new();
        for e in std::fs::read_dir(&pasta).unwrap() {
            let p = e.unwrap().path();
            if p.extension().is_some_and(|x| x == "svg") {
                total += 1;
                let texto = std::fs::read_to_string(&p).unwrap();
                match limpar(&texto) {
                    Ok(limpo) => {
                        assert_eq!(
                            limpar(&limpo).unwrap(),
                            limpo,
                            "{} não é estável",
                            p.display()
                        );
                        // Opcional: grava a versão limpa para comparar o desenho com o original (BM_SVGS_LIMPOS=pasta).
                        if let Ok(destino) = std::env::var("BM_SVGS_LIMPOS") {
                            std::fs::create_dir_all(&destino).unwrap();
                            std::fs::write(
                                std::path::Path::new(&destino).join(p.file_name().unwrap()),
                                limpo,
                            )
                            .unwrap();
                        }
                    }
                    Err(m) => recusados.push(format!("{}: {m}", p.display())),
                }
            }
        }
        assert!(total > 0, "nenhum .svg em {pasta}");
        assert!(
            recusados.is_empty(),
            "{} de {total} recusados:\n{}",
            recusados.len(),
            recusados.join("\n")
        );
    }

    #[test]
    fn deixa_passar_o_tempo_da_nota_e_recusa_o_que_nao_e_numero() {
        let boa = limpar(&svg(r#"<g class="note" data-t="1.5" data-f="12.3333"/>"#)).unwrap();
        assert!(
            boa.contains(r#"data-t="1.5""#) && boa.contains(r#"data-f="12.3333""#),
            "{boa}"
        );
        for ruim in [
            "",
            "-1",
            "1e3",
            "1.",
            ".5",
            "1.2.3",
            " 1",
            "1 ",
            "NaN",
            "1234567890123",
            "0x10",
            "1,5",
            "&lt;",
        ] {
            let r = limpar(&svg(&format!(r#"<g class="note" data-t="{ruim}"/>"#)));
            assert!(r.is_err(), "devia recusar data-t={ruim:?}: {r:?}");
        }
        // outro data-* continua não permitido
        assert!(limpar(&svg(r#"<g data-x="1"/>"#)).is_err());
    }
}
