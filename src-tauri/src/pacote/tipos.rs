//! Os tipos da importação do pacote de partituras (ver `pacote.rs`): os limites, o resultado, as variantes de cada partitura e as falhas.

use crate::hinario::{Pacote, erro};
use serde::Serialize;

pub(super) const MIB: u64 = 1024 * 1024;

/// Os limites da importação. O pacote de 480 hinos tem uns 90 MB descompactados e uns 15 MB no zip (ver docs/roadmap-ideas.md).
pub struct Limites {
    /// Bytes do próprio `.zip`.
    pub zip: usize,
    pub entradas: usize,
    /// Soma dos bytes descompactados (todos os SVG).
    pub descompactado: u64,
    /// Bytes de cada SVG.
    pub svg: u64,
}

impl Default for Limites {
    fn default() -> Self {
        Limites {
            zip: 150 * MIB as usize,
            entradas: 2_000,
            descompactado: 300 * MIB,
            svg: 8 * MIB,
        }
    }
}

/// Uma partitura do zip que não entrou, e por quê (o resto do pacote entra).
#[derive(Debug, Serialize, PartialEq)]
pub struct Recusada {
    pub numero: u32,
    pub motivo: String,
}

#[derive(Debug, Serialize)]
pub struct Importacao {
    pub pacote: Pacote,
    /// Quantas partituras foram importadas.
    pub partituras: u32,
    pub recusadas: Vec<Recusada>,
}

/// Cada partitura tem até duas versões, desenhadas para larguras de tela diferentes (o SVG é pré-desenhado: as quebras de linha são fixas,
/// então um celular em pé e um deitado pedem larguras de página diferentes). O retrato é obrigatório; a paisagem é opcional.
/// A ordem (retrato antes de paisagem) importa: a paisagem só entra se o retrato do mesmo hino entrou.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Variante {
    Retrato,
    Paisagem,
}

impl Variante {
    /// O nome do arquivo no disco e dentro do zip (sem a pasta): `hino-283.svg` ou `hino-283-paisagem.svg`.
    pub(super) fn arquivo(self, numero: u32) -> String {
        match self {
            Variante::Retrato => format!("hino-{numero}.svg"),
            Variante::Paisagem => format!("hino-{numero}-paisagem.svg"),
        }
    }
}

#[derive(Debug, PartialEq)]
pub(super) enum Entrada {
    Pasta,
    Svg(u32, Variante),
}

pub(super) fn invalido(e: impl ToString) -> String {
    erro("zip_invalido", &[e.to_string()])
}

pub(super) fn gravar(e: impl ToString) -> String {
    erro("partituras_gravar", &[e.to_string()])
}

pub(super) enum Falha {
    GrandeDemais,
    Zip(String),
}
