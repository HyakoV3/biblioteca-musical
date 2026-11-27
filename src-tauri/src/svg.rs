//! Limpeza do SVG da partitura (I-08).
//!
//! O SVG vem de um pacote importado e é **embutido na página** (para seguir o tema escuro e o alto contraste): um SVG malicioso
//! poderia executar script. A CSP do app (`tauri.conf.json`) é a segunda camada; esta limpeza é a primeira. O arquivo não é copiado como veio. Ele é lido por um
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

mod listas;
mod valores;

use crate::hinario::erro;
use listas::{ATRIBUTOS, COM_TEXTO, ELEMENTOS};
use roxmltree::{Attribute, Document, Node, NodeType, ParsingOptions};
use std::collections::HashMap;
use valores::{escapar, valor_final};

/// Nós (elementos, textos...) que um SVG pode ter. Um hino grande do Verovio tem cerca de 20 mil.
pub const LIMITE_NOS: u32 = 300_000;
const LIMITE_PROFUNDIDADE: usize = 40;
const NS_SVG: &str = "http://www.w3.org/2000/svg";
const NS_XML: &str = "http://www.w3.org/XML/1998/namespace";

/// Confere o SVG e devolve a versão reescrita, ou o motivo de recusar. O motivo é um erro codificado (`["svg_elemento", "script"]`, ver
/// `hinario::erro`): a interface o traduz no idioma da pessoa, e o detalhe (o nome do elemento ou do atributo) segue como argumento.
pub fn limpar(texto: &str) -> Result<String, String> {
    limpar_com(texto, LIMITE_NOS)
}

fn limpar_com(texto: &str, limite_nos: u32) -> Result<String, String> {
    let opcoes = ParsingOptions {
        allow_dtd: false,
        nodes_limit: limite_nos,
        ..ParsingOptions::default()
    };
    let doc = Document::parse_with_options(texto, opcoes)
        .map_err(|e| erro("svg_xml", &[e.to_string()]))?;
    sem_comentario_na_raiz(&doc)?;
    let raiz = doc.root_element();
    if raiz.tag_name().name() != "svg" {
        return Err(erro("svg_raiz", &[raiz.tag_name().name().to_string()]));
    }
    sem_use_encadeado(&doc)?;
    let mut saida = String::with_capacity(texto.len());
    escrever(raiz, 0, &mut saida)?;
    Ok(saida)
}

fn e_use(no: &Node) -> bool {
    no.is_element() && no.tag_name().name() == "use"
}

/// O primeiro elemento de cada `id` do documento.
fn elementos_por_id<'a, 'i>(doc: &'a Document<'i>) -> HashMap<&'a str, Node<'a, 'i>> {
    let mut por_id = HashMap::new();
    for n in doc.descendants().filter(|n| n.is_element()) {
        if let Some(id) = n.attribute("id") {
            por_id.entry(id).or_insert(n);
        }
    }
    por_id
}

/// Comentário e instrução de processamento fora do elemento raiz: recusados.
fn sem_comentario_na_raiz(doc: &Document) -> Result<(), String> {
    for no in doc.root().children() {
        match no.node_type() {
            NodeType::Comment => return Err(erro("svg_comentario", &[])),
            NodeType::PI => return Err(erro("svg_instrucao", &[])),
            _ => {}
        }
    }
    Ok(())
}

/// Recusa o `<use>` cujo alvo é, ou contém, outro `<use>`. O navegador resolve cada `<use>` copiando o alvo; um alvo que também usa
/// outros alvos faz o desenho crescer em cadeia (a conta explode com poucos nós) e trava a página. Os SVGs do Verovio só apontam
/// para `<symbol>` ou `<g>` sem `<use>` dentro.
fn sem_use_encadeado(doc: &Document) -> Result<(), String> {
    let por_id = elementos_por_id(doc);
    for uso in doc.descendants().filter(e_use) {
        let Some(id) = uso.attribute("href").and_then(|h| h.strip_prefix('#')) else {
            continue;
        };
        if let Some(alvo) = por_id.get(id)
            && alvo.descendants().any(|n| e_use(&n))
        {
            return Err(erro("svg_use_encadeado", &[id.to_string()]));
        }
    }
    Ok(())
}

