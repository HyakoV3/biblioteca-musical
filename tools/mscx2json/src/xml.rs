//! Leitura de baixo nível do XML do MuseScore: filhos, números, durações, ligaduras e textos.

use roxmltree::{Document, Node};

pub(crate) fn filho<'a, 'i>(n: Node<'a, 'i>, nome: &str) -> Option<Node<'a, 'i>> {
    n.children()
        .find(|c| c.is_element() && c.tag_name().name() == nome)
}

pub(crate) fn texto<'a, 'i>(n: Node<'a, 'i>, nome: &str) -> Option<&'a str> {
    filho(n, nome).and_then(|c| c.text()).map(str::trim)
}

pub(crate) fn numero<T: std::str::FromStr>(n: Node, nome: &str) -> Option<T> {
    texto(n, nome).and_then(|s| s.parse().ok())
}

/// "3/4" -> batidas (semínima = 1).
pub(crate) fn fracao(s: &str) -> Option<f64> {
    let (a, b) = s.split_once('/')?;
    let (a, b): (f64, f64) = (a.trim().parse().ok()?, b.trim().parse().ok()?);
    (b != 0.0).then(|| a / b * 4.0)
}

pub(crate) fn batidas_do_tipo(t: &str) -> Option<f64> {
    Some(match t {
        "long" => 16.0,
        "breve" => 8.0,
        "whole" => 4.0,
        "half" => 2.0,
        "quarter" => 1.0,
        "eighth" => 0.5,
        "16th" => 0.25,
        "32nd" => 0.125,
        "64th" => 0.0625,
        "128th" => 0.03125,
        _ => return None,
    })
}

pub(crate) fn duracao(n: Node, compasso: f64) -> Result<f64, String> {
    let tipo = texto(n, "durationType").ok_or("nota ou pausa sem <durationType>")?;
    if tipo == "measure" {
        return Ok(texto(n, "duration").and_then(fracao).unwrap_or(compasso));
    }
    let base = batidas_do_tipo(tipo).ok_or_else(|| format!("durationType desconhecido: {tipo}"))?;
    let pontos: i32 = numero(n, "dots").unwrap_or(0);
    Ok(base * (2.0 - 0.5f64.powi(pontos)))
}

pub(crate) fn e_apojatura(chord: Node) -> bool {
    chord.children().any(|c| {
        let nome = c.tag_name().name();
        c.is_element()
            && (nome.starts_with("grace") || nome == "acciaccatura" || nome == "appoggiatura")
    })
}

/// Um `<Spanner type="Tie">` com o filho `lado` (`next` abre a ligadura, `prev` a fecha).
fn spanner_de_ligadura(c: Node, lado: &str) -> bool {
    c.attribute("type") == Some("Tie") && filho(c, lado).is_some()
}

/// Algum elemento filho da nota satisfaz `f`, que recebe o filho e o nome da sua tag.
fn algum_elemento_filho(nota: Node, f: impl Fn(Node, &str) -> bool) -> bool {
    nota.children()
        .any(|c| c.is_element() && f(c, c.tag_name().name()))
}

pub(crate) fn liga_inicio(nota: Node) -> bool {
    algum_elemento_filho(nota, |c, nome| match nome {
        "Spanner" => spanner_de_ligadura(c, "next"),
        "Tie" => true,
        _ => false,
    })
}

/// Alguma nota do arquivo abre uma ligadura (`<Tie id="...">` dentro de `<Note>`) com este `id`?
pub(crate) fn abre_ligadura_com_id(nota: Node, id: &str) -> bool {
    nota.document().descendants().any(|d| {
        d.has_tag_name("Tie")
            && d.attribute("id") == Some(id)
            && d.parent().is_some_and(|p| p.has_tag_name("Note"))
    })
}

pub(crate) fn liga_fim(nota: Node) -> bool {
    algum_elemento_filho(nota, |c, nome| match nome {
        "Spanner" => spanner_de_ligadura(c, "prev"),
        "endTie" => true,
        // MuseScore 2: o fim da ligadura é um `<endSpanner id="N"/>` dentro da nota, e o `N` é o `<Tie id="N">` de uma nota
        // anterior. Outros spanners ancorados em nota (glissando, linha de nota) também fecham assim, por isso só vale o
        // `id` que abriu uma ligadura.
        "endSpanner" => c
            .attribute("id")
            .is_some_and(|id| abre_ligadura_com_id(nota, id)),
        _ => false,
    })
}

/// Todo o texto dentro de um elemento, sem espaços repetidos. Entende o texto rico do MuseScore:
/// - trechos com formatação (`<i>`, `<b>`...) entram inteiros;
/// - o símbolo de **elisão** (`<sym>lyricsElision...</sym>`, duas palavras cantadas numa nota só,
///   como "go‿es") vira um espaço: "go es";
/// - o nome de qualquer outro símbolo (`<sym>...</sym>`) é ignorado, para não vazar no texto.
pub(crate) fn texto_completo(n: Node) -> String {
    let mut s = String::new();
    for d in n.descendants() {
        if d.is_text() {
            if d.parent().is_some_and(|p| p.has_tag_name("sym")) {
                continue; // nome do símbolo, não é texto
            }
            s.push_str(d.text().unwrap_or(""));
        } else if d.has_tag_name("sym")
            && d.text()
                .is_some_and(|t| t.trim().starts_with("lyricsElision"))
        {
            s.push(' ');
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Tira um número de estrofe escrito no começo do texto ("1. Pa" -> "Pa"): o app já numera as estrofes.
pub(crate) fn sem_numero_inicial(s: &str) -> &str {
    let t = s.trim_start();
    let digitos = t.chars().take_while(|c| c.is_ascii_digit()).count();
    match t[digitos..].strip_prefix('.') {
        Some(resto) if digitos > 0 => resto.trim_start(),
        _ => s,
    }
}

/// Textos de moldura (`<Text>` com `<style>` igual a um dos estilos pedidos), na ordem do arquivo.
pub(crate) fn texto_de_estilo(doc: &Document, estilos: &[&str]) -> Vec<String> {
    let mut achados: Vec<(usize, String)> = vec![];
    for n in doc.descendants().filter(|n| n.has_tag_name("Text")) {
        let Some(estilo) = texto(n, "style") else {
            continue;
        };
        let Some(pos) = estilos.iter().position(|e| *e == estilo) else {
            continue;
        };
        if let Some(t) = filho(n, "text") {
            let t = texto_completo(t);
            if !t.is_empty() {
                achados.push((pos, t));
            }
        }
    }
    // Primeiro por ordem dos estilos pedidos (ex.: letrista antes de compositor), mantendo a do arquivo.
    achados.sort_by_key(|(pos, _)| *pos);
    achados.into_iter().map(|(_, t)| t).collect()
}
