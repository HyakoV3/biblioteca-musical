//! Os recortes da partitura por passada: acordes, compassos e a introdução.

use crate::modelo::{Evento, InicioDeCompasso, Voz, arredondar};
use crate::percurso::Acorde;

const EPS: f64 = 1e-6;

/// Recorta os acordes que começam em cada intervalo de compassos e os recoloca em sequência, sem buracos.
pub(crate) fn selecionar(
    acordes: &[Acorde],
    inicios: &[f64],
    segmentos: &[(usize, usize)],
) -> Vec<Acorde> {
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let (t0, t1) = (inicios[de], inicios[ate]);
        let primeiro = saida.len();
        for a in acordes
            .iter()
            .filter(|a| a.inicio >= t0 - EPS && a.inicio < t1 - EPS)
        {
            let mut novo = a.clone();
            novo.inicio = a.inicio - t0 + acumulado;
            novo.dur = a.dur.min(t1 - a.inicio);
            saida.push(novo);
        }
        cortar_ligaduras_do_segmento(&mut saida[primeiro..]);
        acumulado += t1 - t0;
    }
    saida
}

/// O acorde seguinte tem uma nota `midi` que termina uma ligadura?
fn continua_a_ligadura(seguinte: &[(u8, bool, bool)], midi: u8) -> bool {
    seguinte.iter().any(|&(m, termina, _)| m == midi && termina)
}

/// Uma ligadura que sai do último acorde de um segmento não continua no próximo segmento (que não é o que vem depois na partitura): sem isto, ela
/// engoliria a primeira nota igual do trecho seguinte (a 1ª nota da 2ª casa, por exemplo). Tira a marca de "começa ligadura" das notas cujo acorde
/// seguinte, DENTRO do segmento, não continua a ligadura (ou que não têm acorde seguinte).
pub(crate) fn cortar_ligaduras_do_segmento(acordes: &mut [Acorde]) {
    for i in 0..acordes.len() {
        let seguinte = acordes.get(i + 1).map(|a| a.notas.clone());
        let seguinte = seguinte.unwrap_or_default();
        for nota in acordes[i].notas.iter_mut() {
            nota.2 = nota.2 && continua_a_ligadura(&seguinte, nota.0);
        }
    }
}

/// O instante em que cada compasso dos `segmentos` começa na passada montada por `selecionar`: o mesmo deslocamento de cada intervalo
/// (`inicio - t0 + acumulado`), para o compasso cair exatamente onde as suas notas caem. Os índices são os do compasso ESCRITO.
pub(crate) fn compassos_da_passada(
    inicios: &[f64],
    segmentos: &[(usize, usize)],
) -> Vec<InicioDeCompasso> {
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let t0 = inicios[de];
        for (i, &inicio) in inicios.iter().enumerate().take(ate).skip(de) {
            saida.push((arredondar(inicio - t0 + acumulado), i));
        }
        acumulado += inicios[ate] - t0;
    }
    saida
}

/// Os compassos da introdução: os que começam antes do marcador `*` (`fim_intro`, em batidas). O compasso que contém o `*` entra, porque
/// começa antes dele. A introdução é o começo da passada normal, então a régua é a mesma.
pub(crate) fn compassos_da_introducao(inicios: &[f64], fim_intro: f64) -> Vec<InicioDeCompasso> {
    (0..inicios.len().saturating_sub(1))
        .take_while(|&i| inicios[i] < fim_intro - EPS)
        .map(|i| (arredondar(inicios[i]), i))
        .collect()
}

/// O começo de uma voz, até `ate` batidas: as notas que começam antes entram, e as que atravessam o corte são encurtadas.
fn recortar_voz(v: &Voz, ate: f64) -> Voz {
    let notas = v
        .notas
        .iter()
        .filter(|n| n.inicio < ate - EPS)
        .map(|n| Evento {
            inicio: n.inicio,
            dur: n.dur.min(ate - n.inicio),
            midi: n.midi,
        })
        .collect();
    Voz {
        nome: v.nome.clone(),
        notas,
    }
}

/// Recorta o começo de cada voz, até `ate` batidas: notas que começam antes entram, e as que atravessam o corte
/// são encurtadas. Devolve `None` se não sobrar nenhuma nota.
pub(crate) fn recortar_inicio(vozes: &[Voz], ate: f64) -> Option<Vec<Voz>> {
    let recorte: Vec<Voz> = vozes.iter().map(|v| recortar_voz(v, ate)).collect();
    recorte
        .iter()
        .any(|v| !v.notas.is_empty())
        .then_some(recorte)
}
