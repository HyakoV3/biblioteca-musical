//! O que o zip tem (ver `pacote.rs`): abre o zip dentro dos limites, classifica cada nome (só os exatos valem) e lê uma entrada cortando no limite.

use super::tipos::{Entrada, Falha, Limites, Variante, invalido};
use crate::hinario::erro;
use std::io::{Cursor, Read};
use zip::ZipArchive;

/// Uma partitura do zip: o número do hino, a variante e a posição da entrada no zip.
pub(super) type Svg = (u32, Variante, usize);

/// Abre o zip dentro dos limites: tamanho, nomes repetidos e quantidade de entradas.
pub(super) fn abrir_zip<'a>(
    bytes: &'a [u8],
    lim: &Limites,
) -> Result<ZipArchive<Cursor<&'a [u8]>>, String> {
    if bytes.len() > lim.zip {
        return Err(erro("zip_grande_demais", &[]));
    }
    let zip = ZipArchive::new(Cursor::new(bytes)).map_err(invalido)?;
    // O índice do zip já junta nomes repetidos numa entrada só (cada leitor escolhe a sua): aqui o pacote é recusado.
    if zip.has_duplicate_names() {
        return Err(erro("zip_repetido", &[]));
    }
    if zip.len() > lim.entradas {
        return Err(erro("zip_muitos_arquivos", &[]));
    }
    Ok(zip)
}

/// 1ª passada: só os nomes e os tamanhos declarados, sem descompactar nada. Devolve as partituras (SVG) do zip.
pub(super) fn listar_svgs(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    lim: &Limites,
) -> Result<Vec<Svg>, String> {
    let mut svgs = Vec::new();
    let mut declarado: u64 = 0;
    for i in 0..zip.len() {
        let f = zip.by_index_raw(i).map_err(invalido)?;
        // Um nome que não é UTF-8 válido nunca é um dos nomes exatos aceitos.
        let nome = match f.name() {
            Ok(n) => n.into_owned(),
            Err(_) => {
                return Err(erro(
                    "zip_inesperado",
                    &[curto(&String::from_utf8_lossy(f.name_raw()))],
                ));
            }
        };
        let tipo = classificar(&nome).ok_or_else(|| erro("zip_inesperado", &[curto(&nome)]))?;
        declarado = declarado.saturating_add(f.size());
        if let Entrada::Svg(n, v) = tipo {
            svgs.push((n, v, i));
        }
    }
    if declarado > lim.descompactado {
        return Err(erro("zip_descompactado_grande", &[]));
    }
    if svgs.is_empty() {
        return Err(erro("partituras_nenhuma", &[]));
    }
    Ok(svgs)
}

/// Só estes nomes valem num pacote. O número é o canônico (sem zero à esquerda, de 1 a 9 dígitos).
pub(super) fn classificar(nome: &str) -> Option<Entrada> {
    if nome == "partituras/" {
        return Some(Entrada::Pasta);
    }
    let resto = nome.strip_prefix("partituras/hino-")?;
    // a paisagem primeiro: "5-paisagem.svg" também termina em ".svg", mas "5-paisagem" não é um número
    let (n, variante) = match resto.strip_suffix("-paisagem.svg") {
        Some(n) => (n, Variante::Paisagem),
        None => (resto.strip_suffix(".svg")?, Variante::Retrato),
    };
    numero_canonico(n).map(|n| Entrada::Svg(n, variante))
}

fn numero_canonico(n: &str) -> Option<u32> {
    let canonico = !n.is_empty()
        && n.len() <= 9
        && n.bytes().all(|b| b.is_ascii_digit())
        && !n.starts_with('0');
    if canonico { n.parse().ok() } else { None }
}

/// Nome do zip encurtado para ir numa mensagem de erro (pode ter qualquer coisa).
pub(super) fn curto(nome: &str) -> String {
    nome.chars().take(60).collect()
}

/// Lê a entrada `i` do zip, cortando no limite (o tamanho do cabeçalho não é confiável).
pub(super) fn ler_entrada(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    i: usize,
    limite: u64,
) -> Result<Vec<u8>, Falha> {
    let arquivo = zip.by_index(i).map_err(|e| Falha::Zip(e.to_string()))?;
    let mut buf = Vec::new();
    arquivo
        .take(limite + 1)
        .read_to_end(&mut buf)
        .map_err(|e| Falha::Zip(e.to_string()))?;
    if buf.len() as u64 > limite {
        return Err(Falha::GrandeDemais);
    }
    Ok(buf)
}
