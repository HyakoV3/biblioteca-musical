//! A preparação das partituras (ver `pacote.rs`): limpa cada SVG do zip e grava os aceitos numa pasta de preparo, um por vez, para não segurar tudo na memória.

use super::disco::sem_erro_se_nao_existe;
use super::entradas::{Svg, ler_entrada};
use super::tipos::{Falha, Limites, MIB, Recusada, Variante, gravar, invalido};
use crate::hinario::erro;
use crate::svg;
use std::collections::HashSet;
use std::io::Cursor;
use std::path::Path;
use zip::ZipArchive;

/// O que a preparação precisa saber: as partituras do zip, os hinos do hinário, a pasta de preparo, a marca e os limites.
pub(super) struct Preparo<'a> {
    pub svgs: &'a [Svg],
    pub hinos: &'a HashSet<u32>,
    pub novo: &'a Path,
    pub marca: &'a str,
    pub lim: &'a Limites,
}

/// O que já se sabe durante a preparação.
#[derive(Default)]
struct Estado {
    /// Os hinos cujo RETRATO entrou (é o que conta como "partitura instalada").
    aceitas: Vec<u32>,
    recusadas: Vec<Recusada>,
    /// Bytes descompactados até agora (o total tem limite).
    lido: u64,
}

/// O que fazer com uma partitura do zip, antes de lê-la.
enum Destino {
    /// Pulada em silêncio (o motivo já está nas recusadas).
    Pular,
    Recusar(String),
    Tratar,
}

/// Limpa cada SVG e grava os aceitos na pasta de preparo. Devolve os hinos aceitos e as recusadas.
pub(super) fn preparar(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    p: &Preparo,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<(Vec<u32>, Vec<Recusada>), String> {
    sem_erro_se_nao_existe(std::fs::remove_dir_all(p.novo)).map_err(gravar)?; // sobra de uma importação interrompida
    std::fs::create_dir(p.novo).map_err(gravar)?;
    let mut estado = Estado::default();
    let mut ordem = p.svgs.to_vec();
    ordem.sort_unstable(); // por hino e, dentro dele, o retrato antes da paisagem
    let total = ordem.len() as u32;
    for (pos, svg) in ordem.into_iter().enumerate() {
        // Avisa a cada 10 partituras (são ~960: perto de cem avisos, sem encher o canal).
        if pos % 10 == 0 {
            progresso(pos as u32, total);
        }
        if let Some(motivo) = tratar(zip, p, &mut estado, svg)? {
            estado.recusadas.push(recusa(svg.0, svg.1, motivo));
        }
    }
    if !estado.aceitas.is_empty() {
        std::fs::write(p.novo.join(".hinario"), p.marca).map_err(gravar)?;
    }
    Ok((estado.aceitas, estado.recusadas))
}

/// A recusa da paisagem diz que é a paisagem (o mesmo número de hino pode aparecer duas vezes na lista).
fn recusa(numero: u32, variante: Variante, motivo: String) -> Recusada {
    Recusada {
        numero,
        motivo: match variante {
            Variante::Retrato => motivo,
            Variante::Paisagem => erro("svg_paisagem", &[motivo]),
        },
    }
}

/// Decide, sem ler o zip, se a partitura é pulada, recusada ou tratada.
fn decidir(numero: u32, variante: Variante, aceitas: &[u32], p: &Preparo) -> Destino {
    // A paisagem de um hino cujo retrato veio no zip e NÃO entrou (o hinário não tem o hino, ou o retrato foi recusado por outro motivo)
    // é pulada em silêncio: o retrato já deixou o hino nas recusadas, com o motivo verdadeiro. Contá-lo duas vezes aparece na tela como
    // "hinos 77, 77".
    let sem_retrato_aceito = variante == Variante::Paisagem && !aceitas.contains(&numero);
    let retrato_no_zip = p
        .svgs
        .iter()
        .any(|&(m, v, _)| m == numero && v == Variante::Retrato);
    if sem_retrato_aceito && retrato_no_zip {
        return Destino::Pular;
    }
    if !p.hinos.contains(&numero) {
        return Destino::Recusar(erro("pacote_sem_hino", &[]));
    }
    // Chegou aqui uma paisagem SEM retrato no zip: recusada, e uma vez só.
    if sem_retrato_aceito {
        return Destino::Recusar(erro("pacote_sem_retrato", &[]));
    }
    Destino::Tratar
}

/// Trata uma partitura: `Ok(None)` se foi aceita (ou pulada), `Ok(Some(motivo))` se foi recusada, `Err` se o pacote inteiro deve ser recusado.
fn tratar(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    p: &Preparo,
    estado: &mut Estado,
    (numero, variante, i): Svg,
) -> Result<Option<String>, String> {
    match decidir(numero, variante, &estado.aceitas, p) {
        Destino::Pular => return Ok(None),
        Destino::Recusar(motivo) => return Ok(Some(motivo)),
        Destino::Tratar => {}
    }
    let texto = match ler_texto(zip, p, estado, i)? {
        Ok(texto) => texto,
        Err(motivo) => return Ok(Some(motivo)),
    };
    match svg::limpar(&texto) {
        Ok(limpo) => {
            std::fs::write(p.novo.join(variante.arquivo(numero)), limpo).map_err(gravar)?;
            if variante == Variante::Retrato {
                estado.aceitas.push(numero);
            }
            Ok(None)
        }
        Err(motivo) => Ok(Some(motivo)),
    }
}

/// Lê a entrada `i` do zip como texto, dentro do limite do SVG e do total descompactado. `Ok(Err(motivo))` é uma recusa só desta partitura.
fn ler_texto(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    p: &Preparo,
    estado: &mut Estado,
    i: usize,
) -> Result<Result<String, String>, String> {
    let bytes = match ler_entrada(zip, i, p.lim.svg) {
        Ok(b) => b,
        Err(Falha::GrandeDemais) => {
            return Ok(Err(erro(
                "pacote_svg_grande",
                &[(p.lim.svg / MIB).to_string()],
            )));
        }
        Err(Falha::Zip(e)) => return Err(invalido(e)),
    };
    estado.lido += bytes.len() as u64;
    if estado.lido > p.lim.descompactado {
        return Err(erro("zip_descompactado_grande", &[]));
    }
    Ok(String::from_utf8(bytes).map_err(|_| erro("pacote_utf8", &[])))
}
