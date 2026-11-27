//! A sincronia da letra (karaokê): o instante de cada marca na régua de cada passada.

use crate::coro::{CORO, FINAL};
use crate::modelo::{EstrofeSinc, Marca, Trecho, arredondar};
use std::collections::BTreeMap;

/// Instante da partitura na régua de uma passada (as notas dela, sem buracos), ou `None` se esse trecho não toca nela.
pub(crate) fn instante_na_passada(
    t: f64,
    segmentos: &[(usize, usize)],
    inicios: &[f64],
) -> Option<f64> {
    const EPS: f64 = 1e-6;
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let (t0, t1) = (inicios[de], inicios[ate]);
        if t >= t0 - EPS && t < t1 - EPS {
            return Some(t - t0 + acumulado);
        }
        acumulado += t1 - t0;
    }
    None
}

/// Agrupa as marcas por estrofe e linha, com o tempo na régua da passada. Estrofes sem nenhum trecho nessa passada
/// ficam de fora; linhas sem trecho ficam vazias (o índice continua o da letra).
pub(crate) fn estrofes_da_passada(
    marcas: &[Marca],
    segmentos: &[(usize, usize)],
    inicios: &[f64],
) -> Vec<EstrofeSinc> {
    let mut linhas_por_verso: BTreeMap<u32, usize> = BTreeMap::new();
    for m in marcas {
        let n = linhas_por_verso.entry(m.verso).or_insert(0);
        *n = (*n).max(m.linha + 1);
    }
    let mut saida = vec![];
    for (&verso, &n_linhas) in &linhas_por_verso {
        let mut linhas: Vec<Vec<Trecho>> = vec![vec![]; n_linhas];
        let mut algum = false;
        for m in marcas.iter().filter(|m| m.verso == verso) {
            if let Some(t) = instante_na_passada(m.t, segmentos, inicios) {
                linhas[m.linha].push((arredondar(t), m.de, m.ate));
                algum = true;
            }
        }
        if algum {
            saida.push(EstrofeSinc {
                estrofe: if verso == CORO || verso == FINAL {
                    0
                } else {
                    verso + 1
                },
                linhas,
            });
        }
    }
    saida
}
