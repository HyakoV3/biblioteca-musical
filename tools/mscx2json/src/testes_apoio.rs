//! Peças que os testes do conversor dividem: o que vem dos módulos e os documentos de teste.

#![allow(unused_imports)]

pub(crate) use crate::cli::*;
pub(crate) use crate::conserto::*;
pub(crate) use crate::conversao::*;
pub(crate) use crate::coro::*;
pub(crate) use crate::correcoes;
pub(crate) use crate::estrutura::*;
pub(crate) use crate::modelo::*;
pub(crate) use crate::montagem::*;
pub(crate) use crate::partes::*;
pub(crate) use crate::percurso::*;
pub(crate) use crate::saida::*;
pub(crate) use crate::sincronia::*;
pub(crate) use crate::tonalidade::*;
pub(crate) use crate::validacao::*;
pub(crate) use crate::versos::*;
pub(crate) use crate::vozes::*;
pub(crate) use crate::xml::*;
pub(crate) use roxmltree::{Document, Node};
pub(crate) use serde_json::{Map, Value, json};
pub(crate) use std::collections::{BTreeMap, BTreeSet, HashMap};
pub(crate) use std::path::{Path, PathBuf};

pub(crate) fn parte(id: u32, nome: &str) -> String {
    format!(r#"<Part><Staff id="{id}"/><trackName>{nome}</trackName></Part>"#)
}

pub(crate) fn doc(partes: &str, pautas: &str) -> String {
    format!(
        r#"<?xml version="1.0"?><museScore version="3.02"><Score><Division>480</Division>
        <metaTag name="workTitle">Título fictício</metaTag>{partes}{pautas}</Score></museScore>"#
    )
}

pub(crate) fn acorde(tipo: &str, pitch: u8) -> String {
    format!("<Chord><durationType>{tipo}</durationType><Note><pitch>{pitch}</pitch></Note></Chord>")
}

pub(crate) fn pauta(id: u32, compassos: &str) -> String {
    format!(r#"<Staff id="{id}">{compassos}</Staff>"#)
}

pub(crate) fn compasso(corpo: &str) -> String {
    format!("<Measure><voice>{corpo}</voice></Measure>")
}

pub(crate) const C44: &str = "<TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>";

pub(crate) fn notas(h: &Hino, voz: usize) -> Vec<(f64, f64, u8)> {
    h.vozes[voz]
        .notas
        .iter()
        .map(|n| (n.inicio, n.dur, n.midi))
        .collect()
}

pub(crate) fn compasso_ms2(corpo: &str, extra_voz: &str) -> String {
    format!("<Measure>{corpo}{extra_voz}</Measure>")
}

// --- Quebra de linha por VERSO (a partitura respira também no meio do verso). Tudo com texto fictício. ---

pub(crate) fn silaba_de(t: f64, texto: &str, continua: bool) -> Silaba {
    Silaba {
        t,
        voz: 0,
        verso: 0,
        continua,
        quebra_antes: false,
        texto: texto.to_string(),
    }
}

/// Sílabas de uma estrofe, de 1 em 1 batida, e as respirações logo antes das palavras de índice `antes` (em batidas - 0,5).
pub(crate) fn estrofe_com_respiracoes(
    palavras: &[&str],
    antes: &[usize],
) -> (Vec<Silaba>, Vec<f64>) {
    let silabas = palavras
        .iter()
        .enumerate()
        .map(|(i, w)| silaba_de(i as f64, w, false))
        .collect();
    (silabas, antes.iter().map(|&i| i as f64 - 0.5).collect())
}

pub(crate) fn texto_moldura(estilo: &str, t: &str) -> String {
    format!("<Text><style>{estilo}</style><text>{t}</text></Text>")
}

/// Documento sem metaTag, só com a moldura informada e uma nota (para testar título e autoria).
pub(crate) fn doc_com_moldura(moldura: &str) -> String {
    let nota = format!("{C44}{}", acorde("whole", 60));
    format!(
        r#"<?xml version="1.0"?><museScore version="2.06"><Score><Division>480</Division>{moldura}{}{}</Score></museScore>"#,
        parte(1, "S"),
        pauta(1, &compasso(&nota))
    )
}

/// Compasso de uma semibreve em 4/4 (4 batidas) com marcas extras de repetição/volta.
pub(crate) fn comp_marcado(extra: &str, pitch: u8) -> String {
    format!(
        "<Measure>{extra}<voice>{C44}{}</voice></Measure>",
        acorde("whole", pitch)
    )
}

/// Mesma estrutura do hino 457: repetição do compasso 1, fim de repetição + 1ª casa no 3, 2ª casa no 4
/// e trecho final (5 e 6).
pub(crate) fn hino_com_final() -> String {
    let medidas = [
        comp_marcado("<startRepeat/>", 60),
        comp_marcado("", 62),
        comp_marcado(
            r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
            64,
        ),
        comp_marcado(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            65,
        ),
        comp_marcado(r#"<endSpanner id="2"/>"#, 67),
        comp_marcado("", 69),
    ]
    .concat();
    doc(&parte(1, "S"), &pauta(1, &medidas))
}

pub(crate) fn notas_de(vozes: &[Voz], i: usize) -> Vec<(f64, f64, u8)> {
    vozes[i]
        .notas
        .iter()
        .map(|n| (n.inicio, n.dur, n.midi))
        .collect()
}

/// Dois compassos de 4/4; no 2º, uma mínima, o texto de pauta "*" e outra mínima (o "*" é escrito sobre a 2ª mínima, a última nota da introdução).
pub(crate) fn hino_com_asterisco() -> String {
    let marca = "<StaffText><text>*</text></StaffText>";
    let m1 = comp_marcado("", 60);
    let m2 = format!(
        "<Measure><voice>{C44}{}{marca}{}</voice></Measure>",
        acorde("half", 62),
        acorde("half", 64)
    );
    doc(&parte(1, "S"), &pauta(1, &[m1, m2].concat()))
}

/// Sílaba como no MuseScore 2; `texto_xml` pode ter formatação interna (ex.: `<sym>`).
pub(crate) fn sil(sy: &str, texto_xml: &str) -> String {
    let sy = if sy.is_empty() {
        String::new()
    } else {
        format!("<syllabic>{sy}</syllabic>")
    };
    format!("<Lyrics>{sy}<text>{texto_xml}</text></Lyrics>")
}

pub(crate) fn acorde_letra(pitch: u8, letras: &str) -> String {
    format!(
        "<Chord><durationType>quarter</durationType>{letras}<Note><pitch>{pitch}</pitch></Note></Chord>"
    )
}