fn escrever(no: Node, nivel: usize, saida: &mut String) -> Result<(), String> {
    let nome = conferir_elemento(no, nivel)?;
    saida.push('<');
    saida.push_str(nome);
    if nivel == 0 {
        saida.push_str(&format!(" xmlns=\"{NS_SVG}\""));
    }
    escrever_atributos(no, nome, nivel, saida)?;
    if nivel == 0 {
        saida.push_str(" overflow=\"hidden\"");
    }
    saida.push('>');
    escrever_filhos(no, nome, nivel, saida)?;
    saida.push_str("</");
    saida.push_str(nome);
    saida.push('>');
    Ok(())
}

/// Profundidade, espaço de nomes e lista de elementos permitidos. Devolve o nome do elemento.
fn conferir_elemento<'a>(no: Node<'a, '_>, nivel: usize) -> Result<&'a str, String> {
    if nivel > LIMITE_PROFUNDIDADE {
        return Err(erro("svg_fundo", &[]));
    }
    let nome = no.tag_name().name();
    if no.tag_name().namespace() != Some(NS_SVG) {
        return Err(erro("svg_espaco", &[nome.to_string()]));
    }
    if !ELEMENTOS.contains(&nome) {
        return Err(erro("svg_elemento", &[nome.to_string()]));
    }
    Ok(nome)
}

fn escrever_atributos(
    no: Node,
    nome: &str,
    nivel: usize,
    saida: &mut String,
) -> Result<(), String> {
    for a in no.attributes() {
        let completo = nome_do_atributo(&a, nome)?;
        if !ATRIBUTOS.contains(&completo.as_str()) {
            return Err(erro("svg_atributo", &[completo, nome.to_string()]));
        }
        if nivel == 0 && !atributo_do_raiz(&completo)? {
            continue;
        }
        let valor = valor_final(&completo, a.value())
            .map_err(|m| erro("svg_valor", &[completo.clone(), nome.to_string(), m]))?;
        saida.push(' ');
        saida.push_str(&completo);
        saida.push_str("=\"");
        escapar(&valor, true, saida);
        saida.push('"');
    }
    Ok(())
}

/// O nome do atributo como sai na página: sem espaço de nomes, ou `xml:...`. Outro espaço de nomes é recusado.
fn nome_do_atributo(a: &Attribute, elemento: &str) -> Result<String, String> {
    match a.namespace() {
        None => Ok(a.name().to_string()),
        Some(NS_XML) => Ok(format!("xml:{}", a.name())),
        Some(_) => Err(erro(
            "svg_atributo_espaco",
            &[a.name().to_string(), elemento.to_string()],
        )),
    }
}

/// Regras do `<svg>` raiz: `overflow` é decidido pelo app (falso: pula o atributo), `class` e `transform` são recusados.
fn atributo_do_raiz(completo: &str) -> Result<bool, String> {
    match completo {
        "overflow" => Ok(false),
        "class" | "transform" => Err(erro("svg_atributo_raiz", &[completo.to_string()])),
        _ => Ok(true),
    }
}

fn escrever_filhos(no: Node, nome: &str, nivel: usize, saida: &mut String) -> Result<(), String> {
    for filho in no.children() {
        match filho.node_type() {
            // O CSS do pacote é descartado (ver o cabeçalho): quem o escreveu não decide nada na página.
            NodeType::Element if is_style(filho) => {}
            NodeType::Element => escrever(filho, nivel + 1, saida)?,
            NodeType::Text => escrever_texto(filho.text().unwrap_or(""), nome, saida)?,
            NodeType::Comment => return Err(erro("svg_comentario", &[])),
            NodeType::PI => return Err(erro("svg_instrucao", &[])),
            NodeType::Root => {}
        }
    }
    Ok(())
}

/// Em `<text>` e `<tspan>` o espaço entre os filhos é mantido (faz parte de como o texto é desenhado); nos demais, só pode haver espaço.
fn escrever_texto(texto: &str, nome: &str, saida: &mut String) -> Result<(), String> {
    if COM_TEXTO.contains(&nome) {
        escapar(texto, false, saida);
    } else if !texto.trim().is_empty() {
        return Err(erro("svg_texto", &[nome.to_string()]));
    }
    Ok(())
}

