//! A conversão de um arquivo `.mscx` para o hino.

use crate::correcoes::Correcao;
use crate::leitura::{Leitura, PartesDasPautas};
use crate::modelo::Hino;
use crate::xml::{filho, texto};
use roxmltree::{Document, Node};

#[cfg(test)]
pub fn converter(xml: &str, numero_hino: u32) -> Result<Hino, String> {
    converter_com(xml, numero_hino, &[])
}

/// O nome da parte de cada pauta: id da pauta -> (nome, posição na parte, total de pautas).
fn partes_das_pautas<'a>(score: Node<'a, '_>) -> PartesDasPautas<'a> {
    let mut info = PartesDasPautas::new();
    for parte in score.children().filter(|c| c.has_tag_name("Part")) {
        let nome = texto(parte, "trackName")
            .filter(|s| !s.is_empty())
            .or_else(|| filho(parte, "Instrument").and_then(|i| texto(i, "longName")))
            .unwrap_or("")
            .to_string();
        let pautas: Vec<_> = parte
            .children()
            .filter(|c| c.has_tag_name("Staff"))
            .collect();
        for (i, p) in pautas.iter().enumerate() {
            if let Some(id) = p.attribute("id") {
                info.insert(id, (nome.clone(), i + 1, pautas.len()));
            }
        }
    }
    info
}

/// Ticks por semínima (`<Division>`; 480 se faltar).
fn ler_divisao(score: Node) -> f64 {
    filho(score, "Division")
        .and_then(|d| d.text())
        .and_then(|t| t.trim().parse().ok())
        .unwrap_or(480.0)
}

/// Como `converter`, aplicando antes as correções da letra desse hino (arquivo de correções; ver `correcoes.rs`).
pub fn converter_com(xml: &str, numero_hino: u32, ajustes: &[Correcao]) -> Result<Hino, String> {
    let doc = Document::parse(xml).map_err(|e| format!("XML inválido: {e}"))?;
    let score = doc
        .descendants()
        .find(|n| n.has_tag_name("Score"))
        .ok_or("não parece um arquivo MuseScore (.mscx): falta <Score>")?;
    let mut leitura = Leitura::nova(
        partes_das_pautas(score),
        ajustes,
        numero_hino,
        ler_divisao(score),
    );
    let pautas = score
        .children()
        .filter(|c| c.has_tag_name("Staff") && c.children().any(|m| m.has_tag_name("Measure")));
    for (idx_pauta, pauta) in pautas.enumerate() {
        leitura.ler_pauta(idx_pauta, pauta)?;
    }
    leitura.concluir(&doc)
}