/// `<style>` do espaço de nomes do SVG (um `<style>` de outro espaço de nomes não é descartado: é recusado em `escrever`).
fn is_style(no: Node) -> bool {
    no.tag_name().name() == "style" && no.tag_name().namespace() == Some(NS_SVG)
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
                motivo.contains("svg_elemento") || motivo.contains("svg_espaco"),
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
            assert!(motivo.contains("svg_atributo"), "{attr} -> {motivo}");
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
        assert!(motivo.contains("svg_atributo_espaco"), "{motivo}");
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
            assert!(motivo.contains("svg_atributo"), "{attr} -> {motivo}");
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
            assert!(
                motivo.contains("svg_valor") && motivo.contains("svg_valor_id"),
                "{id:?} -> {motivo}"
            );
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
            assert!(motivo.contains("svg_atributo_raiz"), "{attr} -> {motivo}");
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
            recusa(r#"<!-- x --><svg xmlns="http://www.w3.org/2000/svg"/>"#)
                .contains("svg_comentario")
        );
        assert!(recusa(&svg("<g><!-- x --></g>")).contains("svg_comentario"));
        assert!(
            recusa(r#"<svg xmlns="http://www.w3.org/2000/svg"/><?pi x?>"#)
                .contains("svg_instrucao")
        );
        assert!(recusa(&svg("<g><?pi x?></g>")).contains("svg_instrucao"));
        // a declaração <?xml ...?> do começo é normal e não conta como instrução
        assert!(
            limpar(r#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>"#).is_ok()
        );
    }

    #[test]
    fn recusa_raiz_e_espaco_de_nomes_errados() {
        assert!(recusa(r#"<html xmlns="http://www.w3.org/1999/xhtml"/>"#).contains("svg_raiz"));
        assert!(recusa("<svg/>").contains("svg_espaco"));
        assert!(recusa(r#"<svg xmlns="http://evil/ns"/>"#).contains("svg_espaco"));
        assert!(
            recusa(&svg(r#"<body xmlns="http://www.w3.org/1999/xhtml"/>"#)).contains("svg_espaco")
        );
        assert!(
            recusa(&svg(
                r#"<svg xmlns="http://www.w3.org/2000/svg"><g xmlns="http://evil/ns"/></svg>"#
            ))
            .contains("svg_espaco")
        );
    }

    #[test]
    fn recusa_use_que_aponta_para_alvo_com_outro_use() {
        // use -> g que contém use (encadeado) e use -> use (o alvo é ele mesmo um <use>)
        let encadeado = svg(
            "<defs><symbol id=\"a\"><path d=\"M0 0\"/></symbol><g id=\"b\"><use href=\"#a\"/></g></defs><use href=\"#b\"/>",
        );
        assert!(
            recusa(&encadeado).contains("svg_use_encadeado"),
            "{}",
            recusa(&encadeado)
        );
        let direto = svg(
            "<defs><symbol id=\"a\"><path d=\"M0 0\"/></symbol><use id=\"b\" href=\"#a\"/></defs><use href=\"#b\"/>",
        );
        assert!(recusa(&direto).contains("svg_use_encadeado"));
    }

    #[test]
    fn aceita_use_que_aponta_para_symbol_sem_use() {
        let ok = svg(
            "<defs><symbol id=\"a\"><path d=\"M0 0\"/></symbol></defs><use href=\"#a\"/><use href=\"#a\"/>",
        );
        assert!(limpar(&ok).is_ok());
    }

    #[test]
    fn recusa_texto_solto_fora_de_text() {
        assert!(recusa(&svg("<g>oi</g>")).contains("svg_texto"));
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
            assert!(recusa(t).contains("svg_xml"), "{t}");
        }
    }

    #[test]
    fn limita_a_profundidade() {
        let fundo = |n: usize| svg(&format!("{}{}", "<g>".repeat(n), "</g>".repeat(n)));
        assert!(limpar(&fundo(LIMITE_PROFUNDIDADE)).is_ok());
        assert!(recusa(&fundo(LIMITE_PROFUNDIDADE + 1)).contains("svg_fundo"));
    }

    #[test]
    fn limita_a_quantidade_de_nos() {
        let tres = svg("<g/><g/>");
        assert!(limpar_com(&tres, 100).is_ok());
        assert!(recusa_com(&tres, 2).contains("svg_xml"));
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
